import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

type PushPayload = {
  userId: string;
  workspaceId: string;
  category: 'MENTION' | 'DIGEST';
  title: string;
  body: string;
};

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly deliveryMode: 'disabled' | 'local' | 'webhook';
  private readonly outboxFilePath: string;
  private readonly webhookUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.deliveryMode = this.configService.get<'disabled' | 'local' | 'webhook'>('PUSH_DELIVERY_MODE', 'local');
    const configuredOutboxPath = this.configService.get<string>('LOCAL_PUSH_OUTBOX_FILE', '.data/push-outbox.jsonl');
    this.outboxFilePath = isAbsolute(configuredOutboxPath)
      ? configuredOutboxPath
      : resolve(process.cwd(), configuredOutboxPath);
    this.webhookUrl = this.configService.get<string>('PUSH_WEBHOOK_URL', '');
  }

  async send(payload: PushPayload) {
    try {
      if (this.deliveryMode === 'disabled') {
        return { delivered: false, mode: 'disabled' as const };
      }

      if (this.deliveryMode === 'local') {
        await mkdir(dirname(this.outboxFilePath), { recursive: true });
        await appendFile(
          this.outboxFilePath,
          `${JSON.stringify({
            ...payload,
            deliveredAt: new Date().toISOString(),
            mode: 'local',
          })}\n`,
          'utf8',
        );
        return { delivered: true, mode: 'local' as const };
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Push webhook responded with ${response.status}`);
      }

      return { delivered: true, mode: 'webhook' as const };
    } catch (error) {
      this.logger.warn(`Push delivery failed for ${payload.userId}: ${(error as Error).message}`);
      return { delivered: false, mode: this.deliveryMode };
    }
  }
}