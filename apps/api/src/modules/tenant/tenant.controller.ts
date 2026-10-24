import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission, requireTenant } from '../auth/auth.middleware.js';
import { prisma } from '../../db.js';
import { reportsService } from '../reports/reports.service.js';

export const tenantRouter = Router();

/**
 * 1. GET /api/v1/restaurants/:restaurantId/reports/summary
 * Boss va Manager kirishi mumkin (reports.view kerak)
 * Haqiqiy server aggregatsiyasi!
 */
tenantRouter.get(
  '/:restaurantId/reports/summary',
  requireAuth,
  requireTenant,
  requirePermission('reports.view'),
  async (req: Request, res: Response) => {
    try {
      const restaurantId = req.params.restaurantId;
      const rest = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, name: true, currency: true },
      });

      const metrics = await reportsService.getBossDashboardMetrics(restaurantId);

      return res.status(200).json({
        success: true,
        data: {
          restaurant: rest,
          summary: {
            todayRevenueTiyin: metrics.todayPaymentsTiyin.toString(),
            activeTablesCount: metrics.activeTablesCount,
            todayOrdersTotalTiyin: metrics.todayOrdersTotalTiyin.toString(),
            openDebtTiyin: metrics.openDebtTiyin.toString(),
          },
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Hisobotni olishda xatolik.' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }
  }
);
