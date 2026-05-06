import { UnreachableError } from '@truckermudgeon/base/precon';
import type { GameState } from '@truckermudgeon/navigation/types';
import { runInAction } from 'mobx';
import type { AppClient, AppStore, ControlsStore } from '../controllers/types';
import { TelemetryTimeline } from '../util/telemetry-timeline';
import type { RouteRenderer } from './route-renderer';

/**
 * Single subscription point for the navigator's tRPC telemetry stream.
 * Dispatches each event into the right store field and pushes
 * positionUpdates into a TelemetryTimeline that the RouteAnimator
 * samples. Owns its subscription via start()/stop().
 */
export class TelemetryService {
  readonly timeline = new TelemetryTimeline<GameState>({
    lookbackMs: 250,
    maxExtrapolationMs: 500,
    emaAlpha: 0.5,
  });

  private subscription: { unsubscribe: () => void } | undefined;

  constructor(
    private readonly store: AppStore,
    private readonly controls: ControlsStore,
    private readonly routeRenderer: RouteRenderer,
  ) {}

  start(client: AppClient): void {
    this.subscription?.unsubscribe();
    console.log('subscribing');
    this.subscription = client.subscribeToDevice.subscribe(void 0, {
      // TODO: a WS gap longer than the publicKey TTL (12h) makes the
      // resubscribe fail auth — we log it here but the user sees nothing.
      // Surface it (force re-pair or flip bindingStale) instead.
      onError: err => console.error('subscribeToDevice error', err),
      onData: event => {
        const { store, routeRenderer, timeline } = this;
        switch (event.type) {
          case 'positionUpdate': {
            timeline.push(event.data);
            const gameState = event.data;
            const speedAbs = Math.abs(gameState.speed);
            runInAction(() => {
              if (!store.hasReceivedFirstTelemetry) {
                store.hasReceivedFirstTelemetry = true;
              }
              if (store.bindingStale) {
                store.bindingStale = false;
              }
              if (store.map === 'usa') {
                this.controls.limit = gameState.speedLimit.mph;
                this.controls.speed = Math.round(speedAbs * 2.236936);
              } else {
                this.controls.limit = gameState.speedLimit.kph;
                this.controls.speed = Math.round(speedAbs * 3.6);
              }
            });
            break;
          }
          case 'routeUpdate':
            runInAction(() => {
              store.activeRoute = event.data;
              store.activeRouteIndex = undefined;
              routeRenderer.renderActiveRoute(event.data);
            });
            break;
          case 'routeProgress':
            runInAction(() => (store.activeRouteIndex = event.data));
            break;
          case 'segmentComplete':
            runInAction(() => (store.segmentComplete = event.data));
            break;
          case 'themeModeUpdate':
            runInAction(() => (store.themeMode = event.data));
            break;
          case 'trailerUpdate':
            runInAction(() => (store.trailerPoint = event.data?.position));
            break;
          case 'mapUpdate':
            runInAction(() => (store.map = event.data));
            localStorage.setItem('map', event.data);
            timeline.reset();
            break;
          case 'jobUpdate':
            break;
          case 'staleBinding':
            runInAction(() => (store.bindingStale = true));
            break;
          default:
            throw new UnreachableError(event);
        }
      },
    });
  }

  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    this.timeline.reset();
  }
}
