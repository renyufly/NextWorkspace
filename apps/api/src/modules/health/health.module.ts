import { Module } from '@nestjs/common';

import { JobsModule } from '../jobs/jobs.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [JobsModule, RealtimeModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
