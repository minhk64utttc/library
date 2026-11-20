import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CirculationModule } from '../circulation/circulation.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [AuthModule, CirculationModule],
  controllers: [MeController, RemindersController],
  providers: [MeService, RemindersService, WorkspaceService],
})
export class MeModule {}
