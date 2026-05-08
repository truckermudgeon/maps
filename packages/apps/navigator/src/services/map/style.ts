import type { GeoJSONSource } from 'maplibre-gl';
import type { MapHandle } from './handle';

/**
 * Stylesheet-shaped mutations on the map: GeoJSON source data, layer
 * paint properties, and layer visibility.
 */
export class MapStyle {
  constructor(private readonly handle: MapHandle) {}

  /**
   * Replaces the data on a registered GeoJSON source. No-op if the
   * map isn't loaded or the source doesn't exist yet.
   */
  setSourceData(
    sourceId: string,
    data: GeoJSON.Feature | GeoJSON.FeatureCollection,
  ): void {
    const map = this.handle.getMap();
    if (!map) {
      return;
    }
    map.getSource<GeoJSONSource>(sourceId)?.setData(data);
  }

  /**
   * Sets a paint property on a layer. No-op if the map isn't loaded
   * or the layer hasn't been registered yet.
   */
  setLayerPaintProperty(layerId: string, prop: string, value: unknown): void {
    const map = this.handle.getMap();
    if (!map?.getLayer(layerId)) {
      return;
    }
    map.getMap().setPaintProperty(layerId, prop, value);
  }

  /**
   * Toggles layer visibility via the underlying `visibility` layout
   * property. No-op if the map isn't loaded or the layer hasn't been
   * registered yet.
   */
  setLayerVisibility(layerId: string, visible: boolean): void {
    const map = this.handle.getMap();
    if (!map?.getLayer(layerId)) {
      return;
    }
    map
      .getMap()
      .setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  }
}
