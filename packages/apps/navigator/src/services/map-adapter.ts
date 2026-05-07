import { center, getExtent } from '@truckermudgeon/base/geom';
import { Preconditions } from '@truckermudgeon/base/precon';
import { Marker } from 'maplibre-gl';
import { action, makeObservable, observable } from 'mobx';
import type { MapRef } from 'react-map-gl/maplibre';
import { calculateDelta, toCameraOptions } from '../util/camera-options';

interface Padding {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The navigator app's single boundary to MapLibre/react-map-gl. No
 * other file in `packages/apps/navigator` should import `maplibre-gl`
 * or `react-map-gl/maplibre`; everything maplibre-shaped routes
 * through this class.
 *
 * Add a method here if it imports from `maplibre-gl` / `react-map-gl`,
 * calls a method on `MapRef`, or manages a map-attached DOM artifact.
 */
export class MapAdapter {
  // Observable so reactions can re-fire renderers that were called
  // before the map finished loading (e.g. routeUpdate from telemetry
  // arriving before MapGl's onLoad). Read-only externally; mutated
  // only inside onMapLoad.
  private _isMapLoaded = false;
  private map: MapRef | undefined;
  private playerMarker: Marker | undefined;
  private chooseOnMapUi:
    | { marker: Marker; unsubscribeOnMove: () => void }
    | undefined;
  private padding: Padding = { left: 0, right: 0, top: 0, bottom: 0 };
  private offset: [number, number] = [0, 0];
  // Last pose set on the player marker. animateFollowCamera reads this
  // as the interpolation start; setPlayerPose keeps it fresh so a
  // FREE -> FOLLOW transition interpolates from the right pose.
  private lastPlayerPose:
    | { position: [number, number]; bearing: number }
    | undefined;
  // Reused across follow-camera frames to keep the per-frame easing
  // callback allocation-free.
  private readonly playerPoseBuffer: [number, number] = [0, 0];

  constructor() {
    makeObservable<this, '_isMapLoaded'>(this, {
      _isMapLoaded: observable,
      onMapLoad: action,
    });
  }

  get isMapLoaded(): boolean {
    return this._isMapLoaded;
  }

  onMapLoad(map: MapRef, player: Marker): void {
    this.map = map;
    this.playerMarker = player;
    this._isMapLoaded = true;
  }

  getMap(): MapRef | undefined {
    return this.map;
  }

  setPadding(padding: Padding): void {
    this.padding = padding;
    if (this.map) {
      this.map.easeTo({ padding });
    }
  }

  setOffset(offset: [number, number]): void {
    this.offset = offset;
    if (this.map) {
      this.map.easeTo({ offset });
    }
  }

  setPlayerPose(position: [number, number], bearing: number): void {
    if (!this.playerMarker) {
      return;
    }
    this.playerMarker.setLngLat(position);
    this.playerMarker.setRotation(bearing);
    this.lastPlayerPose = {
      position: [position[0], position[1]],
      bearing,
    };
  }

  /**
   * Begins a follow-camera session. The returned `animate` is called
   * per-tick by the playback loop with the current player pose; the
   * first call (and the first call after `stop()`) snaps without
   * animating, subsequent calls interpolate from the previously-set
   * pose. `stop()` resets the cached pose so a future session
   * re-snaps instead of tweening from a stale tick.
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
        if (!this.map) {
          return;
        }
        const prev = this.lastPlayerPose;
        if (!prev) {
          this.map.setCenter(opts.position);
          this.setPlayerPose(opts.position, opts.bearing);
          return;
        }
        const bearingDelta = calculateDelta(prev.bearing, opts.bearing);
        this.map.easeTo({
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
            this.setPlayerPose(
              this.playerPoseBuffer,
              prev.bearing + t * bearingDelta,
            );
            return t;
          },
        });
      },
      stop: () => {
        this.lastPlayerPose = undefined;
      },
    };
  }

  addMapDragEndListener(
    cb: (centerLngLat: [number, number]) => void,
  ): () => void {
    const map = Preconditions.checkExists(this.map);
    const subscription = map.on('dragend', e =>
      cb(e.target.getCenter().toArray()),
    );
    return () => subscription.unsubscribe();
  }

  clearPitchAndBearing(): void {
    Preconditions.checkState(this.map != null);
    this.map.panTo(this.map.getCenter(), {
      duration: 500,
      pitch: 0,
      zoom: 10,
      bearing: 0,
    });
  }

  fitPoints(lonLats: [number, number][]): void {
    if (!this.map || !this.playerMarker) {
      console.warn("tried to view points but map/marker hasn't loaded");
      return;
    }
    const extent = getExtent(lonLats);
    const sw = [extent[0], extent[1]] as [number, number];
    const ne = [extent[2], extent[3]] as [number, number];
    const camera = this.map.cameraForBounds([sw, ne], {
      padding: 0,
      pitch: 0,
      bearing: 0,
    });
    console.log('fitting to', { bounds: [sw, ne], camera });
    if (!camera) {
      console.warn(
        'could not calculate camera for bounds. falling back to center of BB.',
      );
      this.map.easeTo({
        duration: 500,
        center: center(extent),
        zoom: this.map.getZoom() - 2,
        pitch: 0,
        bearing: 0,
      });
      return;
    }
    // HACK until map files are re-built to support lower zoom levels.
    if (camera.zoom! < this.map.getMinZoom()) {
      camera.center = this.playerMarker.getLngLat().toArray();
    }
    this.map.easeTo({
      duration: 500,
      ...camera,
      zoom: camera.zoom! - 1,
      pitch: 0,
      bearing: 0,
      padding: this.padding,
    });
  }

  flyTo(lonLat: [number, number], bearing = 0): void {
    if (!this.map) {
      console.warn("tried to fly but map hasn't loaded");
      return;
    }
    this.map.panTo(lonLat, {
      duration: 500,
      pitch: 0,
      zoom: 13,
      bearing,
      padding: this.padding,
      offset: this.offset,
    });
  }

  /**
   * Toggles the draggable "choose on map" marker — a centered Marker
   * that follows the map center as the user pans. Use
   * {@link getChooseOnMapMarkerLngLat} to read the chosen position
   * before toggling off.
   */
  toggleChooseOnMapMarker(enable: boolean): void {
    if (!enable) {
      if (!this.chooseOnMapUi) {
        return;
      }
      this.chooseOnMapUi.marker.remove();
      this.chooseOnMapUi.unsubscribeOnMove();
      this.chooseOnMapUi = undefined;
      return;
    }
    Preconditions.checkState(this.chooseOnMapUi == null);
    const map = Preconditions.checkExists(this.map);
    const marker = new Marker()
      .setLngLat(map.getCenter())
      .setDraggable(false)
      .addTo(map.getMap());
    const subscription = map.on('move', () =>
      marker.setLngLat(map.getCenter()),
    );
    this.chooseOnMapUi = {
      marker,
      unsubscribeOnMove: () => subscription.unsubscribe(),
    };
  }

  getChooseOnMapMarkerLngLat(): [number, number] {
    Preconditions.checkState(this.chooseOnMapUi != null);
    return this.chooseOnMapUi.marker.getLngLat().toArray();
  }
}
