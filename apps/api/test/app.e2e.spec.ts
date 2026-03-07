import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter.js';

type AuthResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
};

describe('WorkNext API E2E', () => {
  const originalEnv = { ...process.env };
  let sandboxDir: string;
  let app: INestApplication;
  let ownerAgent: ReturnType<typeof request.agent>;
  let memberAgent: ReturnType<typeof request.agent>;
  let ownerAccessToken: string;
  let memberAccessToken: string;
  const runId = randomUUID().slice(0, 8);
  const ownerEmail = `owner-${runId}@example.com`;
  const memberEmail = `member-${runId}@example.com`;
  const memberMention = memberEmail.split('@')[0] ?? 'member';

  beforeAll(async () => {
    sandboxDir = await mkdtemp(join(tmpdir(), 'worknext-api-e2e-'));

    process.env.NODE_ENV = 'test';
    process.env.STORAGE_DRIVER = 'local';
    process.env.LOCAL_DATA_FILE = resolve(sandboxDir, 'state.json');
    process.env.LOCAL_UPLOAD_DIR = resolve(sandboxDir, 'uploads');
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    process.env.API_PORT = '0';

    app = await createApp();
    ownerAgent = request.agent(app.getHttpServer());
    memberAgent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
    await rm(sandboxDir, { recursive: true, force: true });

    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }

    Object.assign(process.env, originalEnv);
  });

  it('registers, refreshes, and loads the active user session', async () => {
    const registration = await ownerAgent
      .post('/api/auth/register')
      .send({
        email: ownerEmail,
        password: 'password123',
        displayName: 'Owner One',
      })
      .expect(201);

    expect(registration.body.user.email).toBe(ownerEmail);
    expect(registration.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('worknext_refresh_token=')]),
    );

    ownerAccessToken = registration.body.accessToken;

    const me = await ownerAgent
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);

    expect(me.body).toMatchObject({
      email: ownerEmail,
      displayName: 'Owner One',
    });

    const refreshed = await ownerAgent.post('/api/auth/refresh').expect(201);

    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    expect(refreshed.body.user.email).toBe(ownerEmail);

    ownerAccessToken = refreshed.body.accessToken;

    await ownerAgent
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ displayName: 'Owner Prime' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.displayName).toBe('Owner Prime');
      });
  });

  it('covers workspace, invitation, private channel, upload, messaging, and notifications flows', async () => {
    const memberRegistration = await memberAgent
      .post('/api/auth/register')
      .send({
        email: memberEmail,
        password: 'password123',
        displayName: 'Member Two',
      })
      .expect(201);

    memberAccessToken = memberRegistration.body.accessToken;

    const workspace = await ownerAgent
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ name: 'E2E Workspace' })
      .expect(201);

    const workspaceId = workspace.body.id as string;

    const invitations = await ownerAgent
      .post(`/api/workspaces/${workspaceId}/invitations`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ email: memberEmail, role: 'MEMBER' })
      .expect(201);

    const invitationToken = invitations.body.token as string;

    await memberAgent
      .post('/api/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .send({ token: invitationToken })
      .expect(201)
      .expect(({ body }) => {
        expect(body.id).toBe(workspaceId);
      });

    const privateChannel = await ownerAgent
      .post(`/api/workspaces/${workspaceId}/channels`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        name: 'leadership',
        description: 'Private leadership room',
        type: 'PRIVATE',
      })
      .expect(201);

    const channelId = privateChannel.body.id as string;

    await ownerAgent
      .post(`/api/workspaces/${workspaceId}/channels/${channelId}/members`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ userId: memberRegistration.body.user.id })
      .expect(201);

    const upload = await ownerAgent
      .post(`/api/workspaces/${workspaceId}/files`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .attach('file', Buffer.from('hello attachment'), {
        filename: 'brief.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    const attachmentId = upload.body.id as string;

    const sentMessage = await ownerAgent
      .post(`/api/workspaces/${workspaceId}/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({
        content: `Hello @${memberMention}`,
        attachmentIds: [attachmentId],
      })
      .expect(201);

    expect(sentMessage.body.attachments).toHaveLength(1);
    expect(sentMessage.body.attachments[0]?.id).toBe(attachmentId);

    await memberAgent
      .get(`/api/workspaces/${workspaceId}/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toHaveLength(1);
        expect(body.items[0]?.content).toContain('Hello');
      });

    await memberAgent
      .post(`/api/workspaces/${workspaceId}/channels/${channelId}/messages/read`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true });
      });

    const notifications = await memberAgent
      .get(`/api/notifications?workspaceId=${workspaceId}`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(200);

    expect(notifications.body).toHaveLength(1);
    expect(notifications.body[0]?.messageId).toBe(sentMessage.body.id);

    await memberAgent
      .get(`/api/notifications/unread-count?workspaceId=${workspaceId}`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.total).toBe(1);
      });

    await memberAgent
      .patch(`/api/notifications/${notifications.body[0].id}/read`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true });
      });

    await memberAgent
      .get(`/api/notifications/unread-count?workspaceId=${workspaceId}`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.total).toBe(0);
      });

    await ownerAgent
      .patch(`/api/workspaces/${workspaceId}/channels/${channelId}/messages/${sentMessage.body.id}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ content: 'Updated message body' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.content).toBe('Updated message body');
      });

    await ownerAgent
      .delete(`/api/workspaces/${workspaceId}/channels/${channelId}/messages/${sentMessage.body.id}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.isDeleted).toBe(true);
      });

    await ownerAgent
      .get(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(2);
      });
  });
});

async function createApp() {
  const testingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = testingModule.createNestApplication();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.use(helmet({ contentSecurityPolicy: false }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: app.get(ConfigService).get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  const uploadDir = app.get(ConfigService).get<string>('LOCAL_UPLOAD_DIR', '.uploads');
  app.use('/uploads', express.static(uploadDir));

  await app.init();
  return app;
}