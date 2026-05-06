import { UnreachableError } from '@truckermudgeon/base/precon';
import type { GameState } from '@truckermudgeon/navigation/types';
import { runInAction } from 'mobx';
import type { AppClient, ControlsStore } from '../controllers/types';
import type { RouteStore, SessionStore } from '../stores/types';
import { TelemetryTimeline } from '../util/telemetry-timeline';
import type { RouteRenderer } from './route-renderer';

/**
 * Single subscription point for the navigator's tRPC telemetry stream.
 * Decodes each event into the right store field and exposes the
 * underlying TelemetryTimeline for consumers that need to sample
 * positionUpdates at their own cadence. Owns its subscription via
 * start()/stop().
 */
export class TelemetryService {
  readonly timeline = new TelemetryTimeline<GameState>({
    lookbackMs: 250,
    maxExtrapolationMs: 500,
    emaAlpha: 0.5,
  });

  private subscription: { unsubscribe: () => void } | undefined;

  constructor(
    private readonly session: SessionStore,
    private readonly route: RouteStore,
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
        const { session, route, routeRenderer, timeline } = this;
        switch (event.type) {
          case 'positionUpdate': {
            timeline.push(event.data);
            const gameState = event.data;
            const speedAbs = Math.abs(gameState.speed);
            runInAction(() => {
              if (!session.hasReceivedFirstTelemetry) {
                session.hasReceivedFirstTelemetry = true;
              }
              if (session.bindingStale) {
                session.bindingStale = false;
              }
              if (session.map === 'usa') {
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
              route.activeRoute = event.data;
              route.activeRouteIndex = undefined;
              routeRenderer.renderActiveRoute(event.data);
            });
            break;
          case 'routeProgress':
            runInAction(() => (route.activeRouteIndex = event.data));
            break;
          case 'segmentComplete':
            runInAction(() => (route.segmentComplete = event.data));
            break;
          case 'themeModeUpdate':
            runInAction(() => (session.themeMode = event.data));
            break;
          case 'trailerUpdate':
            runInAction(() => (route.trailerPoint = event.data?.position));
            break;
          case 'mapUpdate':
            runInAction(() => (session.map = event.data));
            localStorage.setItem('map', event.data);
            timeline.reset();
            break;
          case 'jobUpdate':
            break;
          case 'staleBinding':
            runInAction(() => (session.bindingStale = true));
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
