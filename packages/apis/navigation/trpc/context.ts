import type { TRPCRequestInfo } from '@trpc/server/http';
import type http from 'http';
import type { WebSocket } from 'ws';

export type Context = TelemetryContext | NavigatorContext;

// TODO i should probably have separate servers:
//   - accepting + storing telemetry
//   - handling navigator requests
//  but this is fine for now.

export interface TelemetryContext {
  type: 'telemetry';
  clientId: string;
}

export interface NavigatorContext {
  type: 'navigator';
  clientId: string;
}

export function createContext(_opts: {
  info: TRPCRequestInfo;
  req: http.IncomingMessage;
  res: WebSocket;
}): Promise<Context> {
  throw new Error('unimplemented');
}
