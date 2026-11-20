import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Res, UseGuards } from '@nestjs/common';
import {
  changePasswordInputSchema,
  loginInputSchema,
  type AccountSummary,
  type ChangePasswordInput,
  type LoginInput,
} from '@thu-vien/shared';
import type { Response } from 'express';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ENV, type Env } from '../../config/env';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentSession } from './current-session.decorator';
import { AllowedWhilePasswordChangePending } from './password-change-allowed.decorator';
import { Public } from './public.decorator';
import type { SessionContext } from './session.service';

@Controller('auth')
@UseGuards(AuthGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginInputSchema)) body: LoginInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccountSummary> {
    const result = await this.auth.login(body);

    response.cookie(this.env.SESSION_COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: result.expiresAt,
      path: '/',
    });

    return result.account;
  }

  @Post('logout')
  @AllowedWhilePasswordChangePending()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentSession() session: SessionContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(session.sessionId);
    response.clearCookie(this.env.SESSION_COOKIE_NAME, { path: '/' });
  }

  @Get('me')
  @AllowedWhilePasswordChangePending()
  me(@CurrentSession() session: SessionContext): Promise<AccountSummary> {
    return this.auth.getSummary(session.accountId);
  }

  @Post('change-password')
  @AllowedWhilePasswordChangePending()
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentSession() session: SessionContext,
    @Body(new ZodValidationPipe(changePasswordInputSchema)) body: ChangePasswordInput,
  ): Promise<void> {
    await this.auth.changePassword(session.accountId, session.sessionId, body);
  }
}
