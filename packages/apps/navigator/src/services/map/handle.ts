import { Preconditions } from '@truckermudgeon/base/precon';
import type { Marker } from 'maplibre-gl';
import { action, makeObservable, observable } from 'mobx';
import type { MapRef } from 'react-map-gl/maplibre';

/**
 * Custodian of the imperative map ref + player marker ref. Exposes
 * `isMapLoaded` as an observable so reactions can gate on map
 * readiness, and offers low-level event-listener helpers
 * (`addMapDragEndListener`, `onBearingChange`).
 */
export class MapHandle {
  private _isMapLoaded = false;
  private map: MapRef | undefined;
  private playerMarker: Marker | undefined;

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

  /** @internal — for sibling adapters in services/map/ only. */
  getMap(): MapRef | undefined {
    return this.map;
  }

  /** @internal — for sibling adapters in services/map/ only. */
  getPlayerMarker(): Marker | undefined {
    return this.playerMarker;
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

  /**
   * Subscribes to map bearing changes (driven by user pan/rotate or
   * camera animations). The callback fires with the current bearing
   * on every `move` event. Returns an unsubscribe function.
   */
  onBearingChange(cb: (bearing: number) => void): () => void {
    const map = Preconditions.checkExists(this.map);
    const subscription = map.on('move', () => cb(map.getBearing()));
    return () => subscription.unsubscribe();
  }
}
