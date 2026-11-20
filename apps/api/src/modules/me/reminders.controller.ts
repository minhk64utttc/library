import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { pageQuerySchema } from '@thu-vien/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import type { SessionContext } from '../auth/session.service';
import { RemindersService } from './reminders.service';

@Controller('me/notifications')
@UseGuards(AuthGuard)
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Post('read')
  @HttpCode(204)
  async markRead(@CurrentSession() session: SessionContext, @Body(new ZodValidationPipe(z.object({ ids: z.array(z.string().uuid()).max(100) }))) body: { ids: string[] }): Promise<void> {
    await this.reminders.markRead(session.accountId, body.ids);
  }

  @Get()
  list(@CurrentSession() session: SessionContext, @Query(new ZodValidationPipe(pageQuerySchema)) query: { page: number; pageSize: number }) {
    return this.reminders.list(session.accountId, query.page, query.pageSize);
  }
}
