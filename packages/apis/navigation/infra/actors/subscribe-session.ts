import { assertExists } from '@truckermudgeon/base/assert';
import { toGameState } from '../../domain/actor/game-state';
import { toSegmentInfo } from '../../domain/actor/segment-info';
import type { GraphMappedData } from '../../domain/lookup-data';
import type { SessionActor } from '../../domain/session-actor';
import type {
  ActorEvent,
  JobState,
  Route,
  RouteIndex,
  TrailerState,
} from '../../types';

export function subscribeSession(
  actor: SessionActor,
  signal: AbortSignal | undefined,
  tsMapData: GraphMappedData,
) {
  return async function* (): AsyncGenerator<ActorEvent, void, void> {
    const queue: Exclude<
      ActorEvent,
      ActorEvent & { type: 'positionUpdate' }
    >[] = [];
    let resolve: (() => void) | null = null;

    // derived events (buffered)
    // TODO do these need to be buffered? are latest-values enough?

    const onRouteUpdate = (data: Route | undefined) => {
      queue.push({ type: 'routeUpdate', data });
      resolve?.();
      resolve = null;
    };

    const onRouteProgress = (data: RouteIndex | undefined) => {
      queue.push({ type: 'routeProgress', data });
      resolve?.();
      resolve = null;
    };

    const onSegmentComplete = (index: number) => {
      queue.push({
        type: 'segmentComplete',
        // TODO this shouldn't live here.
        data: toSegmentInfo(
          index,
          assertExists(actor.readActiveRoute()),
          tsMapData,
        ),
      });
      resolve?.();
      resolve = null;
    };

    const onJobUpdate = (data: JobState | undefined) => {
      queue.push({ type: 'jobUpdate', data });
      resolve?.();
      resolve = null;
    };

    const onTrailerUpdate = (data: TrailerState | undefined) => {
      queue.push({ type: 'trailerUpdate', data });
      resolve?.();
      resolve = null;
    };

    const onThemeModeUpdate = (data: 'light' | 'dark') => {
      queue.push({ type: 'themeModeUpdate', data });
      resolve?.();
      resolve = null;
    };

    actor.routeEventEmitter.on('update', onRouteUpdate);
    actor.routeEventEmitter.on('progress', onRouteProgress);
    actor.routeEventEmitter.on('segmentComplete', onSegmentComplete);
    actor.jobEventEmitter.on('update', onJobUpdate);
    actor.trailerEventEmitter.on('update', onTrailerUpdate);
    actor.themeModeEventEmitter.on('update', onThemeModeUpdate);

    // hot state (latest only)
    let stateDirty = true;
    const offLatest = actor.getLatestTelemetry().subscribe(() => {
      stateDirty = true;
      resolve?.();
      resolve = null;
    });

    try {
      // eagerly queue up certain states, so clients connecting mid-session see
      // the current "snapshot" of things, without having to wait for state-
      // changes to take effect

      queue.push({ type: 'themeModeUpdate', data: actor.readThemeMode() });
      queue.push({ type: 'jobUpdate', data: actor.readJobState() });
      queue.push({ type: 'trailerUpdate', data: actor.readTrailerState() });

      const rwl = actor.readActiveRoute();
      if (rwl == null) {
        queue.push({ type: 'routeUpdate', data: undefined });
      } else {
        const { lookup, ...route } = rwl;
        queue.push({ type: 'routeUpdate', data: route });
      }

      while (!signal?.aborted) {
        if (queue.length === 0 && !stateDirty) {
          await new Promise<void>(r => (resolve = r));
        }

        // always emit latest telemetry first if updated
        if (stateDirty) {
          stateDirty = false;
          const telemetry = actor.getLatestTelemetry().get();
          if (telemetry) {
            yield { type: 'positionUpdate', data: toGameState(telemetry) };
          }
        }

        // then drain sparse events
        while (queue.length) {
          yield queue.shift()!;
        }
      }
    } finally {
      actor.routeEventEmitter.off('update', onRouteUpdate);
      actor.routeEventEmitter.off('progress', onRouteProgress);
      actor.routeEventEmitter.off('segmentComplete', onSegmentComplete);
      actor.jobEventEmitter.off('update', onJobUpdate);
      actor.trailerEventEmitter.off('update', onTrailerUpdate);
      actor.themeModeEventEmitter.off('update', onThemeModeUpdate);
      offLatest();
    }
  };
}
