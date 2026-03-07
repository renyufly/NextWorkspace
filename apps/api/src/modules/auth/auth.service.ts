import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { hashPassword, verifyPassword } from '../../common/passwords.js';
import {
  type LocalSessionRecord,
  type LocalStoreState,
  type LocalUserRecord,
} from '../local-store/local-store.types.js';
import { LocalStoreService } from '../local-store/local-store.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import type { AccessTokenPayload, AuthenticatedUser, SessionMetadata } from './auth.types.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly localStoreService: LocalStoreService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto, metadata: SessionMetadata): Promise<AuthResult> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const now = new Date().toISOString();

    const createdSession = await this.localStoreService.updateState((state) => {
      const existingUser = state.users.find((user) => user.email === normalizedEmail);

      if (existingUser) {
        throw new ConflictException('An account with that email already exists.');
      }

      const user: LocalUserRecord = {
        id: randomUUID(),
        email: normalizedEmail,
        passwordHash: hashPassword(dto.password),
        displayName: dto.displayName.trim(),
        createdAt: now,
        updatedAt: now,
      };

      state.users.push(user);

      return this.issueSession(state, user, metadata, now);
    });

    return this.buildAuthResult(createdSession.user, createdSession.session, createdSession.refreshToken);
  }

  async login(dto: LoginDto, metadata: SessionMetadata): Promise<AuthResult> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const now = new Date().toISOString();

    const createdSession = await this.localStoreService.updateState((state) => {
      const user = state.users.find((candidate) => candidate.email === normalizedEmail);

      if (!user || !verifyPassword(dto.password, user.passwordHash)) {
        throw new UnauthorizedException('Invalid email or password.');
      }

      return this.issueSession(state, user, metadata, now);
    });

    return this.buildAuthResult(createdSession.user, createdSession.session, createdSession.refreshToken);
  }

  async refresh(refreshToken: string, metadata: SessionMetadata): Promise<AuthResult> {
    const now = new Date().toISOString();
    const hashedToken = this.hashToken(refreshToken);

    const refreshedSession = await this.localStoreService.updateState((state) => {
      const session = state.sessions.find(
        (candidate) =>
          candidate.refreshTokenHash === hashedToken &&
          candidate.revokedAt === null &&
          new Date(candidate.expiresAt).getTime() > Date.now(),
      );

      if (!session) {
        throw new UnauthorizedException('Refresh token is invalid or expired.');
      }

      const user = state.users.find((candidate) => candidate.id === session.userId);

      if (!user) {
        throw new UnauthorizedException('Session user not found.');
      }

      const nextRefreshToken = this.createRefreshToken();
      session.refreshTokenHash = this.hashToken(nextRefreshToken);
      session.userAgent = metadata.userAgent;
      session.ipAddress = metadata.ipAddress;
      session.updatedAt = now;
      session.expiresAt = this.createSessionExpiry();

      return {
        user,
        session,
        refreshToken: nextRefreshToken,
      };
    });

    return this.buildAuthResult(
      refreshedSession.user,
      refreshedSession.session,
      refreshedSession.refreshToken,
    );
  }

  async logout(user: AuthenticatedUser) {
    await this.localStoreService.updateState((state) => {
      const session = state.sessions.find(
        (candidate) => candidate.id === user.sessionId && candidate.userId === user.userId,
      );

      if (session) {
        session.revokedAt = new Date().toISOString();
        session.updatedAt = session.revokedAt;
      }
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.localStoreService.updateState((state) => {
      const user = state.users.find((candidate) => candidate.id === userId);

      if (!user) {
        throw new UnauthorizedException('User no longer exists.');
      }

      if (dto.displayName) {
        user.displayName = dto.displayName.trim();
      }

      user.updatedAt = new Date().toISOString();

      return this.serializeUser(user);
    });
  }

  async getCurrentUser(userId: string) {
    const state = await this.localStoreService.readState();
    const user = state.users.find((candidate) => candidate.id === userId);

    if (!user) {
      throw new UnauthorizedException('User no longer exists.');
    }

    return this.serializeUser(user);
  }

  private issueSession(state: LocalStoreState, user: LocalUserRecord, metadata: SessionMetadata, now: string) {
    const refreshToken = this.createRefreshToken();
    const session: LocalSessionRecord = {
      id: randomUUID(),
      userId: user.id,
      refreshTokenHash: this.hashToken(refreshToken),
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
      expiresAt: this.createSessionExpiry(),
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    state.sessions.push(session);

    return {
      user,
      session,
      refreshToken,
    };
  }

  private async buildAuthResult(
    user: LocalUserRecord,
    session: LocalSessionRecord,
    refreshToken: string,
  ): Promise<AuthResult> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      sessionId: session.id,
      email: user.email,
      displayName: user.displayName,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '12h',
    });

    return {
      accessToken,
      refreshToken,
      user: this.serializeUser(user),
    };
  }

  private serializeUser(user: LocalUserRecord) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
  }

  private createRefreshToken() {
    return randomBytes(48).toString('hex');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private createSessionExpiry() {
    return new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  }
}