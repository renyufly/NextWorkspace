import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SearchWorkspaceQueryDto } from './dto/search-workspace-query.dto.js';
import { SearchService } from './search.service.js';

@UseGuards(AccessTokenGuard)
@Controller('workspaces/:workspaceId/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Query() query: SearchWorkspaceQueryDto,
  ) {
    return this.searchService.search(user.userId, workspaceId, query);
  }
}