import type {
  Route,
  RouteIndex,
  RouteStep,
  SearchResult,
  SegmentInfo,
} from '@truckermudgeon/navigation/types';
import type { Marker } from 'maplibre-gl';
import { action, makeAutoObservable } from 'mobx';
import type { MapRef } from 'react-map-gl/maplibre';
import { ChooseOnMapService } from '../services/choose-on-map';
import { MapAdapter } from '../services/map-adapter';
import { RouteAnimator } from '../services/route-animator';
import { RouteRenderer } from '../services/route-renderer';
import { TelemetryService } from '../services/telemetry';
import { CameraStoreImpl } from '../stores/camera';
import { RouteStoreImpl } from '../stores/route';
import { SessionStoreImpl } from '../stores/session';
import { clearCredentialsAndReload, requestWakeLock } from '../util/browser';
import { BearingMode, CameraMode } from './constants';
import type { AppClient, AppController, AppStore } from './types';

/**
 * Facade over the focused stores (Session/Camera/Route). Exists so that
 * callers can keep using a flat `appStore.activeRoute` API during the
 * controllers/ refactor; once domain hooks land, consumers can access
 * the focused stores directly and this facade can be retired.
 */
export class AppStoreImpl implements AppStore {
  readonly session: SessionStoreImpl;
  readonly camera: CameraStoreImpl;
  readonly route: RouteStoreImpl;

  showNavSheet = false;

  constructor(map: 'usa' | 'europe') {
    this.session = new SessionStoreImpl(map);
    this.camera = new CameraStoreImpl();
    this.route = new RouteStoreImpl();
    // Children own their own observability; opt the refs out so MobX
    // doesn't try to deep-observe them here.
    makeAutoObservable(this, {
      session: false,
      camera: false,
      route: false,
    });
  }

  get themeMode(): 'light' | 'dark' {
    return this.session.themeMode;
  }
  set themeMode(v: 'light' | 'dark') {
    this.session.themeMode = v;
  }

  get map(): 'usa' | 'europe' {
    return this.session.map;
  }
  set map(v: 'usa' | 'europe') {
    this.session.map = v;
  }

  get hasReceivedFirstTelemetry(): boolean {
    return this.session.hasReceivedFirstTelemetry;
  }
  set hasReceivedFirstTelemetry(v: boolean) {
    this.session.hasReceivedFirstTelemetry = v;
  }

  get readyToLoad(): boolean {
    return this.session.readyToLoad;
  }
  set readyToLoad(v: boolean) {
    this.session.readyToLoad = v;
  }

  get bindingStale(): boolean {
    return this.session.bindingStale;
  }
  set bindingStale(v: boolean) {
    this.session.bindingStale = v;
  }

  get cameraMode(): CameraMode {
    return this.camera.cameraMode;
  }
  set cameraMode(v: CameraMode) {
    this.camera.cameraMode = v;
  }

  get bearingMode(): BearingMode {
    return this.camera.bearingMode;
  }
  set bearingMode(v: BearingMode) {
    this.camera.bearingMode = v;
  }

  get activeRoute(): Route | undefined {
    return this.route.activeRoute;
  }
  set activeRoute(v: Route | undefined) {
    this.route.activeRoute = v;
  }

  get activeRouteIndex(): RouteIndex | undefined {
    return this.route.activeRouteIndex;
  }
  set activeRouteIndex(v: RouteIndex | undefined) {
    this.route.activeRouteIndex = v;
  }

  get truckPoint(): readonly [lon: number, lat: number] {
    return this.route.truckPoint;
  }
  set truckPoint(v: [lon: number, lat: number]) {
    this.route.truckPoint = v;
  }

  get trailerPoint(): readonly [lon: number, lat: number] | undefined {
    return this.route.trailerPoint;
  }
  set trailerPoint(v: [lon: number, lat: number] | undefined) {
    this.route.trailerPoint = v;
  }

  get segmentComplete(): SegmentInfo | undefined {
    return this.route.segmentComplete;
  }
  set segmentComplete(v: SegmentInfo | undefined) {
    this.route.segmentComplete = v;
  }

  get activeStepLine() {
    return this.route.activeStepLine;
  }
  get activeRouteSummary() {
    return this.route.activeRouteSummary;
  }
  get activeRouteToFirstWayPointSummary() {
    return this.route.activeRouteToFirstWayPointSummary;
  }
  get distanceToNextManeuver() {
    return this.route.distanceToNextManeuver;
  }
  get activeRouteDirection() {
    return this.route.activeRouteDirection;
  }
  get activeArrowStep() {
    return this.route.activeArrowStep;
  }
  get geoJsonRoute() {
    return this.route.geoJsonRoute;
  }
}

export class AppControllerImpl implements AppController {
  private readonly mapAdapter = new MapAdapter();
  private readonly chooseOnMapService = new ChooseOnMapService(this.mapAdapter);
  private readonly routeRenderer = new RouteRenderer(this.mapAdapter);

  // Built lazily on the first startListening() call so the constructor
  // doesn't need an AppStore reference.
  private telemetryService: TelemetryService | undefined;
  private routeAnimator: RouteAnimator | undefined;

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

  clearPitchAndBearing(_store: AppStore) {
    console.log('clear pitch and bearing');
    this.mapAdapter.clearPitchAndBearing();
  }

  fitPoints(_store: AppStore, lonLats: [number, number][]) {
    this.mapAdapter.fitPoints(lonLats);
  }

  flyTo(_store: AppStore, lonLat: [number, number], bearing = 0) {
    this.mapAdapter.flyTo(lonLat, bearing);
  }

  onMapLoad(map: MapRef, player: Marker) {
    this.mapAdapter.onMapLoad(map, player);
  }

  setFree(store: AppStore) {
    store.cameraMode = CameraMode.FREE;
  }

  setFollow(store: AppStore) {
    store.cameraMode = CameraMode.FOLLOW;
  }

  setNorthUnlock(store: AppStore) {
    store.bearingMode = BearingMode.MATCH_MAP;
  }

  setNorthLock(store: AppStore) {
    store.bearingMode = BearingMode.NORTH_LOCK;
  }

  hideNavSheet(store: AppStore) {
    console.log('hide nav sheet');
    store.showNavSheet = false;
  }

  setDestinationNodeUid(store: AppStore, toNodeUid: string, client: AppClient) {
    void client.previewRoutes.query({ toNodeUid }).then(
      action(([firstRoute]) => {
        if (!firstRoute) {
          console.warn('could not find route to', toNodeUid);
        }
        this.setActiveRoute(store, firstRoute, client);
      }),
    );
  }

  setActiveRoute(store: AppStore, route: Route | undefined, client: AppClient) {
    // optimistically set route and index.
    store.activeRoute = route;
    store.activeRouteIndex = { segmentIndex: 0, stepIndex: 0, nodeIndex: 0 };
    this.renderActiveRoute(route);
    void client.setActiveRoute.mutate(route?.segments.map(s => s.key));
  }

  setActiveRouteFromNodeUids(
    store: AppStore,
    waypoints: bigint[],
    client: AppClient,
  ) {
    void client.generateRouteFromNodeUids
      .query(waypoints.map(wp => wp.toString(16)))
      .then(
        action(route => {
          this.setActiveRoute(store, route, client);
        }),
      );
  }

  startListening(store: AppStore, client: AppClient) {
    this.telemetryService?.stop();
    this.routeAnimator?.stop();

    this.telemetryService = new TelemetryService(store, this.routeRenderer);
    this.telemetryService.start(client);

    this.routeAnimator = new RouteAnimator(
      this.mapAdapter,
      this.routeRenderer,
      this.telemetryService.timeline,
    );
    this.routeAnimator.start(store);
  }

  synthesizeSearchResult(
    _store: AppStore,
    client: AppClient,
  ): Promise<SearchResult> {
    return client.synthesizeSearchResult.query(
      this.chooseOnMapService.getChosenLngLat(),
    );
  }

  toggleChooseOnMapUi(_store: AppStore, enable: boolean) {
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

  unpauseRouteEvents(store: AppStore, client: AppClient) {
    store.segmentComplete = undefined;
    void client.unpauseRouteEvents.mutate();
  }
}
