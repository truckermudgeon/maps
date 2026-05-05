import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActorEvent, GameState } from '../../../types';
import { withStaleDetection } from '../with-stale-detection';

const TIMEOUT_MS = 10_000;

const POSITION_EVENT: ActorEvent = {
  type: 'positionUpdate',
  data: {} as GameState,
};

const SPARSE_EVENT: ActorEvent = {
  type: 'jobUpdate',
  data: undefined,
};

/**
 * Controllable fake source generator. push() queues an event; end() ends
 * the generator. Yields synchronously when buffered events exist.
 */
function makeFakeSource() {
  const queue: ActorEvent[] = [];
  let resolveWaiting: (() => void) | null = null;
  let done = false;

  const source = (async function* (): AsyncGenerator<ActorEvent, void, void> {
    while (!done) {
      if (queue.length === 0) {
        await new Promise<void>(r => {
          resolveWaiting = r;
        });
      }
      while (queue.length > 0) {
        yield queue.shift()!;
      }
    }
  })();

  return {
    source,
    push(event: ActorEvent) {
      queue.push(event);
      const r = resolveWaiting;
      resolveWaiting = null;
      r?.();
    },
    end() {
      done = true;
      const r = resolveWaiting;
      resolveWaiting = null;
      r?.();
    },
  };
}

describe('withStaleDetection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('yields source events through unchanged when telemetry is flowing', async () => {
    const fake = makeFakeSource();
    const guarded = withStaleDetection(fake.source, { timeoutMs: TIMEOUT_MS });

    fake.push(SPARSE_EVENT);
    fake.push(POSITION_EVENT);

    const r1 = await guarded.next();
    const r2 = await guarded.next();

    expect(r1.value).toBe(SPARSE_EVENT);
    expect(r2.value).toBe(POSITION_EVENT);

    fake.end();
  });

  it('emits one staleBinding with phase=at_subscribe after the timeout when no telemetry has arrived', async () => {
    const fake = makeFakeSource();
    const onStale = vi.fn();
    const guarded = withStaleDetection(fake.source, {
      timeoutMs: TIMEOUT_MS,
      onStale,
    });

    const next = guarded.next();
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    const result = await next;

    expect(result.value).toEqual({ type: 'staleBinding' });
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(onStale).toHaveBeenCalledWith('at_subscribe');

    fake.end();
  });

  it('does not re-fire staleBinding within the same stale period', async () => {
    const fake = makeFakeSource();
    const onStale = vi.fn();
    const guarded = withStaleDetection(fake.source, {
      timeoutMs: TIMEOUT_MS,
      onStale,
    });

    // First staleBinding.
    const first = guarded.next();
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    expect((await first).value).toEqual({ type: 'staleBinding' });
    expect(onStale).toHaveBeenCalledTimes(1);

    // Hold a pending next() while advancing past several more timeout
    // windows. onStale should not be called again.
    void guarded.next();
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS * 3);
    expect(onStale).toHaveBeenCalledTimes(1);

    fake.end();
  });

  it('fires onResume and re-arms when telemetry returns; next stale fires phase=mid_session', async () => {
    const fake = makeFakeSource();
    const onStale = vi.fn();
    const onResume = vi.fn();
    const guarded = withStaleDetection(fake.source, {
      timeoutMs: TIMEOUT_MS,
      onStale,
      onResume,
    });

    // at_subscribe stale.
    const stale1 = guarded.next();
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    expect((await stale1).value).toEqual({ type: 'staleBinding' });

    // Resume.
    const resumeP = guarded.next();
    fake.push(POSITION_EVENT);
    expect((await resumeP).value).toBe(POSITION_EVENT);
    expect(onResume).toHaveBeenCalledTimes(1);

    // Subsequent timeout — phase should be mid_session because we've
    // now seen a positionUpdate.
    const stale2 = guarded.next();
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    expect((await stale2).value).toEqual({ type: 'staleBinding' });
    expect(onStale).toHaveBeenLastCalledWith('mid_session');
    expect(onStale).toHaveBeenCalledTimes(2);

    fake.end();
  });

  it('fires onFirstPosition once with the latency from subscribe to first positionUpdate', async () => {
    const fake = makeFakeSource();
    const onFirstPosition = vi.fn();
    const guarded = withStaleDetection(fake.source, {
      timeoutMs: TIMEOUT_MS,
      onFirstPosition,
    });

    // Start the generator first so subscribedAt is captured at "t=0",
    // then advance fake time before delivering the first positionUpdate.
    const first = guarded.next();
    await vi.advanceTimersByTimeAsync(2_500);
    fake.push(POSITION_EVENT);
    await first;

    expect(onFirstPosition).toHaveBeenCalledTimes(1);
    expect(onFirstPosition).toHaveBeenCalledWith(2_500);

    // A second positionUpdate must NOT trigger another onFirstPosition.
    fake.push(POSITION_EVENT);
    await guarded.next();
    expect(onFirstPosition).toHaveBeenCalledTimes(1);

    fake.end();
  });

  it('passes non-positionUpdate events through without firing position callbacks', async () => {
    const fake = makeFakeSource();
    const onFirstPosition = vi.fn();
    const onResume = vi.fn();
    const guarded = withStaleDetection(fake.source, {
      timeoutMs: TIMEOUT_MS,
      onFirstPosition,
      onResume,
    });

    fake.push(SPARSE_EVENT);
    const r = await guarded.next();
    expect(r.value).toBe(SPARSE_EVENT);
    expect(onFirstPosition).not.toHaveBeenCalled();
    expect(onResume).not.toHaveBeenCalled();

    fake.end();
  });

  it('invokes onTick at the start of every internal iteration', async () => {
    const fake = makeFakeSource();
    const onTick = vi.fn();
    const guarded = withStaleDetection(fake.source, {
      timeoutMs: TIMEOUT_MS,
      onTick,
    });

    // Three iterations: two events drain, one timeout.
    fake.push(SPARSE_EVENT);
    fake.push(POSITION_EVENT);
    await guarded.next();
    await guarded.next();

    const stale = guarded.next();
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await stale;

    expect(onTick.mock.calls.length).toBeGreaterThanOrEqual(3);

    fake.end();
  });
});
