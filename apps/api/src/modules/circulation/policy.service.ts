import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PolicyDto, PolicyVersionCreate } from '@thu-vien/shared';

import { Clock } from '../../common/clock/clock';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const POLICY_ID = 'default';
const GLOBAL_SCOPE = 'global';
type PolicyScope = Pick<PolicyVersionCreate, 'readerGroup' | 'materialType' | 'branchCode'>;

function normalizedScope(scope: PolicyScope = {}) {
  return {
    readerGroup: scope.readerGroup || null,
    materialType: scope.materialType?.trim() || null,
    branchCode: scope.branchCode?.trim() || null,
  };
}

function scopeKey(scope: PolicyScope = {}): string {
  const normalized = normalizedScope(scope);
  if (!normalized.readerGroup && !normalized.materialType && !normalized.branchCode) return GLOBAL_SCOPE;
  return `g:${normalized.readerGroup ?? '*'}|m:${normalized.materialType ?? '*'}|b:${normalized.branchCode ?? '*'}`;
}

function scopeFallbacks(scope: PolicyScope): string[] {
  const values = normalizedScope(scope);
  const dimensions = [
    ['readerGroup', values.readerGroup],
    ['materialType', values.materialType],
    ['branchCode', values.branchCode],
  ] as const;
  const available = dimensions.filter(([, value]) => value !== null);
  const candidates: string[] = [];
  for (let size = available.length; size > 0; size -= 1) {
    for (let mask = 1; mask < 1 << available.length; mask += 1) {
      if (mask.toString(2).replace(/0/g, '').length !== size) continue;
      const candidate: { readerGroup?: string | null; materialType?: string | null; branchCode?: string | null } = {};
      available.forEach(([key, value], index) => { if (mask & (1 << index)) candidate[key] = value as string; });
      candidates.push(scopeKey(candidate as PolicyScope));
    }
  }
  return [...candidates, GLOBAL_SCOPE];
}

@Injectable()
export class PolicyService {
  constructor(private readonly prisma: PrismaService, private readonly clock: Clock) {}

  async read(client?: Prisma.TransactionClient, scope: PolicyScope = {}): Promise<PolicyDto> {
    const db = client ?? this.prisma;
    const now = this.clock.now();
    const keys = scopeFallbacks(scope);
    const versions = await db.policyVersion.findMany({
      where: { scopeKey: { in: keys }, effectiveFrom: { lte: now } },
      include: { createdBy: { include: { profile: true } } },
      orderBy: [{ effectiveFrom: 'desc' }, { versionNumber: 'desc' }],
    });
    versions.sort((left, right) => {
      const scopePriority = keys.indexOf(left.scopeKey) - keys.indexOf(right.scopeKey);
      return scopePriority || right.effectiveFrom.getTime() - left.effectiveFrom.getTime() || right.versionNumber - left.versionNumber;
    });
    if (versions[0]) return this.toDto(versions[0]);

    const legacy = await db.policy.upsert({
      where: { id: POLICY_ID }, update: {}, create: { id: POLICY_ID },
    });
    return this.toDto({
      ...legacy, id: 'policy-default-v1', versionNumber: 1, scopeKey: GLOBAL_SCOPE,
      effectiveFrom: new Date('1970-01-01T00:00:00.000Z'), createdAt: legacy.updatedAt,
      readerGroup: null, materialType: null, branchCode: null,
      serviceOpenDays: [1, 2, 3, 4, 5], serviceOpensAt: '08:00', serviceClosesAt: '17:00', createdBy: null,
    });
  }

  async versions(scope: PolicyScope = {}): Promise<PolicyDto[]> {
    const rows = await this.prisma.policyVersion.findMany({
      where: { scopeKey: scopeKey(scope) },
      include: { createdBy: { include: { profile: true } } },
      orderBy: [{ versionNumber: 'desc' }], take: 100,
    });
    return rows.map((row) => this.toDto(row));
  }

  async update(input: PolicyVersionCreate, actorId: string): Promise<PolicyDto> {
    const effectiveFrom = new Date(`${input.effectiveOn}T00:00:00.000+07:00`);
    const todayInBangkok = new Date(this.clock.now().getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (input.effectiveOn <= todayInBangkok) {
      throw new BadRequestException({ code: 'POLICY_DATE_PAST', message: 'Effective date must be in the future.' });
    }
    const scope = normalizedScope(input);
    const key = scopeKey(scope);

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Policy" WHERE "id" = ${POLICY_ID} FOR UPDATE`;
      const current = await tx.policyVersion.findFirst({
        where: { scopeKey: key }, orderBy: [{ versionNumber: 'desc' }],
      });
      const defaults = current ?? await tx.policy.upsert({ where: { id: POLICY_ID }, update: {}, create: { id: POLICY_ID } });
      if (await tx.policyVersion.findFirst({ where: { scopeKey: key, effectiveFrom } })) {
        throw new ConflictException({ code: 'POLICY_DATE_EXISTS', message: 'A policy version already exists for this scope and date.' });
      }
      const created = await tx.policyVersion.create({
        data: {
          scopeKey: key, ...scope,
          versionNumber: (current?.versionNumber ?? 0) + 1, effectiveFrom, createdById: actorId,
          loanDays: input.loanDays ?? defaults.loanDays,
          renewLimit: input.renewLimit ?? defaults.renewLimit,
          renewDays: input.renewDays ?? defaults.renewDays,
          maxActiveLoans: input.maxActiveLoans ?? defaults.maxActiveLoans,
          overdueFinePerDay: input.overdueFinePerDay ?? defaults.overdueFinePerDay,
          holdDays: input.holdDays ?? defaults.holdDays,
          serviceOpenDays: input.serviceOpenDays,
          serviceOpensAt: input.serviceOpensAt,
          serviceClosesAt: input.serviceClosesAt,
        },
        include: { createdBy: { include: { profile: true } } },
      });
      return this.toDto(created);
    });
  }

  addServiceDays(start: Date, dayCount: number, openDays: number[], closesAt: string): Date {
    const result = new Date(start.getTime() + 7 * 60 * 60 * 1000);
    result.setUTCHours(0, 0, 0, 0);
    let added = 0;
    while (added < dayCount) {
      result.setUTCDate(result.getUTCDate() + 1);
      if (openDays.includes(result.getUTCDay())) added += 1;
    }
    const [hours, minutes] = closesAt.split(':').map(Number);
    result.setUTCHours(hours ?? 17, minutes ?? 0, 0, 0);
    return new Date(result.getTime() - 7 * 60 * 60 * 1000);
  }

  private toDto(row: {
    id: string; scopeKey?: string; readerGroup?: string | null; materialType?: string | null; branchCode?: string | null;
    versionNumber: number; effectiveFrom: Date; createdAt: Date;
    loanDays: number; renewLimit: number; renewDays: number; maxActiveLoans: number;
    overdueFinePerDay: number; holdDays: number;
    serviceOpenDays?: number[]; serviceOpensAt?: string; serviceClosesAt?: string;
    createdBy?: { profile: { fullName: string | null } | null } | null;
  }): PolicyDto {
    return {
      id: row.id, scopeKey: row.scopeKey ?? GLOBAL_SCOPE,
      readerGroup: (row.readerGroup ?? null) as PolicyDto['readerGroup'],
      materialType: row.materialType ?? null, branchCode: row.branchCode ?? null,
      versionNumber: row.versionNumber, effectiveFrom: row.effectiveFrom.toISOString(), createdAt: row.createdAt.toISOString(),
      createdByName: row.createdBy?.profile?.fullName ?? null,
      loanDays: row.loanDays, renewLimit: row.renewLimit, renewDays: row.renewDays,
      maxActiveLoans: row.maxActiveLoans, overdueFinePerDay: row.overdueFinePerDay, holdDays: row.holdDays,
      serviceOpenDays: row.serviceOpenDays ?? [1, 2, 3, 4, 5],
      serviceOpensAt: row.serviceOpensAt ?? '08:00', serviceClosesAt: row.serviceClosesAt ?? '17:00',
    };
  }
}
