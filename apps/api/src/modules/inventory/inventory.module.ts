import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthModule } from '../auth/auth.module';
import { CirculationModule } from '../circulation/circulation.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({ imports: [AuthModule, CirculationModule], controllers: [InventoryController], providers: [InventoryService, PermissionsGuard] })
export class InventoryModule {}
