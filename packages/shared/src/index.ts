export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type ChannelType = 'PUBLIC' | 'PRIVATE';
export type DigestMode = 'OFF' | 'DAILY';
export type WorkspaceSearchScope = 'ALL' | 'CHANNELS' | 'MESSAGES' | 'FILES' | 'MEMBERS';
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

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface WorkspaceSummary {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
  workspaceCount: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationWorkspaceSummary {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  currentUserRole: WorkspaceRole | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMemberWorkspaceAccessSummary {
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
}

export interface OrganizationMemberSummary {
  userId: string;
  email: string;
  displayName: string;
  role: OrganizationRole;
  isCurrentUser: boolean;
  workspaceAccess: OrganizationMemberWorkspaceAccessSummary[];
}

export interface WorkspaceMemberSummary {
  userId: string;
  email: string;
  displayName: string;
  role: WorkspaceRole;
  joinedAt: string;
  isCurrentUser: boolean;
}

export interface WorkspaceInvitationSummary {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  invitedBy: {
    id: string;
    displayName: string;
    email: string;
  } | null;
}

export interface ChannelSummary {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  type: ChannelType;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  memberCount: number;
  isMember: boolean;
}

export interface ChannelMemberSummary {
  userId: string;
  email: string;
  displayName: string;
  joinedAt: string;
  isCurrentUser: boolean;
}

export interface FileAttachmentSummary {
  id: string;
  workspaceId: string;
  messageId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

export interface MessageReactionSummary {
  emoji: string;
  count: number;
  reactedByCurrentUser: boolean;
}

export interface MessageReadReceiptSummary {
  userId: string;
  displayName: string;
  readAt: string;
}

export interface MessageSummary {
  id: string;
  workspaceId: string;
  channelId: string;
  parentMessageId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isDeleted: boolean;
  isOwnMessage: boolean;
  threadReplyCount: number;
  reactions: MessageReactionSummary[];
  readReceipts: MessageReadReceiptSummary[];
  attachments: FileAttachmentSummary[];
  sender: {
    id: string;
    displayName: string;
  };
}

export interface NotificationSummary {
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

export interface NotificationPreferenceSummary {
  workspaceId: string;
  userId: string;
  muteAll: boolean;
  allowMentions: boolean;
  emailMentions: boolean;
  emailDigest: boolean;
  pushMentions: boolean;
  pushDigest: boolean;
  mutedChannelIds: string[];
  digestMode: DigestMode;
  lastDigestAt: string | null;
  updatedAt: string;
}

export interface DigestRunSummary {
  queued: boolean;
  createdCount: number;
  notification: NotificationSummary | null;
}

export interface PresenceSummary {
  userId: string;
  status: 'online' | 'offline';
  lastSeenAt: string;
}

export interface RealtimeSyncSummary {
  workspaceId: string;
  channelId: string | null;
  onlineUserIds: string[];
  generatedAt: string;
}

export interface MessagePage {
  items: MessageSummary[];
  nextCursor: string | null;
}

export interface SearchMessageSummary {
  id: string;
  channelId: string;
  channelName: string;
  content: string;
  preview: string;
  senderDisplayName: string;
  matchedTerms: string[];
  score: number;
  createdAt: string;
}

export interface SearchChannelSummary {
  id: string;
  name: string;
  description: string | null;
  type: ChannelType;
  matchedFields: string[];
  score: number;
}

export interface SearchFileSummary {
  id: string;
  messageId: string | null;
  originalName: string;
  mimeType: string;
  url: string;
  preview: string;
  matchedTerms: string[];
  score: number;
  createdAt: string;
}

export interface SearchMemberSummary {
  userId: string;
  displayName: string;
  email: string;
  role: WorkspaceRole;
  matchedFields: string[];
  score: number;
}

export interface WorkspaceSearchSummary {
  query: string;
  scope: WorkspaceSearchScope;
  appliedChannelId: string | null;
  totalCount: number;
  channels: SearchChannelSummary[];
  messages: SearchMessageSummary[];
  files: SearchFileSummary[];
  members: SearchMemberSummary[];
}

export interface AuditLogSummary {
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

export interface WorkspaceAnalyticsTimeseriesPoint {
  date: string;
  count: number;
}

export interface WorkspaceAnalyticsChannelSummary {
  channelId: string;
  channelName: string;
  messageCount: number;
}

export interface WorkspaceAnalyticsSummary {
  workspaceId: string;
  generatedAt: string;
  totals: {
    members: number;
    channels: number;
    messages: number;
    files: number;
    auditEvents: number;
  };
  activity: {
    activeMembers7d: number;
    activeMembers30d: number;
    messages7d: number;
    messages30d: number;
    files30d: number;
    auditEvents30d: number;
  };
  retention: {
    newMembers7d: number;
    newMembers30d: number;
    engagedMemberRate7d: number;
    engagedMemberRate30d: number;
  };
  adminActivity: {
    memberChanges30d: number;
    invitationChanges30d: number;
    channelChanges30d: number;
  };
  messageVolume: WorkspaceAnalyticsTimeseriesPoint[];
  topChannels: WorkspaceAnalyticsChannelSummary[];
}

export interface HealthResponse {
  status: 'ok';
  service: 'worknext-api';
  timestamp: string;
  mode?: 'local' | 'database';
  storagePath?: string;
  checks?: {
    storage?: 'up' | 'down';
    database?: 'up' | 'down' | 'disabled';
    redis?: 'up' | 'down' | 'disabled';
    queues?: 'up' | 'down' | 'disabled';
    realtime?: 'up' | 'down' | 'disabled';
  };
  metrics?: {
    users: number;
    workspaces: number;
    channels: number;
    messages: number;
  };
  features?: {
    redisAdapter: boolean;
    bullmq: boolean;
  };
}

export interface NotificationCountSummary {
  total: number;
  workspaces: Record<string, number>;
}

