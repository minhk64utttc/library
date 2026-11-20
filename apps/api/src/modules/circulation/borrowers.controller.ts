import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { BorrowerDto } from '@thu-vien/shared';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { LoansService } from './loans.service';

const borrowerQuerySchema = z.object({
  q: z.string().max(100).optional(),
});

type BorrowerQuery = z.infer<typeof borrowerQuerySchema>;

@Controller('circulation/borrowers')
@UseGuards(AuthGuard, PermissionsGuard)
export class BorrowersController {
  constructor(private readonly loans: LoansService) {}

  @Get()
  @RequirePermissions('circulation:manage')
  search(
    @Query(new ZodValidationPipe(borrowerQuerySchema)) query: BorrowerQuery,
  ): Promise<BorrowerDto[]> {
    return this.loans.searchBorrowers(query.q);
  }
}
