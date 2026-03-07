export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  email: string;
  displayName: string;
}

export interface AccessTokenPayload {
  sub: string;
  sessionId: string;
  email: string;
  displayName: string;
}

export interface SessionMetadata {
  userAgent: string | null;
  ipAddress: string | null;
}

export const REFRESH_COOKIE_NAME = 'worknext_refresh_token';