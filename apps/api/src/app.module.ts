import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { validateEnv } from './config/env.validation.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ChannelsModule } from './modules/channels/channels.module.js';
import { FilesModule } from './modules/files/files.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { DatabaseModule } from './modules/database/database.module.js';
import { JobsModule } from './modules/jobs/jobs.module.js';
import { LocalStoreModule } from './modules/local-store/local-store.module.js';
import { MessagesModule } from './modules/messages/messages.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { RedisModule } from './modules/redis/redis.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';
import { SearchModule } from './modules/search/search.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: false,
                },
              }
            : undefined,
      },
    }),
    DatabaseModule,
    RedisModule,
    LocalStoreModule,
    JobsModule,
    HealthModule,
    AuditModule,
    AnalyticsModule,
    AuthModule,
    OrganizationsModule,
    WorkspacesModule,
    ChannelsModule,
    FilesModule,
    NotificationsModule,
    RealtimeModule,
    SearchModule,
    MessagesModule,
  ],
})
export class AppModule {}

