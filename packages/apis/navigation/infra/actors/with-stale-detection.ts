import type { ActorEvent } from '../../types';

export type StaleBindingPhase = 'at_subscribe' | 'mid_session';

export interface WithStaleDetectionOpts {
  /** Window after the last source event before staleBinding is yielded. */
  timeoutMs: number;

  /** Defaults to Date.now; override for deterministic tests. */
  now?: () => number;

  /** Periodic hook for keep-alive side effects while the wrapper runs. */
  onTick?: () => void;

  /** Fires when the staleBinding flag flips false → true. */
  onStale?: (phase: StaleBindingPhase) => void;

  /** Fires on the first positionUpdate ever observed. */
  onFirstPosition?: (latencyMs: number) => void;

  /** Fires when a positionUpdate arrives while the binding is stale. */
  onResume?: () => void;
}

/**
 * Wraps a source AsyncGenerator with a stale-detection timer: yields a
 * `staleBinding` event if `timeoutMs` elapses without a source event.
 * Suppressed within a single stale period; re-arms after the next event.
 *
 * Lifecycle callbacks (`onStale`, `onResume`, `onFirstPosition`, `onTick`)
 * let callers attach metrics or keep-alive side effects without sharing
 * the state machine.
 */
export async function* withStaleDetection(
  source: AsyncGenerator<ActorEvent, void, void>,
  opts: WithStaleDetectionOpts,
): AsyncGenerator<ActorEvent, void, void> {
  const now = opts.now ?? Date.now;
  const subscribedAt = now();
  let lastPositionAt = subscribedAt;
  let stale = false;
  let hasSeenFirstPosition = false;
  // Single in-flight source.next() across iterations: async generators
  // satisfy queued .next() calls FIFO, so calling next() again after a
  // timeout would orphan the next yielded event onto an abandoned promise.
  let pending: ReturnType<typeof source.next> | undefined;

  while (true) {
    opts.onTick?.();

    const remaining = Math.max(0, opts.timeoutMs - (now() - lastPositionAt));
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<'timeout'>(resolve => {
      timeoutId = setTimeout(() => resolve('timeout'), remaining);
    });

    pending ??= source.next();
    let res: 'timeout' | Awaited<ReturnType<typeof source.next>>;
    try {
      res = await Promise.race([pending, timedOut]);
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }

    if (res === 'timeout') {
      if (!stale) {
        const phase: StaleBindingPhase = hasSeenFirstPosition
          ? 'mid_session'
          : 'at_subscribe';
        opts.onStale?.(phase);
        yield { type: 'staleBinding' };
        stale = true;
      }
      // Re-arm so we don't busy-loop while waiting for telemetry to resume.
      lastPositionAt = now();
      continue;
    }

    pending = undefined;
    if (res.done) {
      break;
    }

    const event = res.value;
    if (event.type === 'positionUpdate') {
      const t = now();
      lastPositionAt = t;
      if (!hasSeenFirstPosition) {
        hasSeenFirstPosition = true;
        opts.onFirstPosition?.(t - subscribedAt);
      }
      if (stale) {
        opts.onResume?.();
        stale = false;
      }
    }
    yield event;
  }
}
