import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PageQuery, Paginated, PublisherDto, PublisherInput, PublisherUpdate } from '@thu-vien/shared';

import { isRecordNotFound, isUniqueViolation } from '../../common/prisma/errors';
import { PrismaService } from '../../infrastructure/database/prisma.service';

interface PublisherRow {
  id: string;
  code: string;
  name: string;
  address: string | null;
}

@Injectable()
export class PublishersService {
  constructor(private readonly prisma: PrismaService) {}

  async list({ page, pageSize }: PageQuery): Promise<Paginated<PublisherDto>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.publisher.findMany({
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.publisher.count(),
    ]);

    return { items: rows.map((row) => this.toDto(row)), total, page, pageSize };
  }

  async create(input: PublisherInput): Promise<PublisherDto> {
    try {
      const created = await this.prisma.publisher.create({
        data: { code: input.code, name: input.name, address: input.address ?? null },
      });
      return this.toDto(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ code: 'DUPLICATE', message: 'Mã nhà xuất bản đã tồn tại' });
      }
      throw error;
    }
  }

  async update(id: string, input: PublisherUpdate): Promise<PublisherDto> {
    try {
      const updated = await this.prisma.publisher.update({
        where: { id },
        data: {
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.address !== undefined ? { address: input.address } : {}),
        },
      });
      return this.toDto(updated);
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy nhà xuất bản' });
      }
      if (isUniqueViolation(error)) {
        throw new ConflictException({ code: 'DUPLICATE', message: 'Mã nhà xuất bản đã tồn tại' });
      }
      throw error;
    }
  }

  private toDto(row: PublisherRow): PublisherDto {
    return { id: row.id, code: row.code, name: row.name, address: row.address };
  }
}
