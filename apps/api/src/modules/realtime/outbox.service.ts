import { prisma } from '../../db.js';
import { RealtimeEvent, RealtimeEventType, RealtimeScope } from '@menurest/shared';
import { realtimeService } from './realtime.service.js';

export interface RecordOutboxEventParams {
  restaurantId: string;
  eventType: RealtimeEventType;
  payload?: any;
  data?: any;
  scope?: RealtimeScope;
}

/**
 * DB tranzaksiyasi ichida OutboxEvent yozish (Transactional Outbox Pattern)
 * Qat'iy qoida: Agar tranzaksiya rollback bo'lsa, outbox yozilmaydi va event publish bo'lmaydi!
 */
export async function recordOutboxEvent(
  tx: any,
  params: RecordOutboxEventParams
) {
  const client = tx || prisma;
  const eventData = params.payload !== undefined ? params.payload : params.data;
  return client.outboxEvent.create({
    data: {
      restaurantId: params.restaurantId,
      eventType: params.eventType,
      payloadJson: {
        data: eventData,
        scope: params.scope || {},
      },
      status: 'PENDING',
    },
  });
}

export class OutboxService {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  start(intervalMs = 1500) {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.processPending().catch((err) => {
        console.error('[OutboxService] Worker cycle error:', err);
      });
    }, intervalMs);

    // Dastur ishga tushganda yoki qayta yoqilganda (crash restart) pending eventlarni darhol davom ettirish
    this.processPending().catch((err) => {
      console.error('[OutboxService] Startup recovery error:', err);
    });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Tranzaksiya commit bo'lgandan so'ng navbatdagi tsiklni darhol ishga tushirish
   */
  trigger() {
    setImmediate(() => {
      this.processPending().catch((err) => {
        console.error('[OutboxService] Triggered process error:', err);
      });
    });
  }

  /**
   * Barcha PENDING holatdagi outbox eventlarni ketma-ketlikda (FIFO) tarqatish
   */
  async processPending(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const pendingEvents = await prisma.outboxEvent.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      if (pendingEvents.length === 0) {
        return 0;
      }

      for (const evt of pendingEvents) {
        const payload = (evt.payloadJson || {}) as any;
        const realtimeEvent: RealtimeEvent = {
          id: evt.id,
          type: evt.eventType as RealtimeEventType,
          restaurantId: evt.restaurantId,
          createdAt: evt.createdAt.toISOString(),
          data: payload.data ?? {},
          scope: payload.scope ?? {},
        };

        // 1. SSE klientlariga tarqatish
        realtimeService.broadcastEvent(realtimeEvent);

        // 2. Outbox holatini PROCESSED deb yangilash
        await prisma.outboxEvent.update({
          where: { id: evt.id },
          data: {
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      }

      return pendingEvents.length;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Reconnect bo'lgan klientlar uchun Last-Event-ID bo'yicha o'tkazib yuborilgan eventlarni olish
   */
  async getMissedEvents(
    restaurantId: string,
    lastEventId: string,
    limit = 50
  ): Promise<{ events: RealtimeEvent[]; syncRequired: boolean }> {
    const lastEvent = await prisma.outboxEvent.findUnique({
      where: { id: lastEventId },
    });

    if (!lastEvent) {
      // Agar event juda eski bo'lsa yoki topilmasa -> to'liq REST snapshot olish kerak
      return { events: [], syncRequired: true };
    }

    const missed = await prisma.outboxEvent.findMany({
      where: {
        restaurantId,
        createdAt: { gt: lastEvent.createdAt },
      },
      orderBy: { createdAt: 'asc' },
      take: limit + 1,
    });

    if (missed.length > limit) {
      return { events: [], syncRequired: true };
    }

    const events: RealtimeEvent[] = missed.map((evt) => {
      const payload = (evt.payloadJson || {}) as any;
      return {
        id: evt.id,
        type: evt.eventType as RealtimeEventType,
        restaurantId: evt.restaurantId,
        createdAt: evt.createdAt.toISOString(),
        data: payload.data ?? {},
        scope: payload.scope ?? {},
      };
    });

    return { events, syncRequired: false };
  }
}

export const outboxService = new OutboxService();
