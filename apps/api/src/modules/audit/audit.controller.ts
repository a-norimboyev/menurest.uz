import { Router, Request, Response } from 'express';
import { requireAuth, requireTenant, requirePermission } from '../auth/auth.middleware.js';
import { auditService } from './audit.service.js';

export const auditRouter = Router({ mergeParams: true });

/**
 * 1. GET /api/v1/restaurants/:restaurantId/audit
 * Audit loglarni olish (Filter va sahifalash bilan)
 */
auditRouter.get(
  ['/', '/logs'],
  requireAuth,
  requireTenant,
  requirePermission('audit.view'),
  async (req: Request, res: Response) => {
    try {
      const restaurantId = req.params.restaurantId;
      const { action, actorId, from, to, page, limit } = req.query as {
        action?: string;
        actorId?: string;
        from?: string;
        to?: string;
        page?: string;
        limit?: string;
      };

      const result = await auditService.getAuditLogs(restaurantId, {
        action,
        actorId,
        from,
        to,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      return res.status(200).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      console.error('Audit logs error:', err);
      return res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Audit jurnali olishda xatolik.' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }
  }
);

/**
 * 2. GET /api/v1/restaurants/:restaurantId/audit/export
 * Audit loglarni CSV formatida xavfsiz yuklab olish
 */
auditRouter.get(
  '/export',
  requireAuth,
  requireTenant,
  requirePermission('audit.view'),
  async (req: Request, res: Response) => {
    try {
      const restaurantId = req.params.restaurantId;
      const { action, actorId, from, to } = req.query as {
        action?: string;
        actorId?: string;
        from?: string;
        to?: string;
      };

      const csvData = await auditService.exportAuditLogsCsv(restaurantId, {
        action,
        actorId,
        from,
        to,
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit_logs_${restaurantId.substring(0, 8)}.csv"`
      );
      return res.status(200).send(csvData);
    } catch (err: any) {
      console.error('Audit export error:', err);
      return res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Auditni eksport qilishda xatolik.' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }
  }
);
