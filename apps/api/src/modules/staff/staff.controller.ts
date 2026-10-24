import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission, csrfProtection } from '../auth/auth.middleware.js';
import { authService } from '../auth/auth.service.js';
import { staffService } from './staff.service.js';
import { Role } from '@menurest/shared';

export const staffRouter = Router({ mergeParams: true });

function getRestaurantId(req: Request): string {
  const restId = req.params.restaurantId || req.user?.activeRestaurantId;
  if (!restId) {
    throw { statusCode: 400, code: 'RESTAURANT_REQUIRED', message: 'Faol restoran aniqlanmadi.' };
  }
  return restId;
}

/**
 * 1. GET /api/v1/staff yoki /api/v1/restaurants/:restaurantId/staff — Xodimlar ro'yxati
 */
staffRouter.get('/', requireAuth, requirePermission('staff.manage'), async (req: Request, res: Response) => {
  try {
    const restaurantId = getRestaurantId(req);
    const staffList = await staffService.listStaff(restaurantId);

    return res.status(200).json({
      success: true,
      data: staffList,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Xodimlar ro\'yxatini olishda xatolik.' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 2. POST /api/v1/staff yoki /api/v1/restaurants/:restaurantId/staff — Yangi xodim yaratish
 */
staffRouter.post('/', requireAuth, requirePermission('staff.manage'), csrfProtection, async (req: Request, res: Response) => {
  try {
    const restaurantId = getRestaurantId(req);
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const { fullName, phone, password, roles, customPermissions, stationIds, tableIds } = req.body;

    if (!fullName || !phone || !roles || !Array.isArray(roles) || roles.length === 0) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Xodim ismi, telefoni va kamida bitta roli ko\'rsatilishi shart.' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    const result = await staffService.createStaff(
      req.user!,
      restaurantId,
      { fullName, phone, password, roles, customPermissions, stationIds, tableIds },
      ip
    );

    return res.status(201).json({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Xodim yaratishda xatolik.' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 3. PATCH /api/v1/staff/:userId yoki /api/v1/restaurants/:restaurantId/staff/:userId — Xodimni tahrirlash
 */
staffRouter.patch('/:userId', requireAuth, requirePermission('staff.manage'), csrfProtection, async (req: Request, res: Response) => {
  try {
    const restaurantId = getRestaurantId(req);
    const targetUserId = req.params.userId;
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const result = await staffService.updateStaff(
      req.user!,
      restaurantId,
      targetUserId,
      req.body,
      ip
    );

    return res.status(200).json({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Xodimni tahrirlashda xatolik.' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 4. PUT /api/v1/staff/:userId/permissions — Xodim ruxsatlarini sozlash (Boss sozlamasi)
 */
staffRouter.put('/:userId/permissions', requireAuth, requirePermission('staff.manage'), csrfProtection, async (req: Request, res: Response) => {
  try {
    const restaurantId = getRestaurantId(req);
    const targetUserId = req.params.userId;
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const result = await staffService.updatePermissions(
      req.user!,
      restaurantId,
      targetUserId,
      req.body.customPermissions,
      ip
    );

    return res.status(200).json({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Ruxsatlarni yangilashda xatolik.' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 5. POST /api/v1/staff/:userId/assign-role — Eski API mosligi uchun
 */
staffRouter.post(
  '/:userId/assign-role',
  requireAuth,
  requirePermission('staff.manage'),
  csrfProtection,
  async (req: Request, res: Response) => {
    try {
      const { role } = req.body;
      const targetUserId = req.params.userId;
      const restaurantId = getRestaurantId(req);

      if (!role || !Object.values(Role).includes(role as Role)) {
        return res.status(422).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Noto\'g\'ri rol ko\'rsatildi.' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const result = await authService.assignRole(
        req.user!,
        restaurantId,
        targetUserId,
        role as Role,
        ip
      );

      return res.status(200).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'Rolni biriktirishda xatolik.',
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }
  }
);

/**
 * 6. POST /api/v1/staff/:userId/deactivate — Xodimni faolsizlantirish
 */
staffRouter.post(
  '/:userId/deactivate',
  requireAuth,
  requirePermission('staff.manage'),
  csrfProtection,
  async (req: Request, res: Response) => {
    try {
      const targetUserId = req.params.userId;
      const restaurantId = getRestaurantId(req);
      const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

      const result = await authService.deactivateStaff(req.user!, targetUserId, restaurantId, ip);

      return res.status(200).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'Xodimni faolsizlantirishda xatolik.',
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }
  }
);
