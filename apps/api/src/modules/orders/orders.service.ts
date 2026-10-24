import { prisma } from '../../db.js';
import { OrderStatus, OrderItemStatus, VisitStatus } from '@menurest/shared';
import { recordOutboxEvent, outboxService } from '../realtime/outbox.service.js';
import {
  RawOrderPayload,
  normalizeOrderPayload,
  buildScopedIdempotencyKey,
} from './idempotency.js';

export class OrdersService {
  /**
   * Mehmon tomonidan yangi buyurtma yuborish (Server-Authoritative narx va Idempotency bilan)
   */
  async createGuestOrder(
    restaurantId: string,
    guestSessionId: string,
    visitId: string,
    idempotencyKey: string | undefined,
    payload: RawOrderPayload
  ) {
    // 1. Tashrif faol holatda ekanini tekshirish
    const rest = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { isActive: true, subscriptionExpiresAt: true },
    });
    if (!rest || !rest.isActive || (rest.subscriptionExpiresAt && new Date() > rest.subscriptionExpiresAt)) {
      throw new Error('RESTAURANT_SUSPENDED: Restoran xizmati to\'xtatilgan (SUSPENDED). Yangi buyurtma berish taqiqlanadi.');
    }

    const visit = await prisma.visit.findFirst({
      where: { id: visitId, restaurantId },
    });
    if (!visit) {
      throw new Error('VISIT_NOT_FOUND: Tashrif topilmadi');
    }
    if (visit.status !== VisitStatus.ACTIVE) {
      throw new Error('VISIT_CLOSED: Ushbu stoldagi tashrif yopilgan. Yangi buyurtma berish mumkin emas');
    }

    // 2. Idempotency tekshiruvi (Double-click va Retry xavfsizligi)
    let scopedKey: string | null = null;
    let requestHash: string | null = null;

    if (idempotencyKey && idempotencyKey.trim()) {
      scopedKey = buildScopedIdempotencyKey(restaurantId, visitId, idempotencyKey);
      const normalized = normalizeOrderPayload(payload);
      requestHash = normalized.requestHash;

      // Mavjud idempotency yozuvini tekshirish
      const existingRecord = await prisma.idempotencyRecord.findUnique({
        where: { key: scopedKey },
      });

      if (existingRecord) {
        // Aynan bir xil so'rov mazmuni bo'lsa: avvalgi order natijasini qaytarish
        if (existingRecord.requestHash === requestHash) {
          return {
            isIdempotentReplay: true,
            status: existingRecord.responseStatus,
            data: existingRecord.responseBodyJson,
          };
        } else {
          // Bir kalit + boshqa mazmun -> 409 Conflict
          throw new Error(
            'IDEMPOTENCY_CONFLICT: Ushbu Idempotency-Key boshqa buyurtma mazmuni bilan allaqachon ishlatilgan'
          );
        }
      }
    }

    // 3. Buyurtma mazmuni validatsiyasi
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error('VALIDATION_ERROR: Buyurtmada kamida bitta taom bo\'lishi shart');
    }

    if (payload.notes && payload.notes.length > 500) {
      throw new Error('NOTE_TOO_LONG: Buyurtma izohi 500 belgidan oshmasligi lozim');
    }

    // 4. Server-Authoritative Menu & Pricing Validation
    // Frontenddan kelgan nom yoki narxga ISHONMAYMIZ! Har bir taomni DB dan tekshirib, server snapshot yaratamiz.
    const preparedItems: Array<{
      menuItemId: string;
      stationId: string;
      quantity: number;
      notes: string | null;
      snapshotName: string;
      snapshotPriceTiyin: bigint;
      snapshotVariantName: string | null;
      addons: Array<{ name: string; priceTiyin: bigint }>;
    }> = [];

    for (const item of payload.items) {
      const qty = Number(item.quantity);
      if (!qty || qty < 1 || qty > 50) {
        throw new Error('INVALID_QUANTITY: Taom miqdori 1 dan 50 gacha bo\'lishi kerak');
      }

      if (item.notes && item.notes.length > 200) {
        throw new Error('NOTE_TOO_LONG: Taom izohi 200 belgidan oshmasligi kerak');
      }

      // DB dan taomni olish
      const menuItem = await prisma.menuItem.findFirst({
        where: { id: item.menuItemId, restaurantId },
        include: {
          variants: true,
          addonGroups: {
            include: { options: true },
          },
        },
      });

      if (!menuItem || menuItem.isArchived) {
        throw new Error('ITEM_NOT_FOUND: Buyurtma qilinayotgan taom topilmadi');
      }

      if (!menuItem.isAvailable) {
        throw new Error(`ITEM_UNAVAILABLE: '${menuItem.name}' taomi vaqtincha tugagan`);
      }

      // Menyu/narx versiyasi ziddiyati (Price & Menu version conflict)
      if (item.expectedVersion && menuItem.version !== Number(item.expectedVersion)) {
        throw new Error(
          `PRICE_VERSION_CONFLICT: '${menuItem.name}' taomining narxi yoki tarkibi o'zgargan. Iltimos, savatni qayta ko'rib chiqing.`
        );
      }

      // 4.1 Variant tekshiruvi va narxi
      let unitPriceTiyin = menuItem.basePriceTiyin;
      let snapshotVariantName: string | null = null;

      if (item.variantId && item.variantId.trim()) {
        const variant = menuItem.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          throw new Error(`INVALID_VARIANT: '${menuItem.name}' uchun noto'g'ri variant tanlandi`);
        }
        if (!variant.isAvailable) {
          throw new Error(`VARIANT_UNAVAILABLE: '${menuItem.name} - ${variant.name}' varianti vaqtincha mavjud emas`);
        }
        unitPriceTiyin = unitPriceTiyin + variant.priceDifferenceTiyin;
        snapshotVariantName = variant.name;
      }

      // 4.2 Qo'shimchalar (Addon Groups & Options) tekshiruvi
      const selectedAddonSnapshots: Array<{ name: string; priceTiyin: bigint }> = [];
      const chosenOptionIds = new Set(item.addonOptionIds || []);

      for (const group of menuItem.addonGroups) {
        const chosenInGroup = group.options.filter((opt) => chosenOptionIds.has(opt.id));

        if (chosenInGroup.length < group.minSelect || chosenInGroup.length > group.maxSelect) {
          throw new Error(
            `ADDON_LIMIT_VIOLATION: '${menuItem.name}' taomining '${group.name}' guruhidan tanlash chegarasi buzildi (min: ${group.minSelect}, max: ${group.maxSelect})`
          );
        }

        for (const opt of chosenInGroup) {
          if (!opt.isAvailable) {
            throw new Error(`ADDON_UNAVAILABLE: '${opt.name}' qo'shimchasi vaqtincha tugagan`);
          }
          selectedAddonSnapshots.push({
            name: opt.name,
            priceTiyin: opt.priceTiyin,
          });
          unitPriceTiyin = unitPriceTiyin + opt.priceTiyin;
        }
      }

      preparedItems.push({
        menuItemId: menuItem.id,
        stationId: menuItem.stationId,
        quantity: qty,
        notes: item.notes?.trim() || null,
        snapshotName: menuItem.name,
        snapshotPriceTiyin: unitPriceTiyin,
        snapshotVariantName,
        addons: selectedAddonSnapshots,
      });
    }

    // 5. Tranzaksiya ichida Order, OrderItems va IdempotencyRecord yaratish
    try {
      const createdOrderData = await prisma.$transaction(async (tx) => {
        // Restorandagi navbatdagi buyurtma raqami
        const count = await tx.order.count({ where: { restaurantId } });
        const orderNumber = count + 1;

        // Order default NEW holatda yaratiladi (Ofitsiant/Manager tasdig'ini kutadi)
        const order = await tx.order.create({
          data: {
            restaurantId,
            visitId,
            orderNumber,
            status: OrderStatus.NEW,
            notes: payload.notes?.trim() || null,
            createdByRole: 'GUEST',
            createdById: guestSessionId,
          },
        });

        // OrderItem lar yaratiladi (PENDING holatda)
        for (const itm of preparedItems) {
          const orderItem = await tx.orderItem.create({
            data: {
              restaurantId,
              orderId: order.id,
              menuItemId: itm.menuItemId,
              stationId: itm.stationId,
              status: OrderItemStatus.PENDING,
              quantity: itm.quantity,
              notes: itm.notes,
              snapshotName: itm.snapshotName,
              snapshotPriceTiyin: itm.snapshotPriceTiyin,
              snapshotVariantName: itm.snapshotVariantName,
            },
          });

          // Addon snapshots
          for (const addon of itm.addons) {
            await tx.orderItemAddonSnapshot.create({
              data: {
                orderItemId: orderItem.id,
                name: addon.name,
                priceTiyin: addon.priceTiyin,
              },
            });
          }
        }

        const totalOrderTiyin = preparedItems.reduce(
          (sum, i) => sum + i.snapshotPriceTiyin * BigInt(i.quantity),
          0n
        );

        const responsePayload = {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          visitId: order.visitId,
          totalTiyin: totalOrderTiyin.toString(),
          itemsCount: preparedItems.length,
          createdAt: order.createdAt,
        };

        // Idempotency record saqlash
        if (scopedKey && requestHash) {
          await tx.idempotencyRecord.create({
            data: {
              key: scopedKey,
              requestHash,
              responseStatus: 201,
              responseBodyJson: responsePayload,
              expiresAt: new Date(Date.now() + 24 * 3600 * 1000), // 24 soat
            },
          });
        }

        // Outbox event yozish (order.created)
        await recordOutboxEvent(tx, {
          restaurantId,
          eventType: 'order.created',
          data: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            visitId: order.visitId,
            tableId: visit.tableId,
            itemsCount: preparedItems.length,
            totalTiyin: totalOrderTiyin.toString(),
            createdAt: order.createdAt.toISOString(),
          },
          scope: {
            visitId: order.visitId,
            tableId: visit.tableId,
          },
        });

        return responsePayload;
      });

      outboxService.trigger();

      return {
        isIdempotentReplay: false,
        status: 201,
        data: createdOrderData,
      };
    } catch (err: any) {
      // Parallel bir xil idempotency kaliti bo'lsa: P2002 (unique violation)
      if (err.code === 'P2002' && scopedKey) {
        const stored = await prisma.idempotencyRecord.findUnique({
          where: { key: scopedKey },
        });
        if (stored) {
          return {
            isIdempotentReplay: true,
            status: stored.responseStatus,
            data: stored.responseBodyJson,
          };
        }
      }
      throw err;
    }
  }

  /**
   * Joriy tashrifning barcha buyurtmalarini ko'rish
   */
  async getVisitOrders(restaurantId: string, visitId: string) {
    return prisma.order.findMany({
      where: { restaurantId, visitId },
      include: {
        items: {
          include: {
            addonSnapshots: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const ordersService = new OrdersService();
