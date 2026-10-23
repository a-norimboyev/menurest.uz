import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from './auth.constants.js';
import { Role, getPermissionsForRoles, canAssignRole, type Permission } from '@menurest/shared';
import { checkRateLimit, resetRateLimit } from './rateLimiter.js';
import { recordOutboxEvent, outboxService } from '../realtime/outbox.service.js';
import { realtimeService } from '../realtime/realtime.service.js';

export interface SessionPayload {
  userId: string;
  activeRestaurantId?: string;
  tokenVersion: number;
  membershipTokenVersion?: number;
}

export class AuthService {
  /**
   * Xodim tizimga kirishi
   */
  async login(phone: string, password: string, ipAddress: string) {
    const rateLimitKey = `login:${ipAddress}:${phone}`;
    const rateCheck = checkRateLimit(rateLimitKey, 5, 60);

    if (!rateCheck.allowed) {
      await prisma.auditLog.create({
        data: {
          action: 'AUTH_RATE_LIMIT_EXCEEDED',
          entityName: 'User',
          reason: `Kirish urinishlari soni cheklovdan oshdi. Qayta urinish: ${rateCheck.resetSeconds} soniya`,
          ipAddress,
        },
      });
      throw {
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Kirish urinishlari ko'payib ketdi. Iltimos, ${rateCheck.resetSeconds} soniyadan keyin qayta urining.`,
        details: [{ field: 'retryAfter', issue: `${rateCheck.resetSeconds}s` }],
      };
    }

    // Foydalanuvchini izlash
    const user = await prisma.user.findUnique({
      where: { phone },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            restaurant: true,
            roles: true,
          },
        },
      },
    });

    if (!user || !user.isActive || (!user.isSuperAdmin && user.memberships.length === 0)) {
      await prisma.auditLog.create({
        data: {
          action: 'AUTH_LOGIN_FAILED',
          entityName: 'User',
          reason: !user ? 'Foydalanuvchi topilmadi' : 'Foydalanuvchi faolsizlantirilgan',
          ipAddress,
        },
      });
      throw {
        statusCode: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Telefon raqami yoki parol noto\'g\'ri.',
      };
    }

    // Parolni tekshirish
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'AUTH_LOGIN_FAILED',
          entityName: 'User',
          reason: 'Noto\'g\'ri parol kiritildi',
          ipAddress,
        },
      });
      throw {
        statusCode: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Telefon raqami yoki parol noto\'g\'ri.',
      };
    }

    // Muvaffaqiyatli kirish - rate limitni tozalash
    resetRateLimit(rateLimitKey);

    // Faol restoranni tanlash
    let activeMembership = user.memberships[0];
    const activeRestaurantId = activeMembership ? activeMembership.restaurantId : undefined;

    // Rollar va permissionlarni yig'ish
    const roles: Role[] = activeMembership
      ? activeMembership.roles.map((r) => r.role as Role)
      : user.isSuperAdmin
      ? [Role.SUPER_ADMIN]
      : [];

    const customPerms = (activeMembership as any)?.customPermissions as string[] | { allow?: string[]; deny?: string[] } | null;
    const permissions = getPermissionsForRoles(roles, customPerms);

    // Sessiya JWT yaratish
    const sessionPayload: SessionPayload = {
      userId: user.id,
      activeRestaurantId,
      tokenVersion: user.tokenVersion,
      membershipTokenVersion: activeMembership ? activeMembership.tokenVersion : undefined,
    };

    const sessionToken = jwt.sign(sessionPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    // CSRF token (random UUID)
    const csrfToken = crypto.randomUUID();

    // Audit log (hech qanday parol yoki token saqlanmaydi)
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorRole: roles[0] || 'USER',
        restaurantId: activeRestaurantId,
        action: 'AUTH_LOGIN_SUCCESS',
        entityName: 'User',
        entityId: user.id,
        reason: 'Muvaffaqiyatli tizimga kirdi',
        ipAddress,
      },
    });

    return {
      sessionToken,
      csrfToken,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        isSuperAdmin: user.isSuperAdmin,
      },
      activeRestaurant: activeMembership?.restaurant
        ? {
            id: activeMembership.restaurant.id,
            name: activeMembership.restaurant.name,
            slug: activeMembership.restaurant.slug,
          }
        : null,
      membershipsCount: user.memberships.length,
      roles,
      permissions,
    };
  }

  /**
   * Joriy foydalanuvchi ma'lumotlarini olish
   */
  async getMe(userId: string, activeRestaurantId?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            restaurant: true,
            roles: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw {
        statusCode: 401,
        code: 'AUTH_SESSION_EXPIRED',
        message: 'Foydalanuvchi faol emas yoki sessiya bekor qilingan.',
      };
    }

    let activeMembership = user.memberships.find((m) => m.restaurantId === activeRestaurantId);
    if (!activeMembership && user.memberships.length > 0) {
      activeMembership = user.memberships[0];
    }

    const roles: Role[] = activeMembership
      ? activeMembership.roles.map((r) => r.role as Role)
      : user.isSuperAdmin
      ? [Role.SUPER_ADMIN]
      : [];

    const customPerms = (activeMembership as any)?.customPermissions as string[] | { allow?: string[]; deny?: string[] } | null;
    const permissions = getPermissionsForRoles(roles, customPerms);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        isSuperAdmin: user.isSuperAdmin,
      },
      activeRestaurant: activeMembership?.restaurant
        ? {
            id: activeMembership.restaurant.id,
            name: activeMembership.restaurant.name,
            slug: activeMembership.restaurant.slug,
            isActive: activeMembership.restaurant.isActive,
            suspendedReason: activeMembership.restaurant.suspendedReason,
            subscriptionExpiresAt: activeMembership.restaurant.subscriptionExpiresAt
              ? activeMembership.restaurant.subscriptionExpiresAt.toISOString()
              : null,
          }
        : null,
      availableRestaurants: user.memberships.map((m) => ({
        id: m.restaurant.id,
        name: m.restaurant.name,
        slug: m.restaurant.slug,
        isActive: m.restaurant.isActive,
        roles: m.roles.map((r) => r.role),
      })),
      roles,
      permissions,
    };
  }

  /**
   * Ko'p a'zolikka ega foydalanuvchi tenantni almashtirishi
   */
  async switchRestaurant(userId: string, targetRestaurantId: string, ipAddress: string) {
    const membership = await prisma.restaurantMembership.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId: targetRestaurantId,
          userId,
        },
      },
      include: {
        restaurant: true,
        roles: true,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || (!membership && !user.isSuperAdmin)) {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Ushbu restoranga kirish ruxsatingiz mavjud emas.',
      };
    }

    if (membership && !membership.isActive) {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Ushbu restorandagi xodim a\'zoligingiz faolsizlantirilgan.',
      };
    }

    const roles: Role[] = membership
      ? membership.roles.map((r) => r.role as Role)
      : [Role.SUPER_ADMIN];

    const permissions = getPermissionsForRoles(roles);

    const sessionPayload: SessionPayload = {
      userId,
      activeRestaurantId: targetRestaurantId,
      tokenVersion: user.tokenVersion,
      membershipTokenVersion: membership ? membership.tokenVersion : undefined,
    };

    const sessionToken = jwt.sign(sessionPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    const csrfToken = crypto.randomUUID();

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        restaurantId: targetRestaurantId,
        action: 'AUTH_SWITCH_RESTAURANT',
        entityName: 'Restaurant',
        entityId: targetRestaurantId,
        reason: 'Restoran konteksti almashtirildi',
        ipAddress,
      },
    });

    return {
      sessionToken,
      csrfToken,
      activeRestaurant: membership ? membership.restaurant : { id: targetRestaurantId, name: 'Super Admin Mode' },
      roles,
      permissions,
    };
  }

  /**
   * Parolni o'zgartirish (va boshqa barcha sessiyalarni bekor qilish)
   */
  async changePassword(userId: string, oldPass: string, newPass: string, ipAddress: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Foydalanuvchi topilmadi.',
      };
    }

    const isMatch = await bcrypt.compare(oldPass, user.passwordHash);
    if (!isMatch) {
      throw {
        statusCode: 400,
        code: 'INVALID_CREDENTIALS',
        message: 'Eski parol noto\'g\'ri.',
      };
    }

    if (newPass.length < 8) {
      throw {
        statusCode: 422,
        code: 'VALIDATION_ERROR',
        message: 'Yangi parol kamida 8 ta belgidan iborat bo\'lishi kerak.',
      };
    }

    const newHash = await bcrypt.hash(newPass, 10);

    // tokenVersionni oshirish orqali eski sessiyalarni bekor qilish
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        tokenVersion: { increment: 1 },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'AUTH_PASSWORD_CHANGE',
        entityName: 'User',
        entityId: userId,
        reason: 'Parol muvaffaqiyatli almashtirildi, barcha eski sessiyalar bekor qilindi',
        ipAddress,
      },
    });

    return { success: true, message: 'Parol muvaffaqiyatli o\'zgartirildi.' };
  }

  /**
   * Xodimni faolsizlantirish (va uning sessiyalarini darhol bekor qilish)
   */
  async deactivateStaff(actorUser: any, targetUserId: string, restaurantId: string, ipAddress: string) {
    if (actorUser.id === targetUserId) {
      throw {
        statusCode: 400,
        code: 'SELF_DEACTIVATION_FORBIDDEN',
        message: 'O\'zingizni faolsizlantira olmaysiz.',
      };
    }

    // Target a'zoligini topish
    const membership = await prisma.restaurantMembership.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId,
          userId: targetUserId,
        },
      },
      include: { roles: true },
    });

    if (!membership) {
      throw {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Ushbu xodim ushbu restoranga biriktirilmagan.',
      };
    }

    // Manager Bossni faolsizlantira olmaydi!
    const targetRoles = membership.roles.map((r) => r.role as Role);
    if (targetRoles.includes(Role.BOSS) && !actorUser.roles.includes(Role.SUPER_ADMIN)) {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Boss hisobini faolsizlantirish vakolatingiz yo\'q.',
      };
    }

    // Faolsizlantirish va tokenVersionni oshirish (sessiya bekor qilinadi)
    await prisma.$transaction(async (tx) => {
      await tx.restaurantMembership.update({
        where: { id: membership.id },
        data: {
          isActive: false,
          tokenVersion: { increment: 1 },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorUser.id,
          restaurantId,
          action: 'AUTH_STAFF_DEACTIVATED',
          entityName: 'RestaurantMembership',
          entityId: membership.id,
          reason: `Xodim ${targetUserId} faolsizlantirildi`,
          ipAddress,
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'access.revoked',
        payload: {
          userId: targetUserId,
          restaurantId,
          reason: 'STAFF_DEACTIVATED',
        },
        scope: {
          restaurantId,
          targetUserId,
        },
      });
    });

    outboxService.trigger();
    // Faolsizlantirilgan xodimning barcha faol SSE ulanishlarini serverda darhol yopish
    realtimeService.closeUserConnections(targetUserId);

    return { success: true, message: 'Xodim muvaffaqiyatli faolsizlantirildi.' };
  }

  /**
   * Xodimga rol tayinlash (Eskalatsiyani qat'iy tekshirish bilan!)
   */
  async assignRole(actorUser: any, restaurantId: string, targetUserId: string, newRole: Role, ipAddress: string) {
    // 1. O'ziga o'zi vakolat oshirish bloklanadi!
    if (actorUser.id === targetUserId) {
      throw {
        statusCode: 403,
        code: 'SELF_ESCALATION_FORBIDDEN',
        message: 'O\'zingizga yangi vakolat yoki rol biriktira olmaysiz.',
      };
    }

    // 2. Manager Boss yoki SuperAdmin bera olmaydi!
    if (!canAssignRole(actorUser.roles, newRole)) {
      throw {
        statusCode: 403,
        code: 'PRIVILEGE_ESCALATION_FORBIDDEN',
        message: `Sizning rolingiz ${newRole} vakolatini berish huquqiga ega emas.`,
      };
    }

    const membership = await prisma.restaurantMembership.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId,
          userId: targetUserId,
        },
      },
      include: { roles: true },
    });

    if (!membership) {
      throw {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Xodim restoranda topilmadi.',
      };
    }

    // Agar target allaqachon Boss bo'lsa va aktyor Manager bo'lsa, tegish mumkin emas!
    const isTargetBoss = membership.roles.some((r) => r.role === Role.BOSS);
    if (isTargetBoss && !actorUser.roles.includes(Role.BOSS) && !actorUser.roles.includes(Role.SUPER_ADMIN)) {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Menejer Boss vakolatlarini tahrirlay olmaydi.',
      };
    }

    // Rolni qo'shish
    await prisma.membershipRole.upsert({
      where: {
        membershipId_role: {
          membershipId: membership.id,
          role: newRole,
        },
      },
      update: {},
      create: {
        membershipId: membership.id,
        role: newRole,
      },
    });

    // tokenVersion oshiriladi (xodimning sessiyasidagi ruxsatlar yangilanishi uchun)
    await prisma.restaurantMembership.update({
      where: { id: membership.id },
      data: { tokenVersion: { increment: 1 } },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actorUser.id,
        restaurantId,
        action: 'AUTH_ROLE_ASSIGNED',
        entityName: 'MembershipRole',
        entityId: membership.id,
        reason: `Xodimga ${newRole} roli berildi`,
        ipAddress,
      },
    });

    return { success: true, message: `Xodimga ${newRole} roli biriktirildi.` };
  }
}

export const authService = new AuthService();
