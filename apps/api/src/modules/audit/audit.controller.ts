import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AuditService } from './audit.service.js';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';

@UseGuards(AccessTokenGuard)
@Controller('workspaces/:workspaceId/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Query() query: ListAuditLogsQueryDto,
  ) {
    return this.auditService.list(user.userId, workspaceId, query);
  }
}