import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

import type { RealtimeSyncSummary } from '@worknext/shared';

import { ChannelsService } from '../channels/channels.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { PresenceService } from './presence.service.js';
import { RealtimeAdapterService } from './realtime-adapter.service.js';
import { RealtimeService } from './realtime.service.js';

type SocketUser = {
  userId: string;
  email: string;
  displayName: string;
  sessionId: string;
};

type RealtimeSocket = Socket & {
  data: {
    user?: SocketUser;
    joinedWorkspaces?: Set<string>;
    joinedChannels?: Set<string>;
  };
};

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly workspacesService: WorkspacesService,
    private readonly channelsService: ChannelsService,
    private readonly realtimeService: RealtimeService,
    private readonly realtimeAdapterService: RealtimeAdapterService,
    private readonly presenceService: PresenceService,
  ) {}

  afterInit(server: Server) {
    void this.realtimeAdapterService.configure(server);
    this.realtimeService.setServer(server);
  }

  async handleConnection(client: RealtimeSocket) {
    const token = this.readToken(client);

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<SocketUser & { sub: string }>(token);
      client.data.user = {
        userId: payload.sub,
        email: payload.email,
        displayName: payload.displayName,
        sessionId: payload.sessionId,
      };
      client.data.joinedWorkspaces = new Set();
      client.data.joinedChannels = new Set();
      void client.join(this.realtimeService.userRoom(payload.sub));
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: RealtimeSocket) {
    const user = client.data.user;

    if (!user) {
      return;
    }

    await this.presenceService.recordDisconnect(user.userId);

    for (const workspaceId of client.data.joinedWorkspaces ?? []) {
      this.realtimeService.emitPresence(workspaceId, {
        workspaceId,
        userId: user.userId,
        displayName: user.displayName,
        status: 'offline',
        lastSeenAt: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('workspace:join')
  async joinWorkspace(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: { workspaceId: string },
  ) {
    const user = this.getUser(client);
    await this.workspacesService.assertMembership(user.userId, payload.workspaceId);
    await client.join(this.realtimeService.workspaceRoom(payload.workspaceId));
    client.data.joinedWorkspaces?.add(payload.workspaceId);
    await this.presenceService.recordHeartbeat(user.userId);

    this.realtimeService.emitPresence(payload.workspaceId, {
      workspaceId: payload.workspaceId,
      userId: user.userId,
      displayName: user.displayName,
      status: 'online',
      lastSeenAt: new Date().toISOString(),
    });

    return { success: true };
  }

  @SubscribeMessage('channel:join')
  async joinChannel(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: { workspaceId: string; channelId: string },
  ) {
    const user = this.getUser(client);
    await this.channelsService.assertChannelAccess(user.userId, payload.workspaceId, payload.channelId);
    await client.join(this.realtimeService.channelRoom(payload.channelId));
    client.data.joinedChannels?.add(payload.channelId);

    return { success: true };
  }

  @SubscribeMessage('typing:start')
  async typingStart(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: { workspaceId: string; channelId: string },
  ) {
    const user = this.getUser(client);
    await this.channelsService.assertChannelAccess(user.userId, payload.workspaceId, payload.channelId);

    this.realtimeService.emitTyping(payload.workspaceId, payload.channelId, {
      workspaceId: payload.workspaceId,
      channelId: payload.channelId,
      userId: user.userId,
      displayName: user.displayName,
      isTyping: true,
      emittedAt: new Date().toISOString(),
    });

    return { success: true };
  }

  @SubscribeMessage('presence:heartbeat')
  async heartbeat(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: { workspaceId: string },
  ) {
    const user = this.getUser(client);
    await this.workspacesService.assertMembership(user.userId, payload.workspaceId);
    await this.presenceService.recordHeartbeat(user.userId);

    this.realtimeService.emitPresence(payload.workspaceId, {
      workspaceId: payload.workspaceId,
      userId: user.userId,
      displayName: user.displayName,
      status: 'online',
      lastSeenAt: new Date().toISOString(),
    });

    return { success: true };
  }

  @SubscribeMessage('state:sync')
  async syncState(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() payload: { workspaceId: string; channelId?: string | null },
  ): Promise<RealtimeSyncSummary> {
    const user = this.getUser(client);
    await this.workspacesService.assertMembership(user.userId, payload.workspaceId);
    await this.presenceService.recordHeartbeat(user.userId);

    const summary: RealtimeSyncSummary = {
      workspaceId: payload.workspaceId,
      channelId: payload.channelId ?? null,
      onlineUserIds: await this.presenceService.listOnlineUserIds(payload.workspaceId),
      generatedAt: new Date().toISOString(),
    };

    this.realtimeService.emitStateReconciled(user.userId, summary);
    return summary;
  }

  private getUser(client: RealtimeSocket) {
    if (!client.data.user) {
      client.disconnect();
      throw new Error('Socket user not authenticated.');
    }

    return client.data.user;
  }

  private readToken(client: RealtimeSocket) {
    const authToken = client.handshake.auth.token;

    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const authorizationHeader = client.handshake.headers.authorization;

    if (typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ')) {
      return authorizationHeader.slice('Bearer '.length).trim();
    }

    return null;
  }
}