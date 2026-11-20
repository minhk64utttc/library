import { Module } from '@nestjs/common';

import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthModule } from '../auth/auth.module';
import { CirculationModule } from '../circulation/circulation.module';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [AuthModule, CirculationModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, PermissionsGuard],
})
export class IncidentsModule {}
