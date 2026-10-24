import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { prisma } from '../../db.js';
import { TableStatus } from '@menurest/shared';
import { recordOutboxEvent, outboxService } from '../realtime/outbox.service.js';

export interface CreateTableInput {
  hallId: string;
  number: number;
  capacity?: number;
  assignedWaiterId?: string | null;
}

export interface UpdateTableInput {
  hallId?: string;
  number?: number;
  capacity?: number;
  assignedWaiterId?: string | null;
}

export class TablesService {
  /**
   * Zallar ro'yxati
   */
  async listHalls(restaurantId: string) {
    return prisma.hall.findMany({
      where: { restaurantId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Yangi zal yaratish
   */
  async createHall(restaurantId: string, name: string) {
    if (!name || !name.trim()) {
      throw new Error('Zal nomi kiritilishi shart');
    }
    return prisma.hall.create({
      data: {
        restaurantId,
        name: name.trim(),
      },
    });
  }

  /**
   * Restoran stollari ro'yxati (faol tashriflar va ofitsiant ma'lumotlari bilan)
   */
  async listTables(restaurantId: string) {
    return prisma.table.findMany({
      where: { restaurantId },
      include: {
        hall: true,
        assignedWaiter: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        visits: {
          where: { status: 'ACTIVE' },
          include: {
            waiter: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
            guestSessions: {
              where: { isRevoked: false },
              select: {
                id: true,
                createdAt: true,
                lastActiveAt: true,
              },
            },
          },
        },
      },
      orderBy: [{ hall: { name: 'asc' } }, { number: 'asc' }],
    });
  }

  /**
   * Bitta stol ma'lumotlarini olish
   */
  async getTable(restaurantId: string, tableId: string) {
    return prisma.table.findFirst({
      where: { id: tableId, restaurantId },
      include: {
        hall: true,
        assignedWaiter: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        visits: {
          where: { status: 'ACTIVE' },
          include: {
            waiter: { select: { id: true, fullName: true, phone: true } },
            guestSessions: { where: { isRevoked: false } },
          },
        },
      },
    });
  }

  /**
   * Yangi stol yaratish
   */
  async createTable(restaurantId: string, input: CreateTableInput) {
    // 1. Zal ushbu restoranga tegishliligini tekshirish
    const hall = await prisma.hall.findFirst({
      where: { id: input.hallId, restaurantId },
    });
    if (!hall) {
      throw new Error('INVALID_HALL_TENANT: Ko\'rsatilgan zal ushbu restoranga tegishli emas');
    }

    // 2. Biriktirilgan ofitsiant tekshiruvi (agar ko'rsatilgan bo'lsa)
    if (input.assignedWaiterId) {
      const waiterMembership = await prisma.restaurantMembership.findFirst({
        where: {
          restaurantId,
          userId: input.assignedWaiterId,
          isActive: true,
        },
      });
      if (!waiterMembership) {
        throw new Error('INVALID_WAITER_TENANT: Biriktirilgan ofitsiant ushbu restoranda faol emas');
      }
    }

    // 3. Raqam band emasligini tekshirish
    const existingTable = await prisma.table.findFirst({
      where: { restaurantId, number: input.number },
    });
    if (existingTable) {
      throw new Error('TABLE_NUMBER_EXISTS: Ushbu raqamli stol allaqachon mavjud');
    }

    // 4. Random maxfiy bo'lmagan, lekin xavfsiz opaque QR token hosil qilish
    const qrToken = crypto.randomUUID();

    return prisma.table.create({
      data: {
        restaurantId,
        hallId: input.hallId,
        number: input.number,
        capacity: input.capacity || 4,
        status: TableStatus.FREE,
        qrToken,
        assignedWaiterId: input.assignedWaiterId || null,
      },
      include: {
        hall: true,
        assignedWaiter: {
          select: { id: true, fullName: true, phone: true },
        },
      },
    });
  }

  /**
   * Stol ma'lumotlarini tahrirlash
   */
  async updateTable(restaurantId: string, tableId: string, input: UpdateTableInput) {
    const table = await prisma.table.findFirst({
      where: { id: tableId, restaurantId },
    });
    if (!table) {
      throw new Error('TABLE_NOT_FOUND: Stol topilmadi');
    }

    if (input.hallId) {
      const hall = await prisma.hall.findFirst({
        where: { id: input.hallId, restaurantId },
      });
      if (!hall) {
        throw new Error('INVALID_HALL_TENANT: Zal ushbu restoranga tegishli emas');
      }
    }

    if (input.number && input.number !== table.number) {
      const existing = await prisma.table.findFirst({
        where: { restaurantId, number: input.number, NOT: { id: tableId } },
      });
      if (existing) {
        throw new Error('TABLE_NUMBER_EXISTS: Ushbu raqamli boshqa stol mavjud');
      }
    }

    if (input.assignedWaiterId) {
      const waiterMembership = await prisma.restaurantMembership.findFirst({
        where: {
          restaurantId,
          userId: input.assignedWaiterId,
          isActive: true,
        },
      });
      if (!waiterMembership) {
        throw new Error('INVALID_WAITER_TENANT: Biriktirilgan ofitsiant ushbu restoranda faol emas');
      }
    }

    return prisma.table.update({
      where: { id: tableId },
      data: {
        hallId: input.hallId ?? table.hallId,
        number: input.number ?? table.number,
        capacity: input.capacity ?? table.capacity,
        assignedWaiterId: input.assignedWaiterId !== undefined ? input.assignedWaiterId : table.assignedWaiterId,
      },
      include: {
        hall: true,
        assignedWaiter: { select: { id: true, fullName: true, phone: true } },
      },
    });
  }

  /**
   * QR tokenni yangilash (eski QRni bekor qilish va yangisini hosil qilish)
   */
  async regenerateQrToken(restaurantId: string, tableId: string) {
    const table = await prisma.table.findFirst({
      where: { id: tableId, restaurantId },
    });
    if (!table) {
      throw new Error('TABLE_NOT_FOUND: Stol topilmadi');
    }

    const newQrToken = crypto.randomUUID();
    const updated = await prisma.table.update({
      where: { id: tableId },
      data: { qrToken: newQrToken },
    });

    return {
      tableId: updated.id,
      number: updated.number,
      qrToken: updated.qrToken,
    };
  }

  /**
   * QR kod tasvirini generatsiya qilish (SVG yoki PNG)
   */
  async generateQrCodeImage(
    restaurantId: string,
    tableId: string,
    format: 'png' | 'svg',
    frontendBaseUrl?: string
  ) {
    const table = await prisma.table.findFirst({
      where: { id: tableId, restaurantId },
      include: { restaurant: true },
    });
    if (!table) {
      throw new Error('TABLE_NOT_FOUND: Stol topilmadi');
    }

    const origin = frontendBaseUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    // Ommaviy havola: stolning sir bo'lmagan opaque identifikatorini o'z ichiga oladi
    const targetUrl = `${origin}/table/${table.qrToken}`;

    if (format === 'svg') {
      const svg = await QRCode.toString(targetUrl, {
        type: 'svg',
        margin: 2,
        color: {
          dark: '#0F5C3C', // menurest asosiy brend rangi
          light: '#FFFFFF',
        },
      });
      return { contentType: 'image/svg+xml', data: Buffer.from(svg) };
    } else {
      const pngBuffer = await QRCode.toBuffer(targetUrl, {
        type: 'png',
        width: 500,
        margin: 2,
        color: {
          dark: '#0F5C3C',
          light: '#FFFFFF',
        },
      });
      return { contentType: 'image/png', data: pngBuffer };
    }
  }

  /**
   * Stolni tozalangan deb belgilash (DIRTY -> FREE)
   */
  async markClean(restaurantId: string, tableId: string, _userId: string) {
    const table = await prisma.table.findFirst({
      where: { id: tableId, restaurantId },
    });
    if (!table) {
      throw new Error('TABLE_NOT_FOUND: Stol topilmadi');
    }

    if (table.status !== TableStatus.DIRTY) {
      throw new Error(`TABLE_NOT_DIRTY: Faqat tozalash kutilayotgan (DIRTY) stolni bo'shatish mumkin. Joriy holat: ${table.status}`);
    }

    // Faol tashrif yo'qligini tekshirish
    const activeVisit = await prisma.visit.findFirst({
      where: { tableId, status: 'ACTIVE' },
    });
    if (activeVisit) {
      throw new Error('ACTIVE_VISIT_EXISTS: Faol tashrif mavjud stolda tozalash holati yakunlanishi mumkin emas');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.table.update({
        where: { id: tableId },
        data: { status: TableStatus.FREE },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          action: 'TABLE_MARKED_CLEAN',
          actorId: _userId,
          entityName: 'Table',
          entityId: tableId,
          newStateJson: { previousStatus: TableStatus.DIRTY, newStatus: TableStatus.FREE, tableNumber: table.number },
        },
      });

      await recordOutboxEvent(tx, {
        restaurantId,
        eventType: 'table.state_changed',
        payload: {
          tableId,
          status: TableStatus.FREE,
        },
        scope: {
          restaurantId,
          tableId,
        },
      });

      return up;
    });

    outboxService.trigger();
    return updated;
  }
}

export const tablesService = new TablesService();
