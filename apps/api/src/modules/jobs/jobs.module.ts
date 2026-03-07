import { Global, Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module.js';
import { JobsService } from './jobs.service.js';

@Global()
@Module({
  imports: [NotificationsModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}