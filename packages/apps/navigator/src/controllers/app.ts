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
  StepManeuver,
} from '@truckermudgeon/navigation/types';
import bearing from '@turf/bearing';
import { featureCollection, lineString, point } from '@turf/helpers';
import { length } from '@turf/length';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import type { GeoJSONSource } from 'maplibre-gl';
import { Marker } from 'maplibre-gl';
import { action, makeAutoObservable, observable, runInAction } from 'mobx';
import type { MapRef } from 'react-map-gl/maplibre';
import { lineGradientExpression } from '../components/RoutesStyle';
import { toRouteFeatures } from '../route-features';
import { BearingMode, CameraMode } from './constants';
import { TelemetryTimeline } from './telemetry-timeline';
import type { AppClient, AppController, AppStore } from './types';

export class AppStoreImpl implements AppStore {
  themeMode: 'light' | 'dark' = 'light';
  cameraMode: CameraMode = CameraMode.FOLLOW;
  bearingMode: BearingMode = BearingMode.MATCH_MAP;
  activeRoute: Route | undefined = undefined;
  activeRouteIndex: RouteIndex | undefined = undefined;
  truckPoint: [lon: number, lat: number] = [0, 0];
  trailerPoint: [lon: number, lat: number] | undefined;
  showNavSheet = false;
  readyToLoad = false;
  mapLoaded = false;
  hasReceivedFirstTelemetry = false;
  bindingStale = false;

  segmentComplete: SegmentInfo | undefined = undefined;

  constructor(public map: 'usa' | 'europe') {
    makeAutoObservable(this, {
      activeRoute: observable.ref,
      activeRouteIndex: observable.struct,
      truckPoint: observable.ref,
      trailerPoint: observable.ref,
      segmentComplete: observable.ref,
    });
  }

  private get activeStep(): RouteStep | undefined {
    // N.B.: activeRoute and activeRouteIndex can get out of sync. An undefined
    // activeRouteIndex signals this, and forces an early exit here so that
    // a possibly-invalid StepManeuver isn't calculated.
    if (!this.activeRoute || this.activeRouteIndex == null) {
      return undefined;
    }

    const { segmentIndex, stepIndex } = this.activeRouteIndex;
    return assertExists(
      this.activeRoute.segments[segmentIndex].steps[stepIndex],
    );
  }

  private get nextStep(): RouteStep | undefined {
    if (!this.activeRoute || !this.activeStep) {
      return;
    }
    return getNextStep(this.activeStep, this.activeRoute);
  }

  private get nextStepArrow():
    | {
        geometry: GeoJSON.Feature<GeoJSON.LineString>;
        length: number;
      }
    | undefined {
    if (!this.nextStep?.arrowPoints) {
      return;
    }

    const arrowPoints = polyline
      .decode(this.nextStep.geometry)
      .slice(0, this.nextStep.arrowPoints);
    const arrow = lineString(arrowPoints);
    return {
      geometry: arrow,
      length: length(arrow),
    };
  }

  get activeStepLine():
    | {
        line: GeoJSON.Feature<GeoJSON.LineString>;
        length: number;
        arrow?: {
          geometry: GeoJSON.Feature<GeoJSON.LineString>;
          length: number;
        };
      }
    | undefined {
    if (!this.activeStep) {
      return undefined;
    }

    const linePoints = polyline.decode(this.activeStep.geometry);
    const line = lineString(linePoints);
    let arrow;
    if (this.activeStep.arrowPoints) {
      const geometry = lineString(
        linePoints.slice(0, this.activeStep.arrowPoints),
      );
      arrow = {
        geometry,
        length: length(geometry),
      };
    }
    return {
      line,
      length: length(line),
      arrow,
    };
  }

  get activeRouteSummary():
    | { distanceMeters: number; minutes: number }
    | undefined {
    const firstWayPointSummary = this.activeRouteToFirstWayPointSummary;
    if (!firstWayPointSummary || !this.activeRoute || !this.activeRouteIndex) {
      return;
    }

    const restSegments = this.activeRoute.segments.slice(
      this.activeRouteIndex.segmentIndex + 1,
    );

    const restSegmentTotals = restSegments
      .flatMap(segment => segment.steps)
      .reduce(routeSummaryReducer, {
        duration: 0,
        distanceMeters: 0,
        activeRouteNodeIndex: this.activeRouteIndex.nodeIndex,
      });

    return {
      distanceMeters:
        firstWayPointSummary.distanceMeters + restSegmentTotals.distanceMeters,
      minutes:
        firstWayPointSummary.minutes +
        Math.ceil(restSegmentTotals.duration / 60),
    };
  }

  get activeRouteToFirstWayPointSummary():
    | { distanceMeters: number; minutes: number }
    | undefined {
    if (!this.activeRoute || !this.activeRouteIndex) {
      return;
    }

    const [firstSegment] = this.activeRoute.segments.slice(
      this.activeRouteIndex.segmentIndex,
    );

    const firstSegmentTotals = firstSegment.steps
      .slice(this.activeRouteIndex.stepIndex)
      .reduce(routeSummaryReducer, {
        duration: 0,
        distanceMeters: 0,
        activeRouteNodeIndex: this.activeRouteIndex.nodeIndex,
      });

    return {
      distanceMeters: firstSegmentTotals.distanceMeters,
      minutes: Math.ceil(firstSegmentTotals.duration / 60),
    };
  }

  get activeRouteDirection(): StepManeuver | undefined {
    if (!this.activeStepLine) {
      return;
    }

    const { line } = this.activeStepLine;
    // check for degenerate lines
    const firstCoord = line.geometry.coordinates[0];
    if (
      line.geometry.coordinates.every(
        pos => pos[0] === firstCoord[0] && pos[1] === firstCoord[1],
      )
    ) {
      return undefined; //this.activeStep?.maneuver;
    }

    const distanceAlongLineKm = nearestPointOnLine(line, this.truckPoint)
      .properties.location;
    if (distanceAlongLineKm < (this.activeStepLine.arrow?.length ?? 0) / 2) {
      return this.activeStep?.maneuver;
    }
    return this.nextStep?.maneuver;
  }

  get distanceToNextManeuver(): number {
    if (!this.activeStepLine) {
      return 0;
    }

    const { line, length } = this.activeStepLine;
    // check for degenerate lines
    const firstCoord = line.geometry.coordinates[0];
    if (
      line.geometry.coordinates.every(
        pos => pos[0] === firstCoord[0] && pos[1] === firstCoord[1],
      )
    ) {
      return 0;
    }

    const distanceAlongLineKm = nearestPointOnLine(line, this.truckPoint)
      .properties.location;
    const arrowMidpointLocation = (this.activeStepLine.arrow?.length ?? 0) / 2;
    if (distanceAlongLineKm < arrowMidpointLocation) {
      return ((arrowMidpointLocation - distanceAlongLineKm) * 1000) / 19.668;
    }

    return (
      ((length - distanceAlongLineKm + (this.nextStepArrow?.length ?? 0) / 2) *
        1000) /
      19.668
    );
  }

  get activeArrowStep(): RouteStep | undefined {
    if (!this.activeStepLine) {
      return;
    }
    const { line } = this.activeStepLine;
    // check for degenerate lines
    const firstCoord = line.geometry.coordinates[0];
    if (
      line.geometry.coordinates.every(
        pos => pos[0] === firstCoord[0] && pos[1] === firstCoord[1],
      )
    ) {
      return undefined;
    }

    const distanceAlongLineKm = nearestPointOnLine(line, this.truckPoint)
      .properties.location;
    if (distanceAlongLineKm < (this.activeStepLine.arrow?.length ?? 0) / 2) {
      return this.activeStep!;
    }
    return this.nextStep!;
  }

  get geoJsonRoute(): {
    steps: readonly { step: RouteStep; featureLength: number }[];
    featureLength: number;
  } {
    if (!this.activeRoute) {
      return {
        steps: [],
        featureLength: 0,
      };
    }

    let totalLength = 0;
    const steps = this.activeRoute.segments.flatMap(s =>
      s.steps.map(step => {
        const points = polyline.decode(step.geometry);
        const stepLine = lineString(points);
        const featureLength = length(stepLine);
        totalLength += featureLength;
        return {
          step,
          featureLength,
        };
      }),
    );
    return {
      steps,
      featureLength: totalLength,
    };
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
                // Telemetry resumed after a staleBinding event; the
                // server has re-armed and will fire staleBinding again
                // on any future loss.
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
            // Server has gone past its no-telemetry grace window. Surface a
            // prompt via the WaitingForTelemetry UI; the user picks the
            // recovery action (try again vs. re-pair) instead of us
            // clearing credentials behind their back.
            runInAction(() => {
              console.log('stale binding message received');
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

function calculateDelta(currBearing: number, nextBearing: number): number {
  const normalizedCurr = currBearing % 360;
  const normalizedNext = nextBearing > 0 ? nextBearing : nextBearing + 360;
  let delta = normalizedNext - normalizedCurr;
  if (delta > 180) {
    delta -= 360;
  }
  return delta;
}

function toCameraOptions(
  center: Position,
  bearing: number,
  speedMph: number,
  options: { isNorthLock: boolean },
) {
  let zoom;
  let pitch;
  if (speedMph > 60) {
    zoom = 11;
    pitch = 30;
  } else if (speedMph > 30) {
    zoom = 12;
    pitch = 45;
  } else {
    zoom = 13;
    pitch = 50;
  }
  return {
    center,
    zoom: options.isNorthLock ? zoom - 2 : zoom,
    pitch: options.isNorthLock ? 0 : pitch,
    bearing: options.isNorthLock ? 0 : bearing,
  };
}

function getNextStep(step: RouteStep, route: Route): RouteStep | undefined {
  const allSteps = route.segments.flatMap(segment => segment.steps);
  const index = allSteps.indexOf(step);
  if (index === -1) {
    return undefined;
  }
  return allSteps[index + 1];
}

const routeSummaryReducer = (
  acc: {
    duration: number;
    distanceMeters: number;
    activeRouteNodeIndex: number;
  },
  step: RouteStep,
  stepIndex: number,
) => {
  const stepFraction =
    stepIndex === 0
      ? // TODO tests.
        (step.nodesTraveled - acc.activeRouteNodeIndex) / step.nodesTraveled
      : 1;

  // TODO figure this out. is it because of arrival steps?
  let dDuration = step.duration * stepFraction;
  if (isNaN(dDuration) || !isFinite(dDuration)) {
    dDuration = 0;
  }
  let dDistance = step.distanceMeters * stepFraction;
  if (isNaN(dDistance) || !isFinite(dDistance)) {
    dDistance = 0;
  }

  acc.duration += dDuration;
  acc.distanceMeters += dDistance;
  return acc;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
