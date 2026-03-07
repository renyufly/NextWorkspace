import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { FilesModule } from '../files/files.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

@Module({
  imports: [AuthModule, ChannelsModule, FilesModule, JobsModule, RealtimeModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}