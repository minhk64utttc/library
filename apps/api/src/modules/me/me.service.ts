import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  FineDto,
  FineReceiptDto,
  LoanDto,
  MyProfileDto,
  Paginated,
  ReservationDto,
  UpdateMyProfile,
  FineWaiverRequestInput,
} from '@thu-vien/shared';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { Clock } from '../../common/clock/clock';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { FinesService, type FineListQuery } from '../circulation/fines.service';
import { LoansService, type LoanListQuery } from '../circulation/loans.service';
import { ReservationsService, type ReservationListQuery } from '../circulation/reservations.service';

const PROFILE_PHOTO_LIMIT_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class MeService {
  private readonly photoStorageRoot = join(
    resolve(process.env.DOCUMENT_STORAGE_PATH ?? join(process.cwd(), '.private', 'digital')),
    'profile-photos',
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly loans: LoansService,
    private readonly reservations: ReservationsService,
    private readonly fines: FinesService,
  ) {}

  async cardActivity(accountId: string) {
    const [activeLoanCount, card] = await this.prisma.$transaction([
      this.prisma.loan.count({ where: { borrowerId: accountId, status: 'active' } }),
      this.prisma.libraryCard.findUnique({ where: { accountId }, select: { events: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 30, select: { id: true, action: true, reason: true, createdAt: true, newExpiresAt: true } } } }),
    ]);
    return { activeLoanCount, events: (card?.events ?? []).map(event => ({ id: event.id, action: event.action, reason: event.reason, createdAt: event.createdAt.toISOString(), newExpiresOn: event.newExpiresAt ? new Date(event.newExpiresAt.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) : null })) };
  }

  async profile(accountId: string): Promise<MyProfileDto> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { profile: true, roles: true, libraryCard: true },
    });
    if (!account) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy tài khoản' });
    }
    return this.toProfile(account, this.clock.now());
  }

  async updateProfile(accountId: string, input: UpdateMyProfile): Promise<MyProfileDto> {
    await this.prisma.profile.upsert({
      where: { accountId },
      update: {
        fullName: input.fullName,
        ...(input.phone !== undefined ? { phone: input.phone.trim() || null } : {}),
        ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail || null } : {}),
        ...(input.reminderEmailEnabled !== undefined ? { reminderEmailEnabled: input.reminderEmailEnabled } : {}),
      },
      create: {
        accountId,
        fullName: input.fullName,
        phone: input.phone?.trim() || null,
        contactEmail: input.contactEmail || null,
        reminderEmailEnabled: input.reminderEmailEnabled ?? true,
      },
    });
    return this.profile(accountId);
  }

  async uploadProfilePhoto(accountId: string, file: { mimetype: string; size: number; buffer: Buffer }): Promise<MyProfileDto> {
    if (!file.buffer?.length || file.size !== file.buffer.length || file.size > PROFILE_PHOTO_LIMIT_BYTES || !PROFILE_PHOTO_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException({ code: 'INVALID_PROFILE_PHOTO', message: 'Chọn ảnh JPEG, PNG hoặc WebP có dung lượng tối đa 5 MB.' });
    }

    let normalizedPhoto: Buffer;
    try {
      const image = sharp(file.buffer, { limitInputPixels: 20_000_000, failOn: 'warning' });
      const metadata = await image.metadata();
      const inputMimeType = metadata.format === 'jpeg' ? 'image/jpeg' : metadata.format === 'png' ? 'image/png' : metadata.format === 'webp' ? 'image/webp' : '';
      if (!inputMimeType || inputMimeType !== file.mimetype) {
        throw new Error('Image content and declared type do not match.');
      }
      normalizedPhoto = await image.rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
    } catch {
      throw new BadRequestException({ code: 'INVALID_PROFILE_PHOTO_CONTENT', message: 'Tệp không phải ảnh hợp lệ hoặc ảnh vượt giới hạn giải mã.' });
    }

    const storageKey = randomUUID();
    const destination = this.profilePhotoPath(storageKey);
    await mkdir(this.photoStorageRoot, { recursive: true, mode: 0o700 });
    await writeFile(destination, normalizedPhoto, { flag: 'wx', mode: 0o600 });

    try {
      const oldStorageKey = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${accountId} FOR UPDATE`;
        const profile = await tx.profile.findUnique({ where: { accountId }, select: { photoStorageKey: true } });
        if (profile) {
          await tx.profile.update({ where: { accountId }, data: { photoStorageKey: storageKey } });
          return profile.photoStorageKey;
        }
        const account = await tx.account.findUnique({ where: { id: accountId }, select: { email: true } });
        if (!account) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy tài khoản.' });
        await tx.profile.create({ data: { accountId, fullName: account.email, photoStorageKey: storageKey } });
        return null;
      });
      if (oldStorageKey) await unlink(this.profilePhotoPath(oldStorageKey)).catch(() => undefined);
    } catch (error) {
      await unlink(destination).catch(() => undefined);
      throw error;
    }

    return this.profile(accountId);
  }

  async profilePhoto(accountId: string): Promise<Buffer> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${accountId} FOR UPDATE`;
      const profile = await tx.profile.findUnique({ where: { accountId }, select: { photoStorageKey: true } });
      if (!profile?.photoStorageKey) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Chưa có ảnh hồ sơ.' });
      return readFile(this.profilePhotoPath(profile.photoStorageKey));
    });
  }

  async removeProfilePhoto(accountId: string): Promise<MyProfileDto> {
    const storageKey = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${accountId} FOR UPDATE`;
      const profile = await tx.profile.findUnique({ where: { accountId }, select: { photoStorageKey: true } });
      if (!profile?.photoStorageKey) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Chưa có ảnh hồ sơ.' });
      await tx.profile.update({ where: { accountId }, data: { photoStorageKey: null } });
      return profile.photoStorageKey;
    });
    await unlink(this.profilePhotoPath(storageKey)).catch(() => undefined);
    return this.profile(accountId);
  }

  listLoans(accountId: string, query: Omit<LoanListQuery, 'borrowerId'>): Promise<Paginated<LoanDto>> {
    return this.loans.list({ ...query, borrowerId: accountId });
  }

  async renewLoan(accountId: string, loanId: string): Promise<LoanDto> {
    await this.assertOwnLoan(accountId, loanId);
    return this.loans.renew(loanId, accountId, 'reader');
  }

  listReservations(
    accountId: string,
    query: Omit<ReservationListQuery, 'borrowerId'>,
  ): Promise<Paginated<ReservationDto>> {
    return this.reservations.list({ ...query, borrowerId: accountId });
  }

  createReservation(accountId: string, editionId: string): Promise<ReservationDto> {
    return this.reservations.create({ editionId, borrowerId: accountId });
  }

  async cancelReservation(accountId: string, id: string): Promise<ReservationDto> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      select: { borrowerId: true },
    });
    if (!reservation) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy đặt trước' });
    }
    if (reservation.borrowerId !== accountId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Không phải đặt trước của bạn' });
    }
    return this.reservations.cancel(id);
  }

  listFines(accountId: string, query: Omit<FineListQuery, 'borrowerId'>): Promise<Paginated<FineDto>> {
    return this.fines.list({ ...query, borrowerId: accountId });
  }

  async requestFineWaiver(accountId: string, fineId: string, input: FineWaiverRequestInput) {
    const fine = await this.prisma.fine.findFirst({
      where: { id: fineId, loan: { borrowerId: accountId } },
      select: { id: true },
    });
    if (!fine) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy khoản phạt' });
    }
    return this.fines.requestWaiver(fineId, accountId, input.amount, input.reason);
  }

  fineReceipt(accountId: string, paymentId: string): Promise<FineReceiptDto> {
    return this.fines.receipt(paymentId, accountId);
  }

  private async assertOwnLoan(accountId: string, loanId: string): Promise<void> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: { borrowerId: true },
    });
    if (!loan) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy khoản mượn' });
    }
    if (loan.borrowerId !== accountId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Không phải khoản mượn của bạn' });
    }
  }

  private toProfile(account: {
    id: string;
    email: string;
    status: string;
    mustChangePassword: boolean;
    profile: { fullName: string; phone: string | null; contactEmail: string | null; reminderEmailEnabled: boolean; photoStorageKey: string | null } | null;
    roles: { role: string }[];
    libraryCard: { cardNumber: string; status: 'active' | 'locked'; expiresAt: Date } | null;
  }, now: Date): MyProfileDto {
    return {
      id: account.id,
      email: account.email,
      fullName: account.profile?.fullName ?? account.email,
      phone: account.profile?.phone ?? null,
      contactEmail: account.profile?.contactEmail ?? null,
      reminderEmailEnabled: account.profile?.reminderEmailEnabled ?? true,
      photoUrl: account.profile?.photoStorageKey ? '/api/me/profile/photo' : null,
      libraryCard: account.libraryCard
        ? {
            cardNumber: account.libraryCard.cardNumber,
            status: account.libraryCard.status === 'locked'
              ? 'locked'
              : account.libraryCard.expiresAt < now
                ? 'expired'
                : 'active',
            expiresOn: new Date(account.libraryCard.expiresAt.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10),
          }
        : null,
      roles: account.roles.map((entry) => entry.role as MyProfileDto['roles'][number]),
      status: account.status,
      mustChangePassword: account.mustChangePassword,
    };
  }

  private profilePhotoPath(storageKey: string): string {
    if (!/^[0-9a-f-]{36}$/i.test(storageKey)) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy ảnh hồ sơ.' });
    const path = resolve(this.photoStorageRoot, storageKey);
    if (!path.startsWith(`${this.photoStorageRoot}/`) && !path.startsWith(`${this.photoStorageRoot}\\`)) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy ảnh hồ sơ.' });
    }
    return path;
  }
}
