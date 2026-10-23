import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requirePermission, requireTenant } from '../auth/auth.middleware.js';
import { visitsService } from './visits.service.js';

export const visitsRouter = Router({ mergeParams: true });

// 1. FREE stolga yangi tashrif ochish
visitsRouter.post(
  '/:restaurantId/tables/:tableId/open-visit',
  requireAuth,
  requireTenant,
  requirePermission('visits.open'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { waiterId } = req.body;
      const result = await visitsService.openVisit(
        req.params.restaurantId,
        req.params.tableId,
        waiterId,
        req.user!.id
      );

      res.status(201).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      if (err.message?.includes('TABLE_NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          error: { code: 'TABLE_NOT_FOUND', message: 'Stol topilmadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (err.message?.includes('RESTAURANT_SUSPENDED')) {
        return res.status(403).json({
          success: false,
          error: { code: 'RESTAURANT_SUSPENDED', message: err.message.split(':')[1]?.trim() || err.message },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (err.message?.includes('TABLE_NOT_FREE') || err.message?.includes('TABLE_ALREADY_OCCUPIED')) {
        return res.status(400).json({
          success: false,
          error: { code: err.message.split(':')[0], message: err.message.split(':')[1]?.trim() || err.message },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

// 2. Kirish kodini yangilash
visitsRouter.post(
  '/:restaurantId/visits/:visitId/rotate-code',
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userPerms = req.user?.permissions || [];
      const hasPerm = req.user?.isSuperAdmin || userPerms.includes('visits.open') || userPerms.includes('tables.manage');
      if (!hasPerm) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Kodni yangilash uchun ruxsat yetarli emas' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      const result = await visitsService.rotateCode(
        req.params.restaurantId,
        req.params.visitId,
        req.user!.id
      );

      res.status(200).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      if (err.message?.includes('ACTIVE_VISIT_NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          error: { code: 'ACTIVE_VISIT_NOT_FOUND', message: 'Faol tashrif topilmadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

// 3. Tashrifni yopish (Item checks va Billing checks bilan)
visitsRouter.post(
  '/:restaurantId/visits/:visitId/close',
  requireAuth,
  requireTenant,
  requirePermission('visits.close'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { forceSettlement } = req.body;
      const result = await visitsService.closeVisit(
        req.params.restaurantId,
        req.params.visitId,
        req.user!.id,
        Boolean(forceSettlement)
      );

      res.status(200).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      if (err.message?.includes('ACTIVE_VISIT_NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          error: { code: 'ACTIVE_VISIT_NOT_FOUND', message: 'Faol tashrif topilmadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      if (
        err.message?.includes('ACTIVE_ITEMS_EXIST') ||
        err.message?.includes('UNPAID_BILL_EXISTS') ||
        err.message?.includes('UNPAID_BALANCE') ||
        err.message?.includes('REFUND_DUE') ||
        err.message?.includes('OPEN_CALLS_EXIST')
      ) {
        const code = err.message.split(':')[0].trim();
        const message = err.message.split(':')[1]?.trim() || err.message;
        return res.status(400).json({
          success: false,
          error: { code, message },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);
