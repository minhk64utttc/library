import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  libraryCardActionSchema,
  libraryCardCreateSchema,
  libraryCardListQuerySchema,
  libraryCardRenewSchema,
  type LibraryCardAction,
  type LibraryCardCreate,
  type LibraryCardDto,
  type LibraryCardListQuery,
  type LibraryCardRenew,
  type Paginated,
} from '@thu-vien/shared';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import type { SessionContext } from '../auth/session.service';
import { CardsService } from './cards.service';

const borrowerQuerySchema = z.object({ q: z.string().trim().max(200).optional() });

@Controller('circulation/cards')
@UseGuards(AuthGuard, PermissionsGuard)
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get('borrowers')
  @RequirePermissions('cards:manage')
  borrowers(@Query(new ZodValidationPipe(borrowerQuerySchema)) query: { q?: string }) {
    return this.cards.borrowers(query.q);
  }

  @Get()
  @RequirePermissions('cards:manage')
  list(
    @Query(new ZodValidationPipe(libraryCardListQuerySchema)) query: LibraryCardListQuery,
  ): Promise<Paginated<LibraryCardDto>> {
    return this.cards.list(query);
  }

  @Post()
  @RequirePermissions('cards:manage')
  issue(
    @CurrentSession() session: SessionContext,
    @Body(new ZodValidationPipe(libraryCardCreateSchema)) body: LibraryCardCreate,
  ): Promise<LibraryCardDto> {
    return this.cards.issue(body, session.accountId);
  }

  @Post(':id/renew')
  @RequirePermissions('cards:manage')
  renew(
    @Param('id') id: string,
    @CurrentSession() session: SessionContext,
    @Body(new ZodValidationPipe(libraryCardRenewSchema)) body: LibraryCardRenew,
  ): Promise<LibraryCardDto> {
    return this.cards.renew(id, body, session.accountId);
  }

  @Post(':id/lock')
  @RequirePermissions('cards:manage')
  lock(
    @Param('id') id: string,
    @CurrentSession() session: SessionContext,
    @Body(new ZodValidationPipe(libraryCardActionSchema)) body: LibraryCardAction,
  ): Promise<LibraryCardDto> {
    return this.cards.lock(id, body, session.accountId);
  }

  @Post(':id/unlock')
  @RequirePermissions('cards:manage')
  unlock(
    @Param('id') id: string,
    @CurrentSession() session: SessionContext,
    @Body(new ZodValidationPipe(libraryCardActionSchema)) body: LibraryCardAction,
  ): Promise<LibraryCardDto> {
    return this.cards.unlock(id, body, session.accountId);
  }
}
