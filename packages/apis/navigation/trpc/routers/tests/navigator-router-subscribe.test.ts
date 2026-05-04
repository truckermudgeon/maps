import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { staleBindingTimeoutMs } from '../../../constants';
import { aTelemetryWith } from '../../../domain/actor/tests/builders';
import { AuthState } from '../../../domain/auth/auth-state';
import type { SessionActor } from '../../../domain/session-actor';
import type { ActorEvent, TruckSimTelemetry } from '../../../types';
import { createCallerFactory } from '../../init';
import { navigatorRouter } from '../navigator-router';
import {
  MockKvStore,
  MockSessionActorRegistry,
  mockNavigatorContext,
} from './mocks';

// Integration-level coverage for subscribeToDevice. The staleBinding
// state machine itself is exercised in withStaleDetection's unit tests;
// what's verified here is the integration with subscribeSession — in
// particular, that subscribeSession does NOT yield the actor's cached
// last-known telemetry on subscribe (regression for 9c3bb3d1).

const createCaller = createCallerFactory(navigatorRouter);

function makeFakeActor() {
  const subs = new Set<() => void>();
  let value: TruckSimTelemetry | undefined;
  const latestTelemetry = {
    subscribe: (cb: () => void) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    get: () => value,
    update: (v: TruckSimTelemetry | undefined) => {
      value = v;
      for (const s of subs) s();
    },
    dispose: () => subs.clear(),
  };

  const actor = {
    code: 'fake-actor',
    gameContext: undefined,
    routeEventEmitter: new EventEmitter(),
    jobEventEmitter: new EventEmitter(),
    mapEventEmitter: new EventEmitter(),
    trailerEventEmitter: new EventEmitter(),
    themeModeEventEmitter: new EventEmitter(),
    getLatestTelemetry: () => latestTelemetry,
    readActiveRoute: () => undefined,
    readJobState: () => undefined,
    readMapState: () => 'usa',
    readRouteIndex: () => undefined,
    readTelemetry: () => value,
    readTrailerState: () => undefined,
    readThemeMode: () => 'light',
    attachClient: () => true,
    detachClient: () => undefined,
    attachedClientIds: new Set<string>(),
  } as unknown as SessionActor;

  return {
    actor,
    seedCache: () => latestTelemetry.update(aTelemetryWith({})),
  };
}

function setupCaller(actor: SessionActor) {
  return createCaller(
    mockNavigatorContext({
      auth: {
        state: AuthState.VIEWER_AUTHENTICATED,
        viewerId: '00000000-0000-0000-0000-000000000000',
      },
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
          get: vi.fn().mockReturnValue(actor),
          getOrCreate: vi.fn().mockReturnValue(actor),
        }),
      },
    }),
  );
}

describe('navigatorRouter > subscribeToDevice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not yield positionUpdate from cached telemetry at subscribe time', async () => {
    const fake = makeFakeActor();
    fake.seedCache();
    const caller = setupCaller(fake.actor);

    const sub = await caller.subscribeToDevice();
    const iter = sub[Symbol.asyncIterator]() as AsyncIterator<ActorEvent>;

    // With no live telemetry, the only event that ever yields after
    // subscribeSession's preamble is staleBinding. Drain until we see it,
    // then assert the seeded cache never surfaced as a positionUpdate
    // along the way.
    const seen: ActorEvent[] = [];
    while (true) {
      const next = iter.next();
      await vi.advanceTimersByTimeAsync(staleBindingTimeoutMs);
      const r = await next;
      if (r.done) break;
      seen.push(r.value);
      if (r.value.type === 'staleBinding') break;
    }

    expect(seen.map(e => e.type)).not.toContain('positionUpdate');
    expect(seen.at(-1)?.type).toBe('staleBinding');

    await iter.return?.();
  });
});
