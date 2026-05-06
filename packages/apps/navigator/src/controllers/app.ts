import polyline from '@mapbox/polyline';
import { assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import { center, getExtent } from '@truckermudgeon/base/geom';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
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
import type { GeoJSONSource } from 'maplibre-gl';
import { Marker } from 'maplibre-gl';
import { action, makeAutoObservable, runInAction } from 'mobx';
import type { MapRef } from 'react-map-gl/maplibre';
import { lineGradientExpression } from '../components/RoutesStyle';
import { toRouteFeatures } from '../route-features';
import { CameraStoreImpl } from '../stores/camera';
import { RouteStoreImpl } from '../stores/route';
import { SessionStoreImpl } from '../stores/session';
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
  private map: MapRef | undefined;
  private playerMarker: Marker | undefined;
  private chooseOnMapUi:
    | {
        marker: Marker;
        unsubscribeOnMove: () => void;
      }
    | undefined;
  private deviceSubscription: { unsubscribe: () => void } | undefined;
  private renderIntervalId: ReturnType<typeof setInterval> | undefined;
  private wakeLock?: WakeLockSentinel = undefined;
  private padding = {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  };
  private offset: [number, number] = [0, 0];
  private lastRenderedActiveStepLine:
    | GeoJSON.Feature<GeoJSON.LineString>
    | undefined;

  setPadding(padding: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }) {
    this.padding = padding;
    if (this.map) {
      this.map.easeTo({ padding });
    }
  }

  setOffset(offset: [number, number]) {
    this.offset = offset;
    if (this.map) {
      this.map.easeTo({ offset });
    }
  }

  forceRePair() {
    console.log('forceRePair: clearing viewer credentials and reloading');
    this.deviceSubscription?.unsubscribe();
    this.deviceSubscription = undefined;
    if (this.renderIntervalId != null) {
      clearInterval(this.renderIntervalId);
      this.renderIntervalId = undefined;
    }
    localStorage.removeItem('viewerId');
    localStorage.removeItem('telemetryId');
    // SessionGate decides what to render based on local useState that's
    // initialized from localStorage at mount; reload to restart that flow
    // at the pairing form.
    window.location.reload();
  }

  requestWakeLock() {
    if (this.wakeLock != null && !this.wakeLock.released) {
      console.log('already have a wakelock');
      return;
    }

    const requestWakeLock = async () => {
      try {
        console.log('requesting wake lock');
        this.wakeLock = await navigator.wakeLock.request();
        console.log('wake lock released?:', this.wakeLock.released);
      } catch (err) {
        if (err instanceof Error) {
          console.error(
            `error requesting wakelock: ${err.name}, ${err.message}`,
          );
        } else {
          console.error('unknown error requesting wakelock:', err);
        }
      }
    };

    void requestWakeLock();
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

  // used for choose-on-map ui
  clearPitchAndBearing(_store: AppStore) {
    console.log('clear pitch and bearing');
    Preconditions.checkState(this.map != null);
    this.map.panTo(this.map.getCenter(), {
      duration: 500,
      pitch: 0,
      zoom: 10,
      bearing: 0,
    });
  }

  fitPoints(_store: AppStore, lonLats: [number, number][]) {
    if (!this.map || !this.playerMarker) {
      console.warn("tried to view points but map/marker hasn't loaded");
      return;
    }

    const extent = getExtent([
      ...lonLats,
      //this.playerMarker.getLngLat().toArray(),
    ]);
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

  flyTo(_store: AppStore, lonLat: [number, number], bearing = 0) {
    if (!this.map) {
      console.warn("tried to fly butmap hasn't loaded");
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

  onMapLoad(map: MapRef, player: Marker) {
    this.map = map;
    this.playerMarker = player;
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
            runInAction(() => {
              store.themeMode = event.data;
              // HACK is this the best way to change theme mode, outside of a React
              // component?
              const htmlElement = document.documentElement;
              htmlElement.setAttribute('data-joy-color-scheme', event.data);
              htmlElement.setAttribute('data-mui-color-scheme', event.data);
            });
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

      const { map, playerMarker } = this;
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
            padding: this.padding,
            offset: this.offset,
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
    Preconditions.checkState(this.chooseOnMapUi != null);
    return client.synthesizeSearchResult.query(
      this.chooseOnMapUi.marker.getLngLat().toArray(),
    );
  }

  toggleChooseOnMapUi(_store: AppStore, enable: boolean) {
    if (!enable) {
      if (!this.chooseOnMapUi) {
        return;
      }

      this.chooseOnMapUi.marker.remove();
      this.chooseOnMapUi.unsubscribeOnMove();
      this.chooseOnMapUi = undefined;
    } else {
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
  }

  renderActiveRoute(maybeRoute: Route | undefined) {
    const { map } = this;
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
    const { map } = this;
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
    if (!this.map) {
      return;
    }

    // note: setting paint property by getting a reference to the style layer
    // with react-map-gl apis, then calling setpaintproperty on the style layer,
    // does *not* work.
    const visibility = visible ? 'visible' : 'none';
    this.map
      .getMap()
      .setLayoutProperty('activeRouteLayer', 'visibility', visibility)
      .setLayoutProperty('activeRouteLayer-case', 'visibility', visibility)
      .setLayoutProperty('activeRouteIconsLayer', 'visibility', visibility)
      .setLayoutProperty('activeRouteStartLayer', 'visibility', visibility)
      .setLayoutProperty('activeRouteStepLayer', 'visibility', visibility)
      .setLayoutProperty('activeRouteStepLayer-case', 'visibility', visibility);
  }

  private renderActiveRouteProgress(store: AppStore) {
    if (
      !this.map ||
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
      this.map.getSource<GeoJSONSource>('activeRouteStep'),
    );
    if (this.lastRenderedActiveStepLine !== store.activeStepLine.line) {
      console.log('rendering step line');
      stepSource.setData(store.activeStepLine.line);
    }
    const stepProgress =
      distanceAlongActiveStepLine / store.activeStepLine.length;
    this.map
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
    this.map
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
    const { map } = this;
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
