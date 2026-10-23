import { Router, Request, Response } from 'express';
import { requireAuth, requireTenant, requirePermission, csrfProtection } from '../auth/auth.middleware.js';
import { settingsService } from './settings.service.js';

export const settingsRouter = Router({ mergeParams: true });

/**
 * 1. GET /api/v1/restaurants/:restaurantId/settings
 */
settingsRouter.get(
  '/',
  requireAuth,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const restaurantId = req.params.restaurantId;
      const settings = await settingsService.getSettings(restaurantId);

      return res.status(200).json({
        success: true,
        data: settings,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Sozlamalarni olishda xatolik.' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }
  }
);

/**
 * 2. PATCH /api/v1/restaurants/:restaurantId/settings
 * Faqat settings.manage ruxsati bor xodimlar (Boss / SuperAdmin)
 */
settingsRouter.patch(
  '/',
  requireAuth,
  requireTenant,
  requirePermission('settings.manage'),
  csrfProtection,
  async (req: Request, res: Response) => {
    try {
      const restaurantId = req.params.restaurantId;
      const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

      const updated = await settingsService.updateSettings(
        req.user!,
        restaurantId,
        req.body,
        ip
      );

      return res.status(200).json({
        success: true,
        data: updated,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Sozlamalarni yangilashda xatolik.' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }
  }
);
