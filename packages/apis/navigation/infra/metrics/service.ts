import * as Prometheus from 'prom-client';
import { env } from '../../env';
import type { ActorMetrics } from './actor';
import { ConsoleActorMetrics, PrometheusActorMetrics } from './actor';
import type { RpcMetrics } from './rpc';
import { ConsoleRpcMetrics, PrometheusRpcMetrics } from './rpc';
import type { SessionMetrics } from './session';
import { ConsoleSessionMetrics, PrometheusSessionMetrics } from './session';
import type { WorkerMetrics } from './worker';
import { ConsoleWorkerMetrics, PrometheusWorkerMetrics } from './worker';
import type { WsMetrics } from './ws';
import { ConsoleWsMetrics, PrometheusWsMetrics } from './ws';

export interface MetricsService {
  ws: WsMetrics;
  rpc: RpcMetrics;
  actor: ActorMetrics;
  session: SessionMetrics;
  worker: WorkerMetrics;
  render: () => Promise<string>;
}

export function createMetricsService(): MetricsService {
  if (env.METRICS_ENABLED) {
    Prometheus.collectDefaultMetrics();
  }

  return env.METRICS_ENABLED
    ? {
        ws: new PrometheusWsMetrics(),
        rpc: new PrometheusRpcMetrics(),
        actor: new PrometheusActorMetrics(),
        session: new PrometheusSessionMetrics(),
        worker: new PrometheusWorkerMetrics(),
        render: () => Prometheus.register.metrics(),
      }
    : {
        ws: new ConsoleWsMetrics(),
        rpc: new ConsoleRpcMetrics(),
        actor: new ConsoleActorMetrics(),
        session: new ConsoleSessionMetrics(),
        worker: new ConsoleWorkerMetrics(),
        render: () => Promise.resolve('dummy metrics render.'),
      };
}
