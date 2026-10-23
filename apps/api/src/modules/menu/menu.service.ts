import { prisma } from '../../db.js';
import { recordOutboxEvent, outboxService } from '../realtime/outbox.service.js';

export interface CreateTranslationDto {
  language: string;
  name: string;
  description?: string;
}

export interface CreateVariantDto {
  name: string;
  priceDifferenceTiyin: bigint;
  isDefault?: boolean;
  isAvailable?: boolean;
}

export interface CreateAddonOptionDto {
  name: string;
  priceTiyin: bigint;
  isAvailable?: boolean;
}

export interface CreateAddonGroupDto {
  name: string;
  minSelect?: number;
  maxSelect?: number;
  options: CreateAddonOptionDto[];
}

export interface CreateMenuItemDto {
  categoryId: string;
  stationId: string;
  name: string;
  description?: string;
  basePriceTiyin: bigint;
  imageUrl?: string;
  isAvailable?: boolean;
  sortOrder?: number;
  allergens?: string[];
  translations?: CreateTranslationDto[];
  variants?: CreateVariantDto[];
  addonGroups?: CreateAddonGroupDto[];
}

export interface UpdateMenuItemDto {
  categoryId?: string;
  stationId?: string;
  name?: string;
  description?: string;
  basePriceTiyin?: bigint;
  imageUrl?: string;
  isAvailable?: boolean;
  sortOrder?: number;
  allergens?: string[];
  translations?: CreateTranslationDto[];
  variants?: CreateVariantDto[];
  addonGroups?: CreateAddonGroupDto[];
}

export class MenuService {
  // --- CATEGORIES ---

  async listCategories(restaurantId: string) {
    return prisma.category.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            menuItems: {
              where: { isArchived: false },
            },
          },
        },
      },
    });
  }

  async createCategory(restaurantId: string, data: { name: string; sortOrder?: number; isVisible?: boolean }) {
    if (!data.name || !data.name.trim()) {
      throw new Error('Kategoriya nomi kiritilishi shart');
    }

    return prisma.category.create({
      data: {
        restaurantId,
        name: data.name.trim(),
        sortOrder: data.sortOrder ?? 0,
        isVisible: data.isVisible ?? true,
      },
    });
  }

  async updateCategory(
    restaurantId: string,
    categoryId: string,
    data: { name?: string; sortOrder?: number; isVisible?: boolean }
  ) {
    const existing = await prisma.category.findUnique({
      where: {
        id_restaurantId: { id: categoryId, restaurantId },
      },
    });

    if (!existing) {
      const err: any = new Error('Kategoriya topilmadi');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    return prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isVisible !== undefined && { isVisible: data.isVisible }),
      },
    });
  }

  async deleteCategory(restaurantId: string, categoryId: string) {
    const existing = await prisma.category.findUnique({
      where: {
        id_restaurantId: { id: categoryId, restaurantId },
      },
      include: {
        menuItems: {
          where: { isArchived: false },
        },
      },
    });

    if (!existing) {
      const err: any = new Error('Kategoriya topilmadi');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (existing.menuItems.length > 0) {
      const err: any = new Error(
        `Ushbu kategoriyada ${existing.menuItems.length} ta faol taom mavjud. Avval taomlarni boshqa kategoriyaga o'tkazing`
      );
      err.statusCode = 400;
      err.code = 'CATEGORY_NOT_EMPTY';
      throw err;
    }

    return prisma.category.delete({
      where: { id: categoryId },
    });
  }

  // --- MENU ITEMS ---

  async listMenuItems(
    restaurantId: string,
    filters?: { categoryId?: string; isAvailable?: boolean; search?: string }
  ) {
    return prisma.menuItem.findMany({
      where: {
        restaurantId,
        isArchived: false,
        ...(filters?.categoryId && { categoryId: filters.categoryId }),
        ...(filters?.isAvailable !== undefined && { isAvailable: filters.isAvailable }),
        ...(filters?.search && {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        category: true,
        station: true,
        translations: true,
        variants: true,
        addonGroups: {
          include: {
            options: true,
          },
        },
      },
    });
  }

  async getMenuItemById(restaurantId: string, itemId: string) {
    const item = await prisma.menuItem.findUnique({
      where: {
        id_restaurantId: { id: itemId, restaurantId },
      },
      include: {
        category: true,
        station: true,
        translations: true,
        variants: true,
        addonGroups: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!item || item.isArchived) {
      const err: any = new Error('Taom topilmadi');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    return item;
  }

  async createMenuItem(restaurantId: string, data: CreateMenuItemDto) {
    // 1. Cross-tenant validation: Category must belong to this restaurant
    const category = await prisma.category.findUnique({
      where: {
        id_restaurantId: { id: data.categoryId, restaurantId },
      },
    });
    if (!category) {
      const err: any = new Error('Kategoriya ushbu restoranga tegishli emas yoki mavjud emas');
      err.statusCode = 400;
      err.code = 'INVALID_CATEGORY_TENANT';
      throw err;
    }

    // 2. Cross-tenant validation: Station must belong to this restaurant
    const station = await prisma.preparationStation.findUnique({
      where: {
        id_restaurantId: { id: data.stationId, restaurantId },
      },
    });
    if (!station) {
      const err: any = new Error('Tayyorlash stansiyasi ushbu restoranga tegishli emas yoki mavjud emas');
      err.statusCode = 400;
      err.code = 'INVALID_STATION_TENANT';
      throw err;
    }

    // 3. Price validation
    if (data.basePriceTiyin < 0n) {
      const err: any = new Error('Taom narxi noldan kichik bo\'lishi mumkin emas');
      err.statusCode = 400;
      err.code = 'INVALID_PRICE';
      throw err;
    }

    // 4. Validate Addon groups (min <= max)
    if (data.addonGroups) {
      for (const group of data.addonGroups) {
        const min = group.minSelect ?? 0;
        const max = group.maxSelect ?? 1;
        if (min < 0 || max < min) {
          const err: any = new Error(
            `Qo'shimcha guruhi (${group.name}) uchun minSelect (${min}) va maxSelect (${max}) qiymatlari noto'g'ri`
          );
          err.statusCode = 400;
          err.code = 'INVALID_ADDON_SELECTION_RANGE';
          throw err;
        }
      }
    }

    // 5. Create in database
    const created = await prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.create({
        data: {
          restaurantId,
          categoryId: data.categoryId,
          stationId: data.stationId,
          name: data.name.trim(),
          description: data.description?.trim(),
          basePriceTiyin: data.basePriceTiyin,
          imageUrl: data.imageUrl,
          isAvailable: data.isAvailable ?? true,
          sortOrder: data.sortOrder ?? 0,
          allergens: data.allergens ? (data.allergens as any) : undefined,
          version: 1,
          translations: data.translations
            ? {
                create: data.translations.map((tr) => ({
                  language: tr.language,
                  name: tr.name.trim(),
                  description: tr.description?.trim(),
                })),
              }
            : undefined,
          variants: data.variants
            ? {
                create: data.variants.map((v) => ({
                  name: v.name.trim(),
                  priceDifferenceTiyin: v.priceDifferenceTiyin,
                  isDefault: v.isDefault ?? false,
                  isAvailable: v.isAvailable ?? true,
                })),
              }
            : undefined,
          addonGroups: data.addonGroups
            ? {
                create: data.addonGroups.map((g) => ({
                  restaurantId,
                  name: g.name.trim(),
                  minSelect: g.minSelect ?? 0,
                  maxSelect: g.maxSelect ?? 1,
                  options: {
                    create: g.options.map((opt) => ({
                      name: opt.name.trim(),
                      priceTiyin: opt.priceTiyin,
                      isAvailable: opt.isAvailable ?? true,
                    })),
                  },
                })),
              }
            : undefined,
        },
        include: {
          category: true,
          station: true,
          translations: true,
          variants: true,
          addonGroups: {
            include: {
              options: true,
            },
          },
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'menu.updated',
        payload: {
          menuItemId: item.id,
          action: 'CREATED',
        },
        scope: {
          restaurantId,
        },
      });

      return item;
    });

    outboxService.trigger();
    return created;
  }

  async updateMenuItem(restaurantId: string, itemId: string, data: UpdateMenuItemDto) {
    const existing = await prisma.menuItem.findUnique({
      where: {
        id_restaurantId: { id: itemId, restaurantId },
      },
    });

    if (!existing || existing.isArchived) {
      const err: any = new Error('Taom topilmadi');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Cross-tenant validations if changed
    if (data.categoryId && data.categoryId !== existing.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id_restaurantId: { id: data.categoryId, restaurantId } },
      });
      if (!category) {
        const err: any = new Error('Kategoriya ushbu restoranga tegishli emas');
        err.statusCode = 400;
        err.code = 'INVALID_CATEGORY_TENANT';
        throw err;
      }
    }

    if (data.stationId && data.stationId !== existing.stationId) {
      const station = await prisma.preparationStation.findUnique({
        where: { id_restaurantId: { id: data.stationId, restaurantId } },
      });
      if (!station) {
        const err: any = new Error('Stansiya ushbu restoranga tegishli emas');
        err.statusCode = 400;
        err.code = 'INVALID_STATION_TENANT';
        throw err;
      }
    }

    // Check if price or structure changed => increment version
    const priceChanged = data.basePriceTiyin !== undefined && data.basePriceTiyin !== existing.basePriceTiyin;
    const structureChanged = data.variants !== undefined || data.addonGroups !== undefined;
    const shouldIncrementVersion = priceChanged || structureChanged;

    const result = await prisma.$transaction(async (tx) => {
      // Handle translations update if provided
      if (data.translations) {
        await tx.menuItemTranslation.deleteMany({ where: { menuItemId: itemId } });
        await tx.menuItemTranslation.createMany({
          data: data.translations.map((tr) => ({
            menuItemId: itemId,
            language: tr.language,
            name: tr.name.trim(),
            description: tr.description?.trim(),
          })),
        });
      }

      // Handle variants update if provided
      if (data.variants) {
        await tx.menuVariant.deleteMany({ where: { menuItemId: itemId } });
        await tx.menuVariant.createMany({
          data: data.variants.map((v) => ({
            menuItemId: itemId,
            name: v.name.trim(),
            priceDifferenceTiyin: v.priceDifferenceTiyin,
            isDefault: v.isDefault ?? false,
            isAvailable: v.isAvailable ?? true,
          })),
        });
      }

      // Update main item
      const updatedItem = await tx.menuItem.update({
        where: { id: itemId },
        data: {
          ...(data.categoryId && { categoryId: data.categoryId }),
          ...(data.stationId && { stationId: data.stationId }),
          ...(data.name && { name: data.name.trim() }),
          ...(data.description !== undefined && { description: data.description?.trim() }),
          ...(data.basePriceTiyin !== undefined && { basePriceTiyin: data.basePriceTiyin }),
          ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
          ...(data.isAvailable !== undefined && { isAvailable: data.isAvailable }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
          ...(data.allergens !== undefined && { allergens: data.allergens as any }),
          ...(shouldIncrementVersion && { version: { increment: 1 } }),
        },
        include: {
          category: true,
          station: true,
          translations: true,
          variants: true,
          addonGroups: {
            include: {
              options: true,
            },
          },
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'menu.updated',
        payload: {
          menuItemId: itemId,
          action: 'UPDATED',
        },
        scope: {
          restaurantId,
        },
      });

      return updatedItem;
    });

    outboxService.trigger();
    return result;
  }

  /**
   * Specifically for staff with 'menu.availability' permission.
   * Only alters isAvailable, doesn't increment version or touch price.
   */
  async updateAvailability(restaurantId: string, itemId: string, isAvailable: boolean) {
    const existing = await prisma.menuItem.findUnique({
      where: {
        id_restaurantId: { id: itemId, restaurantId },
      },
    });

    if (!existing || existing.isArchived) {
      const err: any = new Error('Taom topilmadi');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.menuItem.update({
        where: { id: itemId },
        data: { isAvailable },
        select: {
          id: true,
          name: true,
          isAvailable: true,
          version: true,
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'menu.updated',
        payload: {
          menuItemId: itemId,
          action: 'AVAILABILITY_CHANGED',
          isAvailable,
        },
        scope: {
          restaurantId,
        },
      });

      return up;
    });

    outboxService.trigger();
    return updated;
  }

  /**
   * Delete MenuItem with soft-delete safeguard:
   * If item was ever ordered, preserve historical snapshot by soft-deleting (isArchived = true).
   * Otherwise hard delete.
   */
  async deleteMenuItem(restaurantId: string, itemId: string) {
    const existing = await prisma.menuItem.findUnique({
      where: {
        id_restaurantId: { id: itemId, restaurantId },
      },
      include: {
        _count: {
          select: { orderItems: true },
        },
      },
    });

    if (!existing) {
      const err: any = new Error('Taom topilmadi');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (existing._count.orderItems > 0) {
      // Historical orders exist => ARCHIVE instead of hard delete!
      await prisma.$transaction(async (tx) => {
        await tx.menuItem.update({
          where: { id: itemId },
          data: {
            isArchived: true,
            isAvailable: false,
          },
        });

        await recordOutboxEvent(tx, {
          restaurantId,
          eventType: 'menu.updated',
          payload: {
            menuItemId: itemId,
            action: 'ARCHIVED',
          },
          scope: {
            restaurantId,
          },
        });
      });

      outboxService.trigger();
      return {
        id: itemId,
        action: 'archived',
        message: 'Taom buyurtmalar tarixida mavjud bo\'lgani sababli arxivlandi (tarix saqlandi)',
      };
    } else {
      // No order items => safe to hard delete
      await prisma.$transaction(async (tx) => {
        await tx.menuItem.delete({
          where: { id: itemId },
        });

        await recordOutboxEvent(tx, {
          restaurantId,
          eventType: 'menu.updated',
          payload: {
            menuItemId: itemId,
            action: 'DELETED',
          },
          scope: {
            restaurantId,
          },
        });
      });

      outboxService.trigger();
      return {
        id: itemId,
        action: 'deleted',
        message: 'Taom butunlay o\'chirildi',
      };
    }
  }

  // --- PUBLIC MENU READ API ---

  async getPublicMenu(
    slugOrId: string,
    lang: 'uz' | 'ru' = 'uz',
    filters?: { categoryId?: string; search?: string }
  ) {
    // 1. Find restaurant by slug or id
    const restaurant = await prisma.restaurant.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }],
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        address: true,
        serviceChargeBps: true,
        currency: true,
      },
    });

    if (!restaurant) {
      const err: any = new Error('Restoran topilmadi yoki faol emas');
      err.statusCode = 404;
      err.code = 'RESTAURANT_NOT_FOUND';
      throw err;
    }

    // 2. Fetch visible categories
    const categories = await prisma.category.findMany({
      where: {
        restaurantId: restaurant.id,
        isVisible: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        sortOrder: true,
      },
    });

    // 3. Fetch active menu items
    const menuItems = await prisma.menuItem.findMany({
      where: {
        restaurantId: restaurant.id,
        isArchived: false,
        ...(filters?.categoryId && { categoryId: filters.categoryId }),
        ...(filters?.search && {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } },
            {
              translations: {
                some: {
                  OR: [
                    { name: { contains: filters.search, mode: 'insensitive' } },
                    { description: { contains: filters.search, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        translations: true,
        variants: {
          where: { isAvailable: true },
        },
        addonGroups: {
          include: {
            options: {
              where: { isAvailable: true },
            },
          },
        },
      },
    });

    // 4. Transform translated names and clean sensitive information
    const localizedItems = menuItems.map((item) => {
      const translation = item.translations.find((t) => t.language === lang);
      const name = translation?.name || item.name;
      const description = translation?.description || item.description;

      return {
        id: item.id,
        categoryId: item.categoryId,
        name,
        description,
        basePriceTiyin: item.basePriceTiyin,
        imageUrl: item.imageUrl,
        isAvailable: item.isAvailable,
        sortOrder: item.sortOrder,
        allergens: item.allergens || [],
        version: item.version,
        variants: item.variants.map((v) => ({
          id: v.id,
          name: v.name,
          priceDifferenceTiyin: v.priceDifferenceTiyin,
          isDefault: v.isDefault,
        })),
        addonGroups: item.addonGroups.map((g) => ({
          id: g.id,
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          options: g.options.map((opt) => ({
            id: opt.id,
            name: opt.name,
            priceTiyin: opt.priceTiyin,
          })),
        })),
      };
    });

    return {
      restaurant,
      categories,
      items: localizedItems,
    };
  }
}

export const menuService = new MenuService();
