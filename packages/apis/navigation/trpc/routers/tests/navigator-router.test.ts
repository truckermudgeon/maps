import { describe, expect, it, vi } from 'vitest';
import { AuthState } from '../../../domain/auth/auth-state';
import type { SessionActorRegistry } from '../../../infra/actors/registry';
import { createCallerFactory } from '../../init';
import { navigatorRouter } from '../navigator-router';
import {
  MockKvStore,
  MockSessionActorRegistry,
  mockNavigatorContext,
} from './mocks';

const createCaller = createCallerFactory(navigatorRouter);

describe('navigator redeemCode', () => {
  it('throws NOT_FOUND when pairing code is unknown', async () => {
    const caller = createCaller(mockNavigatorContext());

    await expect(caller.redeemCode({ code: 'AAAA' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws CONFLICT when too many clients are already connected', async () => {
    const mockActor = { attachClient: vi.fn().mockReturnValue(false) };
    const caller = createCaller(
      mockNavigatorContext({
        services: {
          kv: new MockKvStore({
            get: vi.fn().mockImplementation(key =>
              String(key).startsWith('pairing:')
                ? Promise.resolve({
                    telemetryId: 'telemetry-123',
                    redeemed: false,
                    cleanupOnRedemption: true,
                  })
                : Promise.resolve(undefined),
            ),
          }),
          sessionActors: new MockSessionActorRegistry({
            getOrCreate: vi.fn().mockReturnValue(mockActor),
          }) as unknown as SessionActorRegistry,
        },
      }),
    );

    await expect(caller.redeemCode({ code: 'AAAA' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('returns viewerId and telemetryId on success', async () => {
    const telemetryId = 'telemetry-abc';
    const mockActor = { attachClient: vi.fn().mockReturnValue(true) };
    const caller = createCaller(
      mockNavigatorContext({
        services: {
          kv: new MockKvStore({
            get: vi.fn().mockImplementation(key =>
              String(key).startsWith('pairing:')
                ? Promise.resolve({
                    telemetryId,
                    redeemed: false,
                    cleanupOnRedemption: true,
                  })
                : Promise.resolve(undefined),
            ),
          }),
          sessionActors: new MockSessionActorRegistry({
            getOrCreate: vi.fn().mockReturnValue(mockActor),
          }) as unknown as SessionActorRegistry,
        },
      }),
    );

    const result = await caller.redeemCode({ code: 'AAAA' });

    expect(result.telemetryId).toBe(telemetryId);
    expect(result.viewerId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe('navigator reconnect', () => {
  it('returns true immediately when already authenticated', async () => {
    const caller = createCaller(
      mockNavigatorContext({
        auth: {
          state: AuthState.VIEWER_AUTHENTICATED,
          viewerId: 'existing-viewer',
        },
      }),
    );

    const result = await caller.reconnect({
      viewerId: '00000000-0000-0000-0000-000000000000',
    });

    expect(result).toBe(true);
  });

  it('returns false when viewerId is not found in KV', async () => {
    const caller = createCaller(mockNavigatorContext());

    const result = await caller.reconnect({
      viewerId: '00000000-0000-0000-0000-000000000001',
    });

    expect(result).toBe(false);
  });

  it('throws CONFLICT when too many clients are already connected', async () => {
    const mockActor = { attachClient: vi.fn().mockReturnValue(false) };
    const caller = createCaller(
      mockNavigatorContext({
        services: {
          kv: new MockKvStore({
            get: vi
              .fn()
              .mockImplementation(key =>
                String(key).startsWith('viewerId:')
                  ? Promise.resolve('telemetry-xyz')
                  : Promise.resolve(undefined),
              ),
          }),
          sessionActors: new MockSessionActorRegistry({
            getOrCreate: vi.fn().mockReturnValue(mockActor),
          }) as unknown as SessionActorRegistry,
        },
      }),
    );

    await expect(
      caller.reconnect({ viewerId: '00000000-0000-0000-0000-000000000002' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
