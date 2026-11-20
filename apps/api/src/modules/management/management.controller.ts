import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { auditQuerySchema, reportQuerySchema, type AuditQuery, type ReportQuery, type ReportSummaryDto } from '@thu-vien/shared';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { AuditService } from './audit.service';
import { ReportsService } from './reports.service';

@Controller('management')
@UseGuards(AuthGuard, PermissionsGuard)
export class ManagementController {
  constructor(private readonly reports: ReportsService, private readonly audit: AuditService) {}

  @Get('reports')
  @RequirePermissions('reports:read')
  report(@Query(new ZodValidationPipe(reportQuerySchema)) query: ReportQuery): Promise<ReportSummaryDto> {
    return this.reports.summary(query);
  }

  @Get('audit')
  @RequirePermissions('audit:read')
  auditLog(@Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery) {
    return this.audit.list(query);
  }
}
