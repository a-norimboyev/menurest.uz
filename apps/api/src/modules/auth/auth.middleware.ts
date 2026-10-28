import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db.js';
import { JWT_SECRET, SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from './auth.constants.js';
import { Role, getPermissionsForRoles, type Permission } from '@menurest/shared';
import type { SessionPayload } from './auth.service.js';

export interface AuthenticatedUser {
  id: string;
  phone: string;
  fullName: string;
  isSuperAdmin: boolean;
  activeRestaurantId?: string;
  roles: Role[];
  permissions: Permission[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      restaurantId?: string;
    }
  }
}

/**
 * Autentifikatsiya middleware: sessiya cookie yoki Bearer tokenni tekshiradi
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    let token: string | undefined;

    if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
      token = req.cookies[SESSION_COOKIE_NAME];
    } else if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      return next();
    }

    let payload: SessionPayload;
    try {
      payload = jwt.verify(token, JWT_SECRET) as SessionPayload;
    } catch {
      return next(); // Token yaroqsiz bo'lsa mehmon yoki anonim qoladi
    }

    // Bazadan foydalanuvchini olish
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            roles: true,
          },
        },
      },
    });

    // 1. Foydalanuvchi faol emasligi yoki tokenVersion mos kelmasligi (Sessiya bekor qilingan!)
    if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
      return next();
    }

    // 2. Faol restoranni aniqlash
    const targetRestId = payload.activeRestaurantId || user.memberships[0]?.restaurantId;
    const membership = user.memberships.find((m) => m.restaurantId === targetRestId);

    // Agar oddiy xodim bo'lsa va bu restoranda faol a'zoligi bo'lmasa yoki a'zolik tokeni eskirgan bo'lsa
    if (!user.isSuperAdmin && (!membership || (payload.membershipTokenVersion && membership.tokenVersion !== payload.membershipTokenVersion))) {
      return next();
    }

    const roles: Role[] = membership
      ? membership.roles.map((r) => r.role as Role)
      : user.isSuperAdmin
      ? [Role.SUPER_ADMIN]
      : [];

    const customPerms = (membership as any)?.customPermissions as string[] | { allow?: string[]; deny?: string[] } | null;
    const permissions = getPermissionsForRoles(roles, customPerms);

    req.user = {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      isSuperAdmin: user.isSuperAdmin,
      activeRestaurantId: targetRestId,
      roles,
      permissions,
    };
    req.restaurantId = targetRestId;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Autentifikatsiya qilingan bo'lishini talab qiladi
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Tizimga kirish talab qilinadi.',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`,
      },
    });
  }
  next();
}

/**
 * Aniq ruxsat(lar)ni talab qiladi (RBAC Permission Guard)
 */
export function requirePermission(...requiredPermissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Tizimga kirish talab qilinadi.',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        },
      });
    }

    // Super Admin texnik ko'mak uchun kirganda (faqat faol SupportAccess bo'lsa)
    if (req.user.isSuperAdmin) {
      if ((req as any).supportAccess) {
        return next();
      }
      const requestedTenant = req.params.restaurantId || (req.body && req.body.restaurantId);
      if (requestedTenant && req.user.activeRestaurantId === requestedTenant) {
        return next();
      }
      return res.status(403).json({
        success: false,
        error: {
          code: 'SUPPORT_SESSION_REQUIRED',
          message: 'Super admin ushbu restoran ma\'lumotlariga kirishi uchun sabab ko\'rsatilgan faol yordam sessiyasi talab qilinadi.',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        },
      });
    }

    const hasAll = requiredPermissions.every((p) => req.user!.permissions.includes(p));
    if (!hasAll) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Sizda ushbu amalni bajarish uchun yetarli vakolat mavjud emas.',
          details: [{ field: 'requiredPermissions', issue: requiredPermissions.join(', ') }],
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        },
      });
    }

    next();
  };
}

export function requireAnyPermission(...requiredPermissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Tizimga kirish talab qilinadi.',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        },
      });
    }

    if (req.user.isSuperAdmin) {
      return next();
    }

    const hasAny = requiredPermissions.some((p) => req.user!.permissions.includes(p));
    if (!hasAny) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Sizda ushbu amalni bajarish uchun yetarli vakolat mavjud emas.',
          details: [{ field: 'requiredPermissions', issue: requiredPermissions.join(', ') }],
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        },
      });
    }

    next();
  };
}

/**
 * Tenant izolyatsiyasini tekshiradi (boshqa restoranning resursiga kirishni to'sadi)
 */
export async function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Tizimga kirish talab qilinadi.' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }

  const requestedTenant = req.params.restaurantId || (req.body && req.body.restaurantId);

  // Super Admin tekshiruvi: avtomatik kirish yo'q, faqat tekshirilgan Support Session orqali
  if (req.user.isSuperAdmin) {
    if (requestedTenant && req.user.activeRestaurantId && requestedTenant === req.user.activeRestaurantId) {
      return next();
    }

    const supportToken = (req.headers['x-support-token'] || req.headers['x-support-access-token']) as string | undefined;
    if (!supportToken) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'SUPPORT_SESSION_REQUIRED',
          message: 'Super admin ushbu restoran ma\'lumotlariga kirishi uchun sabab ko\'rsatilgan faol yordam sessiyasi talab qilinadi.',
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    const tokenHash = crypto.createHash('sha256').update(supportToken).digest('hex');
    const supportAccess = await prisma.supportAccess.findFirst({
      where: {
        tokenHash,
        restaurantId: requestedTenant,
        superAdminUserId: req.user.id,
        revokedAt: null,
      },
    });

    if (!supportAccess || supportAccess.expiresAt <= new Date()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'SUPPORT_SESSION_EXPIRED',
          message: 'Yordam sessiyasi muddati tugagan yoki bekor qilingan.',
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    // Read-only rejimi tekshiruvi: O'zgartirishlar rad etiladi
    if (supportAccess.isReadOnly && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'SUPPORT_READ_ONLY',
          message: 'Yordam sessiyasi faqat o\'qish rejimida. O\'zgartirish kiritish taqiqlanadi.',
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    (req as any).supportAccess = supportAccess;
    return next();
  }

  if (requestedTenant && req.user.activeRestaurantId && requestedTenant !== req.user.activeRestaurantId) {
    const activeRest = await prisma.restaurant.findUnique({
      where: { id: req.user.activeRestaurantId },
      select: { id: true, slug: true },
    });
    if (activeRest && (activeRest.slug === requestedTenant || activeRest.id === requestedTenant)) {
      req.restaurantId = activeRest.id;
      return next();
    }

    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resurs topilmadi yoki boshqa restoranga tegishli.',
      },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }

  next();
}

/**
 * CSRF Himoyasi (Cookie asosidagi POST/PATCH/DELETE mutatsiyalari uchun)
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Xavfsiz HTTP metodlarida CSRF talab qilinmaydi
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Faqat sessiya cookie orqali kelgan so'rovlarda CSRF tekshiriladi
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    const csrfCookie = req.cookies[CSRF_COOKIE_NAME];
    const csrfHeader = req.headers['x-csrf-token'];

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: 'Xavfsizlik tekshiruvi: CSRF tokeni yaroqsiz yoki mos emas.',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        },
      });
    }
  }

  next();
}

/**
 * Faqat platforma Super Adminlari uchun ruxsat beruvchi guard
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Tizimga kirish talab qilinadi.' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }

  if (!req.user.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      error: { code: 'SUPER_ADMIN_REQUIRED', message: 'Faqat platforma Super Admini ushbu amalni bajara oladi.' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }

  next();
}

