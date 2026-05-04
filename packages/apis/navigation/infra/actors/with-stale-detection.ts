import type { ActorEvent } from '../../types';

export type StaleBindingPhase = 'at_subscribe' | 'mid_session';

export interface WithStaleDetectionOpts {
  /**
   * The window after the last positionUpdate (or subscribe time) before the
   * binding is considered stale. On expiration, a single staleBinding event
   * is yielded; subsequent expirations within the same stale period are
   * suppressed until telemetry resumes.
   */
  timeoutMs: number;

  /** Defaults to Date.now; override for deterministic tests. */
  now?: () => number;

  /**
   * Fires at the top of every internal iteration. Use for keep-alive side
   * effects (e.g. touching the SessionActor so the registry doesn't sweep
   * it while a webapp is still watching for resume).
   */
  onTick?: () => void;

  /** Fires when the staleBinding flag flips false → true. */
  onStale?: (phase: StaleBindingPhase) => void;

  /** Fires on the first positionUpdate ever observed. */
  onFirstPosition?: (latencyMs: number) => void;

  /** Fires when a positionUpdate arrives while the binding is stale. */
  onResume?: () => void;
}

/**
 * Wraps an ActorEvent producer with staleBinding detection.
 *
 * - Races each source.next() against a timer; on expiration without a yield
 *   from the source, emits one `{ type: 'staleBinding' }` event downstream.
 * - Suppresses repeat staleBinding emissions within a single stale period;
 *   re-arms the next staleBinding only after telemetry resumes.
 * - Reports lifecycle moments (stale, resume, first position) via callbacks
 *   so the caller can attach metrics/logging without participating in the
 *   state machine.
 *
 * Holds a single in-flight source.next() across iterations: if a timeout
 * wins the race, the pending promise must survive into the next iteration.
 * Calling source.next() again would queue a second request on the async
 * generator, and the next yield would satisfy the abandoned promise (FIFO)
 * instead of the one currently awaited.
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
      // `pending` is intentionally preserved across iterations.
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
