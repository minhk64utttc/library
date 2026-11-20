import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CopyBulkCreate,
  CopyDto,
  CopyStatus,
  CopyUpdate,
  PageQuery,
  Paginated,
} from '@thu-vien/shared';

import { isRecordNotFound, isUniqueViolation } from '../../common/prisma/errors';
import { PrismaService } from '../../infrastructure/database/prisma.service';

type CopyWithRelations = Prisma.CopyGetPayload<{
  include: { edition: { include: { work: true } }; location: true };
}>;

export interface CopyListQuery extends PageQuery {
  editionId?: string;
  status?: CopyStatus;
  code?: string;
}

@Injectable()
export class CopiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list({ page, pageSize, editionId, status, code }: CopyListQuery): Promise<Paginated<CopyDto>> {
    const where: Prisma.CopyWhereInput = {
      ...(editionId ? { editionId } : {}),
      ...(status ? { status } : {}),
      ...(code ? { code: { contains: code, mode: 'insensitive' } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.copy.findMany({
        where,
        include: { edition: { include: { work: true } }, location: true },
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.copy.count({ where }),
    ]);

    return { items: rows.map((row) => this.toDto(row)), total, page, pageSize };
  }

  async bulkCreate(input: CopyBulkCreate): Promise<CopyDto[]> {
    try {
      const codes = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Edition" WHERE id = ${input.editionId} FOR UPDATE`;
        const edition = await tx.edition.findUnique({
          where: { id: input.editionId },
          select: { id: true, callNumber: true, work: { select: { status: true } } },
        });
        if (!edition) {
          throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy ấn bản' });
        }
        if (edition.work.status !== 'published') {
          throw new BadRequestException({
            code: 'RECORD_NOT_PUBLISHED',
            message: 'Chỉ tạo bản sao sau khi công bố bản ghi',
          });
        }
        if (!edition.callNumber?.trim()) {
          throw new BadRequestException({
            code: 'CALL_NUMBER_REQUIRED',
            message: 'Ấn bản cần có mã xếp giá trước khi tạo bản sao',
          });
        }

        const prefix = edition.callNumber.trim().replace(/\s+/g, '-');
        const existing = await tx.copy.count({ where: { editionId: edition.id } });
        const generated = Array.from({ length: input.count }, (_, index) =>
          `${prefix}-${String(existing + index + 1).padStart(4, '0')}`,
        );
        await tx.copy.createMany({
          data: generated.map((code) => ({
            code,
            editionId: edition.id,
            locationId: input.locationId ?? null,
          })),
        });
        return generated;
      });

      const created = await this.prisma.copy.findMany({
        where: { code: { in: codes } },
        include: { edition: { include: { work: true } }, location: true },
        orderBy: { code: 'asc' },
      });
      return created.map((row) => this.toDto(row));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'DUPLICATE',
          message: 'Mã cuốn bị trùng, hãy đặt mã xếp giá riêng cho ấn bản',
        });
      }
      throw error;
    }
  }

  async update(id: string, input: CopyUpdate): Promise<CopyDto> {
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Copy" WHERE id = ${id} FOR UPDATE`;
        const current = await tx.copy.findUnique({
          where: { id },
          include: { edition: { include: { work: true } }, location: true },
        });
        if (!current) {
          throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy bản sao' });
        }

        const resultingStatus = input.status ?? current.status;
        const resultingLocationId = input.locationId === undefined ? current.locationId : input.locationId;
        if (resultingStatus === 'available' && !resultingLocationId) {
          throw new BadRequestException({
            code: 'LOCATION_REQUIRED',
            message: 'Bản sao cần có vị trí trước khi đưa vào phục vụ',
          });
        }

        if (input.status !== undefined) {
          const canActivate = current.status === 'processing' && input.status === 'available';
          if (!canActivate) {
            throw new BadRequestException({
              code: 'INVALID_STATE',
              message: 'Chỉ có thể đưa bản sao đang xử lý vào phục vụ tại đây',
            });
          }
          const openIncident = await tx.incident.count({ where: { copyId: id, status: { not: 'resolved' } } });
          if (openIncident) {
            throw new BadRequestException({ code: 'OPEN_INCIDENT', message: 'Bản sao đang được tra soát sự cố' });
          }
          const [work] = await tx.$queryRaw<Array<{ status: string }>>`
            SELECT status FROM "Work" WHERE id = ${current.edition.workId} FOR SHARE
          `;
          if (work?.status !== 'published') {
            throw new BadRequestException({
              code: 'RECORD_NOT_PUBLISHED',
              message: 'Bản ghi chưa được công bố',
            });
          }
          if (!current.edition.callNumber?.trim()) {
            throw new BadRequestException({
              code: 'CALL_NUMBER_REQUIRED',
              message: 'Ấn bản cần có mã xếp giá trước khi đưa vào phục vụ',
            });
          }
        }

        const changed = await tx.copy.updateMany({
          where: { id, status: current.status, locationId: current.locationId },
          data: {
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.locationId !== undefined ? { locationId: input.locationId } : {}),
          },
        });
        if (changed.count === 0) {
          throw new ConflictException({
            code: 'COPY_CHANGED',
            message: 'Bản sao vừa được thay đổi, hãy thử lại',
          });
        }

        return tx.copy.findUniqueOrThrow({
          where: { id },
          include: { edition: { include: { work: true } }, location: true },
        });
      });
      return this.toDto(updated);
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy bản sao' });
      }
      throw error;
    }
  }

  private toDto(row: CopyWithRelations): CopyDto {
    return {
      id: row.id,
      code: row.code,
      editionId: row.editionId,
      locationId: row.locationId,
      locationName: row.location?.name ?? null,
      status: row.status,
      workTitle: row.edition.work.title,
    };
  }
}
