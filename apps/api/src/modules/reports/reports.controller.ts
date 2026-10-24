import { Router, Request, Response } from 'express';
import { requireAuth, requireTenant, requirePermission } from '../auth/auth.middleware.js';
import { reportsService } from './reports.service.js';

export const reportsRouter = Router({ mergeParams: true });

/**
 * 1. GET /api/v1/restaurants/:restaurantId/reports/dashboard
 * Boss Dashboard Asosiy Ko'rsatkichlari (Kun chegarasi: Asia/Tashkent)
 */
reportsRouter.get(
  ['/dashboard', '/boss-kpi', '/summary'],
  requireAuth,
  requireTenant,
  requirePermission('reports.view'),
  async (req: Request, res: Response) => {
    try {
      const restaurantId = req.params.restaurantId;
      const dateStr = req.query.date as string | undefined;

      const metrics = await reportsService.getBossDashboardMetrics(restaurantId, dateStr);

      return res.status(200).json({
        success: true,
        data: {
          restaurantId: metrics.restaurantId,
          currency: metrics.currency,
          date: metrics.date,
          todayOrdersTotalTiyin: metrics.todayOrdersTotalTiyin.toString(),
          todayDiscountsTiyin: metrics.todayDiscountsTiyin.toString(),
          todayServiceFeeTiyin: metrics.todayServiceFeeTiyin.toString(),
          todayServiceChargeTiyin: (metrics.todayServiceChargeTiyin ?? metrics.todayServiceFeeTiyin).toString(),
          todayPaymentsTiyin: metrics.todayPaymentsTiyin.toString(),
          todayGrossPaymentsTiyin: (metrics.todayGrossPaymentsTiyin ?? metrics.todayPaymentsTiyin).toString(),
          todayRefundsTiyin: metrics.todayRefundsTiyin.toString(),
          todayNetRevenueTiyin: (metrics.todayNetRevenueTiyin ?? 0n).toString(),
          openDebtTiyin: metrics.openDebtTiyin.toString(),
          refundDueTiyin: metrics.refundDueTiyin.toString(),
          activeVisitsCount: metrics.activeVisitsCount,
          activeTablesCount: metrics.activeTablesCount,
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      console.error('Error fetching dashboard metrics:', err);
      return res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Hisobotni olishda xatolik yuz berdi.' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }
  }
);

/**
 * 2. GET /api/v1/restaurants/:restaurantId/reports/operations
 * Manager Operatsion Ko'rsatkichlari (Zal, stollar, kechikishlar, calls)
 */
reportsRouter.get(
  '/operations',
  requireAuth,
  requireTenant,
  requirePermission('reports.view'),
  async (req: Request, res: Response) => {
    try {
      const restaurantId = req.params.restaurantId;
      const operations = await reportsService.getManagerOperationsSummary(restaurantId);

      return res.status(200).json({
        success: true,
        data: operations,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      console.error('Error fetching operations summary:', err);
      return res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Operatsion holatni olishda xatolik.' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }
  }
);

/**
 * 3. GET /api/v1/restaurants/:restaurantId/reports/detailed
 * Davr bo'yicha batafsil hisobot (To'lovlar, buyurtmalar, mashhur taomlar, ofitsiantlar)
 */
reportsRouter.get(
  '/detailed',
  requireAuth,
  requireTenant,
  requirePermission('reports.view'),
  async (req: Request, res: Response) => {
    try {
      const restaurantId = req.params.restaurantId;
      const { from, to } = req.query as { from?: string; to?: string };

      const detailed = await reportsService.getDetailedReports(restaurantId, { from, to });

      return res.status(200).json({
        success: true,
        data: {
          ...detailed,
          paymentsSummary: {
            ...detailed.paymentsSummary,
            grossPaymentsTiyin: detailed.paymentsSummary.grossPaymentsTiyin.toString(),
            cashPaymentsTiyin: detailed.paymentsSummary.cashPaymentsTiyin.toString(),
            terminalPaymentsTiyin: detailed.paymentsSummary.terminalPaymentsTiyin.toString(),
            cashReversalsTiyin: detailed.paymentsSummary.cashReversalsTiyin.toString(),
            terminalReversalsTiyin: detailed.paymentsSummary.terminalReversalsTiyin.toString(),
            refundsTiyin: detailed.paymentsSummary.refundsTiyin.toString(),
            netReceiptsTiyin: detailed.paymentsSummary.netReceiptsTiyin.toString(),
          },
          ordersSummary: {
            ...detailed.ordersSummary,
            totalOrderValueTiyin: detailed.ordersSummary.totalOrderValueTiyin.toString(),
          },
          popularDishes: detailed.popularDishes.map((d) => ({
            ...d,
            totalRevenueTiyin: d.totalRevenueTiyin.toString(),
          })),
          shiftsSummary: detailed.shiftsSummary.map((s) => ({
            ...s,
            startingCashTiyin: s.startingCashTiyin.toString(),
            countedCashTiyin: s.countedCashTiyin?.toString() ?? null,
            differenceTiyin: s.differenceTiyin?.toString() ?? null,
            expectedCashTiyin: s.expectedCashTiyin?.toString() ?? null,
          })),
          waiterPerformance: detailed.waiterPerformance.map((w) => ({
            ...w,
            totalOrderValueTiyin: w.totalOrderValueTiyin.toString(),
          })),
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      console.error('Error fetching detailed reports:', err);
      return res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Hisobotni olishda xatolik.' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }
  }
);
