import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AnalyticsService } from './analytics.service.js';

@UseGuards(AccessTokenGuard)
@Controller('workspaces/:workspaceId/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  async summary(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string) {
    return this.analyticsService.summary(user.userId, workspaceId);
  }
}