import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth() {
    return this.healthService.getHealth();
  }

  @Get('live')
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const readiness = await this.healthService.getReadiness();

    response.status(readiness.ready ? 200 : 503);

    return readiness;
  }
}
