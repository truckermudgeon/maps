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
  let fakeSource: ReturnType<typeof makeFakeSource>;
  beforeEach(() => {
    vi.useFakeTimers();
    fakeSource = makeFakeSource();
  });

  afterEach(() => {
    vi.useRealTimers();
    fakeSource.end();
  });

  it('yields source events through unchanged when telemetry is flowing', async () => {
    const guarded = withStaleDetection(fakeSource.source, {
      timeoutMs: TIMEOUT_MS,
    });

    fakeSource.push(SPARSE_EVENT);
    fakeSource.push(POSITION_EVENT);

    const r1 = await guarded.next();
    const r2 = await guarded.next();

    expect(r1.value).toBe(SPARSE_EVENT);
    expect(r2.value).toBe(POSITION_EVENT);
  });

  it('emits one staleBinding with phase=at_subscribe after the timeout when no telemetry has arrived', async () => {
    const onStale = vi.fn();
    const guarded = withStaleDetection(fakeSource.source, {
      timeoutMs: TIMEOUT_MS,
      onStale,
    });

    const next = guarded.next();
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    const result = await next;

    expect(result.value).toEqual({ type: 'staleBinding' });
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(onStale).toHaveBeenCalledWith('at_subscribe');
  });

  it('does not re-fire staleBinding within the same stale period', async () => {
    const onStale = vi.fn();
    const guarded = withStaleDetection(fakeSource.source, {
      timeoutMs: TIMEOUT_MS,
      onStale,
    });

    // First staleBinding.
    void guarded.next();
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    expect(onStale).toHaveBeenCalledTimes(1);

    // Time advances; still in the same stale period
    void guarded.next();
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS * 3);
    // onStale hasn't been called again
    expect(onStale).toHaveBeenCalledTimes(1);
  });

  it('fires onResume and re-arms when telemetry returns; next stale fires phase=mid_session', async () => {
    const onStale = vi.fn();
    const onResume = vi.fn();
    const guarded = withStaleDetection(fakeSource.source, {
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
    fakeSource.push(POSITION_EVENT);
    expect((await resumeP).value).toBe(POSITION_EVENT);
    expect(onResume).toHaveBeenCalledTimes(1);

    // Subsequent timeout — phase should be mid_session because we've
    // now seen a positionUpdate.
    const stale2 = guarded.next();
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    expect((await stale2).value).toEqual({ type: 'staleBinding' });
    expect(onStale).toHaveBeenLastCalledWith('mid_session');
    expect(onStale).toHaveBeenCalledTimes(2);
  });

  it('fires onFirstPosition once with the latency from subscribe to first positionUpdate', async () => {
    const onFirstPosition = vi.fn();
    const guarded = withStaleDetection(fakeSource.source, {
      timeoutMs: TIMEOUT_MS,
      onFirstPosition,
    });

    // Start the generator first so subscribedAt is captured at "t=0",
    // then advance fake time before delivering the first positionUpdate.
    const first = guarded.next();
    await vi.advanceTimersByTimeAsync(2_500);
    fakeSource.push(POSITION_EVENT);
    await first;

    expect(onFirstPosition).toHaveBeenCalledTimes(1);
    expect(onFirstPosition).toHaveBeenCalledWith(2_500);

    // A second positionUpdate must NOT trigger another onFirstPosition.
    fakeSource.push(POSITION_EVENT);
    await guarded.next();
    expect(onFirstPosition).toHaveBeenCalledTimes(1);
  });

  it('passes non-positionUpdate events through without firing position callbacks', async () => {
    const onFirstPosition = vi.fn();
    const onResume = vi.fn();
    const guarded = withStaleDetection(fakeSource.source, {
      timeoutMs: TIMEOUT_MS,
      onFirstPosition,
      onResume,
    });

    fakeSource.push(SPARSE_EVENT);
    const r = await guarded.next();
    expect(r.value).toBe(SPARSE_EVENT);
    expect(onFirstPosition).not.toHaveBeenCalled();
    expect(onResume).not.toHaveBeenCalled();
  });

  it('invokes onTick at the start of every internal iteration', async () => {
    const onTick = vi.fn();
    const guarded = withStaleDetection(fakeSource.source, {
      timeoutMs: TIMEOUT_MS,
      onTick,
    });

    // Three iterations: two events drain, one timeout.
    fakeSource.push(SPARSE_EVENT);
    fakeSource.push(POSITION_EVENT);
    await guarded.next();
    expect(onTick.mock.calls.length).toBe(1);
    await guarded.next();
    expect(onTick.mock.calls.length).toBe(2);

    const stale = guarded.next();
    expect(onTick.mock.calls.length).toBe(3);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await stale;
  });
});
