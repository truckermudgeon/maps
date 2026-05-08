import { UnreachableError } from '@truckermudgeon/base/precon';
import { toPosAndBearing } from '@truckermudgeon/navigation/helpers';
import type { GameState } from '@truckermudgeon/navigation/types';
import { action } from 'mobx';
import { BearingMode, CameraMode } from '../stores/camera';
import type { CameraStore, RouteStore } from '../stores/types';
import type { TelemetryTimeline } from '../util/telemetry-timeline';
import type { MapCamera, MapMarkers } from './map';
import type { RouteRenderer } from './route-renderer';

const DURATION_MS = 500;

/**
 * Drives the player marker and follow-camera by sampling a
 * TelemetryTimeline at a fixed interval. Owns its lifecycle via
 * start()/stop().
 */
export class TelemetryPlayer {
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private follow: ReturnType<MapCamera['beginFollowCamera']> | undefined;

  constructor(
    private readonly mapCamera: MapCamera,
    private readonly mapMarkers: MapMarkers,
    private readonly routeRenderer: RouteRenderer,
    private readonly timeline: TelemetryTimeline<GameState>,
  ) {}

  start(camera: CameraStore, route: RouteStore): void {
    this.stop();
    const follow = this.mapCamera.beginFollowCamera();
    this.follow = follow;

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
      this.routeRenderer.renderActiveRouteProgress(route);

      switch (camera.cameraMode) {
        case CameraMode.FOLLOW:
          follow.animate({
            position: center,
            bearing,
            speedMph,
            isNorthLock: camera.bearingMode === BearingMode.NORTH_LOCK,
            durationMs: DURATION_MS,
          });
          break;
        case CameraMode.FREE:
          this.mapMarkers.setPlayerPose(center, bearing);
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
    this.follow?.stop();
    this.follow = undefined;
  }
}
