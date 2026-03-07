import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Namespace, Server } from 'socket.io';

import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class RealtimeAdapterService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeAdapterService.name);
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private configured = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  isEnabled() {
    return this.configService.get<boolean>('ENABLE_REDIS_ADAPTER', false) && this.redisService.isEnabled();
  }

  isConfigured() {
    return this.configured;
  }

  async configure(server: Server | Namespace) {
    if (!this.isEnabled() || this.configured) {
      return;
    }

    this.pubClient = await this.redisService.createClient('worknext-socket-pub');
    this.subClient = await this.redisService.createClient('worknext-socket-sub');

    if (!this.pubClient || !this.subClient) {
      return;
    }

    const ioServer = this.resolveRootServer(server);
    ioServer.adapter(createAdapter(this.pubClient, this.subClient));
    this.configured = true;
    this.logger.log('Redis Socket.IO adapter enabled.');
  }

  async onModuleDestroy() {
    await this.pubClient?.quit().catch(() => this.pubClient?.disconnect());
    await this.subClient?.quit().catch(() => this.subClient?.disconnect());
  }

  private resolveRootServer(server: Server | Namespace) {
    return 'server' in server ? server.server : server;
  }
}