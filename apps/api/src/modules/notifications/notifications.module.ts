import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { PushModule } from '../push/push.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [AuthModule, WorkspacesModule, RealtimeModule, EmailModule, PushModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}