import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import {
  INCIDENT_STATUSES,
  incidentCreateSchema,
  incidentDecisionSchema,
  incidentInfoSchema,
  incidentRequestInfoSchema,
  pageQuerySchema,
  type IncidentCreate,
  type IncidentDecisionInput,
  type IncidentDto,
  type IncidentInfo,
  type IncidentRequestInfo,
  type Paginated,
} from '@thu-vien/shared';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import type { SessionContext } from '../auth/session.service';
import { IncidentsService } from './incidents.service';

const listQuerySchema = pageQuerySchema.extend({ status: z.enum(INCIDENT_STATUSES).optional() });
const idSchema = z.string().uuid();

@Controller('incidents')
@UseGuards(AuthGuard, PermissionsGuard)
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get()
  @RequirePermissions('incidents:read')
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>): Promise<Paginated<IncidentDto>> {
    return this.incidents.list(query);
  }

  @Post()
  @RequirePermissions('incidents:report')
  create(
    @Body(new ZodValidationPipe(incidentCreateSchema)) body: IncidentCreate,
    @CurrentSession() session: SessionContext,
  ): Promise<IncidentDto> {
    return this.incidents.create(body, session.accountId);
  }

  @Post(':id/attachments')
  @RequirePermissions('incidents:report')
  @UseInterceptors(FilesInterceptor('files', 3, { limits: { fileSize: 5 * 1024 * 1024, files: 3 } }))
  uploadAttachments(
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @CurrentSession() session: SessionContext,
    @UploadedFiles() files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname: string }> | undefined,
  ) {
    if (!files?.length) throw new BadRequestException({ code: 'FILES_REQUIRED', message: 'Chọn ít nhất một ảnh JPEG, PNG hoặc WebP.' });
    return this.incidents.uploadAttachments(id, session.accountId, files);
  }

  @Get(':id/attachments/:attachmentId')
  @RequirePermissions('incidents:read')
  async attachment(
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Param('attachmentId', new ZodValidationPipe(idSchema)) attachmentId: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.incidents.attachment(id, attachmentId);
    const safeName = encodeURIComponent(file.originalName).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.buffer.length);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${safeName}`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(file.buffer);
  }

  @Post(':id/info')
  @RequirePermissions('incidents:report')
  addInfo(
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(incidentInfoSchema)) body: IncidentInfo,
    @CurrentSession() session: SessionContext,
  ): Promise<IncidentDto> {
    return this.incidents.addInfo(id, body, session.accountId);
  }

  @Post(':id/submit')
  @RequirePermissions('incidents:report')
  submit(
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @CurrentSession() session: SessionContext,
  ): Promise<IncidentDto> {
    return this.incidents.submit(id, session.accountId);
  }

  @Post(':id/request-info')
  @RequirePermissions('incidents:decide')
  requestInfo(
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(incidentRequestInfoSchema)) body: IncidentRequestInfo,
    @CurrentSession() session: SessionContext,
  ): Promise<IncidentDto> {
    return this.incidents.requestInfo(id, body, session.accountId);
  }

  @Post(':id/decide')
  @RequirePermissions('incidents:decide')
  decide(
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(incidentDecisionSchema)) body: IncidentDecisionInput,
    @CurrentSession() session: SessionContext,
  ): Promise<IncidentDto> {
    return this.incidents.decide(id, body, session.accountId);
  }
}
