import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  FINE_STATUSES,
  finePaymentSchema,
  fineWaiverDecisionSchema,
  fineWaiverRequestSchema,
  pageQuerySchema,
  type FineDto,
  type FinePaymentInput,
  type FineReceiptDto,
  type FineWaiverDecision,
  type FineWaiverRequestInput,
  type Paginated,
} from '@thu-vien/shared';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import type { SessionContext } from '../auth/session.service';
import { FinesService } from './fines.service';

const fineListQuerySchema = pageQuerySchema.extend({
  status: z.enum(FINE_STATUSES).optional(),
  borrowerId: z.string().min(1).optional(),
  q: z.string().trim().max(200).optional(),
});

type FineListQueryInput = z.infer<typeof fineListQuerySchema>;
const waiverListQuerySchema = pageQuerySchema.extend({ status: z.enum(['pending', 'approved', 'rejected']).optional() });
type WaiverListQuery = z.infer<typeof waiverListQuerySchema>;

@Controller('circulation/fines')
@UseGuards(AuthGuard, PermissionsGuard)
export class FinesController {
  constructor(private readonly fines: FinesService) {}

  @Get()
  @RequirePermissions('fines:read')
  list(
    @Query(new ZodValidationPipe(fineListQuerySchema)) query: FineListQueryInput,
  ): Promise<Paginated<FineDto>> {
    return this.fines.list(query);
  }

  @Get('waivers')
  @RequirePermissions('fines:waive')
  waiverRequests(
    @Query(new ZodValidationPipe(waiverListQuerySchema)) query: WaiverListQuery,
  ) {
    return this.fines.waiverRequests(query);
  }

  @Get('payments/:paymentId/receipt')
  @RequirePermissions('fines:read')
  receipt(@Param('paymentId') paymentId: string): Promise<FineReceiptDto> {
    return this.fines.receipt(paymentId);
  }

  @Post(':id/pay')
  @RequirePermissions('fines:collect')
  pay(
    @Param('id') id: string,
    @CurrentSession() session: SessionContext,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(finePaymentSchema)) body: FinePaymentInput,
  ) {
    return this.fines.collect(id, body.amount, session.accountId, idempotencyKey ?? '');
  }

  @Post(':id/waivers')
  @RequirePermissions('fines:request-waiver')
  requestWaiver(
    @Param('id') id: string,
    @CurrentSession() session: SessionContext,
    @Body(new ZodValidationPipe(fineWaiverRequestSchema)) body: FineWaiverRequestInput,
  ) {
    return this.fines.requestWaiver(id, session.accountId, body.amount, body.reason);
  }

  @Post('waivers/:requestId/decision')
  @RequirePermissions('fines:waive')
  decideWaiver(
    @Param('requestId') requestId: string,
    @CurrentSession() session: SessionContext,
    @Body(new ZodValidationPipe(fineWaiverDecisionSchema)) body: FineWaiverDecision,
  ) {
    return this.fines.decideWaiver(requestId, session.accountId, body);
  }
}
