import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { ClockModule } from './common/clock/clock.module';
import { EnvModule } from './config/env.module';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CirculationModule } from './modules/circulation/circulation.module';
import { HoldingsModule } from './modules/holdings/holdings.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MeModule } from './modules/me/me.module';
import { DigitalModule } from './modules/digital/digital.module';
import { ManagementModule } from './modules/management/management.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { PublicModule } from './modules/public/public.module';

@Module({
  imports: [
    EnvModule,
    ClockModule,
    PrismaModule,
    AuthModule,
    AccountsModule,
    CatalogModule,
    HoldingsModule,
    CirculationModule,
    IncidentsModule,
    InventoryModule,
    MeModule,
    DigitalModule,
    ManagementModule,
    PublicModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
