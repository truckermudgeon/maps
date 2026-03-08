import type { RPCSchema } from 'electrobun/bun';

export interface Delta {
  timestamp: number;
  deltaMs: number;
}

export type TelemetryType = 'undefined' | 'allZeroes' | 'normal';

export type BrowserPage =
  | 'navigator'
  | 'github-maps-repo'
  | 'github-maps-releases'
  | 'github-truckermudgeon-scs-sdk-plugin-repo'
  | 'github-rencloud-scs-sdk-plugin-repo';

export interface SocketEvent {
  type: 'CLOSE' | 'OPEN' | 'ERROR';
}

export interface HealthCheckEvent {
  ok: boolean;
  message: string;
}

export interface TelemetryGuiRPC {
  bun: RPCSchema<{
    requests: {
      startTelemetryClient: {
        params: void;
        response: void;
      };
      openBrowser: {
        params: { page: BrowserPage };
        response: void;
      };
    };
    messages: Record<string, never>;
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      healthCheck: HealthCheckEvent;
      socket: SocketEvent;
      pairingCode: string;
      reconnected: void;
      connectError: string;
      telemetryError: string;
      telemetry: TelemetryType;
      telemetryDeltaMs: number;
    };
  }>;
}

// couldn't figure out how to get the correct types from electrobun, so
// declaring manually for now.
export interface BunRPC {
  request: {
    startTelemetryClient: (params: void) => Promise<void>;
    openBrowser: (params: { page: BrowserPage }) => void;
  };
  addMessageListener(
    event: '*',
    handler: (
      eventName: keyof TelemetryGuiRPC['webview']['messages'],
      ...args: unknown[]
    ) => void,
  ): void;
  removeMessageListener(
    event: '*',
    handler: (
      eventName: keyof TelemetryGuiRPC['webview']['messages'],
      ...args: unknown[]
    ) => void,
  ): void;
}

export interface WebviewRPC {
  send(name: 'healthCheck', event: HealthCheckEvent): void;
  send(name: 'socket', event: SocketEvent): void;
  send(name: 'pairingCode', code: string): void;
  send(name: 'reconnected'): void;
  send(name: 'connectError', errMsg: string): void;
  send(name: 'telemetryError', errMsg: string): void;
  send(name: 'telemetry', type: TelemetryType): void;
  send(name: 'telemetryDeltaMs', deltaMs: number): void;
}
