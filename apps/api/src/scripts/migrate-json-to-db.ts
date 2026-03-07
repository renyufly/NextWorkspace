import { Prisma, PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import process from 'node:process';

import { createEmptyState, type LocalStoreState } from '../modules/local-store/local-store.types.js';

const APP_STATE_META_ID = 'worknext-state';

type Options = {
  sourcePath: string;
  databaseUrl: string;
  dryRun: boolean;
  force: boolean;
};

type CountSummary = {
  users: number;
  sessions: number;
  workspaces: number;
  memberships: number;
  invitations: number;
  channels: number;
  channelMemberships: number;
  channelReadStates: number;
  attachments: number;
  notifications: number;
  messages: number;
};

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const state = await loadState(options.sourcePath);
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: options.databaseUrl,
      },
    },
  });

  try {
    await prisma.$connect();

    const sourceCounts = summarizeState(state);
    const targetCounts = await readTargetCounts(prisma);
    const targetHasData = Object.values(targetCounts).some((count) => count > 0);

    console.log(`Source JSON: ${options.sourcePath}`);
    console.log(`Target database: ${redactDatabaseUrl(options.databaseUrl)}`);
    console.log(`Dry run: ${options.dryRun ? 'yes' : 'no'}`);
    console.log(`Force overwrite: ${options.force ? 'yes' : 'no'}`);
    console.log(`Source counts: ${formatCounts(sourceCounts)}`);
    console.log(`Target counts: ${formatCounts(targetCounts)}`);

    if (options.dryRun) {
      console.log('Dry run completed. No changes were written to PostgreSQL.');
      return;
    }

    if (targetHasData && !options.force) {
      throw new Error('Target database is not empty. Re-run with --force to replace existing PostgreSQL data.');
    }

    await prisma.$transaction(async (transaction) => {
      await persistState(transaction, state);
    });

    const finalCounts = await readTargetCounts(prisma);
    console.log(`Migration completed successfully. Final target counts: ${formatCounts(finalCounts)}`);
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(args: string[]): Options {
  const defaultSource = process.env.LOCAL_DATA_FILE ?? '.data/worknext.json';
  let sourcePath = defaultSource;
  let databaseUrl = process.env.DATABASE_URL ?? '';
  let dryRun = false;
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--') {
      continue;
    }

    if (arg === '--source') {
      sourcePath = args[index + 1] ?? sourcePath;
      index += 1;
      continue;
    }

    if (arg === '--database-url') {
      databaseUrl = args[index + 1] ?? databaseUrl;
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--force') {
      force = true;
      continue;
    }

    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required. Provide it through the environment or --database-url.');
  }

  return {
    sourcePath: isAbsolute(sourcePath) ? sourcePath : resolve(process.cwd(), sourcePath),
    databaseUrl,
    dryRun,
    force,
  };
}

function printHelp() {
  console.log([
    'Usage: pnpm --filter @worknext/api migrate:json-to-db -- [options]',
    '',
    'Options:',
    '  --source <path>         Path to the JSON state file (default: LOCAL_DATA_FILE or .data/worknext.json)',
    '  --database-url <url>    PostgreSQL connection string (default: DATABASE_URL)',
    '  --dry-run               Print source/target summaries without modifying PostgreSQL',
    '  --force                 Replace existing PostgreSQL data if target tables are non-empty',
    '  --help                  Show this message',
  ].join('\n'));
}

async function loadState(sourcePath: string): Promise<LocalStoreState> {
  const rawState = await readFile(sourcePath, 'utf8');
  return normalizeState(JSON.parse(rawState) as Partial<LocalStoreState>);
}

function normalizeState(rawState: Partial<LocalStoreState>): LocalStoreState {
  const emptyState = createEmptyState();

  return {
    meta: {
      version: rawState.meta?.version ?? emptyState.meta.version,
      createdAt: rawState.meta?.createdAt ?? emptyState.meta.createdAt,
      updatedAt: rawState.meta?.updatedAt ?? emptyState.meta.updatedAt,
    },
    users: rawState.users ?? emptyState.users,
    sessions: rawState.sessions ?? emptyState.sessions,
    workspaces: rawState.workspaces ?? emptyState.workspaces,
    memberships: rawState.memberships ?? emptyState.memberships,
    invitations: rawState.invitations ?? emptyState.invitations,
    channels: rawState.channels ?? emptyState.channels,
    channelMemberships: rawState.channelMemberships ?? emptyState.channelMemberships,
    channelReadStates: rawState.channelReadStates ?? emptyState.channelReadStates,
    attachments: rawState.attachments ?? emptyState.attachments,
    notifications: rawState.notifications ?? emptyState.notifications,
    messages: rawState.messages ?? emptyState.messages,
  };
}

function summarizeState(state: LocalStoreState): CountSummary {
  return {
    users: state.users.length,
    sessions: state.sessions.length,
    workspaces: state.workspaces.length,
    memberships: state.memberships.length,
    invitations: state.invitations.length,
    channels: state.channels.length,
    channelMemberships: state.channelMemberships.length,
    channelReadStates: state.channelReadStates.length,
    attachments: state.attachments.length,
    notifications: state.notifications.length,
    messages: state.messages.length,
  };
}

async function readTargetCounts(prisma: PrismaClient): Promise<CountSummary> {
  const [
    users,
    sessions,
    workspaces,
    memberships,
    invitations,
    channels,
    channelMemberships,
    channelReadStates,
    attachments,
    notifications,
    messages,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.session.count(),
    prisma.workspace.count(),
    prisma.workspaceMembership.count(),
    prisma.invitation.count(),
    prisma.channel.count(),
    prisma.channelMembership.count(),
    prisma.channelReadState.count(),
    prisma.fileAttachment.count(),
    prisma.notification.count(),
    prisma.message.count(),
  ]);

  return {
    users,
    sessions,
    workspaces,
    memberships,
    invitations,
    channels,
    channelMemberships,
    channelReadStates,
    attachments,
    notifications,
    messages,
  };
}

function formatCounts(counts: CountSummary) {
  return [
    `users=${counts.users}`,
    `sessions=${counts.sessions}`,
    `workspaces=${counts.workspaces}`,
    `memberships=${counts.memberships}`,
    `invitations=${counts.invitations}`,
    `channels=${counts.channels}`,
    `channelMemberships=${counts.channelMemberships}`,
    `channelReadStates=${counts.channelReadStates}`,
    `attachments=${counts.attachments}`,
    `notifications=${counts.notifications}`,
    `messages=${counts.messages}`,
  ].join(' ');
}

function redactDatabaseUrl(databaseUrl: string) {
  return databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

async function persistState(prisma: DatabaseClient, state: LocalStoreState) {
  await prisma.notification.deleteMany();
  await prisma.fileAttachment.deleteMany();
  await prisma.channelReadState.deleteMany();
  await prisma.channelMembership.deleteMany();
  await prisma.message.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.workspaceMembership.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.session.deleteMany();
  await prisma.presence.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
  await prisma.appStateMeta.deleteMany();

  await prisma.appStateMeta.create({
    data: {
      id: APP_STATE_META_ID,
      version: state.meta.version,
      createdAt: new Date(state.meta.createdAt),
      updatedAt: new Date(state.meta.updatedAt),
    },
  });

  if (state.users.length > 0) {
    await prisma.user.createMany({
      data: state.users.map((user) => ({
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        displayName: user.displayName,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
      })),
    });
  }

  if (state.workspaces.length > 0) {
    await prisma.workspace.createMany({
      data: state.workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        createdById: workspace.createdById,
        createdAt: new Date(workspace.createdAt),
        updatedAt: new Date(workspace.updatedAt),
      })),
    });
  }

  if (state.sessions.length > 0) {
    await prisma.session.createMany({
      data: state.sessions.map((session) => ({
        id: session.id,
        userId: session.userId,
        refreshTokenHash: session.refreshTokenHash,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        expiresAt: new Date(session.expiresAt),
        revokedAt: session.revokedAt ? new Date(session.revokedAt) : null,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      })),
    });
  }

  if (state.memberships.length > 0) {
    await prisma.workspaceMembership.createMany({
      data: state.memberships.map((membership) => ({
        id: membership.id,
        workspaceId: membership.workspaceId,
        userId: membership.userId,
        role: membership.role,
        joinedAt: new Date(membership.joinedAt),
      })),
    });
  }

  if (state.invitations.length > 0) {
    await prisma.invitation.createMany({
      data: state.invitations.map((invitation) => ({
        id: invitation.id,
        workspaceId: invitation.workspaceId,
        email: invitation.email,
        token: invitation.token,
        role: invitation.role,
        invitedById: invitation.invitedById,
        expiresAt: new Date(invitation.expiresAt),
        acceptedAt: invitation.acceptedAt ? new Date(invitation.acceptedAt) : null,
        createdAt: new Date(invitation.createdAt),
        updatedAt: new Date(invitation.updatedAt),
      })),
    });
  }

  if (state.channels.length > 0) {
    await prisma.channel.createMany({
      data: state.channels.map((channel) => ({
        id: channel.id,
        workspaceId: channel.workspaceId,
        name: channel.name,
        description: channel.description,
        type: channel.type,
        createdById: channel.createdById,
        createdAt: new Date(channel.createdAt),
        updatedAt: new Date(channel.updatedAt),
      })),
    });
  }

  if (state.channelMemberships.length > 0) {
    await prisma.channelMembership.createMany({
      data: state.channelMemberships.map((membership) => ({
        id: membership.id,
        workspaceId: membership.workspaceId,
        channelId: membership.channelId,
        userId: membership.userId,
        addedById: membership.addedById,
        joinedAt: new Date(membership.joinedAt),
      })),
    });
  }

  if (state.channelReadStates.length > 0) {
    await prisma.channelReadState.createMany({
      data: state.channelReadStates.map((readState) => ({
        id: readState.id,
        workspaceId: readState.workspaceId,
        channelId: readState.channelId,
        userId: readState.userId,
        lastReadAt: new Date(readState.lastReadAt),
        updatedAt: new Date(readState.updatedAt),
      })),
    });
  }

  if (state.messages.length > 0) {
    await prisma.message.createMany({
      data: state.messages.map((message) => ({
        id: message.id,
        workspaceId: message.workspaceId,
        channelId: message.channelId,
        senderId: message.senderId,
        content: message.content,
        createdAt: new Date(message.createdAt),
        updatedAt: new Date(message.updatedAt),
        deletedAt: message.deletedAt ? new Date(message.deletedAt) : null,
      })),
    });
  }

  if (state.attachments.length > 0) {
    await prisma.fileAttachment.createMany({
      data: state.attachments.map((attachment) => ({
        id: attachment.id,
        workspaceId: attachment.workspaceId,
        uploaderId: attachment.uploaderId,
        messageId: attachment.messageId,
        storageKey: attachment.storageKey,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        url: attachment.url,
        createdAt: new Date(attachment.createdAt),
      })),
    });
  }

  if (state.notifications.length > 0) {
    await prisma.notification.createMany({
      data: state.notifications.map((notification) => ({
        id: notification.id,
        workspaceId: notification.workspaceId,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        channelId: notification.channelId,
        messageId: notification.messageId,
        readAt: notification.readAt ? new Date(notification.readAt) : null,
        createdAt: new Date(notification.createdAt),
      })),
    });
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`JSON -> PostgreSQL migration failed: ${message}`);
  process.exitCode = 1;
});