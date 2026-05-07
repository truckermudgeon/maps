import type { Route, SearchResult } from '@truckermudgeon/navigation/types';
import { action } from 'mobx';
import type { ChooseOnMapService } from '../services/choose-on-map';
import type { MapAdapter } from '../services/map-adapter';
import { RouteAnimator } from '../services/route-animator';
import * as routeApi from '../services/route-api';
import type { RouteRenderer } from '../services/route-renderer';
import { TelemetryService } from '../services/telemetry';
import type {
  CameraStore,
  ControlsStore,
  NavSheetStore,
  RouteStore,
  SessionStore,
} from '../stores/types';
import { clearCredentialsAndReload } from '../util/browser';
import type { AppClient } from './types';

export class AppControllerImpl {
  private readonly telemetryService: TelemetryService;
  private readonly routeAnimator: RouteAnimator;

  constructor(
    private readonly session: SessionStore,
    private readonly camera: CameraStore,
    private readonly route: RouteStore,
    private readonly navSheetStore: NavSheetStore,
    mapAdapter: MapAdapter,
    private readonly routeRenderer: RouteRenderer,
    private readonly chooseOnMapService: ChooseOnMapService,
    controlsStore: ControlsStore,
    private readonly appClient: AppClient,
  ) {
    this.telemetryService = new TelemetryService(
      session,
      route,
      controlsStore,
      routeRenderer,
    );
    this.routeAnimator = new RouteAnimator(
      mapAdapter,
      routeRenderer,
      this.telemetryService.timeline,
    );
  }

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
    this.routeRenderer.renderActiveRoute(route);
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

  startListening() {
    this.telemetryService.start(this.appClient);
    this.routeAnimator.start(this.camera, this.route);
  }

  synthesizeSearchResult(): Promise<SearchResult> {
    return routeApi.synthesizeSearchResult(
      this.appClient,
      this.chooseOnMapService.getChosenLngLat(),
    );
  }

  unpauseRouteEvents() {
    this.route.segmentComplete = undefined;
    void routeApi.unpauseRouteEvents(this.appClient);
  }
}
