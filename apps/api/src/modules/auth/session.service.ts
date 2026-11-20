import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';

import { Clock } from '../../common/clock/clock';
import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface SessionContext {
  accountId: string;
  sessionId: string;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(accountId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      this.clock.now().getTime() + this.env.SESSION_TTL_HOURS * 60 * 60 * 1000,
    );

    await this.prisma.session.create({
      data: { accountId, tokenHash: this.hash(token), expiresAt },
    });

    return { token, expiresAt };
  }

  async resolve(token: string): Promise<SessionContext | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hash(token) },
    });

    if (!session || session.revokedAt || session.expiresAt <= this.clock.now()) {
      return null;
    }

    return { accountId: session.accountId, sessionId: session.id };
  }

  async revokeById(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: this.clock.now() },
    });
  }

  async revokeAllForAccount(accountId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        accountId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: this.clock.now() },
    });
  }

  private hash(token: string): string {
    return createHmac('sha256', this.env.SESSION_SECRET).update(token).digest('hex');
  }
}
