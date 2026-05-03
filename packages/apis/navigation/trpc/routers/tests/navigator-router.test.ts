import { describe, expect, it, vi } from 'vitest';
import { AuthState } from '../../../domain/auth/auth-state';
import { createCallerFactory } from '../../init';
import { navigatorRouter } from '../navigator-router';
import {
  MockKvStore,
  MockSessionActorRegistry,
  mockNavigatorContext,
} from './mocks';

const createCaller = createCallerFactory(navigatorRouter);

describe('navigatorRouter', () => {
  describe('redeemCode', () => {
    it('throws NOT_FOUND when pairing code is unknown', async () => {
      const caller = createCaller(mockNavigatorContext());

      await expect(caller.redeemCode({ code: 'AAAA' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('throws CONFLICT when the actor for the redeemed code is at capacity', async () => {
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
            }),
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
            }),
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

  describe('reconnect', () => {
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

    it('throws CONFLICT when the actor for the viewerId is at capacity', async () => {
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
              // liveness probe needs at least one signal to pass
              has: vi
                .fn()
                .mockImplementation(key =>
                  Promise.resolve(String(key).startsWith('publicKey:')),
                ),
            }),
            sessionActors: new MockSessionActorRegistry({
              getOrCreate: vi.fn().mockReturnValue(mockActor),
            }),
          },
        }),
      );

      await expect(
        caller.reconnect({ viewerId: '00000000-0000-0000-0000-000000000002' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    describe('liveness probe', () => {
      function setup(opts: {
        hasPublicKey: boolean;
        hasRecentTelemetry: boolean;
      }) {
        const kvDelete = vi.fn().mockResolvedValue(undefined);
        const mockActor = { attachClient: vi.fn().mockReturnValue(true) };
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
                has: vi.fn().mockImplementation(key => {
                  const k = String(key);
                  if (k.startsWith('publicKey:'))
                    return Promise.resolve(opts.hasPublicKey);
                  if (k.startsWith('telemetry:'))
                    return Promise.resolve(opts.hasRecentTelemetry);
                  return Promise.resolve(false);
                }),
                delete: kvDelete,
              }),
              sessionActors: new MockSessionActorRegistry({
                getOrCreate: vi.fn().mockReturnValue(mockActor),
              }),
            },
          }),
        );
        return { caller, kvDelete, mockActor };
      }

      it.each([
        {
          name: 'publicKey present',
          hasPublicKey: true,
          hasRecentTelemetry: false,
        },
        {
          name: 'recent telemetry present',
          hasPublicKey: false,
          hasRecentTelemetry: true,
        },
        {
          name: 'both signals present',
          hasPublicKey: true,
          hasRecentTelemetry: true,
        },
      ])(
        'returns true and attaches when binding is live ($name)',
        async ({ hasPublicKey, hasRecentTelemetry }) => {
          const { caller, kvDelete, mockActor } = setup({
            hasPublicKey,
            hasRecentTelemetry,
          });

          const result = await caller.reconnect({
            viewerId: '00000000-0000-0000-0000-000000000003',
          });

          expect(result).toBe(true);
          expect(mockActor.attachClient).toHaveBeenCalledTimes(1);
          expect(kvDelete).not.toHaveBeenCalled();
        },
      );

      it('returns false and clears viewerId mapping when binding is stale', async () => {
        const { caller, kvDelete, mockActor } = setup({
          hasPublicKey: false,
          hasRecentTelemetry: false,
        });

        const result = await caller.reconnect({
          viewerId: '00000000-0000-0000-0000-000000000004',
        });

        expect(result).toBe(false);
        expect(mockActor.attachClient).not.toHaveBeenCalled();
        expect(kvDelete).toHaveBeenCalledWith(
          'viewerId:00000000-0000-0000-0000-000000000004',
        );
      });
    });
  });
});
