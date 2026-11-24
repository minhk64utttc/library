import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditEventDto, AuditQuery, Paginated } from '@thu-vien/shared';

import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditQuery): Promise<Paginated<AuditEventDto>> {
    const term = query.q?.trim();
    const fromDate = query.from ? new Date(`${query.from}T00:00:00.000+07:00`) : undefined;
    const toDate = query.to ? new Date(new Date(`${query.to}T00:00:00.000+07:00`).getTime() + 86_400_000) : undefined;
    const where: Prisma.AuditEventWhereInput = {
      ...(query.outcome ? { outcome: query.outcome } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(fromDate || toDate ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lt: toDate } : {}) } } : {}),
      ...(term ? { OR: [
        { action: { contains: term, mode: 'insensitive' } },
        { targetType: { contains: term, mode: 'insensitive' } },
        { targetId: { contains: term, mode: 'insensitive' } },
        { actor: { email: { contains: term, mode: 'insensitive' } } },
        { actor: { profile: { fullName: { contains: term, mode: 'insensitive' } } } },
      ] } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditEvent.findMany({
        where, include: { actor: { include: { profile: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id, actorName: row.actor?.profile?.fullName ?? row.actor?.email ?? 'Tài khoản đã xóa',
        action: row.action, targetType: row.targetType, targetId: row.targetId,
        outcome: row.outcome === 'failed' ? 'failed' : 'success', createdAt: row.createdAt.toISOString(),
      })),
      total, page: query.page, pageSize: query.pageSize,
    };
  }
}
