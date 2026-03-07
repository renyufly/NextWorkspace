import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}