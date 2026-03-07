import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { PresenceService } from './presence.service.js';
import { RealtimeAdapterService } from './realtime-adapter.service.js';
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimeService } from './realtime.service.js';

@Module({
  imports: [AuthModule, WorkspacesModule, ChannelsModule],
  providers: [RealtimeGateway, RealtimeService, RealtimeAdapterService, PresenceService],
  exports: [RealtimeService, RealtimeAdapterService, PresenceService],
})
export class RealtimeModule {}