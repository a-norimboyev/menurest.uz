import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../db.js';

export const GUEST_SESSION_COOKIE_NAME = 'menurest_guest_session';

export interface GuestSessionContext {
  id: string; // guestSessionId
  visitId: string;
  tableId: string;
  restaurantId: string;
}

declare global {
  namespace Express {
    interface Request {
      guest?: GuestSessionContext;
    }
  }
}

/**
 * Mehmon sessiyasini tekshiruvchi middleware
 */
export async function requireGuestSession(req: Request, res: Response, next: NextFunction) {
  try {
    let rawToken: string | undefined;

    if (req.cookies && req.cookies[GUEST_SESSION_COOKIE_NAME]) {
      rawToken = req.cookies[GUEST_SESSION_COOKIE_NAME];
    } else if (req.headers.authorization?.startsWith('Bearer ')) {
      rawToken = req.headers.authorization.substring(7);
    } else if (req.headers['x-guest-token']) {
      rawToken = req.headers['x-guest-token'] as string;
    } else if (req.query && typeof req.query.token === 'string') {
      rawToken = req.query.token;
    }

    if (!rawToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'GUEST_SESSION_REQUIRED',
          message: 'Mehmon sessiyasi talab qilinadi. Iltimos, stol kodini kiriting.',
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    // Tokenning SHA-256 hashini hisoblash
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const session = await prisma.guestSession.findUnique({
      where: { tokenHash },
      include: {
        visit: {
          include: {
            table: true,
          },
        },
      },
    });

    if (!session || session.isRevoked) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'GUEST_SESSION_REVOKED',
          message: 'Mehmon sessiyasi bekor qilingan yoki mavjud emas.',
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    if (session.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'GUEST_SESSION_EXPIRED',
          message: 'Mehmon sessiyasining amal qilish muddati tugagan.',
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    // Tashrif faol holatda bo'lishi shart
    if (session.visit.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'VISIT_CLOSED',
          message: 'Ushbu stoldagi tashrif yakunlangan. Yangi buyurtma berish uchun yangi tashrif kodi talab qilinadi.',
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    // Oxirgi faollik vaqtini yangilash (fon rejimida)
    prisma.guestSession.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    }).catch(() => {});

    req.guest = {
      id: session.id,
      visitId: session.visitId,
      tableId: session.visit.tableId,
      restaurantId: session.visit.restaurantId,
    };

    next();
  } catch (err) {
    next(err);
  }
}
