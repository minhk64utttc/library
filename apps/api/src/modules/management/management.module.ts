import { Module } from '@nestjs/common';

import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthModule } from '../auth/auth.module';
import { AuditService } from './audit.service';
import { ManagementController } from './management.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule],
  controllers: [ManagementController],
  providers: [AuditService, ReportsService, PermissionsGuard],
})
export class ManagementModule {}
