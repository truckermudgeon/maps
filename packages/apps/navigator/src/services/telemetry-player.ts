import type { Position } from '@truckermudgeon/base/geom';
import { UnreachableError } from '@truckermudgeon/base/precon';
import { toPosAndBearing } from '@truckermudgeon/navigation/helpers';
import type { GameState } from '@truckermudgeon/navigation/types';
import { action } from 'mobx';
import { BearingMode, CameraMode } from '../stores/camera';
import type { CameraStore, RouteStore } from '../stores/types';
import { calculateDelta, toCameraOptions } from '../util/camera-options';
import type { TelemetryTimeline } from '../util/telemetry-timeline';
import type { MapAdapter } from './map-adapter';
import type { RouteRenderer } from './route-renderer';

const DURATION_MS = 500;

/**
 * Drives the player marker and follow-camera by sampling a
 * TelemetryTimeline at a fixed interval. Owns its setInterval via
 * start()/stop().
 */
export class TelemetryPlayer {
  private intervalId: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly mapAdapter: MapAdapter,
    private readonly routeRenderer: RouteRenderer,
    private readonly timeline: TelemetryTimeline<GameState>,
  ) {}

  start(camera: CameraStore, route: RouteStore): void {
    this.stop();
    let prevPosition: Position = [0, 0];
    let currPosition: Position = [0, 0];
    const markerPosition: Position = [0, 0];
    let prevBearing = 0;
    let currBearing = 0;
    let markerBearing = 0;

    const render = () => {
      const gameState = this.timeline.sample(Date.now());
      if (gameState == null) {
        return;
      }

      const { speed, position, heading, game } = gameState;
      const { position: center, bearing } = toPosAndBearing(
        {
          position: { X: position.x, Y: position.z, Z: position.y },
          orientation: { heading },
        },
        game === 'ats' ? 'usa' : 'europe',
      );
      const speedMph = Math.round(speed * 2.236936);

      route.truckPoint = center;

      const map = this.mapAdapter.getMap();
      const playerMarker = this.mapAdapter.getPlayerMarker();
      if (!map || !playerMarker) {
        console.log('early return: positionUpdate before map/marker ready');
        return;
      }

      this.routeRenderer.renderActiveRouteProgress(route);

      if (prevPosition.every(v => !v)) {
        console.log('reset center', center);
        map.setCenter(center);
        playerMarker.setLngLat(center);
        playerMarker.setRotation(bearing);
      }
      prevPosition = currPosition;
      currPosition = center;
      prevBearing = currBearing;
      currBearing = bearing;

      switch (camera.cameraMode) {
        case CameraMode.FOLLOW:
          map.easeTo({
            ...toCameraOptions(center, bearing, speedMph, {
              isNorthLock: camera.bearingMode === BearingMode.NORTH_LOCK,
            }),
            duration: DURATION_MS,
            padding: this.mapAdapter.getPadding(),
            offset: this.mapAdapter.getOffset(),
            easing: t => {
              // HACK update marker here
              markerPosition[0] =
                prevPosition[0] + t * (currPosition[0] - prevPosition[0]);
              markerPosition[1] =
                prevPosition[1] + t * (currPosition[1] - prevPosition[1]);
              markerBearing =
                prevBearing + t * calculateDelta(prevBearing, currBearing);
              playerMarker.setLngLat(markerPosition);
              playerMarker.setRotation(markerBearing);
              return t;
            },
          });
          break;
        case CameraMode.FREE:
          playerMarker.setLngLat(center);
          playerMarker.setRotation(bearing);
          break;
        default:
          throw new UnreachableError(camera.cameraMode);
      }
    };

    this.intervalId = setInterval(action(render), DURATION_MS);
  }

  stop(): void {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}
