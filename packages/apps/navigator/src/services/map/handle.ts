import { Preconditions } from '@truckermudgeon/base/precon';
import type { Marker } from 'maplibre-gl';
import { action, makeObservable, observable } from 'mobx';
import type { MapRef } from 'react-map-gl/maplibre';

/**
 * Custodian of the imperative map ref + player marker ref. Exposes
 * `isMapReady` — true after maplibre has rendered to idle once, i.e.
 * after the React-mounted `<Source>` / `<Layer>` children have
 * committed and any source/layer mutations are safe to make. Also
 * offers low-level event-listener helpers (`addMapDragEndListener`,
 * `onBearingChange`).
 */
export class MapHandle {
  private _isMapReady = false;
  private map: MapRef | undefined;
  private playerMarker: Marker | undefined;

  constructor() {
    makeObservable<this, '_isMapReady' | 'markReady'>(this, {
      _isMapReady: observable,
      onMapLoad: action,
      markReady: action,
    });
  }

  get isMapReady(): boolean {
    return this._isMapReady;
  }

  onMapLoad(map: MapRef, player: Marker): void {
    this.map = map;
    this.playerMarker = player;
    const sub = map.on('idle', () => {
      sub.unsubscribe();
      this.markReady();
    });
  }

  private markReady(): void {
    this._isMapReady = true;
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
