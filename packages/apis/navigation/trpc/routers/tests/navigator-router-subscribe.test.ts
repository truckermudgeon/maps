/* eslint-disable @typescript-eslint/unbound-method */
import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthState } from '../../../domain/auth/auth-state';
import type { SessionActor } from '../../../domain/session-actor';
import type { ActorEvent, TruckSimTelemetry } from '../../../types';
import { createCallerFactory } from '../../init';
import { navigatorRouter } from '../navigator-router';
import {
  MockKvStore,
  MockMetricsService,
  MockSessionActorRegistry,
  mockNavigatorContext,
} from './mocks';

const createCaller = createCallerFactory(navigatorRouter);

const STALE_TIMEOUT_MS = 10_000;

// Subscribe-time sparse events queued by subscribeSession before any
// positionUpdate or stateful waiting. These show up in every fresh
// subscription regardless of whether telemetry is flowing. We don't
// assert them by content — we just need to drain them to reach the
// state where the loop is waiting on a position/timeout.
const SPARSE_PREAMBLE_COUNT = 4; // themeMode, jobUpdate, trailerUpdate, routeUpdate

// Minimal TruckSimTelemetry shape that satisfies the fields toGameState
// destructures. The values are placeholders — these tests only assert on
// event types, not data payloads.
const FAKE_TELEMETRY = {
  game: {
    paused: false,
    timestamp: { value: 0 },
    scale: 1,
    game: { name: 'ats' as const },
  },
  truck: {
    position: { X: 0, Y: 0, Z: 0 },
    orientation: { heading: 0 },
    speed: { value: 0 },
    acceleration: {
      linearAcceleration: { X: 0, Y: 0, Z: 0 },
      angularVelocity: { X: 0, Y: 0, Z: 0 },
      angularAcceleration: { X: 0, Y: 0, Z: 0 },
    },
  },
  navigation: {
    speedLimit: { mph: 0, kph: 0 },
  },
} as unknown as TruckSimTelemetry;

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
    pushTelemetry: () => latestTelemetry.update(FAKE_TELEMETRY),
    seedCache: () => latestTelemetry.update(FAKE_TELEMETRY),
  };
}

function setupCaller(actor: SessionActor) {
  const metrics = new MockMetricsService();
  const caller = createCaller(
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
        metrics,
      },
    }),
  );
  return { caller, metrics };
}

async function drainSparsePreamble(iter: AsyncIterator<ActorEvent>) {
  const events: ActorEvent[] = [];
  for (let i = 0; i < SPARSE_PREAMBLE_COUNT; i++) {
    const r = await iter.next();
    if (r.done) break;
    events.push(r.value);
  }
  return events;
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
    const { caller } = setupCaller(fake.actor);

    const sub = await caller.subscribeToDevice();
    const iter = sub[Symbol.asyncIterator]() as AsyncIterator<ActorEvent>;

    const drained = await drainSparsePreamble(iter);
    expect(drained.map(e => e.type)).not.toContain('positionUpdate');

    await iter.return?.();
  });

  it('emits staleBinding once with phase=at_subscribe after timeout', async () => {
    const fake = makeFakeActor();
    const { caller, metrics } = setupCaller(fake.actor);

    const sub = await caller.subscribeToDevice();
    const iter = sub[Symbol.asyncIterator]() as AsyncIterator<ActorEvent>;

    await drainSparsePreamble(iter);

    const nextPromise = iter.next();
    await vi.advanceTimersByTimeAsync(STALE_TIMEOUT_MS);
    const result = await nextPromise;

    expect(result.value).toEqual({ type: 'staleBinding' });
    expect(metrics.session.staleBindingEvents.inc).toHaveBeenCalledWith({
      phase: 'at_subscribe',
    });
    expect(metrics.session.staleBindingEvents.inc).toHaveBeenCalledTimes(1);

    await iter.return?.();
  });

  it('does not re-fire staleBinding within the stale window', async () => {
    const fake = makeFakeActor();
    const { caller, metrics } = setupCaller(fake.actor);

    const sub = await caller.subscribeToDevice();
    const iter = sub[Symbol.asyncIterator]() as AsyncIterator<ActorEvent>;

    await drainSparsePreamble(iter);

    // First staleBinding.
    const firstStalePromise = iter.next();
    await vi.advanceTimersByTimeAsync(STALE_TIMEOUT_MS);
    expect((await firstStalePromise).value).toEqual({ type: 'staleBinding' });

    // Hold a pending next() while advancing well past another stale
    // window. The metric should not have been incremented again.
    const watching = iter.next();
    await vi.advanceTimersByTimeAsync(STALE_TIMEOUT_MS * 3);
    await flushMicrotasks();
    expect(metrics.session.staleBindingEvents.inc).toHaveBeenCalledTimes(1);

    // Resume telemetry to satisfy the pending iter.next() and let the
    // generator unwind cleanly.
    fake.pushTelemetry();
    await watching;
  });

  it('clears stale flag and re-arms when telemetry resumes', async () => {
    const fake = makeFakeActor();
    const { caller, metrics } = setupCaller(fake.actor);

    const sub = await caller.subscribeToDevice();
    const iter = sub[Symbol.asyncIterator]() as AsyncIterator<ActorEvent>;

    await drainSparsePreamble(iter);

    // Trigger at_subscribe staleBinding.
    const staleP1 = iter.next();
    await vi.advanceTimersByTimeAsync(STALE_TIMEOUT_MS);
    expect((await staleP1).value).toEqual({ type: 'staleBinding' });

    // Push telemetry → should yield a positionUpdate, increment resumed,
    // and observe time_to_first_position_update_ms.
    const resumeP = iter.next();
    fake.pushTelemetry();
    const resume = await resumeP;
    expect(resume.value).toMatchObject({ type: 'positionUpdate' });
    expect(metrics.session.staleBindingResumed.inc).toHaveBeenCalledTimes(1);
    expect(
      metrics.session.timeToFirstPositionUpdate.observe,
    ).toHaveBeenCalledTimes(1);

    // Stop telemetry; advance another 10s. The next staleBinding should fire
    // with phase=mid_session because hasSeenFirstPosition is now true.
    const staleP2 = iter.next();
    await vi.advanceTimersByTimeAsync(STALE_TIMEOUT_MS);
    expect((await staleP2).value).toEqual({ type: 'staleBinding' });
    expect(metrics.session.staleBindingEvents.inc).toHaveBeenLastCalledWith({
      phase: 'mid_session',
    });
    expect(metrics.session.staleBindingEvents.inc).toHaveBeenCalledTimes(2);

    await iter.return?.();
  });

  it('observes time_to_first_position_update_ms only once', async () => {
    const fake = makeFakeActor();
    const { caller, metrics } = setupCaller(fake.actor);

    const sub = await caller.subscribeToDevice();
    const iter = sub[Symbol.asyncIterator]() as AsyncIterator<ActorEvent>;

    await drainSparsePreamble(iter);

    // First positionUpdate.
    const p1 = iter.next();
    fake.pushTelemetry();
    await p1;

    // Second positionUpdate — histogram should NOT observe again.
    const p2 = iter.next();
    fake.pushTelemetry();
    await p2;

    expect(
      metrics.session.timeToFirstPositionUpdate.observe,
    ).toHaveBeenCalledTimes(1);

    await iter.return?.();
  });
});

async function flushMicrotasks() {
  // A few ticks let any pending generator microtasks settle. Each await
  // here gives one round of the microtask queue.
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}
