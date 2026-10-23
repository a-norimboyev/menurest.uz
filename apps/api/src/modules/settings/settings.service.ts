import { prisma } from '../../db.js';
import type { RestaurantSettings } from '@menurest/shared';

export class SettingsService {
  /**
   * Restoran sozlamalarini olish
   */
  async getSettings(restaurantId: string): Promise<RestaurantSettings> {
    const rest = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    if (!rest) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Restoran topilmadi.' };
    }

    return {
      id: rest.id,
      name: rest.name,
      slug: rest.slug,
      phone: rest.phone,
      address: rest.address,
      logoUrl: rest.logoUrl,
      bannerUrl: rest.bannerUrl,
      openingHours: (rest.openingHours as any) || null,
      defaultLanguage: rest.defaultLanguage,
      serviceChargeBps: rest.serviceChargeBps,
      currency: rest.currency,
      timezone: rest.timezone,
    };
  }

  /**
   * Restoran sozlamalarini yangilash
   * Muhim invariant: Restoran serviceChargeBps yoki boshqa sozlamasi o'zgarganda
   * mavjud faol/yopiq tashriflarning `serviceChargeBpsSnapshot`i va buyurtma snapshotlari
   * o'zgarmasdan qat'iy saqlanadi!
   */
  async updateSettings(
    actorUser: any,
    restaurantId: string,
    payload: {
      name?: string;
      phone?: string;
      address?: string;
      logoUrl?: string;
      bannerUrl?: string;
      openingHours?: Record<string, { open: string; close: string; isOpen: boolean }>;
      defaultLanguage?: string;
      serviceChargeBps?: number;
      reason?: string;
    },
    ipAddress: string
  ): Promise<RestaurantSettings> {
    const existing = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    if (!existing) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Restoran topilmadi.' };
    }

    if (payload.serviceChargeBps !== undefined) {
      if (payload.serviceChargeBps < 0 || payload.serviceChargeBps > 5000) {
        throw {
          statusCode: 400,
          code: 'INVALID_SERVICE_CHARGE',
          message: 'Xizmat haqi 0% dan 50% gacha (0..5000 bps) bo\'lishi shart.',
        };
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rest = await tx.restaurant.update({
        where: { id: restaurantId },
        data: {
          name: payload.name !== undefined ? payload.name.trim() : undefined,
          phone: payload.phone !== undefined ? payload.phone.trim() : undefined,
          address: payload.address !== undefined ? payload.address.trim() : undefined,
          logoUrl: payload.logoUrl !== undefined ? payload.logoUrl : undefined,
          bannerUrl: payload.bannerUrl !== undefined ? payload.bannerUrl : undefined,
          openingHours: payload.openingHours !== undefined ? payload.openingHours : undefined,
          defaultLanguage: payload.defaultLanguage !== undefined ? payload.defaultLanguage : undefined,
          serviceChargeBps: payload.serviceChargeBps !== undefined ? payload.serviceChargeBps : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          actorId: actorUser.id,
          actorName: actorUser.fullName,
          actorRole: actorUser.roles[0] || 'BOSS',
          action: 'RESTAURANT_SETTINGS_UPDATED',
          entityName: 'Restaurant',
          entityId: restaurantId,
          oldStateJson: {
            name: existing.name,
            serviceChargeBps: existing.serviceChargeBps,
            defaultLanguage: existing.defaultLanguage,
            phone: existing.phone,
          },
          newStateJson: {
            name: rest.name,
            serviceChargeBps: rest.serviceChargeBps,
            defaultLanguage: rest.defaultLanguage,
            phone: rest.phone,
          },
          reason: payload.reason || 'Restoran sozlamalari yangilandi',
          ipAddress,
        },
      });

      return rest;
    });

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      phone: updated.phone,
      address: updated.address,
      logoUrl: updated.logoUrl,
      bannerUrl: updated.bannerUrl,
      openingHours: (updated.openingHours as any) || null,
      defaultLanguage: updated.defaultLanguage,
      serviceChargeBps: updated.serviceChargeBps,
      currency: updated.currency,
      timezone: updated.timezone,
    };
  }
}

export const settingsService = new SettingsService();
