import { center, getExtent } from '@truckermudgeon/base/geom';
import { Preconditions } from '@truckermudgeon/base/precon';
import { Marker } from 'maplibre-gl';
import { action, makeObservable, observable } from 'mobx';
import type { MapRef } from 'react-map-gl/maplibre';

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

  getPlayerMarker(): Marker | undefined {
    return this.playerMarker;
  }

  getPadding(): Padding {
    return this.padding;
  }

  getOffset(): [number, number] {
    return this.offset;
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
