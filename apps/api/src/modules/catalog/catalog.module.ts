import { Module } from '@nestjs/common';

import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthModule } from '../auth/auth.module';
import { PublishersController } from './publishers.controller';
import { PublishersService } from './publishers.service';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';

@Module({
  imports: [AuthModule],
  controllers: [PublishersController, RecordsController],
  providers: [PublishersService, RecordsService, PermissionsGuard],
})
export class CatalogModule {}
