import { Router, Request, Response } from 'express';
import { authService } from './auth.service.js';
import {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  CSRF_COOKIE_OPTIONS,
} from './auth.constants.js';
import { requireAuth, csrfProtection } from './auth.middleware.js';
import { Role } from '@menurest/shared';

export const authRouter = Router();

/**
 * 1. POST /api/v1/auth/login
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { phone, password, restaurantId } = req.body;
    if (!phone || !password) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Telefon raqami va parol kiritilishi shart.',
        },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const result = await authService.login(phone, password, ip, restaurantId);

    // Cookie larni o'rnatish
    res.cookie(SESSION_COOKIE_NAME, result.sessionToken, SESSION_COOKIE_OPTIONS);
    res.cookie(CSRF_COOKIE_NAME, result.csrfToken, CSRF_COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        activeRestaurant: result.activeRestaurant,
        membershipsCount: result.membershipsCount,
        roles: result.roles,
        permissions: result.permissions,
        csrfToken: result.csrfToken,
        // Non-browser mijozlar uchun token
        token: result.sessionToken,
      },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Kirishda xatolik yuz berdi.',
        details: err.details,
      },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 2. POST /api/v1/auth/logout
 */
authRouter.post('/logout', requireAuth, csrfProtection, async (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });

  return res.status(200).json({
    success: true,
    data: { message: 'Tizimdan muvaffaqiyatli chiqildi.' },
    meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
  });
});

/**
 * 3. GET /api/v1/auth/me
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = await authService.getMe(req.user!.id, req.user!.activeRestaurantId);
    return res.status(200).json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Xatolik yuz berdi.',
      },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 4. POST /api/v1/auth/switch-restaurant
 */
authRouter.post('/switch-restaurant', requireAuth, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.body;
    if (!restaurantId) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Restoran ID ko\'rsatilmadi.' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const result = await authService.switchRestaurant(req.user!.id, restaurantId, ip);

    res.cookie(SESSION_COOKIE_NAME, result.sessionToken, SESSION_COOKIE_OPTIONS);
    res.cookie(CSRF_COOKIE_NAME, result.csrfToken, CSRF_COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      data: {
        activeRestaurant: result.activeRestaurant,
        roles: result.roles,
        permissions: result.permissions,
        csrfToken: result.csrfToken,
        token: result.sessionToken,
      },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Restoran almashtirishda xatolik.',
      },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 5. POST /api/v1/auth/change-password
 */
authRouter.post('/change-password', requireAuth, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Eski va yangi parolni kiriting.' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const result = await authService.changePassword(req.user!.id, oldPassword, newPassword, ip);

    // Yangi parol bilan qayta login qilishni so'raymiz yoki yangi sessiya beramiz
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });

    return res.status(200).json({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Parolni o\'zgartirishda xatolik.',
      },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 6. POST /api/v1/auth/update-credentials
 * Telefon raqami va/yoki parolni yangilash
 */
authRouter.post('/update-credentials', requireAuth, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPhone, newPassword } = req.body;
    if (!currentPassword) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'O\'zgarishlarni tasdiqlash uchun amaldagi parolingizni kiriting.' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const result = await authService.updateCredentials(
      req.user!.id,
      { currentPassword, newPhone, newPassword },
      ip
    );

    // Yangi yaratilgan xavfsiz sessiya cookie larini o'rnatish
    res.cookie(SESSION_COOKIE_NAME, result.sessionToken, SESSION_COOKIE_OPTIONS);
    res.cookie(CSRF_COOKIE_NAME, result.csrfToken, CSRF_COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      data: {
        message: result.message,
        user: result.user,
        csrfToken: result.csrfToken,
      },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Ma\'lumotlarni yangilashda xatolik yuz berdi.',
      },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 7. POST /api/v1/auth/profile
 * Xodim profilini (ism va telefon) yangilash
 */
authRouter.post('/profile', requireAuth, csrfProtection, async (req: Request, res: Response) => {
  try {
    const { fullName, phone } = req.body;
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const result = await authService.updateProfile(req.user!.id, { fullName, phone }, ip);

    if (result.sessionToken && result.csrfToken) {
      res.cookie(SESSION_COOKIE_NAME, result.sessionToken, SESSION_COOKIE_OPTIONS);
      res.cookie(CSRF_COOKIE_NAME, result.csrfToken, CSRF_COOKIE_OPTIONS);
    }

    return res.status(200).json({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Profilni yangilashda xatolik yuz berdi.',
      },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});
