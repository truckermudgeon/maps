import { UnreachableError } from '@truckermudgeon/base/precon';
import { action, computed, makeAutoObservable, observable } from 'mobx';
import type {
  BunRPC,
  Delta,
  HealthCheckEvent,
  SocketEvent,
  TelemetryGuiRPC,
  TelemetryType,
} from '../bun/types';
import type { Mode } from './ModeSelector';

export type AppState =
  | 'healthChecking'
  | 'healthError' // terminal
  | 'socketConnecting'
  | 'socketClosed' // terminal
  | 'socketError' // terminal
  | 'handShaking'
  | 'handshakeError' // terminal
  | 'waitingForPairing'
  | 'telemetryError' // terminal
  | 'telemetryUndefined'
  | 'telemetryAllZeroes'
  | 'telemetryNormal';

export type TerminalAppState = Extract<
  AppState,
  | 'healthError'
  | 'socketClosed'
  | 'socketError'
  | 'handshakeError'
  | 'telemetryError'
>;

const terminalStates = new Set<AppState>([
  'healthError',
  'socketClosed',
  'socketError',
  'handshakeError',
  'telemetryError',
]);

export class AppStore {
  // UI state. does it need to be here?

  mode: Mode = 'code';
  showHelp = false;

  // state

  pairingCode: string | undefined;
  reconnected = false;
  appState: AppState = 'healthChecking';
  // optional error message set when transitioning to a terminal state.
  errorMessage: string | undefined;
  hasReceivedTelemetry = false;
  lifetimeDeltas = 0;
  deltas: Delta[] = [];
  connectedAt: number | undefined;

  private readonly deltaIntervalId: NodeJS.Timeout;

  constructor(readonly rpc: BunRPC) {
    console.log('appstore ctor');
    makeAutoObservable(this, {
      setupListeners: false,
      status: computed.struct,
      latency: computed.struct,
      deltas: observable.shallow,
    });
    rpc.addMessageListener('*', this.setupListeners);
    this.deltaIntervalId = setInterval(() => this.cleanupDeltas(), 5000);
  }

  dispose() {
    console.log('AppStore::dispose');
    this.rpc.removeMessageListener('*', this.setupListeners);
    clearInterval(this.deltaIntervalId);
  }

  cleanupDeltas() {
    const now = Date.now();
    this.deltas = this.deltas.filter(({ timestamp }) => {
      return now - timestamp <= 60_000;
    });
  }

  get latency(): {
    fiveSecondMs: number | undefined;
    sixtySecondMs: number | undefined;
  } {
    let fiveSecondMs: number | undefined;
    let sixtySecondMs: number | undefined;

    const now = Date.now();
    const deltasWithin5s = this.deltas.filter(
      ({ timestamp }) => now - timestamp <= 5000,
    );
    const deltasWithin60s = this.deltas.filter(
      ({ timestamp }) => now - timestamp <= 60_000,
    );

    if (deltasWithin5s.length) {
      fiveSecondMs = Math.round(
        deltasWithin5s.reduce((acc, { deltaMs }) => acc + deltaMs, 0) /
          deltasWithin5s.length,
      );
    }
    if (deltasWithin60s.length) {
      sixtySecondMs = Math.round(
        deltasWithin60s.reduce((acc, { deltaMs }) => acc + deltaMs, 0) /
          deltasWithin60s.length,
      );
    }

    return {
      fiveSecondMs,
      sixtySecondMs,
    };
  }

  get status(): {
    iconColor: 'neutral' | 'danger' | 'success' | 'warning';
    text: string;
    tooltip: string;
  } {
    let iconColor: 'neutral' | 'danger' | 'success' | 'warning';
    let text: string;
    let tooltip: string;

    switch (this.appState) {
      case 'healthChecking':
        iconColor = 'neutral';
        text = 'Connecting...';
        tooltip = 'Checking if server is available';
        break;
      case 'healthError':
        iconColor = 'danger';
        text = 'Disconnected';
        tooltip =
          this.errorMessage == null ||
          this.errorMessage.startsWith('Unable to connect.')
            ? 'The TruckSim Navigator server is down. Try again later.'
            : this.errorMessage;
        break;
      case 'socketConnecting':
        iconColor = 'neutral';
        text = 'Connecting...';
        tooltip = 'Connecting to server...';
        break;
      case 'socketClosed':
        iconColor = 'warning';
        text = 'Disconnected';
        tooltip = 'The server has closed the connection.';
        break;
      case 'socketError':
        iconColor = 'danger';
        text = 'Disconnected';
        tooltip = 'The server has encountered an error.';
        break;
      case 'handShaking':
        iconColor = 'neutral';
        text = 'Connecting...';
        tooltip = 'Performing server handshake...';
        break;
      case 'handshakeError':
        iconColor = 'danger';
        text = 'Disconnected';
        tooltip = 'The server encountered an error during the handshake.';
        break;
      case 'waitingForPairing':
        iconColor = 'neutral';
        text = 'Waiting for device...';
        tooltip = 'Waiting for a device to be paired.';
        break;
      case 'telemetryError':
        iconColor = 'danger';
        text = 'Telemetry error';
        tooltip = 'Error while sending truck telemetry.';
        break;
      case 'telemetryUndefined':
        iconColor = 'warning';
        text = 'Waiting for game telemetry...';
        tooltip =
          'Telemetry is unavailable. Make sure ATS is running and a telemetry plugin is installed.';
        break;
      case 'telemetryAllZeroes':
        iconColor = 'warning';
        text = 'Waiting for truck...';
        tooltip = 'Waiting for truck to appear in the game world.';
        break;
      case 'telemetryNormal':
        this.connectedAt ??= Date.now();
        iconColor = 'success';
        text = 'Connected';
        tooltip = 'Connected to server and sending telemetry data.';
        break;
      default:
        throw new UnreachableError(this.appState);
    }

    return {
      iconColor,
      text,
      tooltip,
    };
  }

  get isTerminal(): boolean {
    return terminalStates.has(this.appState);
  }

  readonly setupListeners = action(
    (
      eventName: keyof TelemetryGuiRPC['webview']['messages'],
      ...args: unknown[]
    ) => {
      //console.log('received event', eventName, args);
      this.errorMessage = undefined;
      switch (eventName) {
        case 'healthCheck': {
          const [healthCheck] = args as [HealthCheckEvent];
          this.appState = healthCheck.ok ? 'socketConnecting' : 'healthError';
          this.errorMessage = !healthCheck.ok ? healthCheck.message : undefined;
          break;
        }
        case 'socket': {
          const [socketEvent] = args as [SocketEvent];
          switch (socketEvent.type) {
            case 'OPEN':
              this.appState = 'handShaking';
              break;
            case 'CLOSE':
              this.appState = 'socketClosed';
              break;
            case 'ERROR':
              this.appState = 'socketError';
              break;
          }
          break;
        }
        case 'connectError':
          this.appState = 'handshakeError';
          break;
        case 'pairingCode': {
          const [pairingCode] = args as [string];
          this.pairingCode = pairingCode;
          this.appState = 'waitingForPairing';
          break;
        }
        case 'reconnected':
          this.reconnected = true;
          break;
        case 'telemetryError':
          this.appState = 'telemetryError';
          break;
        case 'telemetry': {
          this.hasReceivedTelemetry = true;
          const [telemetryType] = args as [TelemetryType];
          switch (telemetryType) {
            case 'undefined':
              this.appState = 'telemetryUndefined';
              break;
            case 'allZeroes':
              this.appState = 'telemetryAllZeroes';
              break;
            case 'normal':
              this.appState = 'telemetryNormal';
              break;
          }
          break;
        }
        case 'telemetryDeltaMs': {
          const [deltaMs] = args as [number];
          this.lifetimeDeltas++;
          if (this.deltas.length > 120) {
            this.deltas.shift();
          }
          this.deltas.push({
            timestamp: Date.now(),
            deltaMs,
          });
          break;
        }
        default:
          throw new UnreachableError(eventName);
      }
    },
  );
}
