import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  category: 'MENTION' | 'DIGEST';
  workspaceId: string;
  userId: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly deliveryMode: 'disabled' | 'local' | 'smtp';
  private readonly outboxFilePath: string;
  private readonly fromAddress: string;
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.deliveryMode = this.configService.get<'disabled' | 'local' | 'smtp'>('EMAIL_DELIVERY_MODE', 'local');
    const configuredOutboxPath = this.configService.get<string>('LOCAL_EMAIL_OUTBOX_FILE', '.data/email-outbox.jsonl');
    this.outboxFilePath = isAbsolute(configuredOutboxPath)
      ? configuredOutboxPath
      : resolve(process.cwd(), configuredOutboxPath);
    this.fromAddress = this.configService.get<string>('EMAIL_FROM_ADDRESS', 'no-reply@worknext.local');
  }

  async send(payload: EmailPayload) {
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
            from: this.fromAddress,
            deliveredAt: new Date().toISOString(),
            mode: 'local',
          })}\n`,
          'utf8',
        );
        return { delivered: true, mode: 'local' as const };
      }

      const transporter = this.getOrCreateTransporter();
      await transporter.sendMail({
        from: this.fromAddress,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
      });

      return { delivered: true, mode: 'smtp' as const };
    } catch (error) {
      this.logger.warn(`Email delivery failed for ${payload.to}: ${(error as Error).message}`);
      return { delivered: false, mode: this.deliveryMode };
    }
  }

  private getOrCreateTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', ''),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      auth: this.configService.get<string>('SMTP_USER', '')
        ? {
            user: this.configService.get<string>('SMTP_USER', ''),
            pass: this.configService.get<string>('SMTP_PASS', ''),
          }
        : undefined,
    });

    return this.transporter;
  }
}