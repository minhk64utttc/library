import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PASSWORD_CHANGE_ALLOWED_KEY } from './password-change-allowed.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import { SessionService, type SessionContext } from './session.service';

export interface AuthenticatedRequest extends Request {
  session: SessionContext;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[this.env.SESSION_COOKIE_NAME];

    if (!token) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Chưa đăng nhập' });
    }

    const session = await this.sessions.resolve(token);
    if (!session) {
      throw new UnauthorizedException({ code: 'SESSION_EXPIRED', message: 'Phiên đã hết hạn' });
    }

    const account = await this.prisma.account.findUnique({
      where: { id: session.accountId },
      select: { status: true, mustChangePassword: true },
    });
    if (!account || account.status !== 'active') {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Tài khoản không hợp lệ',
      });
    }

    if (account.mustChangePassword) {
      const allowed = this.reflector.getAllAndOverride<boolean>(PASSWORD_CHANGE_ALLOWED_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) {
        throw new ForbiddenException({
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'Cần đổi mật khẩu trước khi tiếp tục',
        });
      }
    }

    request.session = session;
    return true;
  }
}
