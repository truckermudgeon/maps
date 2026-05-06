import type { Route, RouteStep } from '@truckermudgeon/navigation/types';
import type { Marker } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import { ChooseOnMapService } from './choose-on-map';
import { MapAdapter } from './map-adapter';
import { RouteRenderer } from './route-renderer';

/**
 * Bundles the imperative map-and-rendering surface used across the
 * navigator: maplibre wrapper (MapAdapter), route layer rendering
 * (RouteRenderer), and the "choose a destination by tapping the map"
 * UI (ChooseOnMapService). Consumers — reactions, view callbacks,
 * AppControllerImpl — call methods here instead of going through
 * AppController.
 */
export class MapPresenter {
  readonly mapAdapter = new MapAdapter();
  readonly chooseOnMapService = new ChooseOnMapService(this.mapAdapter);
  readonly routeRenderer = new RouteRenderer(this.mapAdapter);

  setPadding(padding: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }) {
    this.mapAdapter.setPadding(padding);
  }

  setOffset(offset: [number, number]) {
    this.mapAdapter.setOffset(offset);
  }

  addMapDragEndListener(
    cb: (centerLngLat: [number, number]) => void,
  ): () => void {
    return this.mapAdapter.addMapDragEndListener(cb);
  }

  clearPitchAndBearing() {
    this.mapAdapter.clearPitchAndBearing();
  }

  fitPoints(lonLats: [number, number][]) {
    this.mapAdapter.fitPoints(lonLats);
  }

  flyTo(lonLat: [number, number], bearing = 0) {
    this.mapAdapter.flyTo(lonLat, bearing);
  }

  onMapLoad(map: MapRef, player: Marker) {
    this.mapAdapter.onMapLoad(map, player);
  }

  toggleChooseOnMapUi(enable: boolean) {
    this.chooseOnMapService.toggle(enable);
  }

  renderActiveRoute(maybeRoute: Route | undefined) {
    this.routeRenderer.renderActiveRoute(maybeRoute);
  }

  renderRoutePreview(
    maybeRoute: Route | undefined,
    options: {
      highlight: boolean;
      index: number;
      animate: boolean;
    },
  ) {
    this.routeRenderer.renderRoutePreview(maybeRoute, options);
  }

  drawStepArrow(step: RouteStep | undefined) {
    this.routeRenderer.drawStepArrow(step);
  }
}
