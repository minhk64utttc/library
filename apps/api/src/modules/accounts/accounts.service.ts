import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { Prisma } from '@prisma/client';
import type {
  AccountCreate,
  AccountDto,
  AccountListQuery,
  AccountResetPassword,
  AccountUpdate,
  Paginated,
  Role,
} from '@thu-vien/shared';

import { Clock } from '../../common/clock/clock';
import { isUniqueViolation } from '../../common/prisma/errors';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SessionService } from '../auth/session.service';

const ACCOUNT_INCLUDE = { roles: true, profile: true } as const;

type AccountWithRelations = Prisma.AccountGetPayload<{ include: typeof ACCOUNT_INCLUDE }>;

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly clock: Clock,
  ) {}

  async list({
    page,
    pageSize,
    q,
    status,
    role,
  }: AccountListQuery): Promise<Paginated<AccountDto>> {
    const where: Prisma.AccountWhereInput = {
      ...(status ? { status } : {}),
      ...(role ? { roles: { some: { role } } } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { profile: { fullName: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        where,
        include: ACCOUNT_INCLUDE,
        orderBy: { email: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.account.count({ where }),
    ]);

    return { items: rows.map((row) => this.toDto(row)), total, page, pageSize };
  }

  async get(id: string): Promise<AccountDto> {
    const row = await this.prisma.account.findUnique({ where: { id }, include: ACCOUNT_INCLUDE });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy tài khoản' });
    }
    return this.toDto(row);
  }

  async create(input: AccountCreate): Promise<AccountDto> {
    try {
      const created = await this.prisma.account.create({
        data: {
          email: input.email,
          passwordHash: await hash(input.password),
          status: input.status,
          mustChangePassword: input.mustChangePassword,
          roles: { create: input.roles.map((role) => ({ role })) },
          profile: { create: { fullName: input.fullName, readerGroup: input.readerGroup } },
        },
        include: ACCOUNT_INCLUDE,
      });
      return this.toDto(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ code: 'DUPLICATE', message: 'Email đã tồn tại' });
      }
      throw error;
    }
  }

  async update(id: string, input: AccountUpdate): Promise<AccountDto> {
    const before = await this.prisma.account.findUnique({
      where: { id },
      select: { status: true, email: true },
    });
    if (!before) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy tài khoản' });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.roles) {
        await tx.accountRole.deleteMany({ where: { accountId: id } });
        await tx.accountRole.createMany({
          data: input.roles.map((role) => ({ accountId: id, role })),
        });
      }
      if (input.fullName !== undefined || input.readerGroup !== undefined) {
        await tx.profile.upsert({
          where: { accountId: id },
          update: {
            ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
            ...(input.readerGroup !== undefined ? { readerGroup: input.readerGroup } : {}),
          },
          create: {
            accountId: id, fullName: input.fullName ?? before.email,
            readerGroup: input.readerGroup ?? 'student',
          },
        });
      }
      return tx.account.update({
        where: { id },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.mustChangePassword !== undefined
            ? { mustChangePassword: input.mustChangePassword }
            : {}),
        },
        include: ACCOUNT_INCLUDE,
      });
    });

    if (input.status === 'disabled' && before.status !== 'disabled') {
      await this.sessions.revokeAllForAccount(id);
    }

    return this.toDto(updated);
  }

  async resetPassword(id: string, input: AccountResetPassword): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { id }, select: { id: true } });
    if (!account) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy tài khoản' });
    }

    await this.prisma.account.update({
      where: { id },
      data: {
        passwordHash: await hash(input.password),
        mustChangePassword: true,
        updatedAt: this.clock.now(),
      },
    });
    await this.sessions.revokeAllForAccount(id);
  }

  private toDto(row: AccountWithRelations): AccountDto {
    return {
      id: row.id,
      email: row.email,
      fullName: row.profile?.fullName ?? row.email,
      readerGroup: (row.profile?.readerGroup ?? 'student') as AccountDto['readerGroup'],
      roles: row.roles.map((entry) => entry.role as Role),
      status: row.status,
      mustChangePassword: row.mustChangePassword,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
