import { ConflictException, Injectable } from '@nestjs/common';
import type { LocationDto, LocationInput, PageQuery, Paginated } from '@thu-vien/shared';

import { isUniqueViolation } from '../../common/prisma/errors';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list({ page, pageSize }: PageQuery): Promise<Paginated<LocationDto>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.location.findMany({
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.location.count(),
    ]);

    return {
      items: rows.map((row) => ({ id: row.id, code: row.code, name: row.name })),
      total,
      page,
      pageSize,
    };
  }

  async create(input: LocationInput): Promise<LocationDto> {
    try {
      const created = await this.prisma.location.create({
        data: { code: input.code, name: input.name },
      });
      return { id: created.id, code: created.code, name: created.name };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ code: 'DUPLICATE', message: 'Mã vị trí đã tồn tại' });
      }
      throw error;
    }
  }
}
