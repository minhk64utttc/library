import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, PasswordService, SessionService],
  exports: [AuthService, AuthGuard, SessionService],
})
export class AuthModule {}
