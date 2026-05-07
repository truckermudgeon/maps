import type { Route, SearchResult } from '@truckermudgeon/navigation/types';
import { action } from 'mobx';
import type { MapPresenter } from '../services/map-presenter';
import { RouteAnimator } from '../services/route-animator';
import * as routeApi from '../services/route-api';
import { TelemetryService } from '../services/telemetry';
import type { CameraStoreImpl } from '../stores/camera';
import type { RouteStoreImpl } from '../stores/route';
import type { SessionStoreImpl } from '../stores/session';
import type { ControlsStore, NavSheetStore } from '../stores/types';
import { clearCredentialsAndReload, requestWakeLock } from '../util/browser';
import type { AppClient } from './types';

export class AppControllerImpl {
  private readonly telemetryService: TelemetryService;
  private readonly routeAnimator: RouteAnimator;

  constructor(
    private readonly session: SessionStoreImpl,
    private readonly camera: CameraStoreImpl,
    private readonly route: RouteStoreImpl,
    private readonly navSheetStore: NavSheetStore,
    private readonly mapPresenter: MapPresenter,
    controlsStore: ControlsStore,
    private readonly appClient: AppClient,
  ) {
    this.telemetryService = new TelemetryService(
      session,
      route,
      controlsStore,
      mapPresenter.routeRenderer,
    );
    this.routeAnimator = new RouteAnimator(
      mapPresenter.mapAdapter,
      mapPresenter.routeRenderer,
      this.telemetryService.timeline,
    );
  }

  forceRePair() {
    this.telemetryService.stop();
    this.routeAnimator.stop();
    clearCredentialsAndReload();
  }

  requestWakeLock() {
    requestWakeLock();
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
    this.mapPresenter.renderActiveRoute(route);
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
      this.mapPresenter.chooseOnMapService.getChosenLngLat(),
    );
  }

  unpauseRouteEvents() {
    this.route.segmentComplete = undefined;
    void routeApi.unpauseRouteEvents(this.appClient);
  }
}
