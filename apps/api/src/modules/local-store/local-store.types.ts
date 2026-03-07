export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type ChannelType = 'PUBLIC' | 'PRIVATE';

export interface LocalUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalWorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalWorkspaceMembershipRecord {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface LocalInvitationRecord {
  id: string;
  workspaceId: string;
  email: string;
  token: string;
  role: WorkspaceRole;
  invitedById: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalChannelRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  type: ChannelType;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalChannelMembershipRecord {
  id: string;
  workspaceId: string;
  channelId: string;
  userId: string;
  addedById: string;
  joinedAt: string;
}

export interface LocalChannelReadStateRecord {
  id: string;
  workspaceId: string;
  channelId: string;
  userId: string;
  lastReadAt: string;
  updatedAt: string;
}

export interface LocalFileAttachmentRecord {
  id: string;
  workspaceId: string;
  uploaderId: string;
  messageId: string | null;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

export interface LocalNotificationRecord {
  id: string;
  workspaceId: string;
  userId: string;
  type: 'MENTION';
  title: string;
  body: string;
  channelId: string;
  messageId: string;
  readAt: string | null;
  createdAt: string;
}

export interface LocalMessageRecord {
  id: string;
  workspaceId: string;
  channelId: string;
  senderId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LocalStoreState {
  meta: {
    version: number;
    createdAt: string;
    updatedAt: string;
  };
  users: LocalUserRecord[];
  sessions: LocalSessionRecord[];
  workspaces: LocalWorkspaceRecord[];
  memberships: LocalWorkspaceMembershipRecord[];
  invitations: LocalInvitationRecord[];
  channels: LocalChannelRecord[];
  channelMemberships: LocalChannelMembershipRecord[];
  channelReadStates: LocalChannelReadStateRecord[];
  attachments: LocalFileAttachmentRecord[];
  notifications: LocalNotificationRecord[];
  messages: LocalMessageRecord[];
}

export function createEmptyState(): LocalStoreState {
  const now = new Date().toISOString();

  return {
    meta: {
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    users: [],
    sessions: [],
    workspaces: [],
    memberships: [],
    invitations: [],
    channels: [],
    channelMemberships: [],
    channelReadStates: [],
    attachments: [],
    notifications: [],
    messages: [],
  };
}