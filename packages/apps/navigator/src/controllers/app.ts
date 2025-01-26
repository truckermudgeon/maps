import { assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import { getExtent } from '@truckermudgeon/base/geom';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import type { Route, RouteDirection } from '@truckermudgeon/navigation/types';
import type { Marker } from 'maplibre-gl';
import { action, makeAutoObservable, observable } from 'mobx';
import type { GeoJSONSource } from 'react-map-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import { CameraMode } from './constants';
import type { AppClient, AppController, AppStore } from './types';

export class AppStoreImpl implements AppStore {
  cameraMode: CameraMode = CameraMode.FOLLOW;
  activeRoute: Route | undefined = undefined;
  activeRouteDirection: RouteDirection | undefined;
  trailerPoint: [lon: number, lat: number] | undefined;
  showNavSheet = false;

  constructor() {
    makeAutoObservable(this, {
      activeRoute: observable.ref,
      activeRouteDirection: observable.ref,
    });
  }
}

export class AppControllerImpl implements AppController {
  private map: MapRef | undefined;
  private playerMarker: Marker | undefined;

  fitPoints(lonLats: [number, number][]) {
    if (!this.map || !this.playerMarker) {
      console.warn("tried to view points but map/marker hasn't loaded");
      return;
    }

    const extent = getExtent([
      ...lonLats,
      this.playerMarker.getLngLat().toArray(),
    ]);
    const sw = [extent[0], extent[1]] as [number, number];
    const ne = [extent[2], extent[3]] as [number, number];
    this.map.fitBounds([sw, ne], {
      duration: 500,
      linear: true,
      pitch: 0,
      bearing: 0,
      padding: 50,
    });
    //this.map.fitBounds([sw, ne], {
    //  curve: 1,
    //  //center: this.playerMarker.getLngLat(),
    //  pitch: 0,
    //  bearing: 0,
    //  padding: { left: 100, bottom: 200, right: 100 },
    //});
  }

  onMapLoad(map: MapRef, player: Marker) {
    Preconditions.checkState(this.map == null);
    Preconditions.checkState(this.playerMarker == null);
    this.map = map;
    this.playerMarker = player;
  }

  onMapDragStart(store: AppStore) {
    store.cameraMode = CameraMode.FREE;
  }

  setFollow(store: AppStore) {
    store.cameraMode = CameraMode.FOLLOW;
  }

  startRouteFlow(store: AppStore) {
    store.showNavSheet = true;
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
    // optimistically set route
    store.activeRoute = route;
    this.renderActiveRoute(route);
    void client.setActiveRoute.mutate(route?.segments.map(s => s.key));
  }

  startListening(store: AppStore, client: AppClient) {
    let prevPosition: Position = [0, 0];
    let currPosition: Position = [0, 0];
    const markerPosition: Position = [0, 0];
    let prevBearing = 0;
    let currBearing = 0;
    let markerBearing = 0;
    console.log('subscribing');
    client.onRouteUpdate.subscribe(undefined, {
      onData: action(maybeRoute => {
        store.activeRoute = maybeRoute;
        this.renderActiveRoute(maybeRoute);
      }),
    });

    client.onPositionUpdate.subscribe(undefined, {
      onData: gameState => {
        const { map, playerMarker } = this;
        if (!map || !playerMarker) {
          return;
        }

        const { speedMph, position: center, bearing } = gameState;
        if (prevPosition.every(v => !v)) {
          map.setCenter(center);
        }
        prevPosition = currPosition;
        currPosition = center;
        prevBearing = currBearing;
        currBearing = bearing;

        // TODO do this in a reaction / observable context?
        switch (store.cameraMode) {
          case CameraMode.FOLLOW:
            map.easeTo({
              ...toCameraOptions(center, bearing, speedMph),
              duration: 500,
              padding: { left: store.showNavSheet ? 440 : 0, top: 400 },
              easing: t => {
                // HACK update marker here
                markerPosition[0] =
                  prevPosition[0] + t * (currPosition[0] - prevPosition[0]);
                markerPosition[1] =
                  prevPosition[1] + t * (currPosition[1] - prevPosition[1]);
                markerBearing = prevBearing + t * (currBearing - prevBearing);

                playerMarker.setLngLat(markerPosition);
                playerMarker.setRotation(toRotation(markerBearing));

                return t;
              },
            });
            break;
          case CameraMode.FREE:
            playerMarker.setLngLat(center);
            playerMarker.setRotation(toRotation(bearing));
            break;
          default:
            throw new UnreachableError(store.cameraMode);
        }
      },
    });

    client.onTrailerUpdate.subscribe(undefined, {
      onData: action(
        maybeTrailerPos => (store.trailerPoint = maybeTrailerPos?.position),
      ),
    });

    client.onDirectionUpdate.subscribe(undefined, {
      onData: action(maybeDir => {
        if (maybeDir) {
          console.log('distance to', maybeDir.distanceMeters);
          if (maybeDir.distanceMeters === 0) {
            console.log(maybeDir);
          }
        }
        if (maybeDir && maybeDir.distanceMeters >= 500) {
          maybeDir = { ...maybeDir, laneHint: undefined };
        }
        store.activeRouteDirection = maybeDir;
      }),
    });
  }

  renderActiveRoute(maybeRoute: Route | undefined) {
    const { map } = this;
    if (!map) {
      // TODO what if map becomes defined after onData fires?
      return;
    }

    const routeSource = assertExists(
      map.getSource('activeRoute') as GeoJSONSource | undefined,
    );
    if (!maybeRoute) {
      routeSource.setData(emptyFeatureCollection);
      return;
    }

    console.log('setting route data', maybeRoute);
    routeSource.setData(toFeatureCollection(maybeRoute));
    // active route layer may have been hidden
    // note: setting paint property by getting a reference to the style layer
    // with react-map-gl apis, then calling setpaintproperty on the style layer,
    // does *not* work.
    map.getMap().setLayoutProperty('activeRouteLayer', 'visibility', 'visible');
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
      map.getSource(`previewRoute-${options.index}`) as
        | GeoJSONSource
        | undefined,
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
      .setLayoutProperty('activeRouteLayer', 'visibility', 'none');
  }
}

const emptyFeatureCollection: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
} as const;

function toFeatureCollection(route: Route): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: route.segments.flatMap(segment => segment.lonLats),
        },
        properties: null,
      },
    ],
  };
}

// bearing is -180, 180. But it's better to set CSS rotation from 0, 360 so that
// transitions are predictable.
function toRotation(bearing: number): number {
  if (bearing >= 0) {
    return bearing;
  }
  return 360 + bearing;
}

function toCameraOptions(center: Position, bearing: number, speedMph: number) {
  let zoom;
  let pitch;
  if (speedMph > 60) {
    zoom = 11.5;
    pitch = 30;
  } else if (speedMph > 30) {
    zoom = 13;
    pitch = 45;
  } else {
    zoom = 14;
    pitch = 50;
  }
  return {
    center,
    bearing,
    zoom,
    pitch,
  };
}
