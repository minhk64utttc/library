import { Module } from '@nestjs/common';

import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthModule } from '../auth/auth.module';
import { BorrowersController } from './borrowers.controller';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { CopyAvailabilityService } from './copy-availability.service';
import { FinesController } from './fines.controller';
import { FinesService } from './fines.service';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { PolicyController } from './policy.controller';
import { PolicyService } from './policy.service';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [AuthModule],
  controllers: [
    LoansController,
    BorrowersController,
    CardsController,
    ReservationsController,
    FinesController,
    PolicyController,
  ],
  providers: [
    LoansService,
    CardsService,
    ReservationsService,
    FinesService,
    PolicyService,
    CopyAvailabilityService,
    PermissionsGuard,
  ],
  exports: [CopyAvailabilityService, LoansService, ReservationsService, FinesService],
})
export class CirculationModule {}
