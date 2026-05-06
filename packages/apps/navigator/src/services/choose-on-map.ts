import { Preconditions } from '@truckermudgeon/base/precon';
import { Marker } from 'maplibre-gl';
import type { MapAdapter } from './map-adapter';

/**
 * Owns the draggable "choose on map" marker lifecycle. Toggle
 * visibility with `toggle(enable)`; read the chosen lon/lat with
 * `getChosenLngLat()`.
 */
export class ChooseOnMapService {
  private ui: { marker: Marker; unsubscribeOnMove: () => void } | undefined;

  constructor(private readonly mapAdapter: MapAdapter) {}

  toggle(enable: boolean): void {
    if (!enable) {
      if (!this.ui) {
        return;
      }
      this.ui.marker.remove();
      this.ui.unsubscribeOnMove();
      this.ui = undefined;
      return;
    }
    Preconditions.checkState(this.ui == null);
    const map = Preconditions.checkExists(this.mapAdapter.getMap());
    const marker = new Marker()
      .setLngLat(map.getCenter())
      .setDraggable(false)
      .addTo(map.getMap());
    const subscription = map.on('move', () =>
      marker.setLngLat(map.getCenter()),
    );
    this.ui = {
      marker,
      unsubscribeOnMove: () => subscription.unsubscribe(),
    };
  }

  getChosenLngLat(): [number, number] {
    Preconditions.checkState(this.ui != null);
    return this.ui.marker.getLngLat().toArray();
  }
}
