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

export interface PlatformLead {
  id: string;
  name: string;
  phone: string;
  region: string;
  plan?: string;
  note?: string;
  status: 'NEW' | 'CONTACTED' | 'CONVERTED';
  createdAt: string;
}

export class PlatformService {
  // Leads from landing page
  private leads: PlatformLead[] = [];

  async getLeads() {
    return [...this.leads];
  }

  async createLead(data: { name: string; phone: string; region: string; plan?: string; note?: string }) {
    if (!data.name || !data.phone) {
      throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Ism va telefon raqami majburiy' };
    }
    const newLead: PlatformLead = {
      id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: data.name.trim(),
      phone: data.phone.trim(),
      region: data.region || 'Toshkent shahri',
      plan: data.plan || 'BUSINESS',
      note: data.note?.trim() || 'Bosh sahifadan qoldirilgan ariza',
      status: 'NEW',
      createdAt: new Date().toISOString(),
    };
    this.leads.unshift(newLead);
    return newLead;
  }

  async updateLeadStatus(leadId: string, status: 'NEW' | 'CONTACTED' | 'CONVERTED') {
    const lead = this.leads.find((l) => l.id === leadId);
    if (!lead) {
      throw { statusCode: 404, code: 'LEAD_NOT_FOUND', message: 'Ariza topilmadi' };
    }
    lead.status = status;
    return lead;
  }
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
      activeTablesCount,
      totalMenuItems,
      topOrdersGroup,
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
      prisma.visit.count({
        where: { status: 'ACTIVE' },
      }),
      prisma.menuItem.count(),
      prisma.order.groupBy({
        by: ['restaurantId'],
        where: {
          createdAt: { gte: fromUtc, lte: toUtc },
        },
        _count: { id: true },
        orderBy: {
          _count: { id: 'desc' },
        },
        take: 1,
      }),
    ]);

    let topRestaurantToday: { name: string; ordersCount: number } | null = null;
    if (topOrdersGroup.length > 0 && topOrdersGroup[0]._count.id > 0) {
      const topRest = await prisma.restaurant.findUnique({
        where: { id: topOrdersGroup[0].restaurantId },
        select: { name: true },
      });
      if (topRest) {
        topRestaurantToday = {
          name: topRest.name,
          ordersCount: topOrdersGroup[0]._count.id,
        };
      }
    }

    const suspendedRestaurants = totalRestaurants - activeRestaurants;

    return {
      totalRestaurants,
      activeRestaurants,
      suspendedRestaurants,
      totalUsers,
      totalTables,
      todayOrdersCount,
      activeTablesCount,
      totalMenuItems,
      topRestaurantToday,
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
              roles: { some: { role: { in: ['BOSS', 'MANAGER'] } } },
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
              roles: { some: { role: { in: ['BOSS', 'MANAGER'] } } },
            },
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                  plainPassword: true,
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
        allowedRoles: r.allowedRoles || ['BOSS', 'MANAGER', 'CASHIER', 'KITCHEN', 'WAITER', 'GUEST'],
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
              plainPassword: ownerUser.plainPassword || null,
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
      // 1. Agar mavjud bo'lmagan yangi Boshqaruvchi (Boss yoki Menejer) ma'lumotlari kiritilgan bo'lsa
      const resolvedOwnerName = (dto.ownerName && dto.ownerName.trim()) || `${dto.name.trim()} Boshqaruvchisi`;
      if (!ownerUserId && dto.ownerPhone && dto.ownerPhone.trim()) {
        const cleanPhone = dto.ownerPhone.trim();
        const digits = cleanPhone.replace(/\D/g, '');
        const canonicalPhone = digits.length === 9 ? `+998${digits}` : (digits.length === 12 && digits.startsWith('998') ? `+${digits}` : cleanPhone);
        const phoneCandidates = [canonicalPhone, cleanPhone, digits];
        let existingUser = await tx.user.findFirst({ where: { phone: { in: phoneCandidates } } });

        if (!existingUser) {
          const pass = dto.ownerPassword || 'Demo12345!';
          const passwordHash = await bcrypt.hash(pass, 10);
          existingUser = await tx.user.create({
            data: {
              phone: canonicalPhone,
              fullName: resolvedOwnerName,
              passwordHash,
              plainPassword: pass,
              isSuperAdmin: false,
              isActive: true,
            },
          });
        }
        ownerUserId = existingUser.id;
      }

      if (!ownerUserId) {
        throw new Error('OWNER_REQUIRED: Restoran boshqaruvchisi telefon raqami kiritilishi shart');
      }

      // Rollarni tozalash: Kamida bitta boshqaruvchi (BOSS yoki MANAGER) bo'lishi shart
      let cleanAllowedRoles = Array.isArray(dto.allowedRoles) && dto.allowedRoles.length > 0
        ? Array.from(new Set(dto.allowedRoles))
        : ['BOSS', 'MANAGER', 'CASHIER', 'KITCHEN', 'WAITER', 'GUEST'];

      if (!cleanAllowedRoles.includes('BOSS') && !cleanAllowedRoles.includes('MANAGER')) {
        cleanAllowedRoles.push('MANAGER');
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
          allowedRoles: cleanAllowedRoles,
          isActive: true,
        },
      });

      // 3. Boshlang'ich standart zal ('Asosiy zal')
      const defaultHall = await tx.hall.create({
        data: {
          restaurantId: rest.id,
          name: 'Asosiy zal',
        },
      });

      // 3.1 Boshlang'ich stollarni avtomatik ochish (1-stoldan N-stolgacha)
      const maxAllowed = rest.subscriptionPlan === 'START' ? 30 : (rest.subscriptionPlan === 'BUSINESS' ? 100 : 500);
      const requestedTables = dto.initialTablesCount !== undefined ? Number(dto.initialTablesCount) : 10;
      const count = Math.max(0, Math.min(maxAllowed, requestedTables));
      if (count > 0) {
        const tablesData = [];
        for (let i = 1; i <= count; i++) {
          tablesData.push({
            id: crypto.randomUUID(),
            restaurantId: rest.id,
            hallId: defaultHall.id,
            number: i,
            capacity: 4,
            status: 'FREE' as const,
            qrToken: `qr-${cleanSlug}-${i}-${crypto.randomUUID().slice(0, 8)}`,
          });
        }
        await tx.table.createMany({
          data: tablesData,
        });
      }

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

      // 4. Boshqaruvchi a'zoligini yaratish (Agar BOSS tanlangan bo'lsa BOSS, aks holda to'liq MANAGER)
      const initialAdminRole = cleanAllowedRoles.includes('BOSS') ? 'BOSS' : 'MANAGER';
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
          role: initialAdminRole,
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
          reason: `Super Admin tomonidan "${rest.name}" restorani yaratildi va boshqaruvchi (${initialAdminRole}) biriktirildi`,
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
   * 4.1. Restoran uchun ruxsat etilgan rollarni yangilash (Super Admin)
   */
  async updateRestaurantRoles(
    restaurantId: string,
    allowedRoles: string[],
    superAdminUserId: string,
    ipAddress?: string
  ) {
    const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!rest) {
      throw new Error('RESTAURANT_NOT_FOUND: Restoran topilmadi');
    }

    const cleanRoles = Array.from(new Set(allowedRoles));
    if (!cleanRoles.includes('BOSS') && !cleanRoles.includes('MANAGER')) {
      throw new Error('VALIDATION_ERROR: Restoranda kamida bitta Boshqaruvchi roli (Boss yoki Menejer) bo\'lishi shart');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.restaurant.update({
        where: { id: restaurantId },
        data: { allowedRoles: cleanRoles },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          actorId: superAdminUserId,
          actorRole: 'SUPER_ADMIN',
          action: 'PLATFORM_RESTAURANT_ROLES_UPDATED',
          entityName: 'Restaurant',
          entityId: restaurantId,
          newStateJson: {
            restaurantName: rest.name,
            allowedRoles: cleanRoles,
          },
          ipAddress,
        },
      });

      return res;
    });

    return updated;
  }

  /**
   * 4.2. Restoranni to'liq o'chirish (Super Admin)
   */
  async deleteRestaurant(restaurantId: string, superAdminUserId: string, ipAddress?: string) {
    const rest = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        memberships: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!rest) {
      throw new Error('RESTAURANT_NOT_FOUND: Restoran topilmadi');
    }

    const memberUserIds = rest.memberships.map((m) => m.userId);

    await prisma.restaurant.delete({
      where: { id: restaurantId },
    });

    // Faqat shu restoranga tegishli bo'lgan va SuperAdmin bo'lmagan foydalanuvchilarni tozalash
    for (const uId of memberUserIds) {
      const user = await prisma.user.findUnique({
        where: { id: uId },
        include: { memberships: true },
      });
      if (user && !user.isSuperAdmin && user.memberships.length === 0) {
        await prisma.user.delete({ where: { id: uId } }).catch(() => {});
      }
    }

    return { success: true, deletedRestaurantId: restaurantId, name: rest.name };
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

  /**
   * Super Admin: Restoran boshqaruvchisining (Boss/Menejer) joriy telefon va parolini olish
   */
  async getOwnerCredentials(restaurantId: string) {
    const membership = await prisma.restaurantMembership.findFirst({
      where: {
        restaurantId,
        roles: { some: { role: { in: ['BOSS', 'MANAGER'] } } },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            plainPassword: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership || !membership.user) {
      throw { statusCode: 404, code: 'OWNER_NOT_FOUND', message: 'Restoran boshqaruvchisi topilmadi.' };
    }

    return {
      userId: membership.userId,
      fullName: membership.user.fullName,
      phone: membership.user.phone,
      plainPassword: membership.user.plainPassword || null,
    };
  }

  /**
   * 7. Super Admin: Restoran egasi (Boss) telefon raqami va parolini yangilash
   */
  async updateOwnerCredentials(
    actorUser: any,
    restaurantId: string,
    data: { ownerPhone?: string; newPassword?: string },
    ipAddress: string
  ) {
    const membership = await prisma.restaurantMembership.findFirst({
      where: {
        restaurantId,
        roles: { some: { role: { in: ['BOSS', 'MANAGER'] } } },
      },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership || !membership.user) {
      throw { statusCode: 404, code: 'OWNER_NOT_FOUND', message: 'Restoran boshqaruvchisi (Boss yoki Menejer) topilmadi.' };
    }

    const updates: any = {};
    if (data.ownerPhone && data.ownerPhone.trim()) {
      const cleanPhone = data.ownerPhone.trim();
      const digits = cleanPhone.replace(/\D/g, '');
      const canonicalPhone = digits.length === 9 ? `+998${digits}` : (digits.length === 12 && digits.startsWith('998') ? `+${digits}` : cleanPhone);
      const phoneCandidates = [canonicalPhone, cleanPhone, digits];
      const existing = await prisma.user.findFirst({ where: { phone: { in: phoneCandidates } } });
      if (existing && existing.id !== membership.userId) {
        throw { statusCode: 409, code: 'PHONE_EXISTS', message: 'Ushbu telefon raqam boshqa hisobga biriktirilgan.' };
      }
      updates.phone = canonicalPhone;
    }

    if (data.newPassword && data.newPassword.trim()) {
      const cleanPass = data.newPassword.trim();
      updates.passwordHash = await bcrypt.hash(cleanPass, 10);
      updates.plainPassword = cleanPass;
      updates.tokenVersion = { increment: 1 };
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({
        where: { id: membership.userId },
        data: updates,
      });

      await prisma.auditLog.create({
        data: {
          actorId: actorUser.id,
          actorRole: 'SUPER_ADMIN',
          restaurantId,
          action: 'PLATFORM_OWNER_CREDENTIALS_UPDATED',
          entityName: 'User',
          entityId: membership.userId,
          reason: 'Super Admin tomonidan restoran egasi telefon/paroli yangilandi',
          ipAddress,
        },
      });
    }

    return {
      success: true,
      userId: membership.userId,
      phone: updates.phone || membership.user.phone,
      plainPassword: updates.plainPassword || (membership.user as any).plainPassword || null,
    };
  }

  // In-memory / persisted platform settings
  private platformSettings = {
    platformName: 'Menurest Platform',
    supportPhone: '+998 97 622 00 34',
    supportTelegram: '@muhammadqodirdev',
    supportInstagram: '',
    defaultCurrency: 'UZS',
    defaultServiceChargeBps: 1000, // 10%
    maintenanceMode: false,
    sessionTimeoutHours: 24,
    plans: {
      START: {
        name: 'START (Tezkor Kafe)',
        maxTables: 15,
        monthlyPriceUzs: 450000,
        roles: ['BOSS', 'CASHIER', 'WAITER', 'GUEST'],
        description: 'Kichik kafelar va fast-food oshxonasiz nuqtalar uchun',
      },
      BUSINESS: {
        name: 'BUSINESS (To\'liq Restoran)',
        maxTables: 100,
        monthlyPriceUzs: 950000,
        roles: ['BOSS', 'MANAGER', 'CASHIER', 'KITCHEN', 'WAITER', 'GUEST'],
        description: 'Katta restoranlar, KDS oshxona ekrani va menejer hisobotlari',
      },
      ENTERPRISE: {
        name: 'ENTERPRISE (Tarmoq)',
        maxTables: 500,
        monthlyPriceUzs: 1800000,
        roles: ['BOSS', 'MANAGER', 'CASHIER', 'KITCHEN', 'WAITER', 'GUEST'],
        description: 'Ko\'p filialli restoranlar va maxsus integratsiyalar',
      },
    },
  };

  async getPlatformSettings() {
    return { ...this.platformSettings };
  }

  async updatePlatformSettings(actorUser: any, updates: any, ipAddress: string) {
    if (updates.platformName) this.platformSettings.platformName = String(updates.platformName).trim();
    if (updates.supportPhone !== undefined) this.platformSettings.supportPhone = String(updates.supportPhone).trim();
    if (updates.supportTelegram !== undefined) this.platformSettings.supportTelegram = String(updates.supportTelegram).trim();
    if (updates.supportInstagram !== undefined) this.platformSettings.supportInstagram = String(updates.supportInstagram).trim();
    if (updates.defaultServiceChargeBps !== undefined) this.platformSettings.defaultServiceChargeBps = Number(updates.defaultServiceChargeBps);
    if (updates.maintenanceMode !== undefined) this.platformSettings.maintenanceMode = Boolean(updates.maintenanceMode);
    if (updates.plans) {
      this.platformSettings.plans = { ...this.platformSettings.plans, ...updates.plans };
    }

    await prisma.auditLog.create({
      data: {
        actorId: actorUser.id,
        actorRole: 'SUPER_ADMIN',
        action: 'PLATFORM_SETTINGS_UPDATED',
        entityName: 'PlatformSettings',
        entityId: 'global',
        reason: 'Super Admin tomonidan global platforma sozlamalari yangilandi',
        newStateJson: this.platformSettings as any,
        ipAddress,
      },
    });

    return { ...this.platformSettings };
  }

  async updateAdminCredentials(
    actorUser: any,
    data: { phone?: string; newPassword?: string },
    ipAddress: string
  ) {
    const updates: any = {};

    if (data.phone && data.phone.trim()) {
      const cleanPhone = data.phone.trim();
      const digits = cleanPhone.replace(/\D/g, '');
      const canonicalPhone =
        digits.length === 9
          ? `+998${digits}`
          : digits.length === 12 && digits.startsWith('998')
          ? `+${digits}`
          : cleanPhone;

      const phoneCandidates = [canonicalPhone, cleanPhone, digits];
      const existing = await prisma.user.findFirst({
        where: { phone: { in: phoneCandidates } },
      });

      if (existing && existing.id !== actorUser.id) {
        throw {
          statusCode: 409,
          code: 'PHONE_EXISTS',
          message: 'Ushbu telefon raqam boshqa foydalanuvchiga biriktirilgan.',
        };
      }
      updates.phone = canonicalPhone;
    }

    if (data.newPassword && data.newPassword.trim()) {
      const cleanPass = data.newPassword.trim();
      if (cleanPass.length < 6) {
        throw {
          statusCode: 400,
          code: 'INVALID_PASSWORD',
          message: 'Yangi parol kamida 6 belgidan iborat bo\'lishi kerak',
        };
      }
      updates.passwordHash = await bcrypt.hash(cleanPass, 10);
      updates.plainPassword = cleanPass;
      updates.tokenVersion = { increment: 1 };
    }

    if (Object.keys(updates).length === 0) {
      throw {
        statusCode: 400,
        code: 'NOTHING_TO_UPDATE',
        message: 'O\'zgartirish uchun yangi telefon yoki parol kiritilmadi',
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: actorUser.id },
      data: updates,
    });

    await prisma.auditLog.create({
      data: {
        actorId: actorUser.id,
        actorRole: 'SUPER_ADMIN',
        action: 'SUPER_ADMIN_CREDENTIALS_UPDATED',
        entityName: 'User',
        entityId: actorUser.id,
        reason: 'Super Admin kirish telefoni yoki parolini yangiladi',
        ipAddress,
      },
    });

    return {
      success: true,
      message: 'Super Admin ma\'lumotlari muvaffaqiyatli saqlandi',
      phone: updatedUser.phone,
    };
  }

  async updateAdminPassword(actorUser: any, newPassword: string, ipAddress: string) {
    return this.updateAdminCredentials(actorUser, { newPassword }, ipAddress);
  }
}

export const platformService = new PlatformService();
