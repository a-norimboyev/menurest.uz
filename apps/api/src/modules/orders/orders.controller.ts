import { Router, Request, Response, NextFunction } from 'express';
import { requireGuestSession } from '../guest/guest.middleware.js';
import { ordersService } from './orders.service.js';

export const ordersRouter = Router();

// Barcha mehmon buyurtma amallari uchun faol mehmon sessiyasi talab qilinadi
ordersRouter.use(requireGuestSession);

/**
 * 1. Yangi buyurtma yuborish (Idempotency va Server Snapshot bilan)
 */
ordersRouter.post('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guest = req.guest!;
    const idempotencyKey =
      (req.headers['idempotency-key'] as string) ||
      (req.headers['x-idempotency-key'] as string) ||
      undefined;

    const result = await ordersService.createGuestOrder(
      guest.restaurantId,
      guest.id,
      guest.visitId,
      idempotencyKey,
      {
        ...req.body,
        visitId: guest.visitId,
      }
    );

    res.status(result.status || 201).json({
      success: true,
      data: result.data,
      meta: {
        isIdempotentReplay: result.isIdempotentReplay,
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`,
      },
    });
  } catch (err: any) {
    const msg = err.message || '';

    if (msg.includes('IDEMPOTENCY_CONFLICT') || msg.includes('PRICE_VERSION_CONFLICT')) {
      const code = msg.split(':')[0];
      const message = msg.split(':')[1]?.trim() || msg;
      return res.status(409).json({
        success: false,
        error: { code, message },
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

    if (msg.includes('VISIT_CLOSED')) {
      return res.status(401).json({
        success: false,
        error: { code: 'VISIT_CLOSED', message: msg.split(':')[1]?.trim() || msg },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    if (msg.includes('ITEM_NOT_FOUND') || msg.includes('VISIT_NOT_FOUND')) {
      return res.status(404).json({
        success: false,
        error: { code: msg.split(':')[0], message: msg.split(':')[1]?.trim() || msg },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    if (
      msg.includes('ITEM_UNAVAILABLE') ||
      msg.includes('VARIANT_UNAVAILABLE') ||
      msg.includes('ADDON_UNAVAILABLE') ||
      msg.includes('ADDON_LIMIT_VIOLATION') ||
      msg.includes('INVALID_QUANTITY') ||
      msg.includes('NOTE_TOO_LONG') ||
      msg.includes('VALIDATION_ERROR') ||
      msg.includes('INVALID_VARIANT')
    ) {
      return res.status(400).json({
        success: false,
        error: { code: msg.split(':')[0], message: msg.split(':')[1]?.trim() || msg },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    next(err);
  }
});

/**
 * 2. Tashrifning barcha buyurtmalarini ko'rish (Buyurtmalarim ekrani uchun)
 */
ordersRouter.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guest = req.guest!;
    const orders = await ordersService.getVisitOrders(guest.restaurantId, guest.visitId);

    res.status(200).json({
      success: true,
      data: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        notes: o.notes,
        createdAt: o.createdAt,
        items: o.items.map((i) => ({
          id: i.id,
          name: i.snapshotName,
          priceTiyin: i.snapshotPriceTiyin.toString(),
          variantName: i.snapshotVariantName,
          quantity: i.quantity,
          status: i.status,
          addons: i.addonSnapshots.map((a) => ({
            name: a.name,
            priceTiyin: a.priceTiyin.toString(),
          })),
        })),
      })),
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err) {
    next(err);
  }
});
