import { describe, expect, it, vi } from 'vitest';
import { AuthState } from '../../../domain/auth/auth-state';
import type { Services } from '../../../infra/services';
import type { WsConnectionState } from '../../../infra/ws/registry';
import type { NavigatorContext } from '../../context';
import { createCallerFactory } from '../../init';
import { navigatorRouter } from '../navigator-router';

const createCaller = createCallerFactory(navigatorRouter);

function mockRpcMetrics() {
  return {
    procedureCalls: { inc: vi.fn() },
    procedureErrors: { inc: vi.fn() },
    procedureRateLimited: { inc: vi.fn() },
    procedureDuration: { observe: vi.fn() },
  };
}

function mockWsState(): WsConnectionState {
  return {
    ip: '127.0.0.1',
    websocketKey: 'test-ws-key',
    connectedAt: Date.now(),
    subscriptions: new Map(),
  };
}

function makeNavigatorContext(
  auth: NavigatorContext['auth'] = { state: AuthState.UNAUTHENTICATED },
  servicesOverrides: Partial<Services> = {},
): NavigatorContext {
  return {
    type: 'navigator',
    clientId: 'test-client',
    auth,
    wsConnectionState: mockWsState(),
    services: {
      kv: {
        get: vi.fn().mockResolvedValue(undefined),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        has: vi.fn().mockResolvedValue(false),
        incr: vi.fn().mockResolvedValue(1),
        decr: vi.fn().mockResolvedValue(0),
        expire: vi.fn().mockResolvedValue(undefined),
        onSet: vi.fn().mockReturnValue(() => void 0),
      },
      metrics: {
        rpc: mockRpcMetrics(),
        ws: {} as never,
        actor: {} as never,
        worker: {} as never,
        render: () => Promise.resolve(''),
      },
      rateLimit: {
        consume: vi.fn().mockResolvedValue(true),
        wsUpgrade: vi.fn().mockResolvedValue(true),
        wsConnect: vi.fn().mockResolvedValue(true),
        wsDisconnect: vi.fn().mockResolvedValue(undefined),
      },
      sessionActors: {} as never,
      lookups: {} as never,
      domainEventSink: { publish: vi.fn() },
      search: {} as never,
      routing: {} as never,
      ...servicesOverrides,
    } as unknown as Services,
  };
}

describe('navigator redeemCode', () => {
  it('throws NOT_FOUND when pairing code is unknown', async () => {
    const ctx = makeNavigatorContext();
    const caller = createCaller(ctx);

    await expect(caller.redeemCode({ code: 'AAAA' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws CONFLICT when too many clients are already connected', async () => {
    const mockActor = { attachClient: vi.fn().mockReturnValue(false) };
    const ctx = makeNavigatorContext(
      { state: AuthState.UNAUTHENTICATED },
      {
        kv: {
          get: vi.fn().mockImplementation(key => {
            if (String(key).startsWith('pairing:')) {
              return Promise.resolve({
                telemetryId: 'telemetry-123',
                redeemed: false,
                cleanupOnRedemption: true,
              });
            }
            return Promise.resolve(undefined);
          }),
          set: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          has: vi.fn().mockResolvedValue(false),
          incr: vi.fn().mockResolvedValue(1),
          decr: vi.fn().mockResolvedValue(0),
          expire: vi.fn().mockResolvedValue(undefined),
          onSet: vi.fn().mockReturnValue(() => void 0),
        },
        sessionActors: {
          getOrCreate: vi.fn().mockReturnValue(mockActor),
        } as never,
      },
    );
    const caller = createCaller(ctx);

    await expect(caller.redeemCode({ code: 'AAAA' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('returns viewerId and telemetryId on success', async () => {
    const telemetryId = 'telemetry-abc';
    const mockActor = { attachClient: vi.fn().mockReturnValue(true) };
    const ctx = makeNavigatorContext(
      { state: AuthState.UNAUTHENTICATED },
      {
        kv: {
          get: vi.fn().mockImplementation(key => {
            if (String(key).startsWith('pairing:')) {
              return Promise.resolve({
                telemetryId,
                redeemed: false,
                cleanupOnRedemption: true,
              });
            }
            return Promise.resolve(undefined);
          }),
          set: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          has: vi.fn().mockResolvedValue(false),
          incr: vi.fn().mockResolvedValue(1),
          decr: vi.fn().mockResolvedValue(0),
          expire: vi.fn().mockResolvedValue(undefined),
          onSet: vi.fn().mockReturnValue(() => void 0),
        },
        sessionActors: {
          getOrCreate: vi.fn().mockReturnValue(mockActor),
        } as never,
      },
    );
    const caller = createCaller(ctx);

    const result = await caller.redeemCode({ code: 'AAAA' });

    expect(result.telemetryId).toBe(telemetryId);
    expect(result.viewerId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe('navigator reconnect', () => {
  it('returns true immediately when already authenticated', async () => {
    const ctx = makeNavigatorContext({
      state: AuthState.VIEWER_AUTHENTICATED,
      viewerId: 'existing-viewer',
    });
    const caller = createCaller(ctx);

    const result = await caller.reconnect({
      viewerId: '00000000-0000-0000-0000-000000000000',
    });

    expect(result).toBe(true);
  });

  it('returns false when viewerId is not found in KV', async () => {
    const ctx = makeNavigatorContext();
    const caller = createCaller(ctx);

    const result = await caller.reconnect({
      viewerId: '00000000-0000-0000-0000-000000000001',
    });

    expect(result).toBe(false);
  });

  it('throws CONFLICT when too many clients are already connected', async () => {
    const mockActor = { attachClient: vi.fn().mockReturnValue(false) };
    const ctx = makeNavigatorContext(
      { state: AuthState.UNAUTHENTICATED },
      {
        kv: {
          get: vi.fn().mockImplementation(key => {
            if (String(key).startsWith('viewerId:')) {
              return Promise.resolve('telemetry-xyz');
            }
            return Promise.resolve(undefined);
          }),
          set: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          has: vi.fn().mockResolvedValue(false),
          incr: vi.fn().mockResolvedValue(1),
          decr: vi.fn().mockResolvedValue(0),
          expire: vi.fn().mockResolvedValue(undefined),
          onSet: vi.fn().mockReturnValue(() => void 0),
        },
        sessionActors: {
          getOrCreate: vi.fn().mockReturnValue(mockActor),
        } as never,
      },
    );
    const caller = createCaller(ctx);

    await expect(
      caller.reconnect({ viewerId: '00000000-0000-0000-0000-000000000002' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
