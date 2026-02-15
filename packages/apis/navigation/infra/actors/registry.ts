import { EventEmitter } from 'events';
import type { RoutingService } from '../../domain/actor/generate-routes';
import type { DomainEventSink } from '../../domain/events';
import type {
  GraphAndMapData,
  GraphMappedData,
} from '../../domain/lookup-data';
import type {
  ReadonlySessionActor,
  SessionActor,
  TelemetryEventEmitter,
} from '../../domain/session-actor';
import { SessionActorImpl } from '../../domain/session-actor';
import type { TruckSimTelemetry } from '../../types';
import type { ObservableKvStore } from '../kv/store';
import { navigatorKeys } from '../kv/store';
import type { MetricsService } from '../metrics/service';

interface Entry {
  actor: SessionActor;
  lastTouched: number;
}

export interface ReadonlySessionActorRegistry {
  get(telemetryId: string): ReadonlySessionActor | undefined;
}

export class SessionActorRegistry implements ReadonlySessionActorRegistry {
  // map of telemetry ids to Entries.
  private actors = new Map<string, Entry>();

  constructor(
    private readonly opts: {
      idleTtlMs: number;
      maxClientsPerActor: number;
      graphAndMapData: GraphAndMapData<GraphMappedData>;
      routing: RoutingService;
      kv: ObservableKvStore;
      metrics: MetricsService;
      domainEventSink: DomainEventSink;
      onCreate?: (actor: SessionActor) => void;
      onDelete?: (actor: SessionActor, reason: string) => void;
    },
  ) {}

  /** Get without creating */
  get(telemetryId: string): SessionActor | undefined {
    const entry = this.actors.get(telemetryId);
    if (!entry) {
      return undefined;
    }

    entry.lastTouched = Date.now();
    return entry.actor;
  }

  getByClientId(clientId: string): SessionActor | undefined {
    for (const entry of this.actors.values()) {
      if (entry.actor.attachedClientIds.has(clientId)) {
        return entry.actor;
      }
    }
    return undefined;
  }

  getOrCreate(telemetryId: string): SessionActor {
    let entry = this.actors.get(telemetryId);
    if (!entry) {
      const telemetryEventEmitter: TelemetryEventEmitter = new EventEmitter();

      let lastEmit: number | undefined;

      this.opts.kv.onSet(event => {
        if (event.key === navigatorKeys.telemetry(telemetryId)) {
          if (lastEmit == null) {
            lastEmit = Date.now();
          } else {
            const now = Date.now();
            const latencyMs = now - lastEmit - 500;
            lastEmit = now;
            // record metrics on 5% of telemetry pushes
            if (Math.random() < 0.05) {
              this.opts.metrics.actor.telemetryLatency.observe(
                { code: telemetryId },
                latencyMs,
              );
            }
          }
          telemetryEventEmitter.emit(
            'telemetry',
            event.value as TruckSimTelemetry,
          );
        }
      });

      const actor = new SessionActorImpl(
        telemetryId,
        this.opts.domainEventSink,
        telemetryEventEmitter,
        this.opts.graphAndMapData,
        this.opts.routing,
        this.opts.maxClientsPerActor,
      );
      entry = { actor, lastTouched: Date.now() };
      this.actors.set(telemetryId, entry);
      this.opts.onCreate?.(actor);
    }

    entry.lastTouched = Date.now();
    return entry.actor;
  }

  delete(code: string, reason = 'explicit') {
    const entry = this.actors.get(code);
    if (!entry) {
      return;
    }

    entry.actor.dispose();
    this.actors.delete(code);

    this.opts.onDelete?.(entry.actor, reason);
  }

  /** Periodic cleanup */
  sweepIdle(now = Date.now()) {
    for (const [telemetryId, entry] of this.actors) {
      if (now - entry.lastTouched > this.opts.idleTtlMs) {
        this.delete(telemetryId, 'idle-timeout');
      }
    }
  }
}
