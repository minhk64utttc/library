import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  RESERVATION_STATUSES,
  pageQuerySchema,
  reservationCreateSchema,
  type Paginated,
  type ReservationCreate,
  type ReservationDto,
} from '@thu-vien/shared';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { ReservationsService } from './reservations.service';

const reservationListQuerySchema = pageQuerySchema.extend({
  status: z.enum(RESERVATION_STATUSES).optional(),
  editionId: z.string().min(1).optional(),
  borrowerId: z.string().min(1).optional(),
});

type ReservationListQueryInput = z.infer<typeof reservationListQuerySchema>;

@Controller('circulation/reservations')
@UseGuards(AuthGuard, PermissionsGuard)
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get()
  @RequirePermissions('reservations:read')
  list(
    @Query(new ZodValidationPipe(reservationListQuerySchema)) query: ReservationListQueryInput,
  ): Promise<Paginated<ReservationDto>> {
    return this.reservations.list(query);
  }

  @Post()
  @RequirePermissions('circulation:manage')
  create(
    @Body(new ZodValidationPipe(reservationCreateSchema)) body: ReservationCreate,
  ): Promise<ReservationDto> {
    return this.reservations.create(body);
  }

  @Post('expire-due')
  @RequirePermissions('circulation:manage')
  async expireDue(): Promise<{ released: number }> {
    return { released: await this.reservations.releaseExpired() };
  }

  @Post(':id/cancel')
  @RequirePermissions('circulation:manage')
  cancel(@Param('id') id: string): Promise<ReservationDto> {
    return this.reservations.cancel(id);
  }
}
