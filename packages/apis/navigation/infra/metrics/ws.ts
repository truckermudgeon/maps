import * as Prometheus from 'prom-client';
import { ConsoleMetrics } from './helpers';

export const enum UpgradeRejectionReason {
  BAD_URL = 'bad_url',
  BAD_CLIENT_HEADERS = 'bad_client_headers',
  MISSING_IP = 'missing_ip',
  TOO_MANY_CONCURRENT_CONNECTIONS = 'too_many_concurrent_connections',
  RATE_LIMIT = 'rate_limit',
}

export interface WsMetrics {
  upgradesRejected: {
    inc(meta: { reason: UpgradeRejectionReason }): void;
  };
  connectionsActive: {
    inc(meta: { type: string }): void;
    dec(meta: { type: string }): void;
  };
  connectionsOpened: {
    inc(): void;
  };
  connectionsClosed: {
    inc(): void;
  };
  connectionLifetimeMs: {
    observe(ms: number): void;
  };
}

export class ConsoleWsMetrics extends ConsoleMetrics implements WsMetrics {
  upgradesRejected = {
    inc: (meta: { reason: UpgradeRejectionReason }) =>
      this.inc('upgradesRejected', meta),
  };

  connectionLifetimeMs = {
    observe: (ms: number) => this.observe('connectionLifetimeMs', ms),
  };

  connectionsActive = {
    inc: (meta: { type: string }) => this.inc('connectionsActive', meta),
    dec: (meta: { type: string }) => this.dec('connectionsActive', meta),
  };

  connectionsClosed = {
    inc: () => this.inc('connectionsClosed'),
  };

  connectionsOpened = {
    inc: () => this.inc('connectionsOpened'),
  };
}

export class PrometheusWsMetrics implements WsMetrics {
  private lifetimeMs = new Prometheus.Histogram({
    name: 'ws_connection_lifetime_ms',
    help: 'Lifetime of websocket connection',
    buckets: Prometheus.exponentialBuckets(10_000, 2, 8),
  });

  private rejected = new Prometheus.Counter({
    name: 'ws_upgrades_rejected_total',
    help: 'Total number of HTTP -> WS upgrades rejected',
    labelNames: ['reason'],
  });

  private active = new Prometheus.Gauge({
    name: 'ws_connections_active',
    help: 'Number of active websocket connections',
    labelNames: ['type'],
  });

  private closed = new Prometheus.Counter({
    name: 'ws_connections_closed_total',
    help: 'Total number of connections closed',
  });

  private opened = new Prometheus.Counter({
    name: 'ws_connections_opened_total',
    help: 'Total number of connections opened',
  });

  upgradesRejected = {
    inc: (meta: { reason: UpgradeRejectionReason }) =>
      this.rejected.inc(
        {
          reason: meta.reason,
        },
        1,
      ),
  };

  connectionLifetimeMs = {
    observe: (ms: number) => this.lifetimeMs.observe(ms),
  };

  connectionsActive = {
    inc: (meta: { type: string }) =>
      this.active.inc({
        type: meta.type,
      }),
    dec: (meta: { type: string }) =>
      this.active.dec({
        type: meta.type,
      }),
  };

  connectionsClosed = {
    inc: () => this.closed.inc(),
  };

  connectionsOpened = {
    inc: () => this.opened.inc(),
  };
}
