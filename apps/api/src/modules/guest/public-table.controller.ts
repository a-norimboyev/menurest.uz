import crypto from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../db.js';
import { GUEST_SESSION_COOKIE_NAME } from './guest.middleware.js';
import { TableStatus, VisitStatus } from '@menurest/shared';

export const publicTableRouter = Router();

/**
 * 1. Statik QR orqali stol ma'lumotlarini o'qish (Unauthenticated Public)
 * Ommaviy API stolning faol tashrif sirini (pinCode) yoki ichki IDlarini oshkor qilmaydi.
 */
publicTableRouter.get('/tables/:qrToken', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qrToken } = req.params;

    const table = await prisma.table.findUnique({
      where: { qrToken },
      include: {
        hall: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            phone: true,
            address: true,
            currency: true,
            isActive: true,
          },
        },
      },
    });

    if (!table) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TABLE_NOT_FOUND',
          message: 'Ushbu QR kod eskirgan yoki stol topilmadi.',
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    if (!table.restaurant.isActive) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'RESTAURANT_INACTIVE',
          message: 'Ushbu restoran hozirda faol emas.',
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    // Stol holati bo'yicha mehmon uchun tushunarli matn
    let statusMessage = '';
    if (table.status === TableStatus.FREE) {
      statusMessage = 'Stol hozir bo\'sh. Buyurtma berish uchun ofitsiantga murojaat qiling yoki tashrif ochilishini kuting.';
    } else if (table.status === TableStatus.DIRTY) {
      statusMessage = 'Stol tozalanmoqda. Iltimos, xodimga murojaat qiling.';
    } else if (table.status === TableStatus.OCCUPIED) {
      statusMessage = 'Stol band. Buyurtma berish uchun ofitsiant bergan kirish kodini kiriting.';
    }

    res.status(200).json({
      success: true,
      data: {
        table: {
          number: table.number,
          capacity: table.capacity,
          status: table.status,
          hallName: table.hall.name,
        },
        restaurant: {
          id: table.restaurant.id,
          name: table.restaurant.name,
          slug: table.restaurant.slug,
          phone: table.restaurant.phone,
          address: table.restaurant.address,
          currency: table.restaurant.currency,
        },
        statusMessage,
        canJoin: table.status === TableStatus.OCCUPIED,
      },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. Tashrifga kirish kodi orqali qo'shilish (Join Visit with Code)
 * Rate-limiting: 5 marta xato urinishdan so'ng 2 daqiqaga bloklanadi.
 * Muvaffaqiyatli bo'lsa, xavfsiz tasodifiy token chiqariladi, uning SHA-256 hashi DBda saqlanadi.
 */
publicTableRouter.post('/tables/:qrToken/join', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qrToken } = req.params;
    const { code, deviceInfo } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Kirish kodi kiritilishi shart' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    const table = await prisma.table.findUnique({
      where: { qrToken },
      include: {
        visits: {
          where: { status: VisitStatus.ACTIVE },
        },
      },
    });

    if (!table) {
      return res.status(404).json({
        success: false,
        error: { code: 'TABLE_NOT_FOUND', message: 'Ushbu QR kod eskirgan yoki stol topilmadi' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    if (table.status !== TableStatus.OCCUPIED || table.visits.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TABLE_NOT_OCCUPIED',
          message: 'Ushbu stolda hozirda faol tashrif mavjud emas. Avval xodimga murojaat qiling.',
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    const visit = table.visits[0];

    // 1. Lockout tekshiruvi (Rate limiting)
    if (visit.lockedUntil && visit.lockedUntil > new Date()) {
      const waitSeconds = Math.ceil((visit.lockedUntil.getTime() - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: `Ko'p xato urinishlar tufayli kod kiritish vaqtincha bloklandi. Iltimos, ${waitSeconds} soniya kuting yoki ofitsiantga murojaat qiling.`,
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    // 2. Kod tekshiruvi (plain yoki hash orqali)
    const inputHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
    const isMatch = code.trim() === visit.pinCode || (visit.pinCodeHash && inputHash === visit.pinCodeHash);

    if (!isMatch) {
      const newFailed = visit.failedAttempts + 1;
      const shouldLock = newFailed >= 5;
      const lockedUntil = shouldLock ? new Date(Date.now() + 2 * 60 * 1000) : null;

      await prisma.visit.update({
        where: { id: visit.id },
        data: {
          failedAttempts: newFailed,
          lockedUntil,
        },
      });

      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TABLE_CODE',
          message: shouldLock
            ? '5 marta noto\'g\'ri kod kiritildi. Xavfsizlik yuzasidan 2 daqiqaga bloklandi.'
            : `Noto'g'ri stol kodi. Qolgan urinishlar soni: ${5 - newFailed}.`,
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    // 3. Kod to'g'ri: Failed attempts ni tozalash
    if (visit.failedAttempts > 0 || visit.lockedUntil) {
      await prisma.visit.update({
        where: { id: visit.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
    }

    // 4. Kuchli tasodifiy guest session token hosil qilish
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 6 * 3600 * 1000); // 6 soat amal qiladi

    // DBda hashini saqlash
    await prisma.guestSession.create({
      data: {
        visitId: visit.id,
        restaurantId: table.restaurantId,
        tableId: table.id,
        tokenHash,
        deviceInfo: deviceInfo || null,
        expiresAt,
        isRevoked: false,
      },
    });

    // HttpOnly Cookie o'rnatish
    res.cookie(GUEST_SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 6 * 3600 * 1000,
    });

    res.status(200).json({
      success: true,
      data: {
        sessionToken: rawToken,
        table: {
          number: table.number,
        },
        visit: {
          openedAt: visit.openedAt,
        },
      },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err) {
    next(err);
  }
});
