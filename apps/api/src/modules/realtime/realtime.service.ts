import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitMessageCreated(channelId: string, payload: unknown) {
    this.server?.to(this.channelRoom(channelId)).emit('message:created', payload);
  }

  emitMessageUpdated(channelId: string, payload: unknown) {
    this.server?.to(this.channelRoom(channelId)).emit('message:updated', payload);
  }

  emitMessageDeleted(channelId: string, payload: unknown) {
    this.server?.to(this.channelRoom(channelId)).emit('message:deleted', payload);
  }

  emitTyping(workspaceId: string, channelId: string, payload: unknown) {
    this.server?.to(this.channelRoom(channelId)).emit('typing:update', payload);
    this.server?.to(this.workspaceRoom(workspaceId)).emit('typing:update', payload);
  }

  emitPresence(workspaceId: string, payload: unknown) {
    this.server?.to(this.workspaceRoom(workspaceId)).emit('presence:update', payload);
  }

  emitNotification(workspaceId: string, userId: string, payload: unknown) {
    this.server?.to(this.workspaceRoom(workspaceId)).emit('notification:new', { ...payload as object, userId });
  }

  workspaceRoom(workspaceId: string) {
    return `workspace:${workspaceId}`;
  }

  channelRoom(channelId: string) {
    return `channel:${channelId}`;
  }
}