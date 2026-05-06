import polyline from '@mapbox/polyline';
import { assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import { UnreachableError } from '@truckermudgeon/base/precon';
import { toPosAndBearing } from '@truckermudgeon/navigation/helpers';
import type {
  GameState,
  Route,
  RouteIndex,
  RouteStep,
  SearchResult,
  SegmentInfo,
} from '@truckermudgeon/navigation/types';
import bearing from '@turf/bearing';
import { featureCollection, lineString, point } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import type { GeoJSONSource, Marker } from 'maplibre-gl';
import { action, makeAutoObservable, runInAction } from 'mobx';
import type { MapRef } from 'react-map-gl/maplibre';
import { lineGradientExpression } from '../components/RoutesStyle';
import { toRouteFeatures } from '../route-features';
import { ChooseOnMapService } from '../services/choose-on-map';
import { MapAdapter } from '../services/map-adapter';
import { CameraStoreImpl } from '../stores/camera';
import { RouteStoreImpl } from '../stores/route';
import { SessionStoreImpl } from '../stores/session';
import { clearCredentialsAndReload, requestWakeLock } from '../util/browser';
import { calculateDelta, toCameraOptions } from '../util/camera-options';
import { clamp } from '../util/clamp';
import { TelemetryTimeline } from '../util/telemetry-timeline';
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

  private deviceSubscription: { unsubscribe: () => void } | undefined;
  private renderIntervalId: ReturnType<typeof setInterval> | undefined;
  private lastRenderedActiveStepLine:
    | GeoJSON.Feature<GeoJSON.LineString>
    | undefined;

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
    this.deviceSubscription?.unsubscribe();
    this.deviceSubscription = undefined;
    if (this.renderIntervalId != null) {
      clearInterval(this.renderIntervalId);
      this.renderIntervalId = undefined;
    }
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
    if (this.deviceSubscription || this.renderIntervalId != null) {
      console.log('tearing down previous device subscription');
      this.deviceSubscription?.unsubscribe();
      this.deviceSubscription = undefined;
      if (this.renderIntervalId != null) {
        clearInterval(this.renderIntervalId);
        this.renderIntervalId = undefined;
      }
    }

    let prevPosition: Position = [0, 0];
    let currPosition: Position = [0, 0];
    const markerPosition: Position = [0, 0];
    let prevBearing = 0;
    let currBearing = 0;
    let markerBearing = 0;
    console.log('subscribing');

    const timeline = new TelemetryTimeline<GameState>({
      lookbackMs: 250,
      maxExtrapolationMs: 500,
      emaAlpha: 0.5,
    });

    this.deviceSubscription = client.subscribeToDevice.subscribe(void 0, {
      // TODO: a WS gap longer than the publicKey TTL (12h) makes the
      // resubscribe fail auth — we log it here but the user sees nothing.
      // Surface it (force re-pair or flip bindingStale) instead.
      onError: err => {
        console.error('subscribeToDevice error', err);
      },
      onData: event => {
        switch (event.type) {
          case 'positionUpdate':
            timeline.push(event.data);
            runInAction(() => {
              if (!store.hasReceivedFirstTelemetry) {
                store.hasReceivedFirstTelemetry = true;
              }
              if (store.bindingStale) {
                store.bindingStale = false;
              }
            });
            break;
          case 'routeUpdate':
            runInAction(() => {
              store.activeRoute = event.data;
              store.activeRouteIndex = undefined;
              this.renderActiveRoute(event.data);
            });
            break;
          case 'routeProgress':
            runInAction(() => (store.activeRouteIndex = event.data));
            break;
          case 'segmentComplete':
            runInAction(() => (store.segmentComplete = event.data));
            break;
          case 'themeModeUpdate':
            runInAction(() => (store.themeMode = event.data));
            break;
          case 'trailerUpdate':
            runInAction(() => (store.trailerPoint = event.data?.position));
            break;
          case 'mapUpdate':
            runInAction(() => (store.map = event.data));
            localStorage.setItem('map', event.data);
            timeline.reset();
            break;
          case 'jobUpdate':
            break;
          case 'staleBinding':
            runInAction(() => {
              store.bindingStale = true;
            });
            break;
          default:
            throw new UnreachableError(event);
        }
      },
    });

    const duration = 500;
    const render = () => {
      const gameState = timeline.sample(Date.now());
      if (gameState == null) {
        return;
      }

      const { speed, position, heading, game } = gameState;
      const { position: center, bearing } = toPosAndBearing(
        {
          position: {
            X: position.x,
            Y: position.z,
            Z: position.y,
          },
          orientation: {
            heading,
          },
        },
        game === 'ats' ? 'usa' : 'europe',
      );
      const speedMph = Math.round(speed * 2.236936);

      store.truckPoint = center;

      const map = this.mapAdapter.getMap();
      const playerMarker = this.mapAdapter.getPlayerMarker();
      if (!map || !playerMarker) {
        console.log('early return: positionUpdate before map/marker ready');
        return;
      }

      this.renderActiveRouteProgress(store);

      if (prevPosition.every(v => !v)) {
        console.log('reset center', center);
        map.setCenter(center);
        playerMarker.setLngLat(center);
        playerMarker.setRotation(bearing);
      }
      prevPosition = currPosition;
      currPosition = center;
      prevBearing = currBearing;
      currBearing = bearing;

      switch (store.cameraMode) {
        case CameraMode.FOLLOW:
          map.easeTo({
            ...toCameraOptions(center, bearing, speedMph, {
              isNorthLock: store.bearingMode === BearingMode.NORTH_LOCK,
            }),
            duration,
            padding: this.mapAdapter.getPadding(),
            offset: this.mapAdapter.getOffset(),
            easing: t => {
              // HACK update marker here
              markerPosition[0] =
                prevPosition[0] + t * (currPosition[0] - prevPosition[0]);
              markerPosition[1] =
                prevPosition[1] + t * (currPosition[1] - prevPosition[1]);
              markerBearing =
                prevBearing + t * calculateDelta(prevBearing, currBearing);

              playerMarker.setLngLat(markerPosition);
              playerMarker.setRotation(markerBearing);
              return t;
            },
          });
          break;
        case CameraMode.FREE:
          playerMarker.setLngLat(center);
          playerMarker.setRotation(bearing);
          break;
        default:
          throw new UnreachableError(store.cameraMode);
      }
    };

    this.renderIntervalId = setInterval(action(render), duration);
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
    const map = this.mapAdapter.getMap();
    if (!map) {
      // TODO what if map becomes defined after onData fires?
      return;
    }

    const stepSource = assertExists(
      map.getSource<GeoJSONSource>('activeRouteStep'),
    );
    stepSource.setData(emptyFeatureCollection);
    this.lastRenderedActiveStepLine = undefined;

    const routeSource = assertExists(
      map.getSource<GeoJSONSource>('activeRoute'),
    );
    if (!maybeRoute) {
      routeSource.setData(emptyFeatureCollection);
      return;
    }

    routeSource.setData(toRouteFeatures(maybeRoute));

    this.toggleActiveRouteLayers(true);
  }

  renderRoutePreview(
    maybeRoute: Route | undefined,
    options: {
      highlight: boolean;
      index: number;
      animate: boolean;
    },
  ) {
    const map = this.mapAdapter.getMap();
    if (!map) {
      // TODO what if map becomes defined after onData fires?
      return;
    }

    console.log('rendering route preview');
    const routeSource = assertExists(
      map.getSource<GeoJSONSource>(`previewRoute-${options.index}`),
    );
    if (!maybeRoute) {
      routeSource.setData(emptyFeatureCollection);
      return;
    }

    routeSource.setData(toRouteFeatures(maybeRoute));
    if (options.animate) {
      let start = 0;
      const durationMs = 1_000;

      const animate = (timestamp: number) => {
        if (!start) {
          start = timestamp;
        }

        const t = (timestamp - start) / durationMs;
        const progress = Math.min(t, 1);
        map
          .getMap()
          .setPaintProperty(
            `previewRouteLayer-${options.index}`,
            'line-gradient',
            lineGradientExpression({
              lineType: options.highlight
                ? 'animatedPrimaryLine'
                : 'animatedSecondaryLine',
              progress,
            }),
          )
          .setPaintProperty(
            `previewRouteLayer-${options.index}-case`,
            'line-gradient',
            lineGradientExpression({
              lineType: options.highlight
                ? 'animatedPrimaryCase'
                : 'animatedSecondaryCase',
              progress,
            }),
          );

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }

    this.toggleActiveRouteLayers(false);
  }

  private toggleActiveRouteLayers(visible: boolean) {
    const map = this.mapAdapter.getMap();
    if (!map) {
      return;
    }

    // note: setting paint property by getting a reference to the style layer
    // with react-map-gl apis, then calling setpaintproperty on the style layer,
    // does *not* work.
    const visibility = visible ? 'visible' : 'none';
    map
      .getMap()
      .setLayoutProperty('activeRouteLayer', 'visibility', visibility)
      .setLayoutProperty('activeRouteLayer-case', 'visibility', visibility)
      .setLayoutProperty('activeRouteIconsLayer', 'visibility', visibility)
      .setLayoutProperty('activeRouteStartLayer', 'visibility', visibility)
      .setLayoutProperty('activeRouteStepLayer', 'visibility', visibility)
      .setLayoutProperty('activeRouteStepLayer-case', 'visibility', visibility);
  }

  private renderActiveRouteProgress(store: AppStore) {
    const map = this.mapAdapter.getMap();
    if (
      !map ||
      !store.activeRoute ||
      !store.activeRouteIndex ||
      !store.activeStepLine
    ) {
      return;
    }

    let distanceTraveled = 0;
    const activeStep =
      store.activeRoute.segments[store.activeRouteIndex.segmentIndex].steps[
        store.activeRouteIndex.stepIndex
      ];
    for (const { step, featureLength } of store.geoJsonRoute.steps) {
      if (step === activeStep) {
        break;
      }
      distanceTraveled += featureLength;
    }

    const snapPoint = nearestPointOnLine(
      store.activeStepLine.line,
      // cast as mutable, and assume nearestPointOnLine doesn't mutate.
      store.truckPoint as [number, number],
    );
    const distanceAlongActiveStepLine = snapPoint.properties.lineDistance;
    distanceTraveled += distanceAlongActiveStepLine;
    if (distanceTraveled >= 0.2 && snapPoint.properties.dist < 0.1) {
      //center = snapPoint.geometry.coordinates as [number, number];
      //store.truckPoint = center;
    }

    const stepSource = assertExists(
      map.getSource<GeoJSONSource>('activeRouteStep'),
    );
    if (this.lastRenderedActiveStepLine !== store.activeStepLine.line) {
      console.log('rendering step line');
      stepSource.setData(store.activeStepLine.line);
    }
    const stepProgress =
      distanceAlongActiveStepLine / store.activeStepLine.length;
    map
      .getMap()
      .setPaintProperty(
        `activeRouteStepLayer-case`,
        'line-gradient',
        lineGradientExpression({
          lineType: 'case',
          progress: stepProgress,
        }),
      )
      .setPaintProperty(
        'activeRouteStepLayer',
        'line-gradient',
        lineGradientExpression({
          lineType: 'line',
          progress: stepProgress,
        }),
      );

    this.lastRenderedActiveStepLine = store.activeStepLine.line;

    const progress = clamp(
      distanceTraveled / store.geoJsonRoute.featureLength,
      0,
      1,
    );
    map
      .getMap()
      .setPaintProperty(
        'activeRouteLayer-case',
        'line-gradient',
        lineGradientExpression({
          lineType: 'case',
          progress,
        }),
      )
      .setPaintProperty(
        'activeRouteLayer',
        'line-gradient',
        lineGradientExpression({
          lineType: 'line',
          progress,
        }),
      );
  }

  drawStepArrow(step: RouteStep | undefined) {
    const map = this.mapAdapter.getMap();
    if (!map) {
      // TODO what if map becomes defined after onData fires?
      return;
    }

    const arrowSource = assertExists(
      map.getSource<GeoJSONSource>('previewStepArrow'),
    );
    if (!step?.arrowPoints || step.arrowPoints < 2) {
      arrowSource.setData(emptyFeatureCollection);
      return;
    }

    const points = polyline.decode(step.geometry).slice(0, step.arrowPoints);
    const line = lineString(points);
    const bearingDegrees = bearing(points.at(-2)!, points.at(-1)!);
    const arrowHead = point(points.at(-1)!, { bearing: bearingDegrees });

    arrowSource.setData(
      featureCollection<GeoJSON.LineString | GeoJSON.Point>([line, arrowHead]),
    );
  }

  unpauseRouteEvents(store: AppStore, client: AppClient) {
    store.segmentComplete = undefined;
    void client.unpauseRouteEvents.mutate();
  }
}

const emptyFeatureCollection: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
} as const;
