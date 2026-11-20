import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccountSummary, ChangePasswordInput, LoginInput } from '@thu-vien/shared';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

type AccountWithRelations = Prisma.AccountGetPayload<{
  include: { roles: true; profile: true };
}>;

export interface LoginResult {
  token: string;
  expiresAt: Date;
  account: AccountSummary;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const account = await this.prisma.account.findUnique({
      where: { email: input.email },
      include: { roles: true, profile: true },
    });

    const passwordMatches = account
      ? await this.passwords.verify(account.passwordHash, input.password)
      : false;

    if (!account || !passwordMatches || account.status !== 'active') {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Sai email hoặc mật khẩu',
      });
    }

    const session = await this.sessions.create(account.id);

    return { ...session, account: this.toSummary(account) };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revokeById(sessionId);
  }

  async getSummary(accountId: string): Promise<AccountSummary> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { roles: true, profile: true },
    });

    if (!account) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Chưa đăng nhập' });
    }

    return this.toSummary(account);
  }

  async changePassword(
    accountId: string,
    sessionId: string,
    input: ChangePasswordInput,
  ): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Chưa đăng nhập' });
    }

    const matches = await this.passwords.verify(account.passwordHash, input.currentPassword);
    if (!matches) {
      throw new BadRequestException({
        code: 'INVALID_PASSWORD',
        message: 'Mật khẩu hiện tại không đúng',
      });
    }

    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.prisma.account.update({
      where: { id: accountId },
      data: { passwordHash, mustChangePassword: false },
    });

    await this.sessions.revokeAllForAccount(accountId, sessionId);
  }

  private toSummary(account: AccountWithRelations): AccountSummary {
    return {
      id: account.id,
      email: account.email,
      fullName: account.profile?.fullName ?? account.email,
      roles: account.roles.map((role) => role.role as AccountSummary['roles'][number]),
      mustChangePassword: account.mustChangePassword,
    };
  }
}
