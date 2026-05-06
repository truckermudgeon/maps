import type {
  Route,
  RouteStep,
  SearchResult,
} from '@truckermudgeon/navigation/types';
import type { Marker } from 'maplibre-gl';
import { action } from 'mobx';
import type { MapRef } from 'react-map-gl/maplibre';
import { ChooseOnMapService } from '../services/choose-on-map';
import { MapAdapter } from '../services/map-adapter';
import { RouteAnimator } from '../services/route-animator';
import * as routeApi from '../services/route-api';
import { RouteRenderer } from '../services/route-renderer';
import { TelemetryService } from '../services/telemetry';
import type { CameraStoreImpl } from '../stores/camera';
import type { RouteStoreImpl } from '../stores/route';
import type { SessionStoreImpl } from '../stores/session';
import type { NavSheetStore } from '../stores/types';
import { clearCredentialsAndReload, requestWakeLock } from '../util/browser';
import { BearingMode, CameraMode } from './constants';
import type { AppClient, AppController, ControlsStore } from './types';

export class AppControllerImpl implements AppController {
  private readonly mapAdapter = new MapAdapter();
  private readonly chooseOnMapService = new ChooseOnMapService(this.mapAdapter);
  private readonly routeRenderer = new RouteRenderer(this.mapAdapter);

  private telemetryService: TelemetryService | undefined;
  private routeAnimator: RouteAnimator | undefined;

  constructor(
    private readonly session: SessionStoreImpl,
    private readonly camera: CameraStoreImpl,
    private readonly route: RouteStoreImpl,
    private readonly navSheetStore: NavSheetStore,
    private readonly appClient: AppClient,
  ) {}

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

  forceRePair() {
    this.telemetryService?.stop();
    this.routeAnimator?.stop();
    clearCredentialsAndReload();
  }

  requestWakeLock() {
    requestWakeLock();
  }

  addMapDragEndListener(
    cb: (centerLngLat: [number, number]) => void,
  ): () => void {
    return this.mapAdapter.addMapDragEndListener(cb);
  }

  clearPitchAndBearing() {
    console.log('clear pitch and bearing');
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

  setFree() {
    this.camera.cameraMode = CameraMode.FREE;
  }

  setFollow() {
    this.camera.cameraMode = CameraMode.FOLLOW;
  }

  setNorthUnlock() {
    this.camera.bearingMode = BearingMode.MATCH_MAP;
  }

  setNorthLock() {
    this.camera.bearingMode = BearingMode.NORTH_LOCK;
  }

  hideNavSheet() {
    console.log('hide nav sheet');
    this.navSheetStore.showNavSheet = false;
  }

  setDestinationNodeUid(toNodeUid: string) {
    void routeApi.previewRoutes(this.appClient, toNodeUid).then(
      action(([firstRoute]) => {
        if (!firstRoute) {
          console.warn('could not find route to', toNodeUid);
        }
        this.setActiveRoute(firstRoute);
      }),
    );
  }

  setActiveRoute(route: Route | undefined) {
    // optimistically set route and index.
    this.route.activeRoute = route;
    this.route.activeRouteIndex = {
      segmentIndex: 0,
      stepIndex: 0,
      nodeIndex: 0,
    };
    this.renderActiveRoute(route);
    void routeApi.setActiveRoute(
      this.appClient,
      route?.segments.map(s => s.key),
    );
  }

  setActiveRouteFromNodeUids(waypoints: bigint[]) {
    void routeApi
      .generateRouteFromNodeUids(
        this.appClient,
        waypoints.map(wp => wp.toString(16)),
      )
      .then(
        action(route => {
          this.setActiveRoute(route);
        }),
      );
  }

  startListening(controlsStore: ControlsStore) {
    this.telemetryService?.stop();
    this.routeAnimator?.stop();

    this.telemetryService = new TelemetryService(
      this.session,
      this.route,
      controlsStore,
      this.routeRenderer,
    );
    this.telemetryService.start(this.appClient);

    this.routeAnimator = new RouteAnimator(
      this.mapAdapter,
      this.routeRenderer,
      this.telemetryService.timeline,
    );
    this.routeAnimator.start(this.camera, this.route);
  }

  synthesizeSearchResult(): Promise<SearchResult> {
    return routeApi.synthesizeSearchResult(
      this.appClient,
      this.chooseOnMapService.getChosenLngLat(),
    );
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

  unpauseRouteEvents() {
    this.route.segmentComplete = undefined;
    void routeApi.unpauseRouteEvents(this.appClient);
  }
}
