export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type ChannelType = 'PUBLIC' | 'PRIVATE';

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
  name: string;
  slug: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
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

export interface MessageSummary {
  id: string;
  workspaceId: string;
  channelId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isDeleted: boolean;
  isOwnMessage: boolean;
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
  type: 'MENTION';
  title: string;
  body: string;
  channelId: string;
  messageId: string;
  readAt: string | null;
  createdAt: string;
}

export interface MessagePage {
  items: MessageSummary[];
  nextCursor: string | null;
}

export interface HealthResponse {
  status: 'ok';
  service: 'worknext-api';
  timestamp: string;
  mode?: 'local' | 'database';
  storagePath?: string;
  checks?: {
    storage?: 'up' | 'down';
  };
  metrics?: {
    users: number;
    workspaces: number;
    channels: number;
    messages: number;
  };
}

export interface NotificationCountSummary {
  total: number;
  workspaces: Record<string, number>;
}

