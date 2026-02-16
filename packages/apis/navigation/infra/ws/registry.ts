import type { WebSocket } from 'ws';

export interface WsConnectionState {
  ip: string;
  websocketKey: string;
  connectedAt: number;
  subscriptions: Map<string, number>;
}

export const wsRegistry = new Map<WebSocket, WsConnectionState>();

export type WSRegistry = typeof wsRegistry;
