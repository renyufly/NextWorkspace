import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type Job } from 'bullmq';

import { NotificationsService } from '../notifications/notifications.service.js';
import { RedisService } from '../redis/redis.service.js';

type MentionNotificationJob = {
  workspaceId: string;
  channelId: string;
  messageId: string;
  senderUserId: string;
  content: string;
};

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly notificationsService: NotificationsService,
  ) {}

  isEnabled() {
    return this.configService.get<boolean>('ENABLE_BULLMQ', false) && this.redisService.isEnabled();
  }

  isReady() {
    return Boolean(this.queue && this.worker);
  }

  async onModuleInit() {
    if (!this.isEnabled()) {
      return;
    }

    const prefix = this.configService.get<string>('REDIS_QUEUE_PREFIX', 'worknext');
    const redisUrl = this.configService.get<string>('REDIS_URL', '');

    this.queue = new Queue('mention-notifications', {
      prefix,
      connection: {
        url: redisUrl,
      },
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });

    this.worker = new Worker(
      'mention-notifications',
      async (job) => this.processMentionNotification(job as Job<MentionNotificationJob>),
      {
        prefix,
        connection: {
          url: redisUrl,
        },
        concurrency: 4,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.warn(`BullMQ job failed (${job?.id ?? 'unknown'}): ${error.message}`);
    });

    if (!this.queue || !this.worker) {
      return;
    }

    await this.queue.waitUntilReady();
    await this.worker.waitUntilReady();
    this.logger.log('BullMQ notification queue enabled.');
  }

  async dispatchMentionNotifications(payload: MentionNotificationJob) {
    if (!this.queue) {
      await this.notificationsService.createMentionNotifications(
        payload.workspaceId,
        payload.channelId,
        payload.messageId,
        payload.senderUserId,
        payload.content,
      );
      return { queued: false };
    }

    await this.queue.add('dispatch', payload);
    return { queued: true };
  }

  async healthCheck(): Promise<'up' | 'down' | 'disabled'> {
    if (!this.isEnabled()) {
      return 'disabled';
    }

    if (!this.queue || !this.worker) {
      return 'down';
    }

    try {
      await this.queue.getJobCounts();
      return 'up';
    } catch (error) {
      this.logger.warn(`BullMQ health check failed: ${(error as Error).message}`);
      return 'down';
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  private async processMentionNotification(job: Job<MentionNotificationJob>) {
    await this.notificationsService.createMentionNotifications(
      job.data.workspaceId,
      job.data.channelId,
      job.data.messageId,
      job.data.senderUserId,
      job.data.content,
    );
  }
}