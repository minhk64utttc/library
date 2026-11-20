import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type InventoryItem } from '@prisma/client';
import type { InventoryCreate, InventoryScan, InventoryFound, InventoryDecision, InventoryItemsQuery, InventoryItemDto, InventoryRunDto, PageQuery, Paginated } from '@thu-vien/shared';

import { Clock } from '../../common/clock/clock';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CopyAvailabilityService } from '../circulation/copy-availability.service';

const itemInclude = { copy: { include: { edition: { include: { work: true } } } } } as const;
type ItemRow = Prisma.InventoryItemGetPayload<{ include: typeof itemInclude }>;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService, private readonly clock: Clock, private readonly availability: CopyAvailabilityService) {}

  async list(query: PageQuery): Promise<Paginated<InventoryRunDto>> {
    const [runs, total] = await this.prisma.$transaction([
      this.prisma.inventoryRun.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.inventoryRun.count(),
    ]);
    return { items: await Promise.all(runs.map((run) => this.detail(run.id))), total, ...query };
  }

  async detail(id: string): Promise<InventoryRunDto> {
    const run = await this.prisma.inventoryRun.findUnique({ where: { id }, include: { location: true } });
    if (!run) this.notFound();
    const groups = await this.prisma.inventoryItem.groupBy({ by: ['result'], where: { runId: id }, _count: true });
    return {
      id: run.id, name: run.name, locationId: run.locationId, locationName: run.location.name,
      createdAt: run.createdAt.toISOString(), closedAt: run.closedAt?.toISOString() ?? null,
      total: await this.prisma.inventoryItem.count({ where: { runId: id, inSnapshot: true } }),
      counts: Object.fromEntries(groups.map((group) => [group.result, group._count])),
    };
  }

  async items(id: string, query: InventoryItemsQuery): Promise<Paginated<InventoryItemDto>> {
    if (!await this.prisma.inventoryRun.findUnique({ where: { id }, select: { id: true } })) this.notFound();
    const where: Prisma.InventoryItemWhereInput = { runId: id, ...(query.result ? { result: query.result } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.inventoryItem.findMany({ where, include: itemInclude, orderBy: [{ copy: { code: 'asc' } }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.inventoryItem.count({ where }),
    ]);
    return { items: rows.map((row) => this.toItem(row)), total, page: query.page, pageSize: query.pageSize };
  }

  async create(input: InventoryCreate, actorId: string): Promise<InventoryRunDto> {
    const id = await this.prisma.$transaction(async (tx) => {
      const locations = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Location" WHERE id = ${input.locationId} FOR UPDATE`;
      if (!locations.length) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy vị trí' });
      if (await tx.inventoryRun.findFirst({ where: { locationId: input.locationId, closedAt: null } })) {
        throw new ConflictException({ code: 'OPEN_RUN', message: 'Vị trí này đang có một đợt kiểm kê chưa đóng' });
      }
      const copies = await tx.copy.findMany({ where: { locationId: input.locationId }, orderBy: { id: 'asc' } });
      const run = await tx.inventoryRun.create({ data: { ...input, createdById: actorId, createdAt: this.clock.now() } });
      for (let offset = 0; offset < copies.length; offset += 500) {
        await tx.inventoryItem.createMany({ data: copies.slice(offset, offset + 500).map((copy) => ({
          runId: run.id, copyId: copy.id, expectedLocationId: copy.locationId,
          snapshotStatus: copy.status, snapshotUpdatedAt: copy.updatedAt,
        })) });
      }
      await this.audit(tx, run.id, actorId, 'created', `Chụp danh sách ${copies.length} bản sao`);
      return run.id;
    }, { timeout: 30000 });
    return this.detail(id);
  }

  async scan(id: string, input: InventoryScan, actorId: string): Promise<InventoryItemDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const run = await this.openRun(tx, id);
      await this.locationExists(tx, input.locationId);
      const copies = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Copy" WHERE code = ${input.code} FOR UPDATE`;
      const lockedCopy = copies[0];
      if (!lockedCopy) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy mã cuốn' });
      const copy = await tx.copy.findUniqueOrThrow({ where: { id: lockedCopy.id } });
      if (copy.status === 'on_loan' || await tx.loan.count({ where: { copyId: copy.id, status: 'active' } }) ||
          await tx.incident.count({ where: { copyId: copy.id, status: { not: 'resolved' } } })) {
        throw new ConflictException({ code: 'COPY_BUSY', message: 'Bản sao đang mượn hoặc đang xử lý sự cố; cần xác minh trước khi quét' });
      }
      let item = await tx.inventoryItem.findUnique({ where: { runId_copyId: { runId: id, copyId: copy.id } } });
      if (!item) {
        if (input.locationId !== run.locationId) throw new BadRequestException({ code: 'OUTSIDE_SCOPE', message: 'Chỉ ghi nhận sách ngoài danh sách khi quét trong khu vực của đợt' });
        item = await tx.inventoryItem.create({ data: { runId: id, copyId: copy.id, expectedLocationId: copy.locationId,
          snapshotStatus: copy.status, snapshotUpdatedAt: copy.updatedAt, inSnapshot: false, result: 'unexpected' } });
      }
      if (!['unchecked', 'matched', 'misplaced', 'unexpected'].includes(item.result) || ['pending_search', 'lost', 'withdrawn'].includes(copy.status)) {
        throw new ConflictException({ code: 'USE_FOUND_ACTION', message: 'Kết quả đã đối soát; dùng thao tác tra soát phù hợp' });
      }
      if (!item.inSnapshot && input.locationId !== run.locationId) {
        throw new BadRequestException({ code: 'OUTSIDE_SCOPE', message: 'Quan sát ngoài danh sách phải nằm trong khu vực của đợt' });
      }
      const result = !item.inSnapshot ? 'unexpected' : copy.locationId !== item.expectedLocationId ? 'moved'
        : copy.updatedAt.getTime() !== item.snapshotUpdatedAt.getTime() ? 'changed'
        : item.expectedLocationId === input.locationId ? 'matched' : 'misplaced';
      const updated = await tx.inventoryItem.update({ where: { id: item.id }, data: {
        result, scannedLocationId: input.locationId, scannedAt: this.clock.now(), note: !item.inSnapshot ? 'Phát hiện ngoài danh sách ban đầu; thông tin đăng ký được ghi tại lúc quét' : null,
      }, include: itemInclude });
      await this.audit(tx, id, actorId, 'scanned', `Vị trí quét: ${input.locationId}; ${result}`, item.copyId);
      return updated;
    });
    return this.toItem(row);
  }

  async reconcile(id: string, actorId: string): Promise<InventoryRunDto> {
    await this.prisma.$transaction(async (tx) => {
      await this.openRun(tx, id);
      const items = await tx.inventoryItem.findMany({ where: { runId: id, result: 'unchecked' }, orderBy: { copyId: 'asc' }, take: 100 });
      for (const item of items) {
        await tx.$queryRaw`SELECT id FROM "Copy" WHERE id = ${item.copyId} FOR UPDATE`;
        const copy = await tx.copy.findUniqueOrThrow({ where: { id: item.copyId } });
        let result: InventoryItem['result'];
        let note: string;
        let previousStatus: InventoryItem['previousStatus'] = null;
        const activeLoan = await tx.loan.count({ where: { copyId: copy.id, status: 'active' } });
        if (copy.status === 'on_loan' || activeLoan) {
          result = 'on_loan'; note = 'Đang có khoản mượn; giữ nguyên trạng thái';
        } else if (copy.locationId !== item.expectedLocationId) {
          result = 'moved'; note = 'Vị trí đăng ký đã thay đổi sau khi mở đợt';
        } else if (copy.updatedAt.getTime() !== item.snapshotUpdatedAt.getTime()) {
          result = 'changed'; note = 'Bản sao có biến động sau khi mở đợt; cần kiểm kê lại ở đợt sau';
        } else if (!['available', 'processing', 'damaged'].includes(copy.status) ||
          await tx.incident.count({ where: { copyId: copy.id, status: { not: 'resolved' } } })) {
          result = 'excluded'; note = 'Đang giữ sách hoặc có hồ sơ xử lý khác; giữ nguyên trạng thái';
        } else {
          previousStatus = copy.status;
          result = 'pending_search'; note = 'Chưa quét thấy, cần tra soát trước khi kết luận';
          await tx.copy.update({ where: { id: copy.id }, data: { status: 'pending_search' } });
        }
        await tx.inventoryItem.update({ where: { id: item.id }, data: { result, note, previousStatus } });
        await this.audit(tx, id, actorId, 'reconciled', note, copy.id);
      }
    }, { timeout: 30000 });
    return this.detail(id);
  }

  async found(id: string, itemId: string, input: InventoryFound, actorId: string): Promise<InventoryItemDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.openRun(tx, id);
      const item = await this.pendingItem(tx, id, itemId);
      await this.locationExists(tx, input.locationId);
      const copy = await tx.copy.findUniqueOrThrow({ where: { id: item.copyId }, include: { edition: { include: { work: true } } } });
      const restoredStatus = item.previousStatus === 'damaged' ? 'damaged' : 'processing';
      await tx.copy.update({ where: { id: copy.id }, data: { locationId: input.locationId, status: restoredStatus } });
      if (item.previousStatus === 'available' && copy.edition.work.status === 'published' && copy.edition.callNumber?.trim()) {
        await this.availability.release(tx, copy.id, copy.editionId, this.clock.now());
      }
      const updated = await tx.inventoryItem.update({ where: { id: item.id }, data: {
        result: 'found', scannedLocationId: input.locationId, scannedAt: this.clock.now(), note: input.note,
      }, include: itemInclude });
      await this.audit(tx, id, actorId, 'found', `${input.note}; vị trí: ${input.locationId}`, copy.id);
      return updated;
    });
    return this.toItem(row);
  }

  async confirmLost(id: string, itemId: string, input: InventoryDecision, actorId: string): Promise<InventoryItemDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.openRun(tx, id);
      const item = await this.pendingItem(tx, id, itemId);
      await tx.copy.update({ where: { id: item.copyId }, data: { status: 'lost' } });
      const updated = await tx.inventoryItem.update({ where: { id: item.id }, data: { result: 'lost', note: input.note }, include: itemInclude });
      await this.audit(tx, id, actorId, 'confirmed_lost', input.note, item.copyId);
      return updated;
    });
    return this.toItem(row);
  }

  async close(id: string, actorId: string): Promise<InventoryRunDto> {
    await this.prisma.$transaction(async (tx) => {
      const run = await this.openRun(tx, id, true);
      if (run.closedAt) return;
      const unresolved = await tx.inventoryItem.count({ where: { runId: id, result: { in: ['unchecked', 'pending_search', 'misplaced'] } } });
      if (unresolved) throw new ConflictException({ code: 'UNRESOLVED_ITEMS', message: 'Cần xử lý hết bản sao chưa kiểm tra, sai vị trí và chờ tra soát trước khi đóng' });
      await tx.inventoryRun.update({ where: { id }, data: { closedAt: this.clock.now() } });
      await this.audit(tx, id, actorId, 'closed', 'Đóng đợt sau đối soát');
    });
    return this.detail(id);
  }

  private async openRun(tx: Prisma.TransactionClient, id: string, allowClosed = false) {
    await tx.$queryRaw`SELECT id FROM "InventoryRun" WHERE id = ${id} FOR UPDATE`;
    const run = await tx.inventoryRun.findUnique({ where: { id } });
    if (!run) this.notFound();
    if (run.closedAt && !allowClosed) throw new ConflictException({ code: 'RUN_CLOSED', message: 'Đợt kiểm kê đã đóng' });
    return run;
  }

  private async pendingItem(tx: Prisma.TransactionClient, runId: string, id: string) {
    const item = await tx.inventoryItem.findFirst({ where: { id, runId } });
    if (!item) this.notFound();
    await tx.$queryRaw`SELECT id FROM "Copy" WHERE id = ${item.copyId} FOR UPDATE`;
    const copy = await tx.copy.findUniqueOrThrow({ where: { id: item.copyId } });
    const activeLoan = await tx.loan.count({ where: { copyId: item.copyId, status: 'active' } });
    const openIncident = await tx.incident.count({ where: { copyId: item.copyId, status: { not: 'resolved' } } });
    if (item.result !== 'pending_search' || !item.previousStatus || copy.status !== 'pending_search' || activeLoan || openIncident) {
      throw new ConflictException({ code: 'COPY_CHANGED', message: 'Bản sao đã thay đổi hoặc đang có hồ sơ khác; cần kiểm tra lại' });
    }
    return item;
  }

  private async locationExists(tx: Prisma.TransactionClient, id: string): Promise<void> {
    if (!await tx.location.findUnique({ where: { id }, select: { id: true } })) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy vị trí' });
    }
  }

  private audit(tx: Prisma.TransactionClient, runId: string, actorId: string, action: string, note: string, copyId?: string) {
    return tx.inventoryEvent.create({ data: { runId, actorId, action, note, copyId } });
  }

  private notFound(): never { throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy đợt hoặc bản sao kiểm kê' }); }

  private toItem(row: ItemRow): InventoryItemDto {
    return { id: row.id, inSnapshot: row.inSnapshot, copyId: row.copyId, code: row.copy.code, title: row.copy.edition.work.title,
      expectedLocationId: row.expectedLocationId, scannedLocationId: row.scannedLocationId,
      snapshotStatus: row.snapshotStatus, currentStatus: row.copy.status, result: row.result,
      scannedAt: row.scannedAt?.toISOString() ?? null, note: row.note };
  }
}
