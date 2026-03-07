import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LocalStoreService } from '../local-store/local-store.service.js';

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly localStoreService: LocalStoreService,
  ) {}

  async getHealth() {
    const timestamp = new Date().toISOString();
    const state = await this.localStoreService.readState();

    return {
      status: 'ok',
      service: 'worknext-api',
      timestamp,
      mode: this.configService.get<'local' | 'database'>('STORAGE_DRIVER', 'local'),
      storagePath: this.localStoreService.getStateFilePath(),
      checks: {
        storage: 'up',
      },
      metrics: {
        users: state.users.length,
        workspaces: state.workspaces.length,
        channels: state.channels.length,
        messages: state.messages.length,
      },
    };
  }
}