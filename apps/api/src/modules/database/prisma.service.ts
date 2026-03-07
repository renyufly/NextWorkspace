import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly configService: ConfigService) {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    if (this.configService.get<'local' | 'database'>('STORAGE_DRIVER', 'local') !== 'database') {
      return;
    }

    await this.$connect();
  }

  async onModuleDestroy() {
    if (this.configService.get<'local' | 'database'>('STORAGE_DRIVER', 'local') !== 'database') {
      return;
    }

    await this.$disconnect();
  }

  async assertConnection() {
    await this.$queryRaw`SELECT 1`;
  }
}