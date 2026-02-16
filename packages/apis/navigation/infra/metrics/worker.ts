import * as Prometheus from 'prom-client';
import { ConsoleMetrics } from './helpers';

export interface WorkerMeta {
  name: string;
}

export interface WorkerMetrics {
  workerCalls: {
    inc(meta: WorkerMeta): void;
  };
  workerDuration: {
    observe(meta: WorkerMeta, ms: number): void;
  };
}

export class ConsoleWorkerMetrics
  extends ConsoleMetrics
  implements WorkerMetrics
{
  workerCalls = {
    inc: (meta: WorkerMeta) => this.inc('workerCalls', meta),
  };

  workerDuration = {
    observe: (meta: WorkerMeta, ms: number) =>
      this.observe('workerDuration', ms, meta),
  };
}

export class PrometheusWorkerMetrics implements WorkerMetrics {
  private static readonly labelNames = ['name'];

  private calls = new Prometheus.Counter({
    name: 'worker_calls_total',
    help: 'Total number of calls',
    labelNames: PrometheusWorkerMetrics.labelNames,
  });

  private duration = new Prometheus.Histogram({
    name: 'worker_duration_ms',
    help: 'Execution time',
    labelNames: PrometheusWorkerMetrics.labelNames,
    buckets: Prometheus.exponentialBuckets(100, 5, 6),
  });

  workerCalls = {
    inc: (meta: WorkerMeta) => this.calls.inc(workerMetaToLabels(meta), 1),
  };

  workerDuration = {
    observe: (meta: WorkerMeta, ms: number) =>
      this.duration.observe(workerMetaToLabels(meta), ms),
  };
}

function workerMetaToLabels(meta: WorkerMeta) {
  return {
    name: meta.name,
  };
}
