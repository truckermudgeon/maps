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
  const sparseEventQueue: Exclude<
    ActorEvent,
    ActorEvent & { type: 'positionUpdate' }
  >[] = [];
  let wake: (() => void) | null = null;

  const onRouteUpdate = (data: Route | undefined) => {
    sparseEventQueue.push({ type: 'routeUpdate', data });
    wake?.();
    wake = null;
  };

  const onRouteProgress = (data: RouteIndex | undefined) => {
    sparseEventQueue.push({ type: 'routeProgress', data });
    wake?.();
    wake = null;
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

    sparseEventQueue.push({
      type: 'segmentComplete',
      data: segmentInfo,
    });
    wake?.();
    wake = null;
  };

  const onJobUpdate = (data: JobState | undefined) => {
    sparseEventQueue.push({ type: 'jobUpdate', data });
    wake?.();
    wake = null;
  };

  const onMapUpdate = (data: 'usa' | 'europe') => {
    sparseEventQueue.push({ type: 'mapUpdate', data });
    wake?.();
    wake = null;
  };

  const onTrailerUpdate = (data: TrailerState | undefined) => {
    sparseEventQueue.push({ type: 'trailerUpdate', data });
    wake?.();
    wake = null;
  };

  const onThemeModeUpdate = (data: 'light' | 'dark') => {
    sparseEventQueue.push({ type: 'themeModeUpdate', data });
    wake?.();
    wake = null;
  };

  let hasTelemetry = false;
  const offLatest = actor.getLatestTelemetry().subscribe(() => {
    hasTelemetry = true;
    wake?.();
    wake = null;
  });

  const onAbort = () => {
    wake?.();
    wake = null;
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  const unsubscribe = () => {
    console.log('actor unsubscribe');
    actor.routeEventEmitter.off('update', onRouteUpdate);
    actor.routeEventEmitter.off('progress', onRouteProgress);
    actor.routeEventEmitter.off('segmentComplete', onSegmentComplete);
    actor.jobEventEmitter.off('update', onJobUpdate);
    actor.mapEventEmitter.off('update', onMapUpdate);
    actor.trailerEventEmitter.off('update', onTrailerUpdate);
    actor.themeModeEventEmitter.off('update', onThemeModeUpdate);
    signal?.removeEventListener('abort', onAbort);
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

    // eagerly queue up certain states, so clients connecting mid-session see
    // the current "snapshot" of things, without having to wait for state-
    // changes to take effect

    sparseEventQueue.push({
      type: 'themeModeUpdate',
      data: actor.readThemeMode(),
    });
    sparseEventQueue.push({ type: 'jobUpdate', data: actor.readJobState() });
    sparseEventQueue.push({
      type: 'trailerUpdate',
      data: actor.readTrailerState(),
    });
    if (actor.gameContext != null) {
      sparseEventQueue.push({ type: 'mapUpdate', data: actor.gameContext.map });
    }

    const rwl = actor.readActiveRoute();
    if (rwl == null) {
      sparseEventQueue.push({ type: 'routeUpdate', data: undefined });
    } else {
      const { lookup, ...route } = rwl;
      sparseEventQueue.push({ type: 'routeUpdate', data: route });
      sparseEventQueue.push({
        type: 'routeProgress',
        data: actor.readRouteIndex(),
      });
    }

    while (!signal?.aborted) {
      if (sparseEventQueue.length === 0 && !hasTelemetry) {
        // If there's no data from sparse events or from telemetry, then sleep
        // until `wake` is called from:
        // - telemetry data being received
        // - some sparse-event data being received
        // - `subscribeSession`'s caller unsubscribing
        // - the subscription being aborted
        await new Promise<void>(r => (wake = r));
      }

      // always emit latest telemetry first
      if (hasTelemetry) {
        hasTelemetry = false;
        const telemetry = actor.getLatestTelemetry().get();
        if (telemetry) {
          yield { type: 'positionUpdate', data: toGameState(telemetry) };
        }
      }

      // then drain sparse events
      while (sparseEventQueue.length) {
        yield sparseEventQueue.shift()!;
      }
    }
  };

  return {
    unsubscribe,
    generator: generator(),
  };
}
