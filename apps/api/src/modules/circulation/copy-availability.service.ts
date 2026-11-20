import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PolicyService } from './policy.service';

@Injectable()
export class CopyAvailabilityService {
  constructor(private readonly policy: PolicyService) {}

  async release(tx: Prisma.TransactionClient, copyId: string, editionId: string, now: Date): Promise<void> {
    // Serialize allocation for an edition so concurrent returns cannot claim one hold twice.
    await tx.$queryRaw`SELECT id FROM "Edition" WHERE id = ${editionId} FOR UPDATE`;
    const copy = await tx.copy.findUnique({
      where: { id: copyId }, select: { locationId: true, location: { select: { code: true } } },
    });
    if (!copy?.locationId) {
      await tx.copy.update({ where: { id: copyId }, data: { status: 'processing' } });
      return;
    }
    const next = await tx.reservation.findFirst({
      where: { editionId, status: 'waiting' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { borrower: { include: { profile: true } } },
    });
    if (!next) {
      await tx.copy.update({ where: { id: copyId }, data: { status: 'available' } });
      return;
    }

    const edition = await tx.edition.findUnique({
      where: { id: editionId }, select: { work: { select: { classification: true } } },
    });
    const policy = await this.policy.read(tx, {
      readerGroup: (next.borrower.profile?.readerGroup ?? 'student') as 'student' | 'lecturer' | 'staff' | 'other',
      materialType: edition?.work.classification ?? undefined,
      branchCode: copy.location?.code,
    });
    await tx.copy.update({ where: { id: copyId }, data: { status: 'reserved' } });
    await tx.reservation.update({
      where: { id: next.id },
      data: {
        status: 'ready_for_pickup',
        readyAt: now,
        expiresAt: this.policy.addServiceDays(now, policy.holdDays, policy.serviceOpenDays, policy.serviceClosesAt),
      },
    });
  }
}
