import type { Route, SearchResult } from '@truckermudgeon/navigation/types';
import { action } from 'mobx';
import type { ChooseOnMapService } from '../services/choose-on-map';
import type { RouteAnimator } from '../services/route-animator';
import type { RouteApi } from '../services/route-api';
import type { RouteRenderer } from '../services/route-renderer';
import type { TelemetryService } from '../services/telemetry';
import type { CameraStore, NavSheetStore, RouteStore } from '../stores/types';
import { clearCredentialsAndReload } from '../util/browser';

export class AppControllerImpl {
  constructor(
    private readonly camera: CameraStore,
    private readonly route: RouteStore,
    private readonly navSheetStore: NavSheetStore,
    private readonly routeRenderer: RouteRenderer,
    private readonly chooseOnMapService: ChooseOnMapService,
    private readonly routeApi: RouteApi,
    private readonly telemetryService: TelemetryService,
    private readonly routeAnimator: RouteAnimator,
  ) {}

  forceRePair() {
    this.telemetryService.stop();
    this.routeAnimator.stop();
    clearCredentialsAndReload();
  }

  hideNavSheet() {
    console.log('hide nav sheet');
    this.navSheetStore.showNavSheet = false;
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
    this.routeAnimator.start(this.camera, this.route);
  }

  synthesizeSearchResult(): Promise<SearchResult> {
    return this.routeApi.synthesizeSearchResult(
      this.chooseOnMapService.getChosenLngLat(),
    );
  }

  unpauseRouteEvents() {
    this.route.segmentComplete = undefined;
    void this.routeApi.unpauseRouteEvents();
  }
}
