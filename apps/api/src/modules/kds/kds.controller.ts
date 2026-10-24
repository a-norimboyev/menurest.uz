import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireTenant, requirePermission } from '../auth/auth.middleware.js';
import { kdsService } from './kds.service.js';
import { Role } from '@menurest/shared';
import { serializeBigInt } from '../menu/menu.utils.js';

export const kdsRouter = Router({ mergeParams: true });

function getRestaurantId(req: Request): string {
  return (req.params.restaurantId || req.restaurantId || req.user?.activeRestaurantId)!;
}

function checkIsManager(req: Request): boolean {
  const user = req.user!;
  return (
    user.roles.includes(Role.MANAGER) ||
    user.roles.includes(Role.BOSS) ||
    user.isSuperAdmin
  );
}

/**
 * 1. Stansiyalar ro'yxati
 * GET /api/v1/restaurants/:restaurantId/kds/stations
 */
kdsRouter.get(
  ['/:restaurantId/kds/stations', '/kds/stations'],
  requireAuth,
  requireTenant,
  requirePermission('items.prepare'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const isManager = checkIsManager(req);

      const result = await kdsService.getStations(restaurantId, user.id, isManager);

      res.status(200).json({
        success: true,
        data: serializeBigInt(result),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 2. KDS Chiptalari (Tickets) ro'yxati
 * GET /api/v1/restaurants/:restaurantId/kds/tickets
 */
kdsRouter.get(
  ['/:restaurantId/kds/tickets', '/kds/tickets'],
  requireAuth,
  requireTenant,
  requirePermission('items.prepare'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const isManager = checkIsManager(req);

      const result = await kdsService.getTickets(restaurantId, user.id, isManager, {
        stationId: req.query.stationId as string,
        status: req.query.status as string,
        sort: req.query.sort as 'oldest' | 'newest',
      });

      res.status(200).json({
        success: true,
        data: serializeBigInt(result),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('STATION_ACCESS_DENIED')) {
        return res.status(403).json({
          success: false,
          error: { code: 'STATION_ACCESS_DENIED', message: msg.split(':')[1]?.trim() || msg },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

/**
 * 3. Taomni tayyorlashni boshlash (Prepare Item)
 * POST /api/v1/restaurants/:restaurantId/kds/items/:id/prepare
 */
kdsRouter.post(
  ['/:restaurantId/kds/items/:id/prepare', '/kds/items/:id/prepare'],
  requireAuth,
  requireTenant,
  requirePermission('items.prepare'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const isManager = checkIsManager(req);
      const { id } = req.params;
      const { expectedVersion } = req.body;

      const result = await kdsService.prepareItem(
        restaurantId,
        id,
        user.id,
        isManager,
        expectedVersion
      );

      res.status(200).json({
        success: true,
        data: serializeBigInt(result),
        meta: {
          isIdempotentReplay: result.isIdempotentReplay,
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        },
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('ITEM_NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          error: { code: 'ITEM_NOT_FOUND', message: 'Taom topilmadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('STATION_ACCESS_DENIED')) {
        return res.status(403).json({
          success: false,
          error: { code: 'STATION_ACCESS_DENIED', message: msg.split(':')[1]?.trim() || msg },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('ITEM_VERSION_CONFLICT')) {
        return res.status(409).json({
          success: false,
          error: { code: 'ITEM_VERSION_CONFLICT', message: msg.split(':')[1]?.trim() || msg },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (
        msg.includes('CANNOT_PREPARE_CANCELLED') ||
        msg.includes('ORDER_NOT_CONFIRMED') ||
        msg.includes('INVALID_STATUS_TRANSITION')
      ) {
        return res.status(400).json({
          success: false,
          error: { code: msg.split(':')[0], message: msg.split(':')[1]?.trim() || msg },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

/**
 * 4. Taomni tayyor deb belgilash (Ready Item)
 * POST /api/v1/restaurants/:restaurantId/kds/items/:id/ready
 */
kdsRouter.post(
  ['/:restaurantId/kds/items/:id/ready', '/kds/items/:id/ready'],
  requireAuth,
  requireTenant,
  requirePermission('items.prepare'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const isManager = checkIsManager(req);
      const { id } = req.params;
      const { expectedVersion } = req.body;

      const result = await kdsService.readyItem(
        restaurantId,
        id,
        user.id,
        isManager,
        expectedVersion
      );

      res.status(200).json({
        success: true,
        data: serializeBigInt(result),
        meta: {
          isIdempotentReplay: result.isIdempotentReplay,
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        },
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('ITEM_NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          error: { code: 'ITEM_NOT_FOUND', message: 'Taom topilmadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('STATION_ACCESS_DENIED')) {
        return res.status(403).json({
          success: false,
          error: { code: 'STATION_ACCESS_DENIED', message: msg.split(':')[1]?.trim() || msg },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('ITEM_VERSION_CONFLICT')) {
        return res.status(409).json({
          success: false,
          error: { code: 'ITEM_VERSION_CONFLICT', message: msg.split(':')[1]?.trim() || msg },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (
        msg.includes('CANNOT_READY_CANCELLED') ||
        msg.includes('ORDER_NOT_CONFIRMED') ||
        msg.includes('CANNOT_READY_SERVED')
      ) {
        return res.status(400).json({
          success: false,
          error: { code: msg.split(':')[0], message: msg.split(':')[1]?.trim() || msg },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

/**
 * 5. Tanlangan taomlar holatini ommaviy yangilash (Bulk Action)
 * POST /api/v1/restaurants/:restaurantId/kds/items/bulk-status
 */
kdsRouter.post(
  ['/:restaurantId/kds/items/bulk-status', '/kds/items/bulk-status'],
  requireAuth,
  requireTenant,
  requirePermission('items.prepare'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const isManager = checkIsManager(req);
      const { itemIds, targetStatus } = req.body;

      const result = await kdsService.bulkUpdateStatus(
        restaurantId,
        itemIds,
        targetStatus,
        user.id,
        isManager
      );

      res.status(200).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('STATION_ACCESS_DENIED')) {
        return res.status(403).json({
          success: false,
          error: { code: 'STATION_ACCESS_DENIED', message: msg.split(':')[1]?.trim() || msg },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('EMPTY_SELECTION') || msg.includes('ITEM_NOT_FOUND')) {
        return res.status(400).json({
          success: false,
          error: { code: msg.split(':')[0], message: msg.split(':')[1]?.trim() || msg },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

/**
 * 6. "Tayyorlab bo'lmaydi" (Cannot Prepare) Harakati
 * POST /api/v1/restaurants/:restaurantId/kds/items/:id/cannot-prepare
 */
kdsRouter.post(
  ['/:restaurantId/kds/items/:id/cannot-prepare', '/kds/items/:id/cannot-prepare'],
  requireAuth,
  requireTenant,
  requirePermission('items.prepare'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const isManager = checkIsManager(req);
      const { id } = req.params;
      const { reason, expectedVersion } = req.body;

      const result = await kdsService.cannotPrepareItem(
        restaurantId,
        id,
        user.id,
        isManager,
        reason,
        expectedVersion
      );

      res.status(200).json({
        success: true,
        data: serializeBigInt(result),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('REASON_REQUIRED')) {
        return res.status(400).json({
          success: false,
          error: { code: 'REASON_REQUIRED', message: 'Rad etish sababi ko\'rsatilishi shart' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('STATION_ACCESS_DENIED')) {
        return res.status(403).json({
          success: false,
          error: { code: 'STATION_ACCESS_DENIED', message: msg.split(':')[1]?.trim() || msg },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('ITEM_NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          error: { code: 'ITEM_NOT_FOUND', message: 'Taom topilmadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('CANNOT_CANCEL_SERVED')) {
        return res.status(400).json({
          success: false,
          error: { code: 'CANNOT_CANCEL_SERVED', message: 'Mehmonga yetkazilgan taomni bekor qilib bo\'lmaydi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

/**
 * 7. Xodimni stansiyalarga biriktirish (Boss / Manager)
 * POST /api/v1/restaurants/:restaurantId/kds/staff/:userId/stations
 */
kdsRouter.post(
  ['/:restaurantId/kds/staff/:userId/stations', '/kds/staff/:userId/stations'],
  requireAuth,
  requireTenant,
  requirePermission('staff.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { userId } = req.params;
      const { stationIds } = req.body;

      if (!Array.isArray(stationIds)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PAYLOAD', message: 'stationIds massiv bo\'lishi shart' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      const result = await kdsService.assignStaffStations(
        restaurantId,
        userId,
        stationIds,
        user.id
      );

      res.status(200).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('STAFF_NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          error: { code: 'STAFF_NOT_FOUND', message: 'Xodim topilmadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('INVALID_STATION_TENANT')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATION_TENANT', message: 'Begona stansiyani biriktirib bo\'lmaydi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

/**
 * 8. Xodimning biriktirilgan stansiyalarini ko'rish (Boss / Manager)
 * GET /api/v1/restaurants/:restaurantId/kds/staff/:userId/stations
 */
kdsRouter.get(
  ['/:restaurantId/kds/staff/:userId/stations', '/kds/staff/:userId/stations'],
  requireAuth,
  requireTenant,
  requirePermission('staff.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const { userId } = req.params;

      const result = await kdsService.getStaffStations(restaurantId, userId);

      res.status(200).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);
