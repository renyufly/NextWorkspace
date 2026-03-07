import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import request from 'supertest';

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
  let emailOutboxPath: string;
  let pushOutboxPath: string;
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
    process.env.LOCAL_EMAIL_OUTBOX_FILE = resolve(sandboxDir, 'email-outbox.jsonl');
    process.env.EMAIL_DELIVERY_MODE = 'local';
    process.env.LOCAL_PUSH_OUTBOX_FILE = resolve(sandboxDir, 'push-outbox.jsonl');
    process.env.PUSH_DELIVERY_MODE = 'local';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    process.env.API_PORT = '3101';
    emailOutboxPath = resolve(sandboxDir, 'email-outbox.jsonl');
    pushOutboxPath = resolve(sandboxDir, 'push-outbox.jsonl');

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

    const organizations = await ownerAgent
      .get('/api/organizations')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);

    expect(organizations.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'E2E Workspace',
          workspaceCount: 1,
          memberCount: 2,
          role: 'OWNER',
        }),
      ]),
    );

    const organizationId = organizations.body[0]?.id as string;

    const orgWorkspace = await ownerAgent
      .post(`/api/organizations/${organizationId}/workspaces`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ name: 'Operations Hub' })
      .expect(201);

    expect(orgWorkspace.body.organizationId).toBe(organizationId);

    await ownerAgent
      .get(`/api/organizations/${organizationId}/workspaces`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'E2E Workspace', currentUserRole: 'OWNER' }),
            expect.objectContaining({ name: 'Operations Hub', currentUserRole: 'OWNER' }),
          ]),
        );
      });

    await ownerAgent
      .get(`/api/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              email: ownerEmail,
              role: 'OWNER',
            }),
            expect.objectContaining({
              email: memberEmail,
              role: 'MEMBER',
              workspaceAccess: expect.arrayContaining([
                expect.objectContaining({ workspaceName: 'E2E Workspace', role: 'MEMBER' }),
              ]),
            }),
          ]),
        );
      });

    await memberAgent
      .get(`/api/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(403);

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

    await memberAgent
      .post(`/api/workspaces/${workspaceId}/channels/${channelId}/messages/${sentMessage.body.id}/reactions`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .send({ emoji: '👍' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.reactions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ emoji: '👍', count: 1, reactedByCurrentUser: true }),
          ]),
        );
      });

    const threadReply = await memberAgent
      .post(`/api/workspaces/${workspaceId}/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .send({
        content: 'Reply inside thread',
        parentMessageId: sentMessage.body.id,
      })
      .expect(201);

    expect(threadReply.body.parentMessageId).toBe(sentMessage.body.id);

    await ownerAgent
      .get(`/api/workspaces/${workspaceId}/channels/${channelId}/messages/${sentMessage.body.id}/thread`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]?.content).toBe('Reply inside thread');
      });

    await ownerAgent
      .get(`/api/workspaces/${workspaceId}/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items[0]?.threadReplyCount).toBe(1);
        expect(body.items[0]?.readReceipts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ userId: memberRegistration.body.user.id }),
          ]),
        );
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

    await memberAgent
      .patch('/api/notifications/preferences')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .send({
        workspaceId,
        allowMentions: true,
        emailMentions: true,
        emailDigest: true,
        pushMentions: true,
        pushDigest: true,
        mutedChannelIds: [],
        digestMode: 'DAILY',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.allowMentions).toBe(true);
        expect(body.emailMentions).toBe(true);
        expect(body.emailDigest).toBe(true);
        expect(body.pushMentions).toBe(true);
        expect(body.pushDigest).toBe(true);
        expect(body.mutedChannelIds).toEqual([]);
        expect(body.digestMode).toBe('DAILY');
      });

    await memberAgent
      .get(`/api/notifications/preferences?workspaceId=${workspaceId}`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.allowMentions).toBe(true);
        expect(body.emailMentions).toBe(true);
        expect(body.emailDigest).toBe(true);
        expect(body.pushMentions).toBe(true);
        expect(body.pushDigest).toBe(true);
        expect(body.digestMode).toBe('DAILY');
        expect(body.lastDigestAt).toBeNull();
      });

    await ownerAgent
      .post(`/api/workspaces/${workspaceId}/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ content: `Digest ping @${memberMention}` })
      .expect(201);

    await memberAgent
      .post('/api/notifications/digest/run')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .send({ workspaceId })
      .expect(201)
      .expect(({ body }) => {
        expect(body.queued).toBe(false);
        expect(body.createdCount).toBe(1);
        expect(body.notification).toMatchObject({ type: 'DIGEST' });
      });

    await memberAgent
      .get(`/api/notifications?workspaceId=${workspaceId}`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([expect.objectContaining({ type: 'DIGEST' })]),
        );
      });

    await memberAgent
      .get(`/api/notifications/preferences?workspaceId=${workspaceId}`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.lastDigestAt).toEqual(expect.any(String));
      });

    await ownerAgent
      .get(`/api/workspaces/${workspaceId}/analytics`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.workspaceId).toBe(workspaceId);
        expect(body.totals.members).toBe(2);
        expect(body.totals.messages).toBeGreaterThanOrEqual(3);
        expect(body.activity.messages7d).toBeGreaterThanOrEqual(3);
        expect(body.activity.activeMembers7d).toBe(2);
        expect(body.messageVolume).toHaveLength(7);
        expect(body.topChannels).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ channelId, channelName: 'leadership', messageCount: expect.any(Number) }),
          ]),
        );
      });

    await memberAgent
      .get(`/api/workspaces/${workspaceId}/analytics`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(403);

    const outboxRaw = await readFile(emailOutboxPath, 'utf8');
    const outboxEntries = outboxRaw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { category: string; to: string; subject: string });

    expect(outboxEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'MENTION', to: memberEmail, subject: expect.stringContaining('mentioned you') }),
        expect.objectContaining({ category: 'DIGEST', to: memberEmail, subject: expect.stringContaining('Daily digest') }),
      ]),
    );

    const pushOutboxRaw = await readFile(pushOutboxPath, 'utf8');
    const pushOutboxEntries = pushOutboxRaw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { category: string; userId: string; title: string });

    expect(pushOutboxEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'MENTION', userId: memberRegistration.body.user.id, title: expect.stringContaining('mentioned you') }),
        expect.objectContaining({ category: 'DIGEST', userId: memberRegistration.body.user.id, title: expect.stringContaining('Daily digest') }),
      ]),
    );

    await memberAgent
      .post(`/api/notifications/read-all?workspaceId=${workspaceId}`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(201);

    await memberAgent
      .patch('/api/notifications/preferences')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .send({
        workspaceId,
        allowMentions: false,
        emailMentions: false,
        emailDigest: true,
        pushMentions: false,
        pushDigest: true,
        mutedChannelIds: [channelId],
        digestMode: 'DAILY',
      })
      .expect(200);

    await memberAgent
      .get(`/api/notifications/unread-count?workspaceId=${workspaceId}`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.total).toBe(0);
      });

    await ownerAgent
      .get(`/api/workspaces/${workspaceId}/search?q=leader&scope=CHANNELS`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.scope).toBe('CHANNELS');
        expect(body.totalCount).toBeGreaterThan(0);
        expect(body.channels).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: channelId,
              name: 'leadership',
              matchedFields: expect.arrayContaining(['name']),
            }),
          ]),
        );
      });

    await ownerAgent
      .get(`/api/workspaces/${workspaceId}/search?q=${memberMention}&scope=MESSAGES&channelId=${channelId}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.scope).toBe('MESSAGES');
        expect(body.appliedChannelId).toBe(channelId);
        expect(body.messages.length).toBeGreaterThan(0);
        expect(body.messages[0]?.preview).toContain(memberMention);
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

    await ownerAgent
      .get(`/api/workspaces/${workspaceId}/audit`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ action: 'WORKSPACE_CREATED', entityType: 'WORKSPACE' }),
            expect.objectContaining({ action: 'INVITATION_CREATED', entityType: 'INVITATION' }),
            expect.objectContaining({ action: 'CHANNEL_CREATED', entityType: 'CHANNEL' }),
            expect.objectContaining({ action: 'CHANNEL_MEMBER_ADDED', entityType: 'CHANNEL_MEMBER' }),
          ]),
        );
      });

    await memberAgent
      .get(`/api/workspaces/${workspaceId}/audit`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(403);
  });
});

async function createApp() {
  const { AppModule } = await import('../src/app.module.js');

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