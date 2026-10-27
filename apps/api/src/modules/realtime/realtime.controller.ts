import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireTenant, requirePermission } from '../auth/auth.middleware.js';
import { requireGuestSession } from '../guest/guest.middleware.js';
import { realtimeService } from './realtime.service.js';
import { outboxService, recordOutboxEvent } from './outbox.service.js';
import { kdsService } from '../kds/kds.service.js';
import { prisma } from '../../db.js';
import { Role, PaymentMethod, PaymentStatus, serializeBigInt } from '@menurest/shared';

export const realtimeRouter = Router({ mergeParams: true });

function getRestaurantId(req: Request): string {
  return (req.restaurantId || req.user?.activeRestaurantId || req.params.restaurantId)!;
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
 * 1. Xodimlar uchun Real-vaqt SSE oqimi
 * GET /api/v1/restaurants/:restaurantId/events
 */
realtimeRouter.get(
  ['/:restaurantId/events', '/events'],
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const isManager = checkIsManager(req);

      // Agar xodim oshxona bo'lsa, unga biriktirilgan stansiyalarni aniqlaymiz
      let stationIds: string[] | undefined;
      if (user.roles.includes(Role.KITCHEN) && !isManager) {
        const accessible = await kdsService.getAccessibleStationIds(restaurantId, user.id, isManager);
        if (accessible.isScoped) {
          stationIds = accessible.stationIds;
        }
      }

      realtimeService.setupSseHeaders(res);

      const clientId = `staff_${user.id}_${Date.now()}`;
      realtimeService.registerStaffClient({
        id: clientId,
        res,
        userId: user.id,
        restaurantId,
        roles: user.roles,
        permissions: user.permissions,
        stationIds,
        isManager,
        connectedAt: new Date(),
      });

      // Cursor bo'yicha o'tkazib yuborilgan eventlarni qayta yuborish (Replay)
      const lastEventId = (req.headers['last-event-id'] || req.query.lastEventId) as string;
      if (lastEventId) {
        const missed = await outboxService.getMissedEvents(restaurantId, lastEventId);
        if (missed.syncRequired) {
          realtimeService.sendRaw(res, 'sync.required', {
            message: 'O\'tkazib yuborilgan eventlar hajmi katta, to\'liq snapshot talab qilinadi',
          });
        } else {
          for (const evt of missed.events) {
            realtimeService.broadcastEvent(evt);
          }
        }
      }
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 2. Mehmon uchun Real-vaqt SSE oqimi
 * GET /api/v1/guest/events
 */
export const guestRealtimeRouter = Router();

guestRealtimeRouter.get(
  '/events',
  requireGuestSession,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guest = req.guest!;
      realtimeService.setupSseHeaders(res);

      const clientId = `guest_${guest.id}_${Date.now()}`;
      realtimeService.registerGuestClient({
        id: clientId,
        res,
        restaurantId: guest.restaurantId,
        tableId: guest.tableId,
        visitId: guest.visitId,
        connectedAt: new Date(),
      });

      // Cursor replay
      const lastEventId = (req.headers['last-event-id'] || req.query.lastEventId) as string;
      if (lastEventId) {
        const missed = await outboxService.getMissedEvents(guest.restaurantId, lastEventId);
        if (missed.syncRequired) {
          realtimeService.sendRaw(res, 'sync.required', {
            message: 'O\'tkazib yuborilgan eventlar hajmi katta, to\'liq snapshot talab qilinadi',
          });
        } else {
          for (const evt of missed.events) {
            // Faqat shu mehmonga tegishli eventlarni replay qilish
            if (evt.scope?.visitId === guest.visitId) {
              realtimeService.sendEvent(res, evt);
            }
          }
        }
      }
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 3. To'lovni qayd etish (Payment recording - Cashier / Manager)
 * POST /api/v1/restaurants/:restaurantId/payments
 */
realtimeRouter.post(
  ['/:restaurantId/payments', '/payments'],
  requireAuth,
  requireTenant,
  requirePermission('payments.record'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { visitId, amountTiyin, method = 'CASH', idempotencyKey } = req.body;

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
          error: { code: 'INVALID_INPUT', message: 'visitId va amountTiyin kiritilishi shart' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      const amountBigInt = BigInt(amountTiyin);
      if (amountBigInt <= 0n) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_AMOUNT', message: 'To\'lov summasi musbat bo\'lishi kerak' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      const visit = await prisma.visit.findFirst({
        where: { id: visitId, restaurantId },
        include: { table: true },
      });

      if (!visit) {
        return res.status(404).json({
          success: false,
          error: { code: 'VISIT_NOT_FOUND', message: 'Tashrif topilmadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      // Tranzaksiya ichida Payment yaratish va OutboxEvent yozish
      const result = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            restaurantId,
            visitId,
            cashierId: user.id,
            method: method as PaymentMethod,
            amountTiyin: amountBigInt,
            status: PaymentStatus.COMPLETED,
            idempotencyKey: idempotencyKey || null,
          },
        });

        // 1. payment.recorded outbox hodisasi (Moliya - faqat kassa/menejer, oshxonaga KETMAYDI!)
        await recordOutboxEvent(tx, {
          restaurantId,
          eventType: 'payment.recorded',
          data: {
            paymentId: payment.id,
            visitId,
            tableId: visit.tableId,
            tableNumber: visit.table.number,
            amountTiyin: payment.amountTiyin.toString(),
            method: payment.method,
            cashierId: user.id,
            createdAt: payment.createdAt.toISOString(),
          },
          scope: {
            visitId,
            tableId: visit.tableId,
            isFinancial: true,
          },
        });

        // 2. bill.updated outbox hodisasi
        await recordOutboxEvent(tx, {
          restaurantId,
          eventType: 'bill.updated',
          data: {
            visitId,
            tableId: visit.tableId,
            paidAmountTiyin: payment.amountTiyin.toString(),
            updatedAt: new Date().toISOString(),
          },
          scope: {
            visitId,
            tableId: visit.tableId,
            isFinancial: true,
          },
        });

        await tx.auditLog.create({
          data: {
            restaurantId,
            action: 'PAYMENT_RECORDED',
            actorId: user.id,
            entityName: 'Payment',
            entityId: payment.id,
            newStateJson: { amountTiyin: payment.amountTiyin.toString(), method: payment.method },
          },
        });

        return payment;
      });

      // Trigger outbox immediate cycle
      outboxService.trigger();

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
 * 4. Qaytarishni qayd etish (Refund recording - Manager / Boss)
 * POST /api/v1/restaurants/:restaurantId/refunds
 */
realtimeRouter.post(
  ['/:restaurantId/refunds', '/refunds'],
  requireAuth,
  requireTenant,
  requirePermission('refunds.approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = getRestaurantId(req);
      const user = req.user!;
      const { paymentId, amountTiyin, reason } = req.body;

      if (!paymentId || !amountTiyin || !reason) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'paymentId, amountTiyin va reason talab qilinadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      const payment = await prisma.payment.findFirst({
        where: { id: paymentId, restaurantId },
        include: { visit: { include: { table: true } } },
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: { code: 'PAYMENT_NOT_FOUND', message: 'To\'lov topilmadi' },
          meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
        });
      }

      const refundAmount = BigInt(amountTiyin);

      const result = await prisma.$transaction(async (tx) => {
        const refund = await tx.refund.create({
          data: {
            restaurantId,
            paymentId,
            authorizedByUserId: user.id,
            amountTiyin: refundAmount,
            reason,
          },
        });

        // 1. refund.recorded outbox
        await recordOutboxEvent(tx, {
          restaurantId,
          eventType: 'refund.recorded',
          data: {
            refundId: refund.id,
            paymentId,
            visitId: payment.visitId,
            amountTiyin: refund.amountTiyin.toString(),
            reason,
            approvedByUserId: user.id,
            createdAt: refund.createdAt.toISOString(),
          },
          scope: {
            visitId: payment.visitId,
            tableId: payment.visit.tableId,
            isFinancial: true,
          },
        });

        // 2. bill.updated outbox
        await recordOutboxEvent(tx, {
          restaurantId,
          eventType: 'bill.updated',
          data: {
            visitId: payment.visitId,
            tableId: payment.visit.tableId,
            refundedAmountTiyin: refund.amountTiyin.toString(),
            updatedAt: new Date().toISOString(),
          },
          scope: {
            visitId: payment.visitId,
            tableId: payment.visit.tableId,
            isFinancial: true,
          },
        });

        return refund;
      });

      outboxService.trigger();

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
