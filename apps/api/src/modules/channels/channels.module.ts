import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { ChannelsController } from './channels.controller.js';
import { ChannelsService } from './channels.service.js';

@Module({
  imports: [AuthModule, WorkspacesModule, AuditModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}