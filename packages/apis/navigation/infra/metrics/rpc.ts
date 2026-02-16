import * as Prometheus from 'prom-client';
import { ConsoleMetrics } from './helpers';

export interface RpcMeta {
  path: string;
  type: string;
}

export interface RpcMetrics {
  procedureCalls: {
    inc(meta: RpcMeta): void;
  };
  procedureErrors: {
    inc(meta: RpcMeta): void;
  };
  procedureRateLimited: {
    inc(meta: RpcMeta): void;
  };
  procedureDuration: {
    observe(meta: RpcMeta, ms: number): void;
  };
}

export class ConsoleRpcMetrics extends ConsoleMetrics implements RpcMetrics {
  procedureCalls = {
    inc: (meta: RpcMeta) => this.inc('procedureCalls', meta),
  };

  procedureDuration = {
    observe: (meta: RpcMeta, ms: number) =>
      this.observe('procedureDuration', ms, meta),
  };

  procedureErrors = {
    inc: (meta: RpcMeta) => this.inc('procedureErrors', meta),
  };

  procedureRateLimited = {
    inc: (meta: RpcMeta) => this.inc('procedureRateLimited', meta),
  };
}

export class PrometheusRpcMetrics implements RpcMetrics {
  private static readonly labelNames = ['path', 'type'];

  private calls = new Prometheus.Counter({
    name: 'procedure_calls_total',
    help: 'Total number of calls',
    labelNames: PrometheusRpcMetrics.labelNames,
  });

  private duration = new Prometheus.Histogram({
    name: 'procedure_duration_ms',
    help: 'Execution time',
    labelNames: PrometheusRpcMetrics.labelNames,
    buckets: Prometheus.exponentialBuckets(1, 5, 6),
  });

  private errors = new Prometheus.Counter({
    name: 'procedure_errors_total',
    help: 'Total number of errors',
    labelNames: PrometheusRpcMetrics.labelNames,
  });

  private rateLimited = new Prometheus.Counter({
    name: 'procedure_rate_limited_total',
    help: 'Total number of times procedure has been rate limited',
    labelNames: PrometheusRpcMetrics.labelNames,
  });

  procedureCalls = {
    inc: (meta: RpcMeta) => this.calls.inc(rpcMetaToLabels(meta), 1),
  };

  procedureDuration = {
    observe: (meta: RpcMeta, ms: number) =>
      this.duration.observe(rpcMetaToLabels(meta), ms),
  };

  procedureErrors = {
    inc: (meta: RpcMeta) => this.errors.inc(rpcMetaToLabels(meta), 1),
  };

  procedureRateLimited = {
    inc: (meta: RpcMeta) => this.rateLimited.inc(rpcMetaToLabels(meta), 1),
  };
}

function rpcMetaToLabels(meta: RpcMeta) {
  return {
    path: meta.path,
    type: meta.type,
  };
}
