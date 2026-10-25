import { Router, Request, Response } from 'express';
import { requireAuth, requireSuperAdmin } from '../auth/auth.middleware.js';
import { platformService } from './platform.service.js';
import { authService } from '../auth/auth.service.js';
import {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  CSRF_COOKIE_OPTIONS,
} from '../auth/auth.constants.js';

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
 * 4.1. PATCH /api/v1/platform/restaurants/:restaurantId/roles
 * Restoran uchun ruxsat etilgan rollarni yangilash (Super Admin)
 */
platformRouter.patch('/restaurants/:restaurantId/roles', async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;
    const { allowedRoles } = req.body;
    if (!Array.isArray(allowedRoles)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLES', message: 'allowedRoles massiv bo\'lishi shart' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }

    const data = await platformService.updateRestaurantRoles(
      restaurantId,
      allowedRoles,
      req.user!.id,
      req.ip
    );

    return res.status(200).json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    console.error('Platform update restaurant roles error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Restoran rollarini yangilashda xatolik' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 4.2. DELETE /api/v1/platform/restaurants/:restaurantId
 * Restoranni butunlay o'chirish (Super Admin)
 */
platformRouter.delete('/restaurants/:restaurantId', async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;
    const data = await platformService.deleteRestaurant(restaurantId, req.user!.id, req.ip);
    return res.status(200).json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    if (err.message?.includes('RESTAURANT_NOT_FOUND')) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESTAURANT_NOT_FOUND', message: 'Restoran topilmadi' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    }
    console.error('Platform delete restaurant error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || "Restoranni o'chirishda xatolik yuz berdi" },
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
 * 6.1. POST /api/v1/platform/restaurants/:restaurantId/enter-as-boss
 * Super Admin sifatida restoranga Boshliq bo'lib to'g'ridan-to'g'ri kirish
 */
platformRouter.post('/restaurants/:restaurantId/enter-as-boss', async (req: Request, res: Response) => {
  try {
    const restaurantId = req.params.restaurantId;
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const result = await authService.switchRestaurant(req.user!.id, restaurantId, ip);

    res.cookie(SESSION_COOKIE_NAME, result.sessionToken, SESSION_COOKIE_OPTIONS);
    res.cookie(CSRF_COOKIE_NAME, result.csrfToken, CSRF_COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    console.error('Enter as boss error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Restoranga kirishda xatolik' },
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

/**
 * 8. GET /api/v1/platform/restaurants/:restaurantId/owner-credentials
 * Restoran boshqaruvchisi (Boss) telefon va parolini real-time ko'rish
 */
platformRouter.get('/restaurants/:restaurantId/owner-credentials', async (req: Request, res: Response) => {
  try {
    const data = await platformService.getOwnerCredentials(req.params.restaurantId);
    return res.status(200).json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Ma\'lumotlarni olishda xatolik' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 8. PATCH /api/v1/platform/restaurants/:restaurantId/owner-credentials
 * Restoran egasi (Boss) telefon va parolini yangilash
 */
platformRouter.patch('/restaurants/:restaurantId/owner-credentials', async (req: Request, res: Response) => {
  try {
    const { ownerPhone, newPassword } = req.body;
    const data = await platformService.updateOwnerCredentials(
      req.user!,
      req.params.restaurantId,
      { ownerPhone, newPassword },
      req.ip || '127.0.0.1'
    );

    return res.status(200).json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    console.error('Platform update owner credentials error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Boss ma\'lumotlarini yangilashda xatolik' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 9. GET /api/v1/platform/settings
 * Global platforma sozlamalarini olish
 */
platformRouter.get('/settings', async (_req: Request, res: Response) => {
  const data = await platformService.getPlatformSettings();
  return res.status(200).json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
  });
});

/**
 * 10. PATCH /api/v1/platform/settings
 * Global platforma sozlamalarini yangilash
 */
platformRouter.patch('/settings', async (req: Request, res: Response) => {
  try {
    const data = await platformService.updatePlatformSettings(
      req.user!,
      req.body,
      req.ip || '127.0.0.1'
    );
    return res.status(200).json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Sozlamalarni yangilashda xatolik' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * 11. PATCH /api/v1/platform/admin-password va /admin-credentials
 * Super Admin shaxsiy telefon va parolini yangilash
 */
const handleAdminCredentialsUpdate = async (req: Request, res: Response) => {
  try {
    const { newPassword, phone } = req.body;
    const data = await platformService.updateAdminCredentials(
      req.user!,
      { phone, newPassword },
      req.ip || '127.0.0.1'
    );
    return res.status(200).json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Ma\'lumotlarni yangilashda xatolik' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
};

platformRouter.patch('/admin-password', handleAdminCredentialsUpdate);
platformRouter.patch('/admin-credentials', handleAdminCredentialsUpdate);

/**
 * 12. GET /api/v1/platform/leads
 * Bosh sahifadan kelgan barcha arizalar (lidlar) ro'yxati
 */
platformRouter.get('/leads', async (_req: Request, res: Response) => {
  const leads = await platformService.getLeads();
  return res.status(200).json({
    success: true,
    data: { leads },
    meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
  });
});

/**
 * 13. PATCH /api/v1/platform/leads/:id
 * Ariza statusini o'zgartirish (NEW, CONTACTED, CONVERTED)
 */
platformRouter.patch('/leads/:id', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const lead = await platformService.updateLeadStatus(req.params.id, status);
    return res.status(200).json({
      success: true,
      data: lead,
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Arizani yangilashda xatolik' },
      meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
    });
  }
});

/**
 * Ommaviy /public router - Landing sahifasi uchun
 */
export const publicPlatformRouter = Router();

publicPlatformRouter.get('/contact-info', async (_req: Request, res: Response) => {
  const settings = await platformService.getPlatformSettings();
  return res.status(200).json({
    success: true,
    data: {
      supportPhone: settings.supportPhone,
      supportTelegram: settings.supportTelegram,
      supportInstagram: (settings as any).supportInstagram ?? '',
      platformName: settings.platformName,
    },
  });
});

publicPlatformRouter.post('/leads', async (req: Request, res: Response) => {
  try {
    const { name, phone, region, plan, note } = req.body;
    const lead = await platformService.createLead({ name, phone, region, plan, note });
    return res.status(201).json({
      success: true,
      data: lead,
      message: 'Arizangiz muvaffaqiyatli qabul qilindi! Tez orada siz bilan bog\'lanamiz.',
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Ariza yuborishda xatolik yuz berdi' },
    });
  }
});
