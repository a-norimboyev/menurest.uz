import { Response } from 'express';
import {
  RealtimeEvent,
  Role,
  Permission,
} from '@menurest/shared';

export interface StaffClient {
  id: string;
  res: Response;
  userId: string;
  restaurantId: string;
  roles: Role[];
  permissions: Permission[];
  stationIds?: string[];
  assignedTableIds?: string[];
  isManager: boolean;
  connectedAt: Date;
}

export interface GuestClient {
  id: string;
  res: Response;
  restaurantId: string;
  tableId: string;
  visitId: string;
  connectedAt: Date;
}

export class RealtimeService {
  private staffClients = new Map<string, StaffClient>();
  private guestClients = new Map<string, GuestClient>();
  private keepAliveTimer: NodeJS.Timeout | null = null;

  constructor() {
    // 15 soniyada bir keepalive ping yuborish (proxy va brauzer timeoutlarini oldini oladi)
    this.keepAliveTimer = setInterval(() => {
      this.sendKeepAlive();
    }, 15000);
  }

  /**
   * SSE ulanish sarlavhalarini (headers) sozlash
   */
  setupSseHeaders(res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
  }

  /**
   * Xodim SSE klientini ro'yxatdan o'tkazish
   */
  registerStaffClient(client: StaffClient) {
    this.staffClients.set(client.id, client);

    // Initial ulanish bildirishnomasi
    this.sendRaw(client.res, 'connected', {
      clientId: client.id,
      status: 'connected',
      audience: 'staff',
      serverTime: new Date().toISOString(),
    });

    client.res.on('close', () => {
      this.staffClients.delete(client.id);
    });
  }

  /**
   * Mehmon SSE klientini ro'yxatdan o'tkazish
   */
  registerGuestClient(client: GuestClient) {
    this.guestClients.set(client.id, client);

    this.sendRaw(client.res, 'connected', {
      clientId: client.id,
      status: 'connected',
      audience: 'guest',
      visitId: client.visitId,
      tableId: client.tableId,
      serverTime: new Date().toISOString(),
    });

    client.res.on('close', () => {
      this.guestClients.delete(client.id);
    });
  }

  /**
   * Faol xodimning barcha SSE ulanishlarini darhol yopish (Access Revoked)
   */
  closeUserConnections(userId: string) {
    for (const [id, client] of this.staffClients.entries()) {
      if (client.userId === userId) {
        this.sendRaw(client.res, 'access.revoked', {
          reason: 'Sessiya yoki huquqlar server tomonidan bekor qilindi',
        });
        client.res.end();
        this.staffClients.delete(id);
      }
    }
  }

  /**
   * Eventni barcha mos auditoriyaga tarqatish (Audience & Scope Filtering)
   */
  broadcastEvent(event: RealtimeEvent) {
    const scope = event.scope || {};

    // 1. XODIMLAR AUDITORIYASI
    for (const [clientId, client] of Array.from(this.staffClients.entries())) {
      // 1.1 Tenant izolyatsiyasi
      if (client.restaurantId !== event.restaurantId) {
        continue;
      }

      // 1.2 Access Revoked hodisasi
      if (event.type === 'access.revoked') {
        if (scope.targetUserId && scope.targetUserId === client.userId) {
          this.sendEvent(client.res, event);
          client.res.end();
          this.staffClients.delete(clientId);
        }
        continue;
      }

      // 1.3 Moliyaviy ma'lumotlar filtri: Kitchen xodimi moliyaviy ma'lumotlarni ASLO olmasligi shart!
      if (scope.isFinancial) {
        const isKitchenOnly =
          client.roles.includes(Role.KITCHEN) &&
          !client.isManager &&
          !client.permissions.includes('payments.record') &&
          !client.permissions.includes('reports.view');

        if (isKitchenOnly) {
          continue; // Oshxona moliyaviy eventlarni olmaydi!
        }
      }

      // 1.4 Stansiya filtri: Biriktirilgan stansiyalar izolyatsiyasi (Oshpaz Bar taomini olmaydi)
      if (scope.stationId && !client.isManager) {
        if (client.stationIds && client.stationIds.length > 0) {
          if (!client.stationIds.includes(scope.stationId)) {
            continue; // Begona stansiya taomi oshpazga yuborilmaydi!
          }
        }
      }

      // 1.5 Maxsus huquq filtri
      if (scope.requiredPermission && !client.isManager) {
        if (!client.permissions.includes(scope.requiredPermission as any)) {
          continue;
        }
      }

      // Xodimga event yuborish
      this.sendEvent(client.res, event);
    }

    // 2. MEHMONLAR AUDITORIYASI
    for (const [, client] of this.guestClients.entries()) {
      // 2.1 Tenant izolyatsiyasi
      if (client.restaurantId !== event.restaurantId) {
        continue;
      }

      // 2.2 Mehmon boshqa tashrif yoki boshqa stol eventlarini ASLO olmasligi shart!
      if (scope.visitId) {
        if (scope.visitId !== client.visitId) {
          continue; // Boshqa tashrifning buyurtmasi yoki chaqiruvi!
        }
      } else if (scope.tableId) {
        if (scope.tableId !== client.tableId) {
          continue;
        }
      } else if (event.type !== 'menu.updated') {
        // Tashrif yoki stoldan tashqari ichki operatsion eventlar mehmonga yuborilmaydi
        continue;
      }

      // 2.3 Mehmonga xavfsiz tozalangan ma'lumot yuborish
      this.sendEvent(client.res, event);
    }
  }

  /**
   * Bitta SSE ulanishiga to'liq RealtimeEvent yuborish
   */
  sendEvent(res: Response, event: RealtimeEvent) {
    try {
      res.write(`id: ${event.id}\n`);
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // Ulanish uzilgan bo'lsa res.on('close') orqali tozalanadi
    }
  }

  /**
   * Xom ma'lumot yuborish (connected, keepalive va h.k.)
   */
  sendRaw(res: Response, eventType: string, data: any, id?: string) {
    try {
      if (id) res.write(`id: ${id}\n`);
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {}
  }

  private sendKeepAlive() {
    for (const client of this.staffClients.values()) {
      try {
        client.res.write(':keepalive\n\n');
      } catch {}
    }
    for (const client of this.guestClients.values()) {
      try {
        client.res.write(':keepalive\n\n');
      } catch {}
    }
  }

  destroy() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    for (const client of this.staffClients.values()) {
      try {
        client.res.end();
      } catch {}
    }
    for (const client of this.guestClients.values()) {
      try {
        client.res.end();
      } catch {}
    }
    this.staffClients.clear();
    this.guestClients.clear();
  }
}

export const realtimeService = new RealtimeService();
