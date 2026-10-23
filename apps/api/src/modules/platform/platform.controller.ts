import { Router, Request, Response } from 'express';
import { requireAuth, requireSuperAdmin } from '../auth/auth.middleware.js';
import { platformService } from './platform.service.js';

export const platformRouter = Router();

// Barcha platforma endpointlari faqat Super Admin uchun ochiq
platformRouter.use(requireAuth, requireSuperAdmin);

/**
 * 1. GET /api/v1/platform/overview
 * Platforma texnik agregatsiyalari va xizmat holati
 */
platformRouter.get('/overview', async (_req: Request, res: Response) => {
  try {
    const data = await platformService.getOverview();
    return res.status(200).json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    console.error('Platform overview error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Platforma ma\'lumotlarini olishda xatolik' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 2. GET /api/v1/platform/restaurants
 * Restoranlar ro'yxati (filtrlash va sahifalash bilan)
 */
platformRouter.get('/restaurants', async (req: Request, res: Response) => {
  try {
    const { search, status, page, limit } = req.query as {
      search?: string;
      status?: string;
      page?: string;
      limit?: string;
    };

    const data = await platformService.listRestaurants({
      search,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return res.status(200).json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    console.error('Platform restaurants list error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Restoranlar ro\'yxatini olishda xatolik' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 3. POST /api/v1/platform/restaurants
 * Yangi restoran va uning Boss membershipini yaratish
 */
platformRouter.post('/restaurants', async (req: Request, res: Response) => {
  try {
    const data = await platformService.createRestaurant(req.body, req.user!.id, req.ip);
    return res.status(201).json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    if (err.message?.includes('VALIDATION_ERROR') || err.message?.includes('SLUG_ALREADY_EXISTS') || err.message?.includes('OWNER_REQUIRED')) {
      return res.status(400).json({
        success: false,
        error: { code: err.message.split(':')[0], message: err.message.split(':')[1]?.trim() || err.message },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }
    console.error('Platform create restaurant error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Restoran yaratishda xatolik' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 4. PATCH /api/v1/platform/restaurants/:restaurantId/status
 * Restoran holatini ACTIVE yoki SUSPENDED qilish (tarif va xizmat muddati bilan)
 */
platformRouter.patch('/restaurants/:restaurantId/status', async (req: Request, res: Response) => {
  try {
    const { status, reason, subscriptionExpiresAt, subscriptionPlan } = req.body;
    if (!status || !['ACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Holat faqat ACTIVE yoki SUSPENDED bo\'lishi mumkin' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    const data = await platformService.updateRestaurantStatus(
      req.params.restaurantId,
      { status, reason, subscriptionExpiresAt, subscriptionPlan },
      req.user!.id,
      req.ip
    );

    return res.status(200).json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    if (err.message?.includes('REASON_REQUIRED') || err.message?.includes('RESTAURANT_NOT_FOUND')) {
      const code = err.message.split(':')[0];
      const status = code === 'RESTAURANT_NOT_FOUND' ? 404 : 400;
      return res.status(status).json({
        success: false,
        error: { code, message: err.message.split(':')[1]?.trim() || err.message },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }
    console.error('Platform update restaurant status error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Restoran holatini yangilashda xatolik' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 5. POST /api/v1/platform/restaurants/:restaurantId/support-session
 * Vaqtinchalik Yordam (Support Session) ochish
 */
platformRouter.post('/restaurants/:restaurantId/support-session', async (req: Request, res: Response) => {
  try {
    const { reason, expiresInMinutes, isReadOnly } = req.body;
    const data = await platformService.createSupportSession(
      req.params.restaurantId,
      { reason, expiresInMinutes, isReadOnly },
      req.user!.id,
      req.ip
    );

    return res.status(201).json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    if (err.message?.includes('REASON_REQUIRED') || err.message?.includes('RESTAURANT_NOT_FOUND')) {
      const code = err.message.split(':')[0];
      const status = code === 'RESTAURANT_NOT_FOUND' ? 404 : 400;
      return res.status(status).json({
        success: false,
        error: { code, message: err.message.split(':')[1]?.trim() || err.message },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }
    console.error('Platform support session error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Support sessiyasi ochishda xatolik' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 6. POST /api/v1/platform/restaurants/:restaurantId/support-session/revoke
 * Faol Yordam (Support Session) ni bekor qilish
 */
platformRouter.post('/restaurants/:restaurantId/support-session/revoke', async (req: Request, res: Response) => {
  try {
    const { supportToken } = req.body;
    const data = await platformService.revokeSupportSession(
      req.params.restaurantId,
      supportToken,
      req.user!.id,
      req.ip
    );

    return res.status(200).json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    console.error('Platform revoke support session error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Support sessiyasini bekor qilishda xatolik' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 7. GET /api/v1/platform/audit
 * Platforma Audit jurnali (Super Admin harakatlari)
 */
platformRouter.get('/audit', async (req: Request, res: Response) => {
  try {
    const { page, limit, action } = req.query as {
      page?: string;
      limit?: string;
      action?: string;
    };

    const data = await platformService.getPlatformAuditLogs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      action,
    });

    return res.status(200).json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    console.error('Platform audit logs error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Platform audit jurnali olishda xatolik' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});
