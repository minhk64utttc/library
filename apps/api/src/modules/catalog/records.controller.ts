import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  callNumberUpdateSchema,
  recordListQuerySchema,
  type RecordListQuery,
  recordInputSchema,
  recordRejectSchema,
  recordUpdateSchema,
  type CatalogRecordDto,
  type CallNumberUpdate,
  type Paginated,
  type RecordInput,
  type RecordReject,
  type RecordUpdate,
} from '@thu-vien/shared';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import type { SessionContext } from '../auth/session.service';
import { RecordsService } from './records.service';

@Controller('catalog/records')
@UseGuards(AuthGuard, PermissionsGuard)
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Get()
  @RequirePermissions('catalog:read')
  list(
    @Query(new ZodValidationPipe(recordListQuerySchema)) query: RecordListQuery,
  ): Promise<Paginated<CatalogRecordDto>> {
    return this.records.list(query);
  }

  @Get(':id')
  @RequirePermissions('catalog:read')
  get(@Param('id') id: string): Promise<CatalogRecordDto> {
    return this.records.get(id);
  }

  @Post()
  @RequirePermissions('catalog:write')
  create(
    @Body(new ZodValidationPipe(recordInputSchema)) body: RecordInput,
  ): Promise<CatalogRecordDto> {
    return this.records.create(body);
  }

  @Patch(':id')
  @RequirePermissions('catalog:write')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(recordUpdateSchema)) body: RecordUpdate,
  ): Promise<CatalogRecordDto> {
    return this.records.update(id, body);
  }

  @Post(':id/submit')
  @RequirePermissions('catalog:write')
  submit(@Param('id') id: string): Promise<CatalogRecordDto> {
    return this.records.submit(id);
  }

  @Post(':id/approve')
  @RequirePermissions('catalog:approve')
  approve(
    @Param('id') id: string,
    @CurrentSession() session: SessionContext,
  ): Promise<CatalogRecordDto> {
    return this.records.approve(id, session.accountId);
  }

  @Post(':id/reject')
  @RequirePermissions('catalog:approve')
  reject(
    @Param('id') id: string,
    @CurrentSession() session: SessionContext,
    @Body(new ZodValidationPipe(recordRejectSchema)) body: RecordReject,
  ): Promise<CatalogRecordDto> {
    return this.records.reject(id, session.accountId, body.reason);
  }

  @Post(':id/publish')
  @RequirePermissions('catalog:approve')
  publish(@Param('id') id: string): Promise<CatalogRecordDto> {
    return this.records.publish(id);
  }

  @Patch(':id/editions/:editionId/call-number')
  @RequirePermissions('catalog:write')
  setCallNumber(
    @Param('id') id: string,
    @Param('editionId') editionId: string,
    @Body(new ZodValidationPipe(callNumberUpdateSchema)) body: CallNumberUpdate,
  ): Promise<CatalogRecordDto> {
    return this.records.setCallNumber(id, editionId, body.callNumber);
  }
}
