import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requirePermission, requireTenant } from '../auth/auth.middleware.js';
import { tablesService } from './tables.service.js';

export const tablesRouter = Router({ mergeParams: true });

// 1. Zallar ro'yxati
tablesRouter.get(
  '/:restaurantId/halls',
  requireAuth,
  requireTenant,
  requirePermission('tables.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const halls = await tablesService.listHalls(req.params.restaurantId);
      res.status(200).json({
        success: true,
        data: halls,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

// 2. Yangi zal yaratish
tablesRouter.post(
  '/:restaurantId/halls',
  requireAuth,
  requireTenant,
  requirePermission('tables.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body;
      const hall = await tablesService.createHall(req.params.restaurantId, name);
      res.status(201).json({
        success: true,
        data: hall,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      if (err.message?.includes('nomi')) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: err.message },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

// 3. Stollar ro'yxati
tablesRouter.get(
  '/:restaurantId/tables',
  requireAuth,
  requireTenant,
  // tables.manage yoki visits.open huquqi bor xodimlar (ofitsiant, menejer, boss)
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userPerms = req.user?.permissions || [];
      const hasPerm = req.user?.isSuperAdmin || userPerms.includes('tables.manage') || userPerms.includes('visits.open');
      if (!hasPerm) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Stollarni ko\'rish uchun ruxsat yetarli emas' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      const tables = await tablesService.listTables(req.params.restaurantId);
      res.status(200).json({
        success: true,
        data: tables,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

// 4. Yangi stol yaratish
tablesRouter.post(
  '/:restaurantId/tables',
  requireAuth,
  requireTenant,
  requirePermission('tables.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hallId, number, capacity, assignedWaiterId } = req.body;
      if (!hallId || !number) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'hallId va number kiritilishi shart' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      const table = await tablesService.createTable(req.params.restaurantId, {
        hallId,
        number: Number(number),
        capacity: capacity ? Number(capacity) : 4,
        assignedWaiterId,
      });

      res.status(201).json({
        success: true,
        data: table,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      if (err.message?.includes('INVALID_HALL_TENANT') || err.message?.includes('INVALID_WAITER_TENANT') || err.message?.includes('TABLE_NUMBER_EXISTS')) {
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

// 5. Stolni tahrirlash
tablesRouter.patch(
  '/:restaurantId/tables/:tableId',
  requireAuth,
  requireTenant,
  requirePermission('tables.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hallId, number, capacity, assignedWaiterId } = req.body;
      const table = await tablesService.updateTable(req.params.restaurantId, req.params.tableId, {
        hallId,
        number: number !== undefined ? Number(number) : undefined,
        capacity: capacity !== undefined ? Number(capacity) : undefined,
        assignedWaiterId,
      });

      res.status(200).json({
        success: true,
        data: table,
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
      if (err.message?.includes('INVALID_') || err.message?.includes('TABLE_NUMBER_EXISTS')) {
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

// 6. QR tokenni yangilash (eski QRni bekor qilish va yangisini chiqarish)
tablesRouter.post(
  '/:restaurantId/tables/:tableId/regenerate-qr',
  requireAuth,
  requireTenant,
  requirePermission('tables.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await tablesService.regenerateQrToken(req.params.restaurantId, req.params.tableId);
      res.status(200).json({
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
      next(err);
    }
  }
);

// 7. QR tasvirini olish (PNG yoki SVG)
tablesRouter.get(
  '/:restaurantId/tables/:tableId/qr',
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const format = (req.query.format as string) === 'svg' ? 'svg' : 'png';
      const origin = req.protocol + '://' + req.get('host');
      const { contentType, data } = await tablesService.generateQrCodeImage(
        req.params.restaurantId,
        req.params.tableId,
        format,
        origin
      );

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache');
      res.send(data);
    } catch (err: any) {
      if (err.message?.includes('TABLE_NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          error: { code: 'TABLE_NOT_FOUND', message: 'Stol topilmadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }
      next(err);
    }
  }
);

// 8. Stolni tozalangan deb belgilash (DIRTY -> FREE)
tablesRouter.post(
  '/:restaurantId/tables/:tableId/mark-clean',
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userPerms = req.user?.permissions || [];
      const hasPerm = req.user?.isSuperAdmin || userPerms.includes('tables.manage') || userPerms.includes('visits.open');
      if (!hasPerm) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Stolni tozalashni tasdiqlash uchun ruxsat yetarli emas' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      const updated = await tablesService.markClean(req.params.restaurantId, req.params.tableId, req.user!.id);
      res.status(200).json({
        success: true,
        data: updated,
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
      if (err.message?.includes('TABLE_NOT_DIRTY') || err.message?.includes('ACTIVE_VISIT_EXISTS')) {
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
