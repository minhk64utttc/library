import { Injectable, Logger, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { catchError, concatMap, from, mergeMap, throwError, type Observable } from 'rxjs';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AuthenticatedRequest } from '../../modules/auth/auth.guard';

type MutableRequest = AuthenticatedRequest & {
  route?: { path?: string };
  params: Record<string, string | undefined>;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<MutableRequest>();
    const response = http.getResponse<Response>();
    if (!request.session?.accountId || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase())) {
      return next.handle();
    }

    const path = `${request.baseUrl ?? ''}${request.route?.path ?? request.path}`;
    const targetType = path.split('/').filter(Boolean).slice(0, 3).join('/').slice(0, 150) || 'api';
    const targetId = request.params?.id?.slice(0, 150) ?? null;
    const action = `${request.method.toUpperCase()} ${path}`.slice(0, 300);
    const record = (outcome: 'success' | 'failed') => this.write({
      actorId: request.session.accountId,
      action,
      targetType,
      targetId,
      outcome,
      statusCode: outcome === 'success' ? response.statusCode : 500,
    });

    return next.handle().pipe(
      concatMap(async (result) => { await record('success'); return result; }),
      catchError((error: unknown) => from(record('failed')).pipe(mergeMap(() => throwError(() => error)))),
    );
  }

  private async write(input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string | null;
    outcome: string;
    statusCode: number;
  }): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          actorId: input.actorId,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          outcome: input.outcome,
        },
      });
    } catch (error) {
      this.logger.error(`Không ghi được audit event HTTP ${input.statusCode}.`, error instanceof Error ? error.stack : undefined);
    }
  }
}
