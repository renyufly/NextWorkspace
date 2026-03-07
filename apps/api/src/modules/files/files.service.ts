import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, resolve } from 'node:path';

import type { LocalFileAttachmentRecord } from '../local-store/local-store.types.js';
import { LocalStoreService } from '../local-store/local-store.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ['image/', 'text/', 'application/pdf'];

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class FilesService {
  private readonly uploadDir: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly localStoreService: LocalStoreService,
    private readonly workspacesService: WorkspacesService,
  ) {
    const configuredPath = this.configService.get<string>('LOCAL_UPLOAD_DIR', '.uploads');
    this.uploadDir = isAbsolute(configuredPath) ? configuredPath : resolve(process.cwd(), configuredPath);
  }

  async upload(userId: string, workspaceId: string, file: UploadedFile) {
    await this.workspacesService.assertMembership(userId, workspaceId);
    this.validateFile(file);

    const attachmentId = randomUUID();
    const extension = extname(file.originalname);
    const storageKey = `${attachmentId}${extension}`;
    const targetPath = join(this.uploadDir, storageKey);
    const now = new Date().toISOString();

    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(targetPath, file.buffer);

    return this.localStoreService.updateState((state) => {
      const attachment: LocalFileAttachmentRecord = {
        id: attachmentId,
        workspaceId,
        uploaderId: userId,
        messageId: null,
        storageKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        url: `/uploads/${storageKey}`,
        createdAt: now,
      };

      state.attachments.push(attachment);

      return this.serializeAttachment(attachment);
    });
  }

  async listForWorkspace(userId: string, workspaceId: string) {
    await this.workspacesService.assertMembership(userId, workspaceId);
    const state = await this.localStoreService.readState();

    return state.attachments
      .filter((attachment) => attachment.workspaceId === workspaceId)
      .map((attachment) => this.serializeAttachment(attachment))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async assertAttachmentsAvailable(userId: string, workspaceId: string, attachmentIds: string[]) {
    if (attachmentIds.length === 0) {
      return;
    }

    await this.workspacesService.assertMembership(userId, workspaceId);
    const state = await this.localStoreService.readState();

    for (const attachmentId of attachmentIds) {
      const attachment = state.attachments.find(
        (candidate) => candidate.id === attachmentId && candidate.workspaceId === workspaceId,
      );

      if (!attachment) {
        throw new NotFoundException(`Attachment ${attachmentId} was not found.`);
      }

      if (attachment.uploaderId !== userId) {
        throw new ForbiddenException('You can only attach files that you uploaded.');
      }

      if (attachment.messageId !== null) {
        throw new BadRequestException('Attachment has already been linked to a message.');
      }
    }
  }

  private validateFile(file: UploadedFile) {
    if (!file) {
      throw new BadRequestException('A file upload is required.');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 10 MB upload limit.');
    }

    if (!ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype === prefix || file.mimetype.startsWith(prefix))) {
      throw new BadRequestException('Unsupported file type.');
    }
  }

  private serializeAttachment(attachment: LocalFileAttachmentRecord) {
    return {
      id: attachment.id,
      workspaceId: attachment.workspaceId,
      messageId: attachment.messageId,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      url: attachment.url,
      createdAt: attachment.createdAt,
    };
  }
}