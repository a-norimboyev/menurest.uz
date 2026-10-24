import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../db.js';
import { Role } from '@menurest/shared';
import { getTashkentDayBounds } from '../reports/reports.service.js';
import type {
  PlatformOverviewDto,
  PlatformRestaurantItemDto,
  CreateRestaurantDto,
} from '@menurest/shared';

function sanitizeJson(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(sanitizeJson);
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    const lower = k.toLowerCase();
    if (
      lower.includes('password') ||
      lower.includes('token') ||
      lower.includes('secret') ||
      lower.includes('hash') ||
      lower.includes('pin')
    ) {
      clean[k] = '[REDACTED]';
    } else {
      clean[k] = sanitizeJson(v);
    }
  }
  return clean;
}

export class PlatformService {
  /**
   * 1. Platforma texnik agregatsiyalari va xizmat monitoringi
   */
  async getOverview(): Promise<PlatformOverviewDto & { technicalErrors: any[] }> {
    const startDb = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startDb;

    const now = new Date();
    const { fromUtc, toUtc } = getTashkentDayBounds();

    const [
      totalRestaurants,
      activeRestaurants,
      totalUsers,
      totalTables,
      todayOrdersCount,
      failedOutboxEvents,
    ] = await Promise.all([
      prisma.restaurant.count(),
      prisma.restaurant.count({
        where: {
          isActive: true,
          OR: [
            { subscriptionExpiresAt: null },
            { subscriptionExpiresAt: { gt: now } },
          ],
        },
      }),
      prisma.user.count(),
      prisma.table.count(),
      prisma.order.count({
        where: {
          createdAt: { gte: fromUtc, lte: toUtc },
        },
      }),
      prisma.outboxEvent.findMany({
        where: { status: 'FAILED' },
        select: {
          id: true,
          restaurantId: true,
          eventType: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const suspendedRestaurants = totalRestaurants - activeRestaurants;

    return {
      totalRestaurants,
      activeRestaurants,
      suspendedRestaurants,
      totalUsers,
      totalTables,
      todayOrdersCount,
      systemHealth: {
        status: dbLatencyMs < 200 && failedOutboxEvents.length === 0 ? 'HEALTHY' : 'DEGRADED',
        dbConnected: true,
        dbLatencyMs,
        uptimeSeconds: Math.round(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      },
      technicalErrors: failedOutboxEvents.map((e) => ({
        id: e.id,
        restaurantId: e.restaurantId,
        eventType: e.eventType,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  /**
   * 2. Restoranlar ro'yxati (Qidiruv, holat filtri va sahifalash)
   */
  async listRestaurants(params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    restaurants: PlatformRestaurantItemDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        {
          memberships: {
            some: {
              roles: { some: { role: 'BOSS' } },
              user: { fullName: { contains: q, mode: 'insensitive' } },
            },
          },
        },
      ];
    }

    const now = new Date();
    if (params?.status === 'ACTIVE') {
      where.isActive = true;
      where.OR = [
        { subscriptionExpiresAt: null },
        { subscriptionExpiresAt: { gt: now } },
      ];
    } else if (params?.status === 'SUSPENDED') {
      where.OR = [
        { isActive: false },
        { subscriptionExpiresAt: { lte: now } },
      ];
    }

    const [total, rawRestaurants] = await Promise.all([
      prisma.restaurant.count({ where }),
      prisma.restaurant.findMany({
        where,
        include: {
          _count: {
            select: {
              halls: true,
              tables: true,
              memberships: true,
              visits: { where: { status: 'ACTIVE' } },
            },
          },
          memberships: {
            where: {
              roles: { some: { role: 'BOSS' } },
            },
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                },
              },
            },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const restaurants: PlatformRestaurantItemDto[] = rawRestaurants.map((r) => {
      const isSuspended =
        !r.isActive || (r.subscriptionExpiresAt !== null && r.subscriptionExpiresAt <= now);
      const ownerUser = r.memberships[0]?.user;

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        phone: r.phone,
        extraPhones: r.extraPhones || [],
        telegram: r.telegram,
        instagram: r.instagram,
        address: r.address,
        logoUrl: r.logoUrl,
        subscriptionPlan: r.subscriptionPlan,
        subscriptionExpiresAt: r.subscriptionExpiresAt ? r.subscriptionExpiresAt.toISOString() : null,
        status: isSuspended ? 'SUSPENDED' : 'ACTIVE',
        suspendedReason: r.suspendedReason,
        suspendedAt: r.suspendedAt ? r.suspendedAt.toISOString() : null,
        hallsCount: r._count.halls,
        tablesCount: r._count.tables,
        staffCount: r._count.memberships,
        activeVisitsCount: r._count.visits,
        owner: ownerUser
          ? {
              id: ownerUser.id,
              fullName: ownerUser.fullName,
              phone: ownerUser.phone,
            }
          : null,
        createdAt: r.createdAt.toISOString(),
      };
    });

    return {
      restaurants,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 3. Yangi restoran va Boss membership yaratish (Super Admin)
   */
  async createRestaurant(
    dto: CreateRestaurantDto,
    superAdminUserId: string,
    ipAddress?: string
  ) {
    if (!dto.name || !dto.name.trim()) {
      throw new Error('VALIDATION_ERROR: Restoran nomi kiritilishi shart');
    }
    if (!dto.slug || !dto.slug.trim()) {
      throw new Error('VALIDATION_ERROR: Restoran slugi (identifikatori) kiritilishi shart');
    }

    const cleanSlug = dto.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const existingSlug = await prisma.restaurant.findUnique({
      where: { slug: cleanSlug },
    });
    if (existingSlug) {
      throw new Error('SLUG_ALREADY_EXISTS: Ushbu slug bilan restoran allaqachon mavjud');
    }

    let ownerUserId = dto.ownerUserId;

    // Tranzaksiya ichida restoran, egasi va boshlang'ich zali yaratiladi
    const created = await prisma.$transaction(async (tx) => {
      // 1. Agar mavjud bo'lmagan yangi Boss ma'lumotlari kiritilgan bo'lsa
      if (!ownerUserId && dto.ownerPhone && dto.ownerName) {
        const cleanPhone = dto.ownerPhone.trim();
        let existingUser = await tx.user.findUnique({ where: { phone: cleanPhone } });

        if (!existingUser) {
          const pass = dto.ownerPassword || 'Demo12345!';
          const passwordHash = await bcrypt.hash(pass, 10);
          existingUser = await tx.user.create({
            data: {
              phone: cleanPhone,
              fullName: dto.ownerName.trim(),
              passwordHash,
              isSuperAdmin: false,
              isActive: true,
            },
          });
        }
        ownerUserId = existingUser.id;
      }

      if (!ownerUserId) {
        throw new Error('OWNER_REQUIRED: Restoran egasi (Boss) kiritilishi yoki tanlanishi shart');
      }

      // 2. Restoranni yaratish
      const rest = await tx.restaurant.create({
        data: {
          name: dto.name.trim(),
          slug: cleanSlug,
          phone: dto.phone?.trim() || null,
          extraPhones: Array.isArray(dto.extraPhones) ? dto.extraPhones.map((p) => p.trim()).filter(Boolean) : [],
          telegram: dto.telegram?.trim() || null,
          instagram: dto.instagram?.trim() || null,
          address: dto.address?.trim() || null,
          currency: dto.currency || 'UZS',
          serviceChargeBps: dto.serviceChargeBps || 1000,
          subscriptionPlan: dto.subscriptionPlan || 'BUSINESS',
          subscriptionExpiresAt: dto.subscriptionExpiresAt ? new Date(dto.subscriptionExpiresAt) : null,
          isActive: true,
        },
      });

      // 3. Boshlang'ich standart zal ('Asosiy zal')
      await tx.hall.create({
        data: {
          restaurantId: rest.id,
          name: 'Asosiy zal',
        },
      });

      // 3.1 Boshlang'ich stansiyalar (START / Oshxonasiz rejimda faqat Bar/Xizmat, to'liq rejimda Oshxona + Bar)
      if (dto.subscriptionPlan === 'START') {
        await tx.preparationStation.create({
          data: {
            restaurantId: rest.id,
            name: 'Xizmat / Bar',
            type: 'BAR',
          },
        });
      } else {
        await tx.preparationStation.create({
          data: {
            restaurantId: rest.id,
            name: 'Issiq Oshxona',
            type: 'KITCHEN',
          },
        });
        await tx.preparationStation.create({
          data: {
            restaurantId: rest.id,
            name: 'Ichimliklar Bari',
            type: 'BAR',
          },
        });
      }

      // 4. Boss a'zoligini yaratish
      const membership = await tx.restaurantMembership.create({
        data: {
          restaurantId: rest.id,
          userId: ownerUserId,
          isActive: true,
        },
      });

      await tx.membershipRole.create({
        data: {
          membershipId: membership.id,
          role: 'BOSS',
        },
      });

      // 5. Audit jurnali
      await tx.auditLog.create({
        data: {
          restaurantId: rest.id,
          actorId: superAdminUserId,
          actorRole: 'SUPER_ADMIN',
          action: 'RESTAURANT_CREATED',
          entityName: 'Restaurant',
          entityId: rest.id,
          reason: `Super Admin tomonidan "${rest.name}" restorani yaratildi va Boss biriktirildi`,
          newStateJson: {
            restaurantId: rest.id,
            name: rest.name,
            slug: rest.slug,
            subscriptionPlan: rest.subscriptionPlan,
            ownerUserId,
          },
          ipAddress: ipAddress || null,
        },
      });

      return { rest, ownerUserId };
    });

    const owner = await prisma.user.findUnique({
      where: { id: created.ownerUserId },
      select: { id: true, fullName: true, phone: true },
    });

    return {
      restaurant: created.rest,
      owner,
    };
  }

  /**
   * 4. Restoran holatini o'zgartirish (ACTIVE / SUSPENDED)
   * Super Admin restoranni to'xtatishi yoki qayta faollashtirishi mumkin
   */
  async updateRestaurantStatus(
    restaurantId: string,
    params: {
      status: 'ACTIVE' | 'SUSPENDED';
      reason?: string;
      subscriptionExpiresAt?: string | null;
      subscriptionPlan?: string;
    },
    superAdminUserId: string,
    ipAddress?: string
  ) {
    const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!rest) {
      throw new Error('RESTAURANT_NOT_FOUND: Restoran topilmadi');
    }

    if (params.status === 'SUSPENDED' && (!params.reason || !params.reason.trim())) {
      throw new Error('REASON_REQUIRED: Restoran xizmatini to\'xtatish (SUSPEND) uchun sabab kiritilishi shart');
    }

    const isSuspending = params.status === 'SUSPENDED';
    const updateData: any = {
      isActive: !isSuspending,
      suspendedReason: isSuspending ? params.reason?.trim() : null,
      suspendedAt: isSuspending ? new Date() : null,
    };

    if (params.subscriptionExpiresAt !== undefined) {
      updateData.subscriptionExpiresAt = params.subscriptionExpiresAt
        ? new Date(params.subscriptionExpiresAt)
        : null;
    }
    if (params.subscriptionPlan !== undefined) {
      updateData.subscriptionPlan = params.subscriptionPlan;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.restaurant.update({
        where: { id: restaurantId },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          actorId: superAdminUserId,
          actorRole: 'SUPER_ADMIN',
          action: 'RESTAURANT_STATUS_CHANGED',
          entityName: 'Restaurant',
          entityId: restaurantId,
          reason: params.reason?.trim() || `Restoran holati ${params.status} ga o'zgartirildi`,
          oldStateJson: {
            isActive: rest.isActive,
            suspendedReason: rest.suspendedReason,
            subscriptionExpiresAt: rest.subscriptionExpiresAt,
          },
          newStateJson: {
            isActive: res.isActive,
            suspendedReason: res.suspendedReason,
            subscriptionExpiresAt: res.subscriptionExpiresAt,
          },
          ipAddress: ipAddress || null,
        },
      });

      return res;
    });

    return updated;
  }

  /**
   * 5. Vaqtinchalik Yordam (Support Session) ochish
   * Super Admin sabab ko'rsatib vaqtinchalik cheklangan token oladi
   */
  async createSupportSession(
    restaurantId: string,
    params: {
      reason: string;
      expiresInMinutes?: number;
      isReadOnly?: boolean;
    },
    superAdminUserId: string,
    ipAddress?: string
  ) {
    if (!params.reason || !params.reason.trim()) {
      throw new Error('REASON_REQUIRED: Texnik yordam sessiyasi ochish uchun sabab kiritilishi shart');
    }

    const rest = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true },
    });
    if (!rest) {
      throw new Error('RESTAURANT_NOT_FOUND: Restoran topilmadi');
    }

    const expiresIn = Math.min(Math.max(params.expiresInMinutes || 30, 5), 120);
    const expiresAt = new Date(Date.now() + expiresIn * 60 * 1000);
    const isReadOnly = params.isReadOnly !== false; // Standart: Read-Only

    const rawToken = `sup_${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const supportAccess = await prisma.$transaction(async (tx) => {
      const sa = await tx.supportAccess.create({
        data: {
          restaurantId,
          superAdminUserId,
          tokenHash,
          reason: params.reason.trim(),
          isReadOnly,
          expiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          actorId: superAdminUserId,
          actorRole: 'SUPER_ADMIN',
          action: 'SUPPORT_SESSION_STARTED',
          entityName: 'SupportAccess',
          entityId: sa.id,
          reason: params.reason.trim(),
          newStateJson: {
            restaurantName: rest.name,
            isReadOnly,
            expiresInMinutes: expiresIn,
            expiresAt: expiresAt.toISOString(),
          },
          ipAddress: ipAddress || null,
        },
      });

      return sa;
    });

    return {
      supportToken: rawToken,
      supportAccessId: supportAccess.id,
      restaurantId: rest.id,
      restaurantName: rest.name,
      reason: params.reason.trim(),
      isReadOnly,
      expiresAt: expiresAt.toISOString(),
      expiresInMinutes: expiresIn,
    };
  }

  /**
   * 6. Faol Yordam (Support Session) ni bekor qilish (Revoke)
   */
  async revokeSupportSession(
    restaurantId: string,
    supportToken: string | undefined,
    superAdminUserId: string,
    ipAddress?: string
  ) {
    let whereCondition: any = {
      restaurantId,
      superAdminUserId,
      revokedAt: null,
    };

    if (supportToken) {
      const tokenHash = crypto.createHash('sha256').update(supportToken).digest('hex');
      whereCondition.tokenHash = tokenHash;
    }

    const activeSession = await prisma.supportAccess.findFirst({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
    });

    if (!activeSession) {
      return { success: true, message: 'Faol support sessiyasi topilmadi yoki allaqachon bekor qilingan' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.supportAccess.update({
        where: { id: activeSession.id },
        data: { revokedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          actorId: superAdminUserId,
          actorRole: 'SUPER_ADMIN',
          action: 'SUPPORT_SESSION_REVOKED',
          entityName: 'SupportAccess',
          entityId: activeSession.id,
          reason: 'Super Admin tomonidan yordam sessiyasi bekor qilindi',
          ipAddress: ipAddress || null,
        },
      });
    });

    return { success: true, message: 'Yordam sessiyasi muvaffaqiyatli bekor qilindi' };
  }

  /**
   * 7. Platforma Audit jurnali (Super Admin harakatlari)
   */
  async getPlatformAuditLogs(params?: {
    page?: number;
    limit?: number;
    action?: string;
  }) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { actorRole: 'SUPER_ADMIN' },
        { action: { in: ['RESTAURANT_CREATED', 'RESTAURANT_STATUS_CHANGED', 'SUPPORT_SESSION_STARTED', 'SUPPORT_SESSION_REVOKED'] } },
      ],
    };

    if (params?.action) {
      where.action = params.action;
    }

    const [total, rawLogs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const logs = rawLogs.map((log) => ({
      id: log.id,
      restaurantId: log.restaurantId,
      actorId: log.actorId,
      actorName: log.actorName || 'Super Admin',
      actorRole: log.actorRole || 'SUPER_ADMIN',
      action: log.action,
      entityName: log.entityName,
      entityId: log.entityId,
      oldStateJson: sanitizeJson(log.oldStateJson),
      newStateJson: sanitizeJson(log.newStateJson),
      reason: log.reason,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

export const platformService = new PlatformService();
