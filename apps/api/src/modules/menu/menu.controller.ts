import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth, requireTenant, requirePermission, csrfProtection } from '../auth/auth.middleware.js';
import { menuService } from './menu.service.js';
import { storageService } from '../storage/storage.service.js';
import { serializeBigInt } from './menu.utils.js';
import { prisma } from '../../db.js';

export const menuRouter = Router();
export const publicMenuRouter = Router();

// Multer memory storage configuration for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

// ==========================================
// 1. PUBLIC RESTAURANTS & MENU READ API (Unauthenticated)
// ==========================================

publicMenuRouter.get('/restaurants', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        extraPhones: true,
        telegram: true,
        instagram: true,
        address: true,
        logoUrl: true,
        bannerUrl: true,
        openingHours: true,
        subscriptionPlan: true,
        _count: {
          select: {
            tables: true,
            menuItems: { where: { isArchived: false } },
            halls: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: restaurants,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`,
      },
    });
  } catch (err) {
    next(err);
  }
});

publicMenuRouter.get('/restaurants/:slugOrId/menu', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slugOrId } = req.params;
    const lang = (req.query.lang as 'uz' | 'ru') || 'uz';
    const categoryId = req.query.categoryId as string | undefined;
    const search = req.query.search as string | undefined;

    const data = await menuService.getPublicMenu(slugOrId, lang, { categoryId, search });

    return res.status(200).json({
      success: true,
      data: serializeBigInt(data),
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. CATEGORIES MANAGEMENT (menu.manage)
// ==========================================

menuRouter.get(
  '/:restaurantId/menu/categories',
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId } = req.params;
      const categories = await menuService.listCategories(restaurantId);

      return res.status(200).json({
        success: true,
        data: serializeBigInt(categories),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

menuRouter.post(
  '/:restaurantId/menu/categories',
  requireAuth,
  requireTenant,
  requirePermission('menu.manage'),
  csrfProtection,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId } = req.params;
      const { name, sortOrder, isVisible } = req.body;

      const category = await menuService.createCategory(restaurantId, {
        name,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
        isVisible,
      });

      return res.status(201).json({
        success: true,
        data: serializeBigInt(category),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

menuRouter.patch(
  '/:restaurantId/menu/categories/:categoryId',
  requireAuth,
  requireTenant,
  requirePermission('menu.manage'),
  csrfProtection,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId, categoryId } = req.params;
      const { name, sortOrder, isVisible } = req.body;

      const updated = await menuService.updateCategory(restaurantId, categoryId, {
        name,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
        isVisible,
      });

      return res.status(200).json({
        success: true,
        data: serializeBigInt(updated),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

menuRouter.delete(
  '/:restaurantId/menu/categories/:categoryId',
  requireAuth,
  requireTenant,
  requirePermission('menu.manage'),
  csrfProtection,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId, categoryId } = req.params;
      await menuService.deleteCategory(restaurantId, categoryId);

      return res.status(200).json({
        success: true,
        data: { message: 'Kategoriya muvaffaqiyatli o\'chirildi' },
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 3. MENU ITEMS MANAGEMENT
// ==========================================

menuRouter.get(
  '/:restaurantId/menu/items',
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId } = req.params;
      const categoryId = req.query.categoryId as string | undefined;
      const isAvailable = req.query.isAvailable !== undefined ? req.query.isAvailable === 'true' : undefined;
      const search = req.query.search as string | undefined;

      const items = await menuService.listMenuItems(restaurantId, {
        categoryId,
        isAvailable,
        search,
      });

      return res.status(200).json({
        success: true,
        data: serializeBigInt(items),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

menuRouter.get(
  '/:restaurantId/menu/items/:itemId',
  requireAuth,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId, itemId } = req.params;
      const item = await menuService.getMenuItemById(restaurantId, itemId);

      return res.status(200).json({
        success: true,
        data: serializeBigInt(item),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

menuRouter.post(
  '/:restaurantId/menu/items',
  requireAuth,
  requireTenant,
  requirePermission('menu.manage'),
  csrfProtection,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId } = req.params;
      const {
        categoryId,
        stationId,
        name,
        description,
        basePriceTiyin,
        imageUrl,
        isAvailable,
        sortOrder,
        allergens,
        translations,
        variants,
        addonGroups,
      } = req.body;

      if (!name || basePriceTiyin === undefined) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Taom nomi va narxi (basePriceTiyin) maydonlari majburiy',
          },
        });
      }

      const item = await menuService.createMenuItem(restaurantId, {
        categoryId,
        stationId,
        name,
        description,
        basePriceTiyin: BigInt(basePriceTiyin),
        imageUrl,
        isAvailable,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
        allergens,
        translations,
        variants: variants?.map((v: any) => ({
          name: v.name,
          priceDifferenceTiyin: BigInt(v.priceDifferenceTiyin || 0),
          isDefault: v.isDefault,
          isAvailable: v.isAvailable,
        })),
        addonGroups: addonGroups?.map((g: any) => ({
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          options: g.options?.map((opt: any) => ({
            name: opt.name,
            priceTiyin: BigInt(opt.priceTiyin || 0),
            isAvailable: opt.isAvailable,
          })),
        })),
      });

      return res.status(201).json({
        success: true,
        data: serializeBigInt(item),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

menuRouter.patch(
  '/:restaurantId/menu/items/:itemId',
  requireAuth,
  requireTenant,
  requirePermission('menu.manage'),
  csrfProtection,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId, itemId } = req.params;
      const {
        categoryId,
        stationId,
        name,
        description,
        basePriceTiyin,
        imageUrl,
        isAvailable,
        sortOrder,
        allergens,
        translations,
        variants,
        addonGroups,
      } = req.body;

      const item = await menuService.updateMenuItem(restaurantId, itemId, {
        categoryId,
        stationId,
        name,
        description,
        basePriceTiyin: basePriceTiyin !== undefined ? BigInt(basePriceTiyin) : undefined,
        imageUrl,
        isAvailable,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
        allergens,
        translations,
        variants: variants?.map((v: any) => ({
          name: v.name,
          priceDifferenceTiyin: BigInt(v.priceDifferenceTiyin || 0),
          isDefault: v.isDefault,
          isAvailable: v.isAvailable,
        })),
        addonGroups: addonGroups?.map((g: any) => ({
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          options: g.options?.map((opt: any) => ({
            name: opt.name,
            priceTiyin: BigInt(opt.priceTiyin || 0),
            isAvailable: opt.isAvailable,
          })),
        })),
      });

      return res.status(200).json({
        success: true,
        data: serializeBigInt(item),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 4. AVAILABILITY TOGGLE
 * Allowed for staff with 'menu.availability' OR 'menu.manage'.
 * Staff with only 'menu.availability' cannot modify price or other fields!
 */
menuRouter.patch(
  '/:restaurantId/menu/items/:itemId/availability',
  requireAuth,
  requireTenant,
  csrfProtection,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userPermissions = (req as any).user?.permissions || [];
      const hasAvailability = userPermissions.includes('menu.availability');
      const hasFullManage = userPermissions.includes('menu.manage');

      if (!hasAvailability && !hasFullManage) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Taom mavjudligini o\'zgartirish uchun vakolat yetarli emas',
          },
        });
      }

      // Check for price tampering attempt
      if (req.body.basePriceTiyin !== undefined || req.body.name !== undefined) {
        if (!hasFullManage) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'PRICE_TAMPERING_FORBIDDEN',
              message: 'Sizda faqat taom mavjudligini o\'zgartirish ruxsati bor. Narxni o\'zgartirish taqiqlanadi',
            },
          });
        }
      }

      const { isAvailable } = req.body;
      if (typeof isAvailable !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'isAvailable maydoni boolean bo\'lishi shart',
          },
        });
      }

      const { restaurantId, itemId } = req.params;
      const result = await menuService.updateAvailability(restaurantId, itemId, isAvailable);

      return res.status(200).json({
        success: true,
        data: serializeBigInt(result),
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

menuRouter.delete(
  '/:restaurantId/menu/items/:itemId',
  requireAuth,
  requireTenant,
  requirePermission('menu.manage'),
  csrfProtection,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId, itemId } = req.params;
      const result = await menuService.deleteMenuItem(restaurantId, itemId);

      return res.status(200).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 5. IMAGE UPLOAD (menu.manage)
// ==========================================

menuRouter.post(
  '/:restaurantId/menu/upload-image',
  requireAuth,
  requireTenant,
  requirePermission('menu.manage'),
  csrfProtection,
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE_UPLOADED',
            message: 'Yuklash uchun rasm fayli tanlanmadi',
          },
        });
      }

      const adapter = storageService.getAdapter();
      const uploadResult = await adapter.upload({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
        size: req.file.size,
      });

      return res.status(201).json({
        success: true,
        data: uploadResult,
        meta: { timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` },
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'IMAGE_UPLOAD_FAILED',
          message: err.message || 'Rasm yuklashda xatolik yuz berdi',
        },
      });
    }
  }
);
