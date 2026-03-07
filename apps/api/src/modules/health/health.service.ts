import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../database/prisma.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import { LocalStoreService } from '../local-store/local-store.service.js';
import { RedisService } from '../redis/redis.service.js';
import { RealtimeAdapterService } from '../realtime/realtime-adapter.service.js';

type DependencyStatus = 'up' | 'down' | 'disabled';

type HealthChecks = {
  storage: DependencyStatus;
  database: DependencyStatus;
  redis: DependencyStatus;
  queues: DependencyStatus;
  realtime: DependencyStatus;
};

type HealthStatus = 'ok' | 'degraded' | 'down';

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly localStoreService: LocalStoreService,
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly jobsService: JobsService,
    private readonly realtimeAdapterService: RealtimeAdapterService,
  ) {}

  async getHealth() {
    return this.buildHealthReport();
  }

  getLiveness() {
    const timestamp = new Date().toISOString();

    return {
      status: 'ok' as const,
      service: 'worknext-api',
      timestamp,
    };
  }

  async getReadiness() {
    const report = await this.buildHealthReport();

    return {
      status: report.status,
      ready: report.status !== 'down',
      service: report.service,
      timestamp: report.timestamp,
      mode: report.mode,
      checks: report.checks,
      requiredChecks: report.requiredChecks,
      optionalChecks: report.optionalChecks,
      features: report.features,
    };
  }

  private async buildHealthReport() {
    const timestamp = new Date().toISOString();
    const state = await this.localStoreService.readState();
    const mode = this.configService.get<'local' | 'database'>('STORAGE_DRIVER', 'local');
    const databaseCheck = mode === 'database' ? await this.checkDatabase() : 'disabled';
    const redisCheck = await this.redisService.ping();
    const queueCheck = await this.jobsService.healthCheck();
    const realtimeCheck = this.realtimeAdapterService.isEnabled()
      ? this.realtimeAdapterService.isConfigured()
        ? 'up'
        : 'down'
      : 'disabled';
    const checks: HealthChecks = {
      storage: 'up',
      database: databaseCheck,
      redis: redisCheck,
      queues: queueCheck,
      realtime: realtimeCheck,
    };
    const requiredChecks = this.getRequiredChecks(mode);
    const optionalChecks = (Object.keys(checks) as Array<keyof HealthChecks>).filter(
      (key) => !requiredChecks.includes(key),
    );
    const downRequiredChecks = requiredChecks.filter((key) => checks[key] === 'down');
    const downOptionalChecks = optionalChecks.filter((key) => checks[key] === 'down');
    const status: HealthStatus = downRequiredChecks.length > 0 ? 'down' : downOptionalChecks.length > 0 ? 'degraded' : 'ok';

    return {
      status,
      service: 'worknext-api',
      timestamp,
      mode,
      storagePath: this.localStoreService.getStateFilePath(),
      checks,
      requiredChecks,
      optionalChecks,
      metrics: {
        users: state.users.length,
        workspaces: state.workspaces.length,
        channels: state.channels.length,
        messages: state.messages.length,
      },
      features: {
        redisAdapter: this.realtimeAdapterService.isEnabled(),
        bullmq: this.jobsService.isEnabled(),
      },
      issues: {
        required: downRequiredChecks,
        optional: downOptionalChecks,
      },
    };
  }

  private getRequiredChecks(mode: 'local' | 'database'): Array<keyof HealthChecks> {
    const requiredChecks: Array<keyof HealthChecks> = ['storage'];

    if (mode === 'database') {
      requiredChecks.push('database');
    }

    if (this.realtimeAdapterService.isEnabled()) {
      requiredChecks.push('redis', 'realtime');
    }

    if (this.jobsService.isEnabled()) {
      if (!requiredChecks.includes('redis')) {
        requiredChecks.push('redis');
      }

      requiredChecks.push('queues');
    }

    return requiredChecks;
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      await this.prismaService.assertConnection();
      return 'up';
    } catch {
      return 'down';
    }
  }
}