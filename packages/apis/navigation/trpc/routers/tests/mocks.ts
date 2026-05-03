import { vi } from 'vitest';
import { AuthState } from '../../../domain/auth/auth-state';
import type { SessionActorRegistry } from '../../../infra/actors/registry';
import type { KvStore } from '../../../infra/kv/store';
import type { MetricsService } from '../../../infra/metrics/service';
import type { RateLimitService } from '../../../infra/rate-limit/service';
import type { Services } from '../../../infra/services';
import type { NavigatorContext, TelemetryContext } from '../../context';

export class MockKvStore implements KvStore {
  get: KvStore['get'];
  set: KvStore['set'];
  has: KvStore['has'];
  delete: KvStore['delete'];
  expire: KvStore['expire'];
  incr: KvStore['incr'];
  decr: KvStore['decr'];
  onSet: KvStore['onSet'];

  constructor(overrides: Partial<KvStore> = {}) {
    this.get = (overrides.get ??
      vi.fn().mockResolvedValue(undefined)) as KvStore['get'];
    this.set = (overrides.set ??
      vi.fn().mockResolvedValue(undefined)) as KvStore['set'];
    this.has = (overrides.has ??
      vi.fn().mockResolvedValue(false)) as KvStore['has'];
    this.delete = (overrides.delete ??
      vi.fn().mockResolvedValue(undefined)) as KvStore['delete'];
    this.expire = (overrides.expire ??
      vi.fn().mockResolvedValue(undefined)) as KvStore['expire'];
    this.incr = (overrides.incr ??
      vi.fn().mockResolvedValue(1)) as KvStore['incr'];
    this.decr = (overrides.decr ??
      vi.fn().mockResolvedValue(0)) as KvStore['decr'];
    this.onSet = (overrides.onSet ??
      vi.fn().mockReturnValue(() => void 0)) as KvStore['onSet'];
  }
}

export class MockMetricsService implements MetricsService {
  rpc: MetricsService['rpc'];
  ws: MetricsService['ws'];
  actor: MetricsService['actor'];
  worker: MetricsService['worker'];
  render: MetricsService['render'];

  constructor(overrides: Partial<MetricsService> = {}) {
    this.rpc = overrides.rpc ?? {
      procedureCalls: { inc: vi.fn() },
      procedureErrors: { inc: vi.fn() },
      procedureRateLimited: { inc: vi.fn() },
      procedureDuration: { observe: vi.fn() },
    };
    this.ws = overrides.ws ?? ({} as MetricsService['ws']);
    this.actor = overrides.actor ?? ({} as MetricsService['actor']);
    this.worker = overrides.worker ?? ({} as MetricsService['worker']);
    this.render = overrides.render ?? (() => Promise.resolve(''));
  }
}

export class MockRateLimitService implements RateLimitService {
  consume: RateLimitService['consume'];
  wsUpgrade: RateLimitService['wsUpgrade'];
  wsConnect: RateLimitService['wsConnect'];
  wsDisconnect: RateLimitService['wsDisconnect'];

  constructor(overrides: Partial<RateLimitService> = {}) {
    this.consume = overrides.consume ?? vi.fn().mockResolvedValue(true);
    this.wsUpgrade = overrides.wsUpgrade ?? vi.fn().mockResolvedValue(true);
    this.wsConnect = overrides.wsConnect ?? vi.fn().mockResolvedValue(true);
    this.wsDisconnect =
      overrides.wsDisconnect ?? vi.fn().mockResolvedValue(undefined);
  }
}

export class MockSessionActorRegistry implements SessionActorRegistry {
  get: SessionActorRegistry['get'];
  getOrCreate: SessionActorRegistry['getOrCreate'];
  getByClientId: SessionActorRegistry['getByClientId'];

  constructor(overrides: Partial<SessionActorRegistry> = {}) {
    this.get = (overrides.get ??
      vi.fn().mockReturnValue(undefined)) as SessionActorRegistry['get'];
    this.getOrCreate = (overrides.getOrCreate ??
      vi.fn()) as SessionActorRegistry['getOrCreate'];
    this.getByClientId = (overrides.getByClientId ??
      vi
        .fn()
        .mockReturnValue(undefined)) as SessionActorRegistry['getByClientId'];
  }
}

export function mockServices(overrides: Partial<Services> = {}): Services {
  return {
    kv: new MockKvStore(),
    metrics: new MockMetricsService(),
    rateLimit: new MockRateLimitService(),
    sessionActors: new MockSessionActorRegistry(),
    lookups: {} as Services['lookups'],
    domainEventSink: { publish: vi.fn() },
    search: {} as Services['search'],
    routing: {} as Services['routing'],
    ...overrides,
  };
}

export interface MockNavigatorContextOptions {
  auth?: NavigatorContext['auth'];
  services?: Partial<Services>;
  clientId?: string;
}

export function mockNavigatorContext(
  opts: MockNavigatorContextOptions = {},
): NavigatorContext {
  return {
    type: 'navigator',
    clientId: opts.clientId ?? 'test-client',
    auth: opts.auth ?? { state: AuthState.UNAUTHENTICATED },
    wsConnectionState: {
      ip: '127.0.0.1',
      websocketKey: 'test-ws-key',
      connectedAt: Date.now(),
      subscriptions: new Map(),
    },
    services: mockServices(opts.services),
  };
}

export interface MockTelemetryContextOptions {
  auth?: TelemetryContext['auth'];
  services?: Partial<TelemetryContext['services']>;
  clientId?: string;
}

export function mockTelemetryContext(
  opts: MockTelemetryContextOptions = {},
): TelemetryContext {
  const services = mockServices();
  return {
    type: 'telemetry',
    clientId: opts.clientId ?? 'test-client',
    auth: opts.auth ?? { state: AuthState.UNAUTHENTICATED },
    wsConnectionState: {
      ip: '127.0.0.1',
      websocketKey: 'test-ws-key',
      connectedAt: Date.now(),
      subscriptions: new Map(),
    },
    services: {
      kv: services.kv,
      metrics: services.metrics,
      rateLimit: services.rateLimit,
      sessionActors: services.sessionActors,
      ...opts.services,
    },
  };
}
