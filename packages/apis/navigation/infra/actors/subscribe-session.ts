import { assertExists } from '@truckermudgeon/base/assert';
import { toGameState } from '../../domain/actor/game-state';
import { toSegmentInfo } from '../../domain/actor/segment-info';
import type { LookupService } from '../../domain/lookup-data';
import type { SessionActor } from '../../domain/session-actor';
import type {
  ActorEvent,
  JobState,
  Route,
  RouteIndex,
  SegmentInfo,
  TrailerState,
} from '../../types';

export function subscribeSession(
  actor: SessionActor,
  signal: AbortSignal | undefined,
  lookups: LookupService,
): {
  generator: AsyncGenerator<ActorEvent, void, void>;
  unsubscribe: () => void;
} {
  const queue: Exclude<ActorEvent, ActorEvent & { type: 'positionUpdate' }>[] =
    [];
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
    // TODO calculation of segmentInfo better done as part of emitting
    //  segment-complete event?
    const gameContext = actor.gameContext;
    const activeRoute = assertExists(
      actor.readActiveRoute(),
      'A route must be active to complete a segment',
    );
    let segmentInfo: SegmentInfo;
    if (gameContext) {
      segmentInfo = toSegmentInfo(
        index,
        activeRoute,
        lookups.getData(gameContext).graphAndMapData.tsMapData,
      );
    } else {
      segmentInfo = {
        place: 'Your location',
        placeInfo: '',
        isFinal: index + 1 === activeRoute.segments.length,
      };
    }

    queue.push({
      type: 'segmentComplete',
      data: segmentInfo,
    });
    resolve?.();
    resolve = null;
  };

  const onJobUpdate = (data: JobState | undefined) => {
    queue.push({ type: 'jobUpdate', data });
    resolve?.();
    resolve = null;
  };

  const onMapUpdate = (data: 'usa' | 'europe') => {
    queue.push({ type: 'mapUpdate', data });
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

  // Starts clean: yielding the actor's cached telemetry on subscribe would
  // mask a dead device by satisfying the staleBinding timer with stale data
  // from a prior session.
  let stateDirty = false;
  const offLatest = actor.getLatestTelemetry().subscribe(() => {
    stateDirty = true;
    resolve?.();
    resolve = null;
  });

  const unsubscribe = () => {
    console.log('actor unsubscribe');
    actor.routeEventEmitter.off('update', onRouteUpdate);
    actor.routeEventEmitter.off('progress', onRouteProgress);
    actor.routeEventEmitter.off('segmentComplete', onSegmentComplete);
    actor.jobEventEmitter.off('update', onJobUpdate);
    actor.mapEventEmitter.off('update', onMapUpdate);
    actor.trailerEventEmitter.off('update', onTrailerUpdate);
    actor.themeModeEventEmitter.off('update', onThemeModeUpdate);
    offLatest();
  };

  const generator = async function* (): AsyncGenerator<ActorEvent, void, void> {
    actor.routeEventEmitter.on('update', onRouteUpdate);
    actor.routeEventEmitter.on('progress', onRouteProgress);
    actor.routeEventEmitter.on('segmentComplete', onSegmentComplete);
    actor.jobEventEmitter.on('update', onJobUpdate);
    actor.mapEventEmitter.on('update', onMapUpdate);
    actor.trailerEventEmitter.on('update', onTrailerUpdate);
    actor.themeModeEventEmitter.on('update', onThemeModeUpdate);

    console.log(
      'actor subscriptions',
      actor.routeEventEmitter.listeners.length,
    );

    // eagerly queue up certain states, so clients connecting mid-session see
    // the current "snapshot" of things, without having to wait for state-
    // changes to take effect

    queue.push({ type: 'themeModeUpdate', data: actor.readThemeMode() });
    queue.push({ type: 'jobUpdate', data: actor.readJobState() });
    queue.push({ type: 'trailerUpdate', data: actor.readTrailerState() });
    if (actor.gameContext != null) {
      queue.push({ type: 'mapUpdate', data: actor.gameContext.map });
    }

    const rwl = actor.readActiveRoute();
    if (rwl == null) {
      queue.push({ type: 'routeUpdate', data: undefined });
    } else {
      const { lookup, ...route } = rwl;
      queue.push({ type: 'routeUpdate', data: route });
      queue.push({ type: 'routeProgress', data: actor.readRouteIndex() });
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
  };

  return {
    unsubscribe,
    generator: generator(),
  };
}
