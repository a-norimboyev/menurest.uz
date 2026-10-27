import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireTenant, requirePermission } from '../auth/auth.middleware.js';
import { waiterService } from './waiter.service.js';
import { Role } from '@menurest/shared';
import { serializeBigInt } from '../menu/menu.utils.js';

export const waiterRouter = Router({ mergeParams: true });

function getRestaurantId(req: Request): string {
  return (req.restaurantId || req.user?.activeRestaurantId || req.params.restaurantId)!;
}

/**
 * 1. Ofitsiant Asosiy Dashboardi
 * GET /api/v1/restaurants/:restaurantId/waiter/dashboard
 */
waiterRouter.get(
  ['/:restaurantId/waiter/dashboard', '/waiter/dashboard'],
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const isManager =
        user.roles.includes(Role.MANAGER) || user.roles.includes(Role.BOSS) || user.isSuperAdmin;

      const data = await waiterService.getDashboard(restaurantId, user.id, isManager);

      res.status(200).json({
        success: true,
        data: serializeBigInt(data),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 2. Xizmat chaqiruvini qabul qilish (Claim)
 * POST /api/v1/restaurants/:restaurantId/waiter/service-calls/:id/claim
 */
waiterRouter.post(
  ['/:restaurantId/waiter/service-calls/:id/claim', '/waiter/service-calls/:id/claim'],
  requireAuth,
  requireTenant,
  requirePermission('calls.claim'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { id } = req.params;
      const isManager =
        user.roles.includes(Role.MANAGER) || user.roles.includes(Role.BOSS) || user.isSuperAdmin;

      const result = await waiterService.claimServiceCall(restaurantId, id, user.id, isManager);

      res.status(200).json({
        success: true,
        data: serializeBigInt(result.call),
        meta: {
          isIdempotentReplay: result.isIdempotentReplay,
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        },
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('CALL_ALREADY_CLAIMED')) {
        return res.status(409).json({
          success: false,
          error: { code: 'CALL_ALREADY_CLAIMED', message: 'Boshqa xodim qabul qilgan' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('NOT_ASSIGNED_WAITER')) {
        return res.status(403).json({
          success: false,
          error: { code: 'NOT_ASSIGNED_WAITER', message: 'Ushbu stol boshqa ofitsiantga biriktirilgan' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('CALL_NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          error: { code: 'CALL_NOT_FOUND', message: 'Chaqiruv topilmadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

/**
 * 3. Xizmat chaqiruvini yakunlash (Resolve)
 * POST /api/v1/restaurants/:restaurantId/waiter/service-calls/:id/resolve
 */
waiterRouter.post(
  ['/:restaurantId/waiter/service-calls/:id/resolve', '/waiter/service-calls/:id/resolve'],
  requireAuth,
  requireTenant,
  requirePermission('calls.claim'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { id } = req.params;
      const isManager =
        user.roles.includes(Role.MANAGER) || user.roles.includes(Role.BOSS) || user.isSuperAdmin;

      const result = await waiterService.resolveServiceCall(restaurantId, id, user.id, isManager);

      res.status(200).json({
        success: true,
        data: serializeBigInt(result.call),
        meta: {
          isIdempotentReplay: result.isIdempotentReplay,
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        },
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('FORBIDDEN')) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Faqat qabul qilgan ofitsiant chaqiruvni yakunlay oladi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('CALL_NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          error: { code: 'CALL_NOT_FOUND', message: 'Chaqiruv topilmadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

/**
 * 4. Menejer tomonidan chaqiruvni boshqa ofitsiantga o'tkazish (Reassign)
 * POST /api/v1/restaurants/:restaurantId/waiter/service-calls/:id/reassign
 */
waiterRouter.post(
  ['/:restaurantId/waiter/service-calls/:id/reassign', '/waiter/service-calls/:id/reassign'],
  requireAuth,
  requireTenant,
  requirePermission('staff.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { id } = req.params;
      const { targetWaiterId, reason } = req.body;

      if (!targetWaiterId) {
        return res.status(400).json({
          success: false,
          error: { code: 'TARGET_WAITER_REQUIRED', message: 'Yangi ofitsiant tanlanishi shart' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      const updated = await waiterService.reassignServiceCall(
        restaurantId,
        id,
        user.id,
        targetWaiterId,
        reason
      );

      res.status(200).json({
        success: true,
        data: serializeBigInt(updated),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('CALL_NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          error: { code: 'CALL_NOT_FOUND', message: 'Chaqiruv topilmadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('CANNOT_REASSIGN')) {
        return res.status(400).json({
          success: false,
          error: { code: 'CANNOT_REASSIGN', message: msg.split(':')[1]?.trim() || msg },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

/**
 * 5. Chaqiruvni bekor qilish (Cancel)
 * POST /api/v1/restaurants/:restaurantId/waiter/service-calls/:id/cancel
 */
waiterRouter.post(
  ['/:restaurantId/waiter/service-calls/:id/cancel', '/waiter/service-calls/:id/cancel'],
  requireAuth,
  requireTenant,
  requirePermission('calls.claim'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { id } = req.params;
      const { reason } = req.body;

      const cancelled = await waiterService.cancelServiceCall(restaurantId, id, user.id, reason);

      res.status(200).json({
        success: true,
        data: serializeBigInt(cancelled),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('REASON_REQUIRED')) {
        return res.status(400).json({
          success: false,
          error: { code: 'REASON_REQUIRED', message: 'Bekor qilish sababi kiritilishi shart' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

/**
 * 6. Mehmon buyurtmasini tasdiqlash (Confirm Order)
 * POST /api/v1/restaurants/:restaurantId/waiter/orders/:id/confirm
 */
waiterRouter.post(
  ['/:restaurantId/waiter/orders/:id/confirm', '/waiter/orders/:id/confirm'],
  requireAuth,
  requireTenant,
  requirePermission('orders.confirm'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { id } = req.params;

      const result = await waiterService.confirmOrder(restaurantId, id, user.id);

      res.status(200).json({
        success: true,
        data: serializeBigInt(result.order),
        meta: {
          isIdempotentReplay: result.isIdempotentReplay,
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        },
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('ORDER_NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Buyurtma topilmadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('CANNOT_CONFIRM_CANCELLED') || msg.includes('INVALID_ORDER_STATUS')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ORDER_STATUS', message: msg.split(':')[1]?.trim() || msg },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

/**
 * 7. Mehmon buyurtmasini sabab bilan rad etish (Reject Order)
 * POST /api/v1/restaurants/:restaurantId/waiter/orders/:id/reject
 */
waiterRouter.post(
  ['/:restaurantId/waiter/orders/:id/reject', '/waiter/orders/:id/reject'],
  requireAuth,
  requireTenant,
  requirePermission('orders.confirm'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { id } = req.params;
      const { reason } = req.body;

      const result = await waiterService.rejectOrder(restaurantId, id, user.id, reason);

      res.status(200).json({
        success: true,
        data: serializeBigInt(result.order),
        meta: {
          isIdempotentReplay: result.isIdempotentReplay,
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        },
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
      if (msg.includes('CANNOT_CANCEL_SERVED')) {
        return res.status(400).json({
          success: false,
          error: { code: 'CANNOT_CANCEL_SERVED', message: 'Yetkazilgan buyurtmani bekor qilib bo\'lmaydi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

/**
 * 8. Tayyor taomni yetkazilgan deb belgilash (Serve Item)
 * POST /api/v1/restaurants/:restaurantId/waiter/items/:id/serve
 * Qat'iy Invariant: Faqat READY holatidagi taom SERVED qilinishi mumkin!
 */
waiterRouter.post(
  ['/:restaurantId/waiter/items/:id/serve', '/waiter/items/:id/serve'],
  requireAuth,
  requireTenant,
  requirePermission('items.serve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { id } = req.params;

      const result = await waiterService.serveItem(restaurantId, id, user.id);

      res.status(200).json({
        success: true,
        data: serializeBigInt({
          item: result.item,
          orderStatus: result.newOrderStatus,
        }),
        meta: {
          isIdempotentReplay: result.isIdempotentReplay,
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        },
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('CANNOT_SERVE_UNREADY_ITEM')) {
        return res.status(400).json({
          success: false,
          error: { code: 'CANNOT_SERVE_UNREADY_ITEM', message: msg.split(':')[1]?.trim() || msg },
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
      next(err);
    }
  }
);

/**
 * 9. Ofitsiant tomonidan mehmon nomidan buyurtma yaratish (Staff Order)
 * POST /api/v1/restaurants/:restaurantId/waiter/orders
 */
waiterRouter.post(
  ['/:restaurantId/waiter/orders', '/waiter/orders'],
  requireAuth,
  requireTenant,
  requirePermission('orders.create_staff'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const isManager =
        user.roles.includes(Role.MANAGER) || user.roles.includes(Role.BOSS) || user.isSuperAdmin;

      const order = await waiterService.createStaffOrder(restaurantId, user.id, req.body, isManager);

      res.status(201).json({
        success: true,
        data: serializeBigInt(order),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('NOT_ASSIGNED_WAITER')) {
        return res.status(403).json({
          success: false,
          error: { code: 'NOT_ASSIGNED_WAITER', message: 'Ushbu stol boshqa ofitsiantga biriktirilgan' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('RESTAURANT_SUSPENDED')) {
        return res.status(403).json({
          success: false,
          error: { code: 'RESTAURANT_SUSPENDED', message: msg.split(':')[1]?.trim() || msg },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (
        msg.includes('VISIT_NOT_ACTIVE') ||
        msg.includes('EMPTY_ORDER') ||
        msg.includes('ITEM_UNAVAILABLE') ||
        msg.includes('VARIANT_UNAVAILABLE') ||
        msg.includes('ADDON_UNAVAILABLE')
      ) {
        return res.status(400).json({
          success: false,
          error: { code: msg.split(':')[0], message: msg.split(':')[1]?.trim() || msg },
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
      next(err);
    }
  }
);

/**
 * 10. Stolni o'ziga biriktirish (Claim Table)
 * POST /api/v1/restaurants/:restaurantId/waiter/tables/:tableId/claim
 */
waiterRouter.post(
  ['/:restaurantId/waiter/tables/:tableId/claim', '/waiter/tables/:tableId/claim'],
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { tableId } = req.params;
      const isManager =
        user.roles.includes(Role.MANAGER) || user.roles.includes(Role.BOSS) || user.isSuperAdmin;

      const result = await waiterService.claimTable(restaurantId, tableId, user.id, isManager);
      res.status(200).json({
        success: true,
        data: serializeBigInt(result),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('TABLE_NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          error: { code: 'TABLE_NOT_FOUND', message: 'Stol topilmadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (msg.includes('TABLE_ALREADY_ASSIGNED')) {
        return res.status(409).json({
          success: false,
          error: { code: 'TABLE_ALREADY_ASSIGNED', message: msg.split(':')[1]?.trim() || msg },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

/**
 * 11. Stol biriktirilishini bekor qilish (Unclaim Table)
 * POST /api/v1/restaurants/:restaurantId/waiter/tables/:tableId/unclaim
 */
waiterRouter.post(
  ['/:restaurantId/waiter/tables/:tableId/unclaim', '/waiter/tables/:tableId/unclaim'],
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { tableId } = req.params;
      const isManager =
        user.roles.includes(Role.MANAGER) || user.roles.includes(Role.BOSS) || user.isSuperAdmin;

      const result = await waiterService.unclaimTable(restaurantId, tableId, user.id, isManager);
      res.status(200).json({
        success: true,
        data: serializeBigInt(result),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('FORBIDDEN')) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Siz faqat o\'zingizga biriktirilgan stolni ajrata olasiz' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);
