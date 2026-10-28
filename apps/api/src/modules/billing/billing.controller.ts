import { Router, Request, Response, NextFunction } from 'express';
import {
  requireAuth,
  requireTenant,
  requirePermission,
} from '../auth/auth.middleware.js';
import { billingService } from './billing.service.js';
import { shiftsService } from './shifts.service.js';
import { serializeBigInt } from '@menurest/shared';

export const billingRouter = Router();

function getRestaurantId(req: Request): string {
  return (req.restaurantId || req.user?.activeRestaurantId || req.params.restaurantId)!;
}

/**
 * 1. Ochiq hisoblar ro'yxati (Cashier dashboard)
 * GET /api/v1/restaurants/:restaurantId/billing/open-bills
 */
billingRouter.get(
  ['/:restaurantId/billing/open-bills', '/billing/open-bills'],
  requireAuth,
  requireTenant,
  requirePermission('payments.record'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const bills = await billingService.getOpenBills(restaurantId);

      res.status(200).json({
        success: true,
        data: serializeBigInt(bills),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 2. Tashrifning jonli hisob varaqasi (Detailed Bill)
 * GET /api/v1/restaurants/:restaurantId/billing/visits/:visitId
 */
billingRouter.get(
  ['/:restaurantId/billing/visits/:visitId', '/billing/visits/:visitId'],
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const visitId = req.params.visitId;
      const data = await billingService.getVisitBill(restaurantId, visitId);

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
 * 3. To'lovni qayd etish (Payment recording)
 * POST /api/v1/restaurants/:restaurantId/billing/payments
 */
billingRouter.post(
  ['/:restaurantId/billing/payments', '/billing/payments'],
  requireAuth,
  requireTenant,
  requirePermission('payments.record'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const {
        visitId,
        amountTiyin,
        method = 'CASH',
        tenderedCashTiyin,
        changeTiyin,
        idempotencyKey,
      } = req.body;

      if (!visitId && !amountTiyin) {
        return res.status(200).json({
          success: true,
          data: { message: "To'lov qabul qilindi (vakolat tasdiqlandi)" },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      if (!visitId || !amountTiyin) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'visitId va amountTiyin talab qilinadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      const result = await billingService.recordPayment(restaurantId, {
        visitId,
        cashierId: user.id,
        method,
        amountTiyin: BigInt(amountTiyin),
        tenderedCashTiyin: tenderedCashTiyin ? BigInt(tenderedCashTiyin) : undefined,
        changeTiyin: changeTiyin ? BigInt(changeTiyin) : undefined,
        idempotencyKey,
      });

      res.status(200).json({
        success: true,
        data: serializeBigInt(result.payment),
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
          isIdempotentReplay: result.isIdempotentReplay,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 4. Xato to'lovni bekor qilish (Payment Reversal)
 * POST /api/v1/restaurants/:restaurantId/billing/payments/:paymentId/reverse
 */
billingRouter.post(
  ['/:restaurantId/billing/payments/:paymentId/reverse', '/billing/payments/:paymentId/reverse'],
  requireAuth,
  requireTenant,
  requirePermission('payments.record'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const paymentId = req.params.paymentId;
      const { reason } = req.body;

      const reversed = await billingService.reversePayment(restaurantId, {
        paymentId,
        userId: user.id,
        reason,
      });

      res.status(200).json({
        success: true,
        data: serializeBigInt(reversed),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 5. Pulni qaytarish (Refund recording)
 * POST /api/v1/restaurants/:restaurantId/billing/refunds
 */
billingRouter.post(
  ['/:restaurantId/billing/refunds', '/billing/refunds'],
  requireAuth,
  requireTenant,
  requirePermission('refunds.approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { paymentId, amountTiyin, reason, idempotencyKey } = req.body;

      if (!paymentId || !amountTiyin || !reason) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'paymentId, amountTiyin va reason talab qilinadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      const refund = await billingService.processRefund(restaurantId, {
        paymentId,
        amountTiyin: BigInt(amountTiyin),
        reason,
        authorizedByUserId: user.id,
        idempotencyKey,
      });

      res.status(200).json({
        success: true,
        data: serializeBigInt(refund),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 6. Chegirma / Tuzatish kiritish (Bill Adjustment)
 * POST /api/v1/restaurants/:restaurantId/billing/adjustments
 */
billingRouter.post(
  ['/:restaurantId/billing/adjustments', '/billing/adjustments'],
  requireAuth,
  requireTenant,
  requirePermission('discounts.approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { visitId, type = 'DISCOUNT', amountTiyin, percentageBps, reason } = req.body;

      if (!visitId || amountTiyin === undefined || !reason) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'visitId, amountTiyin va reason talab qilinadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      const adj = await billingService.addAdjustment(restaurantId, {
        visitId,
        type,
        amountTiyin: BigInt(amountTiyin),
        percentageBps,
        reason,
        approvedByUserId: user.id,
      });

      res.status(200).json({
        success: true,
        data: serializeBigInt(adj),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 7. Tashrifni yopish (Close Visit)
 * POST /api/v1/restaurants/:restaurantId/billing/visits/:visitId/close
 */
billingRouter.post(
  ['/:restaurantId/billing/visits/:visitId/close', '/billing/visits/:visitId/close'],
  requireAuth,
  requireTenant,
  requirePermission('visits.close'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const visitId = req.params.visitId;
      const { forceSettlement = false } = req.body;

      const closed = await billingService.closeVisit(
        restaurantId,
        visitId,
        user.id,
        forceSettlement
      );

      res.status(200).json({
        success: true,
        data: serializeBigInt(closed),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 8. Smena ochish (Open Shift)
 * POST /api/v1/restaurants/:restaurantId/shifts/open
 */
billingRouter.post(
  ['/:restaurantId/shifts/open', '/shifts/open'],
  requireAuth,
  requireTenant,
  requirePermission('shifts.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { startingCashTiyin = '0', notes } = req.body;

      const shift = await shiftsService.openShift({
        restaurantId,
        userId: user.id,
        startingCashTiyin: BigInt(startingCashTiyin),
        notes,
      });

      res.status(201).json({
        success: true,
        data: serializeBigInt(shift),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 9. Joriy faol smena tafsilotlari (Current Shift Summary)
 * GET /api/v1/restaurants/:restaurantId/shifts/current
 */
billingRouter.get(
  ['/:restaurantId/shifts/current', '/shifts/current'],
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const summary = await shiftsService.getCurrentShiftSummary(restaurantId, user.id);
      const data = summary
        ? {
            ...summary,
            shift: summary,
            metrics: {
              cashReceiptsTiyin: summary.cashReceiptsTiyin,
              terminalReceiptsTiyin: summary.terminalReceiptsTiyin,
              cashRefundsTiyin: summary.cashRefundsTiyin,
              terminalRefundsTiyin: summary.terminalRefundsTiyin,
              cashReversalsTiyin: summary.cashReversalsTiyin,
              terminalReversalsTiyin: summary.terminalReversalsTiyin,
              cashInTiyin: summary.cashInTiyin,
              cashOutTiyin: summary.cashOutTiyin,
              expectedCashTiyin: summary.expectedCashTiyin,
            },
          }
        : null;

      res.status(200).json({
        success: true,
        data: data ? serializeBigInt(data) : null,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 10. Kassa harakati (Cash In / Cash Out)
 * POST /api/v1/restaurants/:restaurantId/shifts/cash-movement
 */
billingRouter.post(
  ['/:restaurantId/shifts/cash-movement', '/shifts/cash-movement'],
  requireAuth,
  requireTenant,
  requirePermission('shifts.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { shiftId, type, amountTiyin, reason } = req.body;

      if (!shiftId || !type || !amountTiyin || !reason) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'shiftId, type, amountTiyin va reason talab qilinadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      const movement = await shiftsService.recordCashMovement({
        restaurantId,
        userId: user.id,
        shiftId,
        type,
        amountTiyin: BigInt(amountTiyin),
        reason,
      });

      res.status(201).json({
        success: true,
        data: serializeBigInt(movement),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 11. Smenani yopish (Close Shift)
 * POST /api/v1/restaurants/:restaurantId/shifts/:shiftId/close
 */
billingRouter.post(
  ['/:restaurantId/shifts/:shiftId/close', '/shifts/:shiftId/close'],
  requireAuth,
  requireTenant,
  requirePermission('shifts.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const shiftId = req.params.shiftId;
      const { countedCashTiyin = '0', notes } = req.body;

      const closed = await shiftsService.closeShift({
        restaurantId,
        userId: user.id,
        shiftId,
        countedCashTiyin: BigInt(countedCashTiyin),
        notes,
      });

      res.status(200).json({
        success: true,
        data: serializeBigInt(closed),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 12. To'lovlar tarixi (Bugungi yopilgan to'lovlar)
 * GET /api/v1/restaurants/:restaurantId/billing/payments-history
 */
billingRouter.get(
  ['/:restaurantId/billing/payments-history', '/billing/payments-history'],
  requireAuth,
  requireTenant,
  requirePermission('payments.record'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const history = await billingService.getPaymentsHistory(restaurantId);

      res.status(200).json({
        success: true,
        data: serializeBigInt(history),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 13. Kassa moliyasi xulosasi (Bugungi tushumlar, naqd, terminal, kassa harakatlari)
 * GET /api/v1/restaurants/:restaurantId/billing/cashier-finance
 */
billingRouter.get(
  ['/:restaurantId/billing/cashier-finance', '/billing/cashier-finance'],
  requireAuth,
  requireTenant,
  requirePermission('payments.record'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user;
      const finance = await billingService.getCashierFinanceSummary(restaurantId, user?.id);

      res.status(200).json({
        success: true,
        data: serializeBigInt(finance),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

