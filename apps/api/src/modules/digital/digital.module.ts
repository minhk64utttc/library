import { Module } from '@nestjs/common';

import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthModule } from '../auth/auth.module';
import { DigitalController } from './digital.controller';
import { DigitalService } from './digital.service';

@Module({
  imports: [AuthModule],
  controllers: [DigitalController],
  providers: [DigitalService, PermissionsGuard],
})
export class DigitalModule {}
