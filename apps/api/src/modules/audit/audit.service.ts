import { prisma } from '../../db.js';
import { getTashkentRangeBounds } from '../reports/reports.service.js';
import type { AuditLogDto } from '@menurest/shared';

function sanitizeJson(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(sanitizeJson);
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    const lower = k.toLowerCase();
    if (
      lower.includes('password') ||
      lower.includes('token') ||
      lower.includes('secret') ||
      lower.includes('hash') ||
      lower.includes('pin')
    ) {
      clean[k] = '[REDACTED]';
    } else {
      clean[k] = sanitizeJson(v);
    }
  }
  return clean;
}

/**
 * CSV Formula Injection (Formula Injection) zararsizlantirish
 * Agar matn =, +, -, @, tab, qaytish yoki % bilan boshlansa, oldiga bittalik tirnoq (') qo'shiladi.
 */
export function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r%]/.test(str)) {
    str = "'" + str;
  }
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

export class AuditService {
  /**
   * Audit loglarni sahifalab va filtrlangan holda olish (Tenantga qat'iy cheklangan)
   */
  async getAuditLogs(
    restaurantId: string,
    filter?: {
      action?: string;
      actorId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ logs: AuditLogDto[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, filter?.page || 1);
    const limit = Math.min(100, Math.max(1, filter?.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { restaurantId };

    if (filter?.action) {
      where.action = filter.action;
    }
    if (filter?.actorId) {
      where.actorId = filter.actorId;
    }
    if (filter?.from || filter?.to) {
      const { fromUtc, toUtc } = getTashkentRangeBounds(filter.from, filter.to);
      where.createdAt = { gte: fromUtc, lte: toUtc };
    }

    const [total, rawLogs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const logs: AuditLogDto[] = rawLogs.map((log) => ({
      id: log.id,
      restaurantId: log.restaurantId,
      actorId: log.actorId,
      actorName: log.actorName || null,
      actorRole: log.actorRole,
      action: log.action,
      entityName: log.entityName,
      entityId: log.entityId,
      oldStateJson: sanitizeJson(log.oldStateJson),
      newStateJson: sanitizeJson(log.newStateJson),
      reason: log.reason,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Audit loglarni CSV formatida xavfsiz eksport qilish
   */
  async exportAuditLogsCsv(
    restaurantId: string,
    filter?: {
      action?: string;
      actorId?: string;
      from?: string;
      to?: string;
    }
  ): Promise<string> {
    const where: any = { restaurantId };
    if (filter?.action) where.action = filter.action;
    if (filter?.actorId) where.actorId = filter.actorId;
    if (filter?.from || filter?.to) {
      const { fromUtc, toUtc } = getTashkentRangeBounds(filter.from, filter.to);
      where.createdAt = { gte: fromUtc, lte: toUtc };
    }

    const rawLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const headers = [
      'ID',
      'Sana',
      'Foydalanuvchi',
      'Rol',
      'Amal',
      'Resurs',
      'Resurs ID',
      'Sabab',
      'IP manzil',
    ];

    const lines = [headers.join(',')];

    for (const log of rawLogs) {
      const row = [
        log.id,
        log.createdAt.toISOString(),
        log.actorName || log.actorId || 'Noma\'lum',
        log.actorRole || '—',
        log.action,
        log.entityName,
        log.entityId || '—',
        log.reason || '—',
        log.ipAddress || '—',
      ];
      lines.push(row.map(escapeCsvCell).join(','));
    }

    return lines.join('\r\n');
  }
}

export const auditService = new AuditService();
