import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { permissionsFor, type Permission, type Role } from '@thu-vien/shared';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AuthenticatedRequest } from '../../modules/auth/auth.guard';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = request.session;
    if (!session) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Không có quyền' });
    }

    const account = await this.prisma.account.findUnique({
      where: { id: session.accountId },
      include: { roles: true },
    });
    if (!account || account.status !== 'active') {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Không có quyền' });
    }

    const granted = permissionsFor(account.roles.map((entry) => entry.role as Role));

    const allowed = required.every((permission) => granted.has(permission));
    if (!allowed) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Không có quyền' });
    }

    return true;
  }
}
