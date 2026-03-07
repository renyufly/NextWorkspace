export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type ChannelType = 'PUBLIC' | 'PRIVATE';
export type AuditEntityType = 'WORKSPACE' | 'INVITATION' | 'WORKSPACE_MEMBER' | 'CHANNEL' | 'CHANNEL_MEMBER';
export type AuditAction =
  | 'WORKSPACE_CREATED'
  | 'WORKSPACE_UPDATED'
  | 'INVITATION_CREATED'
  | 'INVITATION_REVOKED'
  | 'INVITATION_ACCEPTED'
  | 'MEMBER_ROLE_UPDATED'
  | 'MEMBER_REMOVED'
  | 'CHANNEL_CREATED'
  | 'CHANNEL_UPDATED'
  | 'CHANNEL_DELETED'
  | 'CHANNEL_MEMBER_ADDED'
  | 'CHANNEL_MEMBER_REMOVED';

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

export interface LocalOrganizationRecord {
  id: string;
  name: string;
  slug: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalOrganizationMembershipRecord {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  joinedAt: string;
}

export interface LocalWorkspaceRecord {
  id: string;
  organizationId: string;
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
  type: 'MENTION' | 'DIGEST';
  title: string;
  body: string;
  channelId: string;
  messageId: string;
  readAt: string | null;
  createdAt: string;
}

export interface LocalNotificationPreferenceRecord {
  id: string;
  workspaceId: string;
  userId: string;
  muteAll: boolean;
  allowMentions: boolean;
  emailMentions: boolean;
  emailDigest: boolean;
  pushMentions: boolean;
  pushDigest: boolean;
  mutedChannelIds: string[];
  digestMode: 'OFF' | 'DAILY';
  lastDigestAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalAuditLogRecord {
  id: string;
  workspaceId: string;
  actorUserId: string;
  actorDisplayName: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string | null;
  targetUserId: string | null;
  targetDisplayName: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface LocalPresenceRecord {
  userId: string;
  status: 'online' | 'offline';
  lastSeenAt: string;
  updatedAt: string;
}

export interface LocalMessageRecord {
  id: string;
  workspaceId: string;
  channelId: string;
  senderId: string;
  parentMessageId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LocalMessageReactionRecord {
  id: string;
  workspaceId: string;
  channelId: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface LocalStoreState {
  meta: {
    version: number;
    createdAt: string;
    updatedAt: string;
  };
  users: LocalUserRecord[];
  sessions: LocalSessionRecord[];
  organizations: LocalOrganizationRecord[];
  organizationMemberships: LocalOrganizationMembershipRecord[];
  workspaces: LocalWorkspaceRecord[];
  memberships: LocalWorkspaceMembershipRecord[];
  invitations: LocalInvitationRecord[];
  channels: LocalChannelRecord[];
  channelMemberships: LocalChannelMembershipRecord[];
  channelReadStates: LocalChannelReadStateRecord[];
  attachments: LocalFileAttachmentRecord[];
  notifications: LocalNotificationRecord[];
  notificationPreferences: LocalNotificationPreferenceRecord[];
  auditLogs: LocalAuditLogRecord[];
  presences: LocalPresenceRecord[];
  messages: LocalMessageRecord[];
  messageReactions: LocalMessageReactionRecord[];
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
    organizations: [],
    organizationMemberships: [],
    workspaces: [],
    memberships: [],
    invitations: [],
    channels: [],
    channelMemberships: [],
    channelReadStates: [],
    attachments: [],
    notifications: [],
    notificationPreferences: [],
    auditLogs: [],
    presences: [],
    messages: [],
    messageReactions: [],
  };
}