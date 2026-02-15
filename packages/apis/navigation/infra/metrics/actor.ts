import * as Prometheus from 'prom-client';
import { ConsoleMetrics } from './helpers';

export interface ActorMeta {
  code: string;
}

export interface ActorMetrics {
  telemetryLatency: {
    observe(meta: ActorMeta, ms: number): void;
  };
}

export class ConsoleActorMetrics
  extends ConsoleMetrics
  implements ActorMetrics
{
  telemetryLatency = {
    observe: (meta: ActorMeta, ms: number) =>
      this.observe('telemetryLatency', ms, meta),
  };
}

export class PrometheusActorMetrics implements ActorMetrics {
  private latency = new Prometheus.Histogram({
    name: 'telemetry_latency_ms',
    help: 'Latency between telemetry pushes',
    buckets: Prometheus.exponentialBuckets(10, 2, 8),
  });

  telemetryLatency = {
    observe: (_meta: ActorMeta, ms: number) => this.latency.observe(ms),
  };
}
