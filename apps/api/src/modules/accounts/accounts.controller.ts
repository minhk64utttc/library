import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  accountCreateSchema,
  accountListQuerySchema,
  accountResetPasswordSchema,
  accountUpdateSchema,
  type AccountCreate,
  type AccountDto,
  type AccountListQuery,
  type AccountResetPassword,
  type AccountUpdate,
  type Paginated,
} from '@thu-vien/shared';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { AccountsService } from './accounts.service';

@Controller('accounts')
@UseGuards(AuthGuard, PermissionsGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @RequirePermissions('accounts:manage')
  list(
    @Query(new ZodValidationPipe(accountListQuerySchema)) query: AccountListQuery,
  ): Promise<Paginated<AccountDto>> {
    return this.accounts.list(query);
  }

  @Get(':id')
  @RequirePermissions('accounts:manage')
  get(@Param('id') id: string): Promise<AccountDto> {
    return this.accounts.get(id);
  }

  @Post()
  @RequirePermissions('accounts:manage')
  create(@Body(new ZodValidationPipe(accountCreateSchema)) body: AccountCreate): Promise<AccountDto> {
    return this.accounts.create(body);
  }

  @Patch(':id')
  @RequirePermissions('accounts:manage')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(accountUpdateSchema)) body: AccountUpdate,
  ): Promise<AccountDto> {
    return this.accounts.update(id, body);
  }

  @Post(':id/reset-password')
  @RequirePermissions('accounts:manage')
  async resetPassword(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(accountResetPasswordSchema)) body: AccountResetPassword,
  ): Promise<{ ok: true }> {
    await this.accounts.resetPassword(id, body);
    return { ok: true };
  }
}
