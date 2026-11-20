import { Module } from '@nestjs/common';

import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthModule } from '../auth/auth.module';
import { CopiesController } from './copies.controller';
import { CopiesService } from './copies.service';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  imports: [AuthModule],
  controllers: [LocationsController, CopiesController],
  providers: [LocationsService, CopiesService, PermissionsGuard],
})
export class HoldingsModule {}
