import type { EventEmitter } from 'events';
import { util } from 'zod';
import type {
  JobState,
  RouteIndex,
  TrailerState,
  TruckSimTelemetry,
} from '../types';
import type { JobEventEmitter } from './actor/detect-job-events';
import { detectJobEvents } from './actor/detect-job-events';
import type { RouteEventEmitter } from './actor/detect-route-events';
import { detectRouteEvents } from './actor/detect-route-events';
import type { ThemeModeEventEmitter } from './actor/detect-theme-mode-events';
import { detectThemeModeEvents } from './actor/detect-theme-mode-events';
import type { TrailerEventEmitter } from './actor/detect-trailer-events';
import { detectTrailerEvents } from './actor/detect-trailer-events';
import type { RouteWithLookup, RoutingService } from './actor/generate-routes';
import type { DomainEventSink } from './events';
import type { GraphAndMapData, GraphMappedData } from './lookup-data';
import Omit = util.Omit;

export type TelemetryEventEmitter = EventEmitter<{
  telemetry: [TruckSimTelemetry];
}>;

export type SessionActor = {
  readTelemetry: () => TruckSimTelemetry | undefined;
  telemetryEventEmitter: TelemetryEventEmitter;
} & ReturnType<typeof detectJobEvents> &
  ReturnType<typeof detectRouteEvents> &
  ReturnType<typeof detectTrailerEvents> &
  ReturnType<typeof detectThemeModeEvents> & {
    readonly code: string;
    readonly attachedClientIds: ReadonlySet<string>;
    getLatestTelemetry(): LatestValue<TruckSimTelemetry | undefined>;
    dispose(): void;
    attachClient(clientId: string): boolean;
    detachClient(clientId: string): void;
  };

// add more keys to readonly properties as needed.
export type ReadonlySessionActor = Pick<SessionActor, 'attachedClientIds'>;

// this is just a thin facade over what used to be a bunch of loosely-related
// global functions.
// TODO improve the interface.
export class SessionActorImpl implements SessionActor {
  private clients = new Set<string>(); // client IDs
  private latestTelemetry = new LatestValue<TruckSimTelemetry | undefined>();
  private readonly onTelemetryHandler: (
    t: TruckSimTelemetry | undefined,
  ) => void;

  readonly jobEventEmitter: JobEventEmitter;
  readonly routeEventEmitter: RouteEventEmitter;
  readonly trailerEventEmitter: Omit<TrailerEventEmitter, 'emit'>;
  readonly themeModeEventEmitter: Omit<ThemeModeEventEmitter, 'emit'>;

  readonly readActiveRoute: () => RouteWithLookup | undefined;
  readonly readJobState: () => JobState | undefined;
  readonly readRouteIndex: () => RouteIndex | undefined;
  readonly readTelemetry: () => TruckSimTelemetry | undefined;
  readonly readTrailerState: () => TrailerState | undefined;
  readonly readThemeMode: () => 'light' | 'dark';

  readonly setActiveRoute: (route: RouteWithLookup | undefined) => void;
  readonly unpauseRouteEvents: () => void;

  constructor(
    readonly code: string,
    private readonly events: DomainEventSink,
    readonly telemetryEventEmitter: TelemetryEventEmitter,
    graphAndMapData: GraphAndMapData<GraphMappedData>,
    routing: RoutingService,
    private readonly maxClients: number,
  ) {
    console.log('constructing actor', code);
    this.onTelemetryHandler = telemetry => {
      try {
        this.latestTelemetry.update(telemetry);
      } catch (err) {
        this.events.publish({
          type: 'error',
          code: this.code,
          message: err instanceof Error ? err.message : 'unknown error',
          data: err,
        });
        throw err;
      }
    };
    telemetryEventEmitter.on('telemetry', this.onTelemetryHandler);

    const jobRes = detectJobEvents({
      telemetryEventEmitter,
      jobMappedData: graphAndMapData.tsMapData,
    });
    const routeRes = detectRouteEvents({
      telemetryEventEmitter,
      graphAndMapData,
      routing,
      domainEventSink: this.events,
    });
    const trailerRes = detectTrailerEvents({
      telemetryEventEmitter,
    });
    const themeModeRes = detectThemeModeEvents({
      telemetryEventEmitter,
      graphAndMapData,
    });

    this.jobEventEmitter = jobRes.jobEventEmitter;
    this.routeEventEmitter = routeRes.routeEventEmitter;
    this.trailerEventEmitter = trailerRes.trailerEventEmitter;
    this.themeModeEventEmitter = themeModeRes.themeModeEventEmitter;

    this.readActiveRoute = routeRes.readActiveRoute;
    this.readJobState = jobRes.readJobState;
    this.readRouteIndex = routeRes.readRouteIndex;
    this.readTelemetry = () => this.latestTelemetry.get();
    this.readTrailerState = trailerRes.readTrailerState;
    this.readThemeMode = themeModeRes.readThemeMode;

    this.setActiveRoute = routeRes.setActiveRoute;
    this.unpauseRouteEvents = routeRes.unpauseRouteEvents;
  }

  getLatestTelemetry() {
    return this.latestTelemetry;
  }

  get attachedClientIds(): ReadonlySet<string> {
    return this.clients;
  }

  attachClient(clientId: string): boolean {
    if (this.clients.size >= this.maxClients) {
      // TODO notify observers, e.g. for logging / metrics
      return false;
    }

    this.clients.add(clientId);
    return true;
  }

  detachClient(clientId: string) {
    if (this.clients.delete(clientId)) {
      // TODO notify observers, e.g. for logging / metrics
      console.log('client detached', clientId, 'remaining:', this.clients.size);
    }
  }

  dispose() {
    this.telemetryEventEmitter.off('telemetry', this.onTelemetryHandler);
    this.jobEventEmitter.removeAllListeners();
    this.routeEventEmitter.removeAllListeners();
    this.trailerEventEmitter.removeAllListeners();
    this.themeModeEventEmitter.removeAllListeners();
    this.latestTelemetry.dispose();
  }
}

class LatestValue<T> {
  private value?: T;
  private subs = new Set<() => void>();

  update(v: T) {
    this.value = v;
    for (const s of this.subs) s();
  }

  subscribe(onUpdate: () => void) {
    this.subs.add(onUpdate);
    return () => this.subs.delete(onUpdate);
  }

  dispose() {
    this.subs.clear();
  }

  get() {
    return this.value;
  }
}
