import { center, getExtent } from '@truckermudgeon/base/geom';
import { calculateDelta, toCameraOptions } from '../../util/camera-options';
import type { MapHandle } from './handle';
import type { MapMarkers } from './markers';

interface Padding {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Camera-shaped operations on the map: padding/offset state,
 * fit/fly/clearPitchAndBearing, and the follow-camera animation session.
 */
export class MapCamera {
  private padding: Padding = { left: 0, right: 0, top: 0, bottom: 0 };
  private offset: [number, number] = [0, 0];
  // Reused across follow-camera frames to keep the per-frame easing
  // callback allocation-free.
  private readonly playerPoseBuffer: [number, number] = [0, 0];

  constructor(
    private readonly handle: MapHandle,
    private readonly markers: MapMarkers,
  ) {}

  setPadding(padding: Padding): void {
    this.padding = padding;
    const map = this.handle.getMap();
    if (!map) {
      return;
    }
    map.easeTo({ padding });
  }

  setOffset(offset: [number, number]): void {
    this.offset = offset;
    const map = this.handle.getMap();
    if (!map) {
      return;
    }
    map.easeTo({ offset });
  }

  clearPitchAndBearing(): void {
    const map = this.handle.getMap();
    if (!map) {
      return;
    }
    map.panTo(map.getCenter(), {
      duration: 500,
      pitch: 0,
      zoom: 10,
      bearing: 0,
    });
  }

  fitPoints(lonLats: [number, number][]): void {
    const map = this.handle.getMap();
    const playerMarker = this.handle.getPlayerMarker();
    if (!map || !playerMarker) {
      console.warn("tried to view points but map/marker hasn't loaded");
      return;
    }
    const extent = getExtent(lonLats);
    const sw = [extent[0], extent[1]] as [number, number];
    const ne = [extent[2], extent[3]] as [number, number];
    const cameraOpts = map.cameraForBounds([sw, ne], {
      padding: 0,
      pitch: 0,
      bearing: 0,
    });
    if (!cameraOpts) {
      console.warn(
        'could not calculate camera for bounds. falling back to center of BB.',
      );
      map.easeTo({
        duration: 500,
        center: center(extent),
        zoom: map.getZoom() - 2,
        pitch: 0,
        bearing: 0,
      });
      return;
    }
    // HACK until map files are re-built to support lower zoom levels.
    if (cameraOpts.zoom! < map.getMinZoom()) {
      cameraOpts.center = playerMarker.getLngLat().toArray();
    }
    map.easeTo({
      duration: 500,
      ...cameraOpts,
      zoom: cameraOpts.zoom! - 1,
      pitch: 0,
      bearing: 0,
      padding: this.padding,
    });
  }

  flyTo(lonLat: [number, number], bearing = 0): void {
    const map = this.handle.getMap();
    if (!map) {
      return;
    }
    map.panTo(lonLat, {
      duration: 500,
      pitch: 0,
      zoom: 13,
      bearing,
      padding: this.padding,
      offset: this.offset,
    });
  }

  /**
   * Begins a follow-camera session. Call `animate` per-tick with the
   * current player pose; the first call (and the first call after
   * `stop()`) snaps without animating, subsequent calls interpolate
   * from the previously-set pose. `stop()` resets the cached pose so
   * a future session re-snaps instead of tweening from a stale tick.
   */
  beginFollowCamera(): {
    animate(opts: {
      position: [number, number];
      bearing: number;
      speedMph: number;
      isNorthLock: boolean;
      durationMs: number;
    }): void;
    stop(): void;
  } {
    return {
      animate: opts => {
        const map = this.handle.getMap();
        if (!map) {
          return;
        }
        const prev = this.markers.getLastPlayerPose();
        if (!prev) {
          map.setCenter(opts.position);
          this.markers.setPlayerPose(opts.position, opts.bearing);
          return;
        }
        const bearingDelta = calculateDelta(prev.bearing, opts.bearing);
        map.easeTo({
          ...toCameraOptions(opts.position, opts.bearing, opts.speedMph, {
            isNorthLock: opts.isNorthLock,
          }),
          duration: opts.durationMs,
          padding: this.padding,
          offset: this.offset,
          easing: t => {
            this.playerPoseBuffer[0] =
              prev.position[0] + t * (opts.position[0] - prev.position[0]);
            this.playerPoseBuffer[1] =
              prev.position[1] + t * (opts.position[1] - prev.position[1]);
            this.markers.setPlayerPose(
              this.playerPoseBuffer,
              prev.bearing + t * bearingDelta,
            );
            return t;
          },
        });
      },
      stop: () => {
        this.markers.clearLastPlayerPose();
      },
    };
  }
}
