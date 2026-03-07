import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redisUrl: string;
  private readonly baseClient: Redis | null;

  constructor(private readonly configService: ConfigService) {
    this.redisUrl = this.configService.get<string>('REDIS_URL', '');
    this.baseClient = this.redisUrl
      ? new Redis(this.redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        })
      : null;
  }

  isEnabled() {
    return Boolean(this.baseClient);
  }

  async ping(): Promise<'up' | 'down' | 'disabled'> {
    if (!this.baseClient) {
      return 'disabled';
    }

    try {
      await this.ensureConnected(this.baseClient);
      const result = await this.baseClient.ping();
      return result === 'PONG' ? 'up' : 'down';
    } catch (error) {
      this.logger.warn(`Redis ping failed: ${(error as Error).message}`);
      return 'down';
    }
  }

  async createClient(connectionName: string) {
    if (!this.baseClient) {
      return null;
    }

    const client = this.baseClient.duplicate({
      connectionName,
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    await this.ensureConnected(client);

    return client;
  }

  async onModuleDestroy() {
    if (!this.baseClient) {
      return;
    }

    await this.baseClient.quit().catch(() => this.baseClient?.disconnect());
  }

  private async ensureConnected(client: Redis) {
    if (client.status === 'ready' || client.status === 'connecting' || client.status === 'connect') {
      return;
    }

    await client.connect();
  }
}