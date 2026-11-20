import {
  BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { DigitalSubmissionDto } from '@thu-vien/shared';
import type { Response } from 'express';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Public } from '../auth/public.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import type { SessionContext } from '../auth/session.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  digitalListQuerySchema, digitalPublishSchema, digitalReviewNoteSchema,
  digitalSubmissionCreateSchema, type DigitalListQuery, type DigitalPublish,
  type DigitalReviewNote, type DigitalSubmissionCreate,
} from '@thu-vien/shared';
import { DigitalService, type UploadedDocument } from './digital.service';

@Controller('digital')
@UseGuards(AuthGuard, PermissionsGuard)
export class DigitalController {
  constructor(private readonly digital: DigitalService) {}

  @Get('public')
  @Public()
  publicList(@Query(new ZodValidationPipe(digitalListQuerySchema)) query: DigitalListQuery) {
    return this.digital.listPublic(query);
  }

  @Get('public/:submissionCode/file')
  @Public()
  async publicFile(@Param('submissionCode') submissionCode: string, @Res() response: Response): Promise<void> {
    this.send(await this.digital.downloadPublic(submissionCode), response);
  }

  @Get('submissions/mine')
  @RequirePermissions('digital:submit')
  mySubmissions(@CurrentSession() session: SessionContext, @Query(new ZodValidationPipe(digitalListQuerySchema)) query: DigitalListQuery) {
    return this.digital.listMine(session.accountId, query);
  }

  @Get('submissions/members')
  @RequirePermissions('digital:read')
  memberCatalog(@Query(new ZodValidationPipe(digitalListQuerySchema)) query: DigitalListQuery) {
    return this.digital.listMembers(query);
  }

  @Post('submissions')
  @RequirePermissions('digital:submit')
  create(@CurrentSession() session: SessionContext, @Body(new ZodValidationPipe(digitalSubmissionCreateSchema)) body: DigitalSubmissionCreate): Promise<DigitalSubmissionDto> {
    return this.digital.create(session.accountId, body);
  }

  @Get('submissions')
  @RequirePermissions('digital:manage')
  staffList(@Query(new ZodValidationPipe(digitalListQuerySchema)) query: DigitalListQuery) {
    return this.digital.listStaff(query);
  }

  @Get('submissions/:id')
  @RequirePermissions('digital:submit')
  get(@Param('id') id: string, @CurrentSession() session: SessionContext) {
    return this.digital.get(id, session.accountId);
  }

  @Patch('submissions/:id')
  @RequirePermissions('digital:submit')
  update(
    @Param('id') id: string,
    @CurrentSession() session: SessionContext,
    @Body(new ZodValidationPipe(digitalSubmissionCreateSchema)) body: DigitalSubmissionCreate,
  ) {
    return this.digital.update(id, session.accountId, body);
  }

  @Post('submissions/:id/files')
  @RequirePermissions('digital:submit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024, files: 1 } }))
  upload(
    @Param('id') id: string,
    @CurrentSession() session: SessionContext,
    @UploadedFile() file: UploadedDocument | undefined,
  ) {
    if (!file) throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Cần chọn tệp PDF hoặc DOCX' });
    return this.digital.upload(id, session.accountId, file);
  }

  @Post('submissions/:id/start-review')
  @RequirePermissions('digital:manage')
  startReview(@Param('id') id: string, @CurrentSession() session: SessionContext) {
    return this.digital.startReview(id, session.accountId);
  }

  @Post('submissions/:id/request-info')
  @RequirePermissions('digital:manage')
  requestInfo(@Param('id') id: string, @CurrentSession() session: SessionContext, @Body(new ZodValidationPipe(digitalReviewNoteSchema)) body: DigitalReviewNote) {
    return this.digital.requestInfo(id, session.accountId, body);
  }

  @Post('submissions/:id/accept')
  @RequirePermissions('digital:manage')
  accept(@Param('id') id: string, @CurrentSession() session: SessionContext, @Body(new ZodValidationPipe(digitalReviewNoteSchema)) body: DigitalReviewNote) {
    return this.digital.accept(id, session.accountId, body);
  }

  @Post('submissions/:id/publish')
  @RequirePermissions('digital:publish')
  publish(@Param('id') id: string, @CurrentSession() session: SessionContext, @Body(new ZodValidationPipe(digitalPublishSchema)) body: DigitalPublish) {
    return this.digital.publish(id, session.accountId, body);
  }

  @Get('files/:fileId')
  @RequirePermissions('digital:read')
  async privateFile(@Param('fileId') fileId: string, @CurrentSession() session: SessionContext, @Res() response: Response): Promise<void> {
    this.send(await this.digital.downloadPrivate(fileId, session.accountId), response);
  }

  private send(file: { buffer: Buffer; originalName: string; mimeType: string; sizeBytes: number }, response: Response): void {
    const safeName = encodeURIComponent(file.originalName).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.sizeBytes);
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(file.buffer);
  }
}
