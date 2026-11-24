import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  publisherListQuerySchema,
  publisherInputSchema,
  publisherUpdateSchema,
  type PublisherListQuery,
  type Paginated,
  type PublisherDto,
  type PublisherInput,
  type PublisherUpdate,
} from '@thu-vien/shared';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { PublishersService } from './publishers.service';

@Controller('catalog/publishers')
@UseGuards(AuthGuard, PermissionsGuard)
export class PublishersController {
  constructor(private readonly publishers: PublishersService) {}

  @Get()
  @RequirePermissions('catalog:read')
  list(
    @Query(new ZodValidationPipe(publisherListQuerySchema)) query: PublisherListQuery,
  ): Promise<Paginated<PublisherDto>> {
    return this.publishers.list(query);
  }

  @Post()
  @RequirePermissions('catalog:write')
  create(
    @Body(new ZodValidationPipe(publisherInputSchema)) body: PublisherInput,
  ): Promise<PublisherDto> {
    return this.publishers.create(body);
  }

  @Patch(':id')
  @RequirePermissions('catalog:write')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(publisherUpdateSchema)) body: PublisherUpdate,
  ): Promise<PublisherDto> {
    return this.publishers.update(id, body);
  }
}
