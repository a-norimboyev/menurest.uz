import bcrypt from 'bcryptjs';
import { prisma } from '../../db.js';
import { Role, canAssignRole, getPermissionsForRoles } from '@menurest/shared';

export interface CreateStaffDto {
  fullName: string;
  phone: string;
  password?: string;
  roles: Role[];
  customPermissions?: any;
  stationIds?: string[];
  tableIds?: string[];
}

export interface UpdateStaffDto {
  fullName?: string;
  phone?: string;
  password?: string;
  roles?: Role[];
  customPermissions?: any;
  isActive?: boolean;
  stationIds?: string[];
  tableIds?: string[];
}

export class StaffService {
  /**
   * 1. Restoran xodimlari ro'yxatini olish (Rollari, stansiyalari, biriktirilgan stollari bilan)
   */
  async listStaff(restaurantId: string) {
    const memberships = await prisma.restaurantMembership.findMany({
      where: { restaurantId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            plainPassword: true,
            isActive: true,
            assignedTables: {
              where: { restaurantId },
              select: { id: true, number: true },
            },
            staffStationAssignments: {
              where: { restaurantId },
              include: { station: { select: { id: true, name: true, type: true } } },
            },
          },
        },
        roles: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => {
      const roles = m.roles.map((r) => r.role as Role);
      const customPerms = m.customPermissions as any;
      const permissions = getPermissionsForRoles(roles, customPerms);

      return {
        id: m.id,
        userId: m.user.id,
        fullName: m.user.fullName,
        phone: m.user.phone,
        plainPassword: m.user.plainPassword,
        isActive: m.isActive && m.user.isActive,
        roles,
        customPermissions: m.customPermissions,
        permissions,
        assignedTables: m.user.assignedTables.map((t) => ({ id: t.id, number: t.number })),
        assignedStations: m.user.staffStationAssignments.map((a) => ({
          id: a.station.id,
          name: a.station.name,
          type: a.station.type,
        })),
        createdAt: m.createdAt.toISOString(),
      };
    });
  }

  /**
   * 2. Yangi xodim yaratish (Restoran a'zoligi, rollar, stansiya va stol biriktirish)
   */
  async createStaff(
    actorUser: any,
    restaurantId: string,
    data: CreateStaffDto,
    ipAddress: string
  ) {
    // 2.1 Eskalatsiya tekshiruvi: Manager Boss yoki SuperAdmin tayinlay olmaydi!
    for (const r of data.roles) {
      if (!canAssignRole(actorUser.roles, r)) {
        throw {
          statusCode: 403,
          code: 'PRIVILEGE_ESCALATION_FORBIDDEN',
          message: `Sizning rolingiz ${r} vakolatini berish huquqiga ega emas.`,
        };
      }
    }

    const cleanPhone = data.phone.trim();
    const digits = cleanPhone.replace(/\D/g, '');
    const canonicalPhone = digits.length === 9 ? `+998${digits}` : (digits.length === 12 && digits.startsWith('998') ? `+${digits}` : cleanPhone);
    const phoneCandidates = [canonicalPhone, cleanPhone, digits];
    const passwordHash = await bcrypt.hash(data.password || '123456', 10);

    // 2.2 Foydalanuvchini topish yoki yangi yaratish (+998 va +998 siz formatlarga mos)
    let user = await prisma.user.findFirst({
      where: { phone: { in: phoneCandidates } },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: canonicalPhone,
          passwordHash,
          plainPassword: data.password || '123456',
          fullName: data.fullName.trim(),
        },
      });
    }

    // 2.3 Bu restoranda a'zoligi bormi?
    const existingMembership = await prisma.restaurantMembership.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      throw {
        statusCode: 400,
        code: 'USER_ALREADY_MEMBER',
        message: 'Bu telefon egasi allaqachon restoranda xodim sifatida mavjud.',
      };
    }

    // 2.4 Tranzaksiya bilan a'zolik, rollar va biriktiruvlarni yaratish
    const membership = await prisma.$transaction(async (tx) => {
      const mem = await tx.restaurantMembership.create({
        data: {
          restaurantId,
          userId: user.id,
          customPermissions: data.customPermissions || undefined,
        },
      });

      // Rollarni yozish
      for (const role of data.roles) {
        await tx.membershipRole.create({
          data: {
            membershipId: mem.id,
            role,
          },
        });
      }

      // Stansiyalarni biriktirish
      if (data.stationIds && data.stationIds.length > 0) {
        for (const stationId of data.stationIds) {
          await tx.staffStationAssignment.create({
            data: {
              restaurantId,
              userId: user.id,
              stationId,
            },
          });
        }
      }

      // Stollarni biriktirish
      if (data.tableIds && data.tableIds.length > 0) {
        await tx.table.updateMany({
          where: {
            id: { in: data.tableIds },
            restaurantId,
          },
          data: {
            assignedWaiterId: user.id,
          },
        });
      }

      // Audit log yozish
      await tx.auditLog.create({
        data: {
          restaurantId,
          actorId: actorUser.id,
          actorName: actorUser.fullName,
          actorRole: actorUser.roles[0] || 'MANAGER',
          action: 'STAFF_CREATED',
          entityName: 'RestaurantMembership',
          entityId: mem.id,
          newStateJson: {
            userId: user.id,
            fullName: data.fullName,
            phone: cleanPhone,
            roles: data.roles,
            customPermissions: data.customPermissions,
            stations: data.stationIds,
            tables: data.tableIds,
          },
          reason: `Yangi xodim qo'shildi: ${data.fullName}`,
          ipAddress,
        },
      });

      return mem;
    });

    return {
      membershipId: membership.id,
      userId: user.id,
      fullName: user.fullName,
      phone: user.phone,
      roles: data.roles,
    };
  }

  /**
   * 3. Xodimni tahrirlash (Ism, telefon, rollar, ruxsatlar, stansiya va stollar)
   */
  async updateStaff(
    actorUser: any,
    restaurantId: string,
    targetUserId: string,
    data: UpdateStaffDto,
    ipAddress: string
  ) {
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
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Xodim restoranda topilmadi.' };
    }

    // 3.0 Target userning mavjud rollarini tekshirish: Manager o'zidan yuqori darajadagi (masalan BOSS) xodimni tahrirlay olmaydi!
    const targetRoles = membership.roles.map((r) => r.role as Role);
    const actorRoles = (actorUser.roles || []) as Role[];
    if (!actorUser.isSuperAdmin) {
      const actorIsBoss = actorRoles.includes(Role.BOSS);
      const targetIsBoss = targetRoles.includes(Role.BOSS);
      if (targetIsBoss && !actorIsBoss) {
        throw {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Sizdan yuqori darajadagi xodim ma\'lumotlarini o\'zgartira olmaysiz.',
        };
      }
    }

    // 3.1 O'z-o'ziga eskalatsiya qilishni to'sish
    if (actorUser.id === targetUserId) {
      if (data.roles) {
        const currentRoles = membership.roles.map((r) => r.role).sort();
        const incomingRoles = [...data.roles].sort();
        const rolesChanged =
          currentRoles.length !== incomingRoles.length ||
          currentRoles.some((r, i) => r !== incomingRoles[i]);

        if (rolesChanged) {
          throw {
            statusCode: 403,
            code: 'SELF_ESCALATION_FORBIDDEN',
            message: 'O\'zingizning rollaringizni o\'zgartira olmaysiz.',
          };
        }
      }

      if (data.isActive !== undefined && data.isActive !== membership.isActive) {
        throw {
          statusCode: 403,
          code: 'SELF_ESCALATION_FORBIDDEN',
          message: 'O\'zingizni faolsizlantira olmaysiz.',
        };
      }

      if (data.customPermissions !== undefined) {
        throw {
          statusCode: 403,
          code: 'SELF_ESCALATION_FORBIDDEN',
          message: 'O\'zingizning ruxsatlaringizni o\'zgartira olmaysiz.',
        };
      }
    }

    // Telefon raqami band emasligini tekshirish
    if (data.phone && data.phone.trim()) {
      const existingUser = await prisma.user.findFirst({
        where: {
          phone: data.phone.trim(),
          id: { not: targetUserId },
        },
      });
      if (existingUser) {
        throw {
          statusCode: 409,
          code: 'PHONE_ALREADY_EXISTS',
          message: 'Bu telefon raqami allaqachon boshqa xodimga biriktirilgan.',
        };
      }
    }

    // 3.2 Target Boss bo'lsa va aktyor Boss yoki SuperAdmin bo'lmasa, tahrirlab bo'lmaydi!
    const targetIsBoss = membership.roles.some((r) => r.role === Role.BOSS);
    if (targetIsBoss && !actorUser.roles.includes(Role.BOSS) && !actorUser.roles.includes(Role.SUPER_ADMIN)) {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Boss ma\'lumotlarini o\'zgartirish huquqiga ega emassiz.',
      };
    }

    // 3.3 Yangi rollar eskalatsiyasi
    if (data.roles) {
      for (const r of data.roles) {
        if (!canAssignRole(actorUser.roles, r)) {
          throw {
            statusCode: 403,
            code: 'PRIVILEGE_ESCALATION_FORBIDDEN',
            message: `Sizning rolingiz ${r} vakolatini berish huquqiga ega emas.`,
          };
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      // Foydalanuvchi ma'lumotlarini yangilash
      const userUpdate: any = {};
      if (data.fullName) userUpdate.fullName = data.fullName.trim();
      if (data.phone) userUpdate.phone = data.phone.trim();
      if (data.password && data.password.trim()) {
        userUpdate.passwordHash = await bcrypt.hash(data.password.trim(), 10);
        userUpdate.plainPassword = data.password.trim();
      }
      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({
          where: { id: targetUserId },
          data: userUpdate,
        });
      }

      // Rollarni yangilash
      if (data.roles) {
        await tx.membershipRole.deleteMany({
          where: { membershipId: membership.id },
        });
        for (const role of data.roles) {
          await tx.membershipRole.create({
            data: {
              membershipId: membership.id,
              role,
            },
          });
        }
      }

      // A'zolik holati va maxsus ruxsatlarni yangilash
      const memUpdate: any = {
        tokenVersion: { increment: 1 }, // Sessiyani darhol yangilash/bekor qilish
      };
      if (data.isActive !== undefined) memUpdate.isActive = data.isActive;
      if (data.customPermissions !== undefined) memUpdate.customPermissions = data.customPermissions;

      await tx.restaurantMembership.update({
        where: { id: membership.id },
        data: memUpdate,
      });

      // Stansiyalarni yangilash
      if (data.stationIds !== undefined) {
        await tx.staffStationAssignment.deleteMany({
          where: { restaurantId, userId: targetUserId },
        });
        for (const stationId of data.stationIds) {
          await tx.staffStationAssignment.create({
            data: {
              restaurantId,
              userId: targetUserId,
              stationId,
            },
          });
        }
      }

      // Stollarni yangilash
      if (data.tableIds !== undefined) {
        // Eski stollardan olib tashlash
        await tx.table.updateMany({
          where: { restaurantId, assignedWaiterId: targetUserId },
          data: { assignedWaiterId: null },
        });
        // Yangilarini biriktirish
        if (data.tableIds.length > 0) {
          await tx.table.updateMany({
            where: { restaurantId, id: { in: data.tableIds } },
            data: { assignedWaiterId: targetUserId },
          });
        }
      }

      // Audit log yozish
      await tx.auditLog.create({
        data: {
          restaurantId,
          actorId: actorUser.id,
          actorName: actorUser.fullName,
          actorRole: actorUser.roles[0] || 'MANAGER',
          action: 'STAFF_UPDATED',
          entityName: 'RestaurantMembership',
          entityId: membership.id,
          newStateJson: {
            roles: data.roles,
            customPermissions: data.customPermissions,
            isActive: data.isActive,
            stations: data.stationIds,
            tables: data.tableIds,
          },
          reason: `Xodim tahrirlandi: ${targetUserId}`,
          ipAddress,
        },
      });
    });

    return { success: true, message: 'Xodim ma\'lumotlari muvaffaqiyatli yangilandi.' };
  }

  /**
   * 4. Xodimning maxsus ruxsatlarini yangilash (Moliyaviy vakolat Boss sozlamasidan keladi)
   */
  async updatePermissions(
    actorUser: any,
    restaurantId: string,
    targetUserId: string,
    customPermissions: any,
    ipAddress: string
  ) {
    if (actorUser.id === targetUserId) {
      throw {
        statusCode: 403,
        code: 'SELF_ESCALATION_FORBIDDEN',
        message: 'O\'zingizga ruxsat qo\'sha olmaysiz.',
      };
    }

    const membership = await prisma.restaurantMembership.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId,
          userId: targetUserId,
        },
      },
    });

    if (!membership) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Xodim topilmadi.' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.restaurantMembership.update({
        where: { id: membership.id },
        data: {
          customPermissions,
          tokenVersion: { increment: 1 },
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          actorId: actorUser.id,
          actorName: actorUser.fullName,
          actorRole: actorUser.roles[0] || 'BOSS',
          action: 'STAFF_PERMISSIONS_UPDATED',
          entityName: 'RestaurantMembership',
          entityId: membership.id,
          newStateJson: { customPermissions },
          reason: `Xodim ruxsatlari sozlandi: ${targetUserId}`,
          ipAddress,
        },
      });
    });

    return { success: true, message: 'Xodim ruxsatlari muvaffaqiyatli yangilandi.' };
  }
}

export const staffService = new StaffService();
