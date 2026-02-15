import polyline from '@mapbox/polyline';
import { assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import { getExtent } from '@truckermudgeon/base/geom';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import { toPosAndBearing } from '@truckermudgeon/navigation/helpers';
import type {
  JobState,
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
import { CameraMode } from './constants';
import { TelemetryTimeline } from './telemetry-timeline';
import type { AppClient, AppController, AppStore } from './types';

export class AppStoreImpl implements AppStore {
  themeMode: 'light' | 'dark' = 'light';
  cameraMode: CameraMode = CameraMode.FOLLOW;
  activeRoute: Route | undefined = undefined;
  activeRouteIndex: RouteIndex | undefined = undefined;
  truckPoint: [lon: number, lat: number] = [0, 0];
  trailerPoint: [lon: number, lat: number] | undefined;
  showNavSheet = false;

  currentJob: JobState | undefined;

  segmentComplete: SegmentInfo | undefined = undefined;

  constructor() {
    makeAutoObservable(this, {
      activeRoute: observable.ref,
      activeRouteIndex: observable.struct,
      truckPoint: observable.ref,
      trailerPoint: observable.ref,
      currentJob: observable.ref,
      segmentComplete: observable.ref,
    });
  }

  get isReceivingTelemetry(): boolean {
    return this.truckPoint[0] !== 0 && this.truckPoint[1] !== 0;
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

  private get activeStepLine():
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
  private wakeLock?: WakeLockSentinel = undefined;

  setupWakeLock() {
    Preconditions.checkState(this.wakeLock == null);

    const requestWakeLock = async () => {
      try {
        this.wakeLock = await navigator.wakeLock.request();
      } catch (err) {
        if (err instanceof Error) {
          console.error(
            `error requestion wakelock: ${err.name}, ${err.message}`,
          );
        } else {
          console.error('unknown error requesting wakelock:', err);
        }
      }
    };

    const handleVisibilityChange = async () => {
      if (this.wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };

    void requestWakeLock();
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    document.addEventListener('visibilitychange', handleVisibilityChange);
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
  clearPitchAndBearing(store: AppStore) {
    console.log('clear pitch and bearing');
    Preconditions.checkState(this.map != null);
    this.map.panTo(this.map.getCenter(), {
      duration: 500,
      pitch: 0,
      zoom: 11.5,
      bearing: 0,
      padding: { left: store.showNavSheet ? 400 : 0, top: 0 },
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
    console.log('fitting to', sw, ne);
    this.map.fitBounds([sw, ne], {
      duration: 500,
      linear: true,
      pitch: 0,
      bearing: 0,
      //padding: { left: store.showNavSheet ? 220 : 0, bottom: 100, top: 0 },
      offset: [0, -100],
    });
    //this.map.fitBounds([sw, ne], {
    //  curve: 1,
    //  //center: this.playerMarker.getLngLat(),
    //  pitch: 0,
    //  bearing: 0,
    //  padding: { left: 100, bottom: 200, right: 100 },
    //});
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
      // TODO
      padding: 50,
    });
  }

  onMapLoad(map: MapRef, player?: Marker) {
    Preconditions.checkState(this.map == null);
    Preconditions.checkState(this.playerMarker == null);
    this.map = map;
    this.playerMarker = player;
  }

  setFree(store: AppStore) {
    store.cameraMode = CameraMode.FREE;
  }

  setFollow(store: AppStore) {
    store.cameraMode = CameraMode.FOLLOW;
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
    let prevPosition: Position = [0, 0];
    let currPosition: Position = [0, 0];
    const markerPosition: Position = [0, 0];
    let prevBearing = 0;
    let currBearing = 0;
    let markerBearing = 0;
    console.log('subscribing');

    const timeline = new TelemetryTimeline({
      lookbackMs: 250,
      maxExtrapolationMs: 500,
      emaAlpha: 0.5,
    });

    client.subscribeToDevice.subscribe(void 0, {
      onData: event => {
        switch (event.type) {
          case 'positionUpdate':
            timeline.push(event.data);
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
          case 'jobUpdate':
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

      const { speed, position, heading } = gameState;
      const { position: center, bearing } = toPosAndBearing({
        position: {
          X: position.x,
          Y: position.z,
          Z: position.y,
        },
        orientation: {
          heading,
        },
      });
      const speedMph = Math.round(speed * 2.236936);

      store.truckPoint = center;

      const { map, playerMarker } = this;
      if (!map || !playerMarker) {
        console.log('early return onPositionUpdate');
        return;
      }

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
            ...toCameraOptions(center, bearing, speedMph),
            duration,
            padding: {
              left: store.showNavSheet || store.activeRoute ? 440 : 0,
              top: 550,
            },
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

    setInterval(action(render), duration);
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

    const routeSource = assertExists(
      map.getSource<GeoJSONSource>('activeRoute'),
    );
    const iconsSource = assertExists(
      map.getSource<GeoJSONSource>('activeRouteIcons'),
    );
    if (!maybeRoute) {
      routeSource.setData(emptyFeatureCollection);
      iconsSource.setData(emptyFeatureCollection);
      return;
    }

    console.log('setting route data', maybeRoute);
    routeSource.setData(toFeatureCollection(maybeRoute));
    iconsSource.setData(toFeatureCollection(maybeRoute));
    // active route layer may have been hidden
    // note: setting paint property by getting a reference to the style layer
    // with react-map-gl apis, then calling setpaintproperty on the style layer,
    // does *not* work.
    map
      .getMap()
      .setLayoutProperty('activeRouteLayer', 'visibility', 'visible')
      .setLayoutProperty('activeRouteLayer-case', 'visibility', 'visible')
      .setLayoutProperty('activeRouteIconsLayer', 'visibility', 'visible');
  }

  renderRoutePreview(
    maybeRoute: Route,
    options: {
      highlight: boolean;
      index: number;
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

    routeSource.setData(toFeatureCollection(maybeRoute));
    // note: setting paint property by getting a reference to the style layer
    // with react-map-gl apis, then calling setpaintproperty on the style layer,
    // does *not* work.
    map
      .getMap()
      .setPaintProperty(
        `previewRouteLayer-${options.index}`,
        'line-opacity',
        options.highlight ? 1 : 0.25,
      )
      .setPaintProperty(
        `previewRouteLayer-${options.index}-case`,
        'line-opacity',
        options.highlight ? 1 : 0.25,
      )
      .setLayoutProperty('activeRouteLayer', 'visibility', 'none')
      .setLayoutProperty('activeRouteLayer-case', 'visibility', 'none');
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
      arrowSource.setData(featureCollection([]));
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

export function toFeatureCollection(route: Route): GeoJSON.FeatureCollection {
  const iconFeatures: GeoJSON.Feature<GeoJSON.Point>[] = route.segments.flatMap(
    segment =>
      segment.steps.flatMap(step =>
        step.trafficIcons.flatMap(icon => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: icon.lonLat,
          },
          properties: {
            sprite: icon.type === 'stop' ? 'stopsign' : 'trafficlight',
          },
        })),
      ),
  );

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: route.segments.flatMap(segment =>
            segment.steps.flatMap(step => polyline.decode(step.geometry)),
          ),
        },
        properties: null,
      },
      ...iconFeatures,
    ],
  };
}

function calculateDelta(currBearing: number, nextBearing: number): number {
  const normalizedCurr = currBearing % 360;
  const normalizedNext = nextBearing > 0 ? nextBearing : nextBearing + 360;
  let delta = normalizedNext - normalizedCurr;
  if (delta > 180) {
    delta -= 360;
  }
  return delta;
}

function toCameraOptions(center: Position, bearing: number, speedMph: number) {
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
    bearing,
    zoom,
    pitch,
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
