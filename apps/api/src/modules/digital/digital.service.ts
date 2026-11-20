import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DigitalAccessLevel, DigitalSubmissionStatus, Prisma } from '@prisma/client';
import type { DigitalPublish, DigitalReviewNote, DigitalSubmissionCreate, Paginated } from '@thu-vien/shared';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { Clock } from '../../common/clock/clock';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const FILE_LIMIT_BYTES = 25 * 1024 * 1024;
const FILE_TYPES = new Map([
  ['application/pdf', '.pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
]);
const INCLUDE = {
  submitter: { include: { profile: true } },
  files: { orderBy: { versionNumber: 'desc' as const }, take: 1 },
} as const;

export interface UploadedDocument {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class DigitalService {
  private readonly storageRoot = resolve(process.env.DOCUMENT_STORAGE_PATH ?? join(process.cwd(), '.private', 'digital'));

  constructor(private readonly prisma: PrismaService, private readonly clock: Clock) {}

  async create(accountId: string, input: DigitalSubmissionCreate) {
    const code = `HS-${this.clock.now().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const row = await this.prisma.digitalSubmission.create({
      data: { ...input, submissionCode: code, submitterId: accountId, department: input.department || null },
      include: INCLUDE,
    });
    await this.event(row.id, accountId, 'created', 'Tạo hồ sơ nộp tài liệu số');
    return this.toDto(row);
  }

  async listMine(accountId: string, query: { page: number; pageSize: number; status?: DigitalSubmissionStatus; q?: string }): Promise<Paginated<unknown>> {
    return this.list({ ...query, submitterId: accountId });
  }

  async listStaff(query: { page: number; pageSize: number; status?: DigitalSubmissionStatus; q?: string }): Promise<Paginated<unknown>> {
    return this.list(query);
  }

  async listPublic(query: { page: number; pageSize: number; q?: string }): Promise<Paginated<unknown>> {
    const term = query.q?.trim();
    const where: Prisma.DigitalSubmissionWhereInput = {
      status: 'published', accessLevel: 'public',
      ...(term ? { OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { author: { contains: term, mode: 'insensitive' } },
      ] } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.digitalSubmission.findMany({
        where,
        select: {
          submissionCode: true, title: true, abstract: true, author: true, department: true,
          publishedYear: true, license: true, publishedAt: true,
          files: { select: { originalName: true }, orderBy: { versionNumber: 'desc' }, take: 1 },
        },
        orderBy: { publishedAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize,
      }),
      this.prisma.digitalSubmission.count({ where }),
    ]);
    return { items: rows.map((row) => ({
      submissionCode: row.submissionCode, title: row.title, abstract: row.abstract, author: row.author,
      department: row.department, publishedYear: row.publishedYear, license: row.license,
      publishedAt: row.publishedAt?.toISOString() ?? null, fileName: row.files[0]?.originalName ?? null,
    })), total, page: query.page, pageSize: query.pageSize };
  }

  async listMembers(query: { page: number; pageSize: number; q?: string }): Promise<Paginated<unknown>> {
    const term = query.q?.trim();
    const where: Prisma.DigitalSubmissionWhereInput = {
      status: 'published', accessLevel: 'members_only',
      ...(term ? { OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { author: { contains: term, mode: 'insensitive' } },
      ] } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.digitalSubmission.findMany({
        where, select: {
          id: true, submissionCode: true, title: true, abstract: true, author: true, department: true,
          publishedYear: true, license: true, accessLevel: true, publishedAt: true,
          files: { select: { id: true, originalName: true }, orderBy: { versionNumber: 'desc' }, take: 1 },
        }, orderBy: { publishedAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize,
      }),
      this.prisma.digitalSubmission.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        submissionId: row.id, submissionCode: row.submissionCode, title: row.title, abstract: row.abstract,
        author: row.author, department: row.department, publishedYear: row.publishedYear, license: row.license,
        accessLevel: row.accessLevel, publishedAt: row.publishedAt?.toISOString() ?? null,
        fileId: row.files[0]?.id ?? null, fileName: row.files[0]?.originalName ?? null,
      })), total, page: query.page, pageSize: query.pageSize,
    };
  }

  private async list(query: { page: number; pageSize: number; status?: DigitalSubmissionStatus; q?: string; submitterId?: string }): Promise<Paginated<unknown>> {
    const term = query.q?.trim();
    const where: Prisma.DigitalSubmissionWhereInput = {
      ...(query.submitterId ? { submitterId: query.submitterId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(term ? { OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { author: { contains: term, mode: 'insensitive' } },
        { submissionCode: { contains: term, mode: 'insensitive' } },
      ] } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.digitalSubmission.findMany({ where, include: INCLUDE, orderBy: { submittedAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.digitalSubmission.count({ where }),
    ]);
    return { items: rows.map((row) => this.toDto(row)), total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string, accountId: string) {
    const row = await this.prisma.digitalSubmission.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy hồ sơ học liệu số' });
    const roles = await this.prisma.accountRole.findMany({ where: { accountId }, select: { role: true } });
    const canManage = roles.some((entry) => entry.role === 'digital' || entry.role === 'manager');
    if (!canManage && row.submitterId !== accountId) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy hồ sơ học liệu số' });
    const events = await this.prisma.digitalSubmissionEvent.findMany({
      where: { submissionId: id }, include: { actor: { include: { profile: true } } }, orderBy: { createdAt: 'asc' },
    });
    return {
      submission: this.toDto(row),
      events: events.map((event) => ({
        id: event.id, action: event.action, note: event.note,
        actorName: event.actor.profile?.fullName ?? event.actor.email, createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async update(id: string, accountId: string, input: DigitalSubmissionCreate) {
    await this.ownedEditable(id, accountId);
    const changed = await this.prisma.digitalSubmission.updateMany({
      where: { id, submitterId: accountId, status: { in: ['new_submission', 'need_more_info'] } },
      data: { ...input, department: input.department || null },
    });
    if (!changed.count) throw new ConflictException({ code: 'SUBMISSION_LOCKED', message: 'Submission state changed; reload and try again.' });
    const updated = await this.prisma.digitalSubmission.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    await this.event(id, accountId, 'metadata_updated', 'Cập nhật thông tin hồ sơ');
    return this.toDto(updated);
  }

  async upload(id: string, accountId: string, file: UploadedDocument) {
    await this.ownedEditable(id, accountId);
    this.validateFile(file);
    const storageKey = randomUUID();
    const destination = this.filePath(storageKey);
    await mkdir(this.storageRoot, { recursive: true, mode: 0o700 });
    await writeFile(destination, file.buffer, { flag: 'wx', mode: 0o600 });
    let saved: Prisma.DigitalFileVersionGetPayload<Record<string, never>>;
    try {
      saved = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "DigitalSubmission" WHERE "id" = ${id} FOR UPDATE`;
        const current = await tx.digitalSubmission.findUnique({ where: { id } });
        if (!current || current.submitterId !== accountId || !['new_submission', 'need_more_info'].includes(current.status)) {
          throw new BadRequestException({ code: 'SUBMISSION_LOCKED', message: 'Submission is no longer editable.' });
        }
        const latest = await tx.digitalFileVersion.findFirst({ where: { submissionId: id }, orderBy: { versionNumber: 'desc' } });
        const version = await tx.digitalFileVersion.create({
          data: {
            submissionId: id, uploaderId: accountId, storageKey,
            originalName: basename(file.originalname).slice(0, 255), mimeType: file.mimetype,
            sizeBytes: file.size, checksumSha256: createHash('sha256').update(file.buffer).digest('hex'),
            versionNumber: (latest?.versionNumber ?? 0) + 1,
          },
        });
        if (current.status === 'need_more_info') {
          await tx.digitalSubmission.update({ where: { id }, data: { status: 'new_submission' } });
        }
        return version;
      });
    } catch (error) {
      await unlink(destination).catch(() => undefined);
      throw error;
    }
    await this.event(id, accountId, 'file_uploaded', `Đã tải phiên bản tệp ${saved.versionNumber}`);
    return { originalName: saved.originalName, sizeBytes: saved.sizeBytes, versionNumber: saved.versionNumber, checksumSha256: saved.checksumSha256 };
  }

  async startReview(id: string, actorId: string) {
    const row = await this.requireStatus(id, 'new_submission');
    if (!row.files.length) throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Hồ sơ cần có tệp PDF hoặc DOCX trước khi duyệt' });
    const updated = await this.transitionStatus(id, 'new_submission', { status: 'under_review' });
    await this.event(id, actorId, 'review_started', 'Bắt đầu thẩm định hồ sơ');
    return updated;
  }

  async requestInfo(id: string, actorId: string, input: DigitalReviewNote) {
    await this.requireStatus(id, 'under_review');
    const updated = await this.transitionStatus(id, 'under_review', { status: 'need_more_info', reviewNote: input.note });
    await this.event(id, actorId, 'more_info_requested', input.note);
    return updated;
  }

  async accept(id: string, actorId: string, input: DigitalReviewNote) {
    await this.requireStatus(id, 'under_review');
    const updated = await this.transitionStatus(id, 'under_review', { status: 'accepted', reviewNote: input.note, acceptedAt: this.clock.now() });
    await this.event(id, actorId, 'accepted', input.note);
    return updated;
  }

  async publish(id: string, actorId: string, input: DigitalPublish) {
    await this.requireStatus(id, 'accepted');
    const updated = await this.transitionStatus(id, 'accepted', {
        status: 'published', accessLevel: input.accessLevel as DigitalAccessLevel,
        publicationNote: input.note ?? null, publishedAt: this.clock.now(),
    });
    await this.event(id, actorId, 'published', input.note ?? null, input.accessLevel as DigitalAccessLevel);
    return updated;
  }

  async downloadPrivate(fileId: string, accountId: string) {
    const file = await this.file(fileId);
    const accountRoles = await this.prisma.accountRole.findMany({ where: { accountId }, select: { role: true } });
    const roleNames = accountRoles.map((entry) => entry.role);
    const canManage = roleNames.includes('digital') || roleNames.includes('manager');
    const ownSubmission = file.submission.submitterId === accountId;
    const publicResource = file.submission.status === 'published' && file.submission.accessLevel === 'public';
    const membersResource = file.submission.status === 'published' && file.submission.accessLevel === 'members_only';
    if (!canManage && !ownSubmission && !publicResource && !membersResource) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy tệp học liệu số' });
    }
    if (!canManage && !ownSubmission && (publicResource || membersResource)) {
      const latest = await this.prisma.digitalFileVersion.findFirst({
        where: { submissionId: file.submissionId }, orderBy: { versionNumber: 'desc' }, select: { id: true },
      });
      if (latest?.id !== file.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'File not found' });
    }
    return this.readFile(file);
  }

  async downloadPublic(submissionCode: string) {
    const file = await this.prisma.digitalFileVersion.findFirst({
      where: { submission: { submissionCode, status: 'published', accessLevel: 'public' } },
      include: { submission: true }, orderBy: { versionNumber: 'desc' },
    });
    if (!file) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy tài liệu công khai' });
    return this.readFile(file);
  }

  private async readFile(file: { storageKey: string; originalName: string; mimeType: string; sizeBytes: number }) {
    const buffer = await readFile(this.filePath(file.storageKey));
    return { buffer, originalName: file.originalName, mimeType: file.mimeType, sizeBytes: file.sizeBytes };
  }

  private async file(fileId: string) {
    const file = await this.prisma.digitalFileVersion.findUnique({ where: { id: fileId }, include: { submission: true } });
    if (!file) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy tệp học liệu số' });
    return file;
  }

  private filePath(key: string): string {
    if (!/^[0-9a-f-]{36}$/i.test(key)) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy tệp học liệu số' });
    const path = resolve(this.storageRoot, key);
    if (!path.startsWith(`${this.storageRoot}/`) && !path.startsWith(`${this.storageRoot}\\`)) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy tệp học liệu số' });
    }
    return path;
  }

  private validateFile(file: UploadedDocument): void {
    const extension = FILE_TYPES.get(file.mimetype);
    if (!file.buffer?.length || file.size !== file.buffer.length || file.size > FILE_LIMIT_BYTES || !extension) {
      throw new BadRequestException({ code: 'INVALID_FILE', message: 'Chỉ nhận tệp PDF hoặc DOCX tối đa 25 MB' });
    }
    const nameExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    const hasValidSignature = extension === '.pdf'
      ? file.buffer.subarray(0, 5).toString('ascii') === '%PDF-'
      : file.buffer.subarray(0, 2).toString('hex') === '504b';
    if (nameExtension !== extension || !hasValidSignature) {
      throw new BadRequestException({ code: 'INVALID_FILE_CONTENT', message: 'Định dạng tệp không khớp nội dung' });
    }
  }

  private async ownedEditable(id: string, accountId: string) {
    const row = await this.prisma.digitalSubmission.findUnique({ where: { id } });
    if (!row || row.submitterId !== accountId) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy hồ sơ học liệu số' });
    if (!['new_submission', 'need_more_info'].includes(row.status)) {
      throw new BadRequestException({ code: 'SUBMISSION_LOCKED', message: 'Hồ sơ không còn ở trạng thái được chỉnh sửa' });
    }
    return row;
  }

  private async requireStatus(id: string, status: DigitalSubmissionStatus) {
    const row = await this.prisma.digitalSubmission.findUnique({ where: { id }, include: { files: { take: 1 } } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy hồ sơ học liệu số' });
    if (row.status !== status) throw new BadRequestException({ code: 'INVALID_STATUS', message: 'Hồ sơ không ở trạng thái phù hợp để xử lý' });
    return row;
  }

  private async transitionStatus(
    id: string,
    expectedStatus: DigitalSubmissionStatus,
    data: Prisma.DigitalSubmissionUpdateManyMutationInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.digitalSubmission.updateMany({ where: { id, status: expectedStatus }, data });
      if (changed.count !== 1) {
        throw new ConflictException({ code: 'INVALID_STATUS', message: 'Submission state changed; reload and try again.' });
      }
      return tx.digitalSubmission.findUniqueOrThrow({ where: { id } });
    });
  }

  private event(submissionId: string, actorId: string, action: string, note: string | null, accessLevel?: DigitalAccessLevel) {
    return this.prisma.digitalSubmissionEvent.create({
      data: { submissionId, actorId, action, note, ...(accessLevel ? { accessLevel } : {}) },
    });
  }

  private toDto(row: Prisma.DigitalSubmissionGetPayload<{ include: typeof INCLUDE }>) {
    const file = row.files[0];
    return {
      id: row.id, submissionCode: row.submissionCode, title: row.title, abstract: row.abstract,
      author: row.author, department: row.department, publishedYear: row.publishedYear,
      license: row.license, rightsConfirmed: row.rightsConfirmed, status: row.status,
      accessLevel: row.accessLevel, reviewNote: row.reviewNote, publicationNote: row.publicationNote,
      submittedAt: row.submittedAt.toISOString(), publishedAt: row.publishedAt?.toISOString() ?? null,
      submitterId: row.submitterId, submitterName: row.submitter.profile?.fullName ?? row.submitter.email,
      file: file ? {
        id: file.id, originalName: file.originalName, mimeType: file.mimeType,
        sizeBytes: file.sizeBytes, checksumSha256: file.checksumSha256, versionNumber: file.versionNumber,
      } : null,
    };
  }
}
