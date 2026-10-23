import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db.js';
import { requireGuestSession } from './guest.middleware.js';
import { ServiceCallType, ServiceCallStatus } from '@menurest/shared';
import { recordOutboxEvent, outboxService } from '../realtime/outbox.service.js';

export const guestRouter = Router();

// Barcha guestRouter endpointlari uchun faol guest session talab qilinadi
guestRouter.use(requireGuestSession);

/**
 * 1. Joriy mehmon sessiyasi va ushbu tashrifdagi umumiy buyurtmalar / hisob
 */
guestRouter.get('/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guest = req.guest!;

    const visit = await prisma.visit.findUnique({
      where: { id: guest.visitId },
      include: {
        table: {
          select: {
            id: true,
            number: true,
            capacity: true,
            status: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            currency: true,
          },
        },
        orders: {
          include: {
            items: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: { code: 'VISIT_NOT_FOUND', message: 'Tashrif topilmadi' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        guestSessionId: guest.id,
        visit: {
          id: visit.id,
          openedAt: visit.openedAt,
          status: visit.status,
        },
        table: visit.table,
        restaurant: visit.restaurant,
        orders: visit.orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          notes: o.notes,
          createdAt: o.createdAt,
          items: o.items.map((i) => ({
            id: i.id,
            name: i.snapshotName,
            priceTiyin: i.snapshotPriceTiyin.toString(),
            quantity: i.quantity,
            variantName: i.snapshotVariantName,
            status: i.status,
          })),
        })),
      },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. Ofitsiantni chaqirish yoki hisob so'rash (Anti-spam / Duplication Guard bilan)
 */
const handleCreateServiceCall = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guest = req.guest!;
    const { type = 'WAITER' } = req.body;

    const validTypes = [ServiceCallType.WAITER, ServiceCallType.BILL, ServiceCallType.WATER, ServiceCallType.CUSTOM];
    const callType = validTypes.includes(type as ServiceCallType) ? (type as ServiceCallType) : ServiceCallType.WAITER;

    // 1. Anti-spam tekshiruvi: Bir tashrifda aynan bir turdagi ochiq (PENDING yoki ACKNOWLEDGED) chaqiruv bo'lsa qayta yaratilmaydi
    const existingActiveCall = await prisma.serviceCall.findFirst({
      where: {
        visitId: guest.visitId,
        restaurantId: guest.restaurantId,
        type: callType,
        status: { in: [ServiceCallStatus.PENDING, ServiceCallStatus.ACKNOWLEDGED] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingActiveCall) {
      return res.status(200).json({
        success: true,
        data: {
          id: existingActiveCall.id,
          type: existingActiveCall.type,
          status: existingActiveCall.status,
          createdAt: existingActiveCall.createdAt,
        },
        meta: {
          isDuplicate: true,
          message: 'Ushbu so\'rov allaqachon faol, xodimga xabar yetkazilgan',
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        },
      });
    }

    // 2. Yangi chaqiruv yaratish (Tranzaksiyada outbox event bilan)
    const serviceCall = await prisma.$transaction(async (tx) => {
      const call = await tx.serviceCall.create({
        data: {
          restaurantId: guest.restaurantId,
          tableId: guest.tableId,
          visitId: guest.visitId,
          type: callType,
          status: ServiceCallStatus.PENDING,
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId: guest.restaurantId,
        eventType: 'call.created',
        payload: {
          callId: call.id,
          tableId: guest.tableId,
          visitId: guest.visitId,
          type: call.type,
          status: call.status,
        },
        scope: {
          restaurantId: guest.restaurantId,
          visitId: guest.visitId,
          tableId: guest.tableId,
        },
      });

      return call;
    });

    outboxService.trigger();

    res.status(201).json({
      success: true,
      data: {
        id: serviceCall.id,
        type: serviceCall.type,
        status: serviceCall.status,
        createdAt: serviceCall.createdAt,
      },
      meta: {
        isDuplicate: false,
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`,
      },
    });
  } catch (err) {
    next(err);
  }
};

guestRouter.post('/service-call', handleCreateServiceCall);
guestRouter.post('/service-calls', handleCreateServiceCall);
