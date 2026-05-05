import * as Prometheus from 'prom-client';
import { ConsoleMetrics } from './helpers';

export type ReconnectOutcome = 'viewer_unknown' | 'stale_cleared' | 'live';
export type StaleBindingPhase = 'at_subscribe' | 'mid_session';

export interface SessionMetrics {
  reconnectOutcome: {
    inc(meta: { outcome: ReconnectOutcome }): void;
  };
  staleBindingEvents: {
    inc(meta: { phase: StaleBindingPhase }): void;
  };
  staleBindingResumed: {
    inc(): void;
  };
  timeToFirstPositionUpdate: {
    observe(ms: number): void;
  };
}

export class ConsoleSessionMetrics
  extends ConsoleMetrics
  implements SessionMetrics
{
  reconnectOutcome = {
    inc: (meta: { outcome: ReconnectOutcome }) =>
      this.inc('reconnectOutcome', meta),
  };

  staleBindingEvents = {
    inc: (meta: { phase: StaleBindingPhase }) =>
      this.inc('staleBindingEvents', meta),
  };

  staleBindingResumed = {
    inc: () => this.inc('staleBindingResumed'),
  };

  timeToFirstPositionUpdate = {
    observe: (ms: number) => this.observe('timeToFirstPositionUpdate', ms),
  };
}

export class PrometheusSessionMetrics implements SessionMetrics {
  private reconnect = new Prometheus.Counter({
    name: 'reconnect_outcome_total',
    help: 'Outcomes of the reconnect mutation liveness probe',
    labelNames: ['outcome'],
  });

  private staleEvents = new Prometheus.Counter({
    name: 'stale_binding_events_total',
    help: 'Number of staleBinding events emitted, split by phase',
    labelNames: ['phase'],
  });

  private staleResumed = new Prometheus.Counter({
    name: 'stale_binding_resumed_total',
    help: 'Number of times telemetry resumed after a staleBinding event',
  });

  // Orphaned subscriptions are counted separately via
  // stale_binding_events_total{phase=at_subscribe}, so this histogram
  // contains only resolutions. Buckets extend past the 10s staleBinding
  // window to keep edge-case resolutions out of +Inf.
  private firstPosition = new Prometheus.Histogram({
    name: 'time_to_first_position_update_ms',
    help: 'Latency from subscribe to first positionUpdate (resolved only)',
    buckets: Prometheus.exponentialBuckets(10, 2, 13),
  });

  reconnectOutcome = {
    inc: (meta: { outcome: ReconnectOutcome }) =>
      this.reconnect.inc({ outcome: meta.outcome }, 1),
  };

  staleBindingEvents = {
    inc: (meta: { phase: StaleBindingPhase }) =>
      this.staleEvents.inc({ phase: meta.phase }, 1),
  };

  staleBindingResumed = {
    inc: () => this.staleResumed.inc(1),
  };

  timeToFirstPositionUpdate = {
    observe: (ms: number) => this.firstPosition.observe(ms),
  };
}
