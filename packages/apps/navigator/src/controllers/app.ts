import type { Route, SearchResult } from '@truckermudgeon/navigation/types';
import { action } from 'mobx';
import type { MapMarkers } from '../services/map';
import type { RouteApi } from '../services/route-api';
import type { RouteRenderer } from '../services/route-renderer';
import type { TelemetryService } from '../services/telemetry';
import type { TelemetryPlayer } from '../services/telemetry-player';
import type { CameraStore, RouteStore } from '../stores/types';
import { clearCredentialsAndReload } from '../util/browser';
import type { AppController } from './types';

export class AppControllerImpl implements AppController {
  constructor(
    private readonly camera: CameraStore,
    private readonly route: RouteStore,
    private readonly routeRenderer: RouteRenderer,
    private readonly mapMarkers: MapMarkers,
    private readonly routeApi: RouteApi,
    private readonly telemetryService: TelemetryService,
    private readonly telemetryPlayer: TelemetryPlayer,
  ) {}

  forceRePair() {
    this.telemetryService.stop();
    this.telemetryPlayer.stop();
    clearCredentialsAndReload();
  }

  setDestinationNodeUid(toNodeUid: string) {
    void this.routeApi.previewRoutes(toNodeUid).then(
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
    this.routeRenderer.renderActiveRoute(route);
    void this.routeApi.setActiveRoute(route?.segments.map(s => s.key));
  }

  setActiveRouteFromNodeUids(waypoints: bigint[]) {
    void this.routeApi
      .generateRouteFromNodeUids(waypoints.map(wp => wp.toString(16)))
      .then(
        action(route => {
          this.setActiveRoute(route);
        }),
      );
  }

  startListening() {
    this.telemetryService.start();
    this.telemetryPlayer.start(this.camera, this.route);
  }

  synthesizeSearchResult(): Promise<SearchResult> {
    return this.routeApi.synthesizeSearchResult(
      this.mapMarkers.getChooseOnMapMarkerLngLat(),
    );
  }

  unpauseRouteEvents() {
    this.route.segmentComplete = undefined;
    void this.routeApi.unpauseRouteEvents();
  }
}
