'use client';

import { io, type Socket } from 'socket.io-client';

const REALTIME_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api').replace(/\/api$/, '') + '/realtime';

export type RealtimeSocket = Socket;

export function createRealtimeSocket(accessToken: string) {
  return io(REALTIME_BASE_URL, {
    transports: ['websocket'],
    auth: {
      token: accessToken,
    },
    reconnection: true,
    autoConnect: true,
  });
}