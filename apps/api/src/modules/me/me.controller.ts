import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import {
  FINE_STATUSES,
  LOAN_STATUSES,
  RESERVATION_STATUSES,
  pageQuerySchema,
  reservationInputSchema,
  fineWaiverRequestSchema,
  type FineReceiptDto,
  type FineWaiverRequestInput,
  updateMyProfileSchema,
  type FineDto,
  type LoanDto,
  type MyProfileDto,
  type Paginated,
  type ReservationDto,
  type ReservationInput,
  type UpdateMyProfile,
} from '@thu-vien/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import type { SessionContext } from '../auth/session.service';
import { MeService } from './me.service';
import { WorkspaceService } from './workspace.service';

const myLoanQuerySchema = pageQuerySchema.extend({
  status: z.enum(LOAN_STATUSES).optional(),
  overdue: z.enum(['true', 'false']).optional(),
});

const myReservationQuerySchema = pageQuerySchema.extend({
  status: z.enum(RESERVATION_STATUSES).optional(),
});

const myFineQuerySchema = pageQuerySchema.extend({
  status: z.enum(FINE_STATUSES).optional(),
});

type MyLoanQuery = z.infer<typeof myLoanQuerySchema>;
type MyReservationQuery = z.infer<typeof myReservationQuerySchema>;
type MyFineQuery = z.infer<typeof myFineQuerySchema>;

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(private readonly me: MeService, private readonly workspace: WorkspaceService) {}

  @Get('workspace')
  workspaceTasks(@CurrentSession() session: SessionContext) {
    return this.workspace.tasks(session.accountId);
  }

  @Get('profile')
  profile(@CurrentSession() session: SessionContext): Promise<MyProfileDto> {
    return this.me.profile(session.accountId);
  }

  @Get('card/activity')
  cardActivity(@CurrentSession() session: SessionContext) {
    return this.me.cardActivity(session.accountId);
  }

  @Patch('profile')
  updateProfile(
    @CurrentSession() session: SessionContext,
    @Body(new ZodValidationPipe(updateMyProfileSchema)) body: UpdateMyProfile,
  ): Promise<MyProfileDto> {
    return this.me.updateProfile(session.accountId, body);
  }

  @Get('profile/photo')
  async profilePhoto(@CurrentSession() session: SessionContext, @Res() response: Response): Promise<void> {
    const photo = await this.me.profilePhoto(session.accountId);
    response.setHeader('Content-Type', 'image/jpeg');
    response.setHeader('Content-Length', photo.length);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Disposition', 'inline; filename="profile-photo.jpg"');
    response.send(photo);
  }

  @Post('profile/photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  uploadProfilePhoto(
    @CurrentSession() session: SessionContext,
    @UploadedFile() file: { mimetype: string; size: number; buffer: Buffer } | undefined,
  ): Promise<MyProfileDto> {
    if (!file) throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Chọn một ảnh để tải lên.' });
    return this.me.uploadProfilePhoto(session.accountId, file);
  }

  @Delete('profile/photo')
  removeProfilePhoto(@CurrentSession() session: SessionContext): Promise<MyProfileDto> {
    return this.me.removeProfilePhoto(session.accountId);
  }

  @Get('loans')
  loans(
    @CurrentSession() session: SessionContext,
    @Query(new ZodValidationPipe(myLoanQuerySchema)) query: MyLoanQuery,
  ): Promise<Paginated<LoanDto>> {
    return this.me.listLoans(session.accountId, {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      overdue: query.overdue === 'true',
    });
  }

  @Post('loans/:id/renew')
  renew(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
  ): Promise<LoanDto> {
    return this.me.renewLoan(session.accountId, id);
  }

  @Get('reservations')
  reservations(
    @CurrentSession() session: SessionContext,
    @Query(new ZodValidationPipe(myReservationQuerySchema)) query: MyReservationQuery,
  ): Promise<Paginated<ReservationDto>> {
    return this.me.listReservations(session.accountId, {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });
  }

  @Post('reservations')
  createReservation(
    @CurrentSession() session: SessionContext,
    @Body(new ZodValidationPipe(reservationInputSchema)) body: ReservationInput,
  ): Promise<ReservationDto> {
    return this.me.createReservation(session.accountId, body.editionId);
  }

  @Post('reservations/:id/cancel')
  cancelReservation(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
  ): Promise<ReservationDto> {
    return this.me.cancelReservation(session.accountId, id);
  }

  @Get('fines')
  fines(
    @CurrentSession() session: SessionContext,
    @Query(new ZodValidationPipe(myFineQuerySchema)) query: MyFineQuery,
  ): Promise<Paginated<FineDto>> {
    return this.me.listFines(session.accountId, {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });
  }

  @Post('fines/:id/waivers')
  requestFineWaiver(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(fineWaiverRequestSchema)) body: FineWaiverRequestInput,
  ) {
    return this.me.requestFineWaiver(session.accountId, id, body);
  }

  @Get('fines/payments/:paymentId/receipt')
  fineReceipt(
    @CurrentSession() session: SessionContext,
    @Param('paymentId') paymentId: string,
  ): Promise<FineReceiptDto> {
    return this.me.fineReceipt(session.accountId, paymentId);
  }
}
