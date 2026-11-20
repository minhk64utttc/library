import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  COPY_STATUSES,
  copyBulkCreateSchema,
  copyUpdateSchema,
  pageQuerySchema,
  type CopyBulkCreate,
  type CopyDto,
  type CopyUpdate,
  type Paginated,
} from '@thu-vien/shared';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CopiesService, type CopyListQuery } from './copies.service';

const copyListQuerySchema = pageQuerySchema.extend({
  editionId: z.string().min(1).optional(),
  status: z.enum(COPY_STATUSES).optional(),
  code: z.string().trim().min(1).max(100).optional(),
});

type CopyListQueryInput = z.infer<typeof copyListQuerySchema>;

@Controller('holdings/copies')
@UseGuards(AuthGuard, PermissionsGuard)
export class CopiesController {
  constructor(private readonly copies: CopiesService) {}

  @Get()
  @RequirePermissions('catalog:read')
  list(
    @Query(new ZodValidationPipe(copyListQuerySchema)) query: CopyListQueryInput,
  ): Promise<Paginated<CopyDto>> {
    return this.copies.list(query as CopyListQuery);
  }

  @Post()
  @RequirePermissions('holdings:manage')
  bulkCreate(
    @Body(new ZodValidationPipe(copyBulkCreateSchema)) body: CopyBulkCreate,
  ): Promise<CopyDto[]> {
    return this.copies.bulkCreate(body);
  }

  @Patch(':id')
  @RequirePermissions('holdings:manage')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(copyUpdateSchema)) body: CopyUpdate,
  ): Promise<CopyDto> {
    return this.copies.update(id, body);
  }
}
