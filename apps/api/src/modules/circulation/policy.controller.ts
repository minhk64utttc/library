import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { policyScopeSchema, policyVersionCreateSchema, type PolicyDto, type PolicyScopeQuery, type PolicyVersionCreate } from '@thu-vien/shared';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import type { SessionContext } from '../auth/session.service';
import { PolicyService } from './policy.service';

@Controller('circulation/policy')
@UseGuards(AuthGuard, PermissionsGuard)
export class PolicyController {
  constructor(private readonly policy: PolicyService) {}

  @Get()
  @RequirePermissions('catalog:read')
  read(@Query(new ZodValidationPipe(policyScopeSchema)) scope: PolicyScopeQuery): Promise<PolicyDto> {
    return this.policy.read(undefined, scope);
  }

  @Get('versions')
  @RequirePermissions('policies:manage')
  versions(@Query(new ZodValidationPipe(policyScopeSchema)) scope: PolicyScopeQuery): Promise<PolicyDto[]> {
    return this.policy.versions(scope);
  }

  @Patch()
  @RequirePermissions('policies:manage')
  update(
    @Body(new ZodValidationPipe(policyVersionCreateSchema)) body: PolicyVersionCreate,
    @CurrentSession() session: SessionContext,
  ): Promise<PolicyDto> {
    return this.policy.update(body, session.accountId);
  }
}
