import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  LOAN_STATUSES,
  loanInputSchema,
  pageQuerySchema,
  type LoanDto,
  type LoanCopyOption,
  type LoanInput,
  type Paginated,
} from '@thu-vien/shared';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { LoansService } from './loans.service';
import { CurrentSession } from '../auth/current-session.decorator';
import type { SessionContext } from '../auth/session.service';

const loanListQuerySchema = pageQuerySchema.extend({
  status: z.enum(LOAN_STATUSES).optional(),
  borrowerId: z.string().min(1).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  q: z.string().trim().max(200).optional(),
  copyCode: z.string().trim().max(200).optional(),
  sort: z.enum(['newest', 'due_asc', 'due_desc']).default('newest'),
});

type LoanListQueryInput = z.infer<typeof loanListQuerySchema>;

@Controller('circulation/loans')
@UseGuards(AuthGuard, PermissionsGuard)
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Get()
  @RequirePermissions('catalog:read')
  list(
    @Query(new ZodValidationPipe(loanListQuerySchema)) query: LoanListQueryInput,
  ): Promise<Paginated<LoanDto>> {
    return this.loans.list({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      borrowerId: query.borrowerId,
      overdue: query.overdue === 'true',
      q: query.q, copyCode: query.copyCode, sort: query.sort,
    });
  }

  @Get('copies')
  @RequirePermissions('circulation:manage')
  searchCopies(@Query(new ZodValidationPipe(z.object({ q: z.string().trim().min(1).max(200) }))) query: { q: string }): Promise<LoanCopyOption[]> {
    return this.loans.searchCopies(query.q);
  }

  @Post()
  @RequirePermissions('circulation:manage')
  borrow(@Body(new ZodValidationPipe(loanInputSchema)) body: LoanInput): Promise<LoanDto> {
    return this.loans.borrow(body);
  }

  @Post(':id/return')
  @RequirePermissions('circulation:manage')
  returnLoan(@Param('id') id: string): Promise<LoanDto> {
    return this.loans.returnLoan(id);
  }

  @Post(':id/renew')
  @RequirePermissions('circulation:manage')
  renew(@Param('id') id: string, @CurrentSession() session: SessionContext): Promise<LoanDto> {
    return this.loans.renew(id, session.accountId, 'staff');
  }
}
