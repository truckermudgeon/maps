import { assertExists } from '@truckermudgeon/base/assert';
import { UnreachableError } from '@truckermudgeon/base/precon';
import type { PoiType } from '@truckermudgeon/navigation/constants';
import { ScopeType } from '@truckermudgeon/navigation/constants';
import type { Route, SearchResult } from '@truckermudgeon/navigation/types';
import { action, makeAutoObservable, observable } from 'mobx';
import { NavPageKey } from './constants';
import type { AppClient, NavSheetController, NavSheetStore } from './types';

export class NavSheetStoreImpl implements NavSheetStore {
  currentPageKey = NavPageKey.CATEGORIES;

  isLoading = false;
  selectedPoiTypeLabel: string | undefined = undefined;

  destinations: SearchResult[] = [];
  selectedDestination: SearchResult | undefined = undefined;

  routes: Route[] = [];
  selectedRoute: Route | undefined = undefined;

  constructor() {
    makeAutoObservable(this, {
      destinations: observable.ref,
      selectedDestination: observable.ref,
      routes: observable.ref,
      selectedRoute: observable.ref,
    });
  }

  get title(): string {
    switch (this.currentPageKey) {
      case NavPageKey.CATEGORIES:
        return 'Choose destination';
      case NavPageKey.DESTINATIONS:
        return assertExists(this.selectedPoiTypeLabel);
      case NavPageKey.ROUTES:
        return `Routes to ${assertExists(this.selectedDestination).name}`;
      default:
        throw new UnreachableError(this.currentPageKey);
    }
  }

  get showBackButton(): boolean {
    return this.currentPageKey !== NavPageKey.CATEGORIES;
  }
}

export class NavSheetControllerImpl implements NavSheetController {
  constructor(private readonly appClient: AppClient) {}

  onBackClick(store: NavSheetStore) {
    switch (store.currentPageKey) {
      case NavPageKey.CATEGORIES:
        // shouldn't be able to press 'Back' from the 'types' page.
        throw new Error();
      case NavPageKey.DESTINATIONS:
        this.reset(store);
        break;
      case NavPageKey.ROUTES:
        store.currentPageKey = NavPageKey.DESTINATIONS;
        store.selectedDestination = undefined;
        store.routes = [];
        store.selectedRoute = undefined;
        break;
      default:
        throw new UnreachableError(store.currentPageKey);
    }
  }

  onDestinationTypeClick(store: NavSheetStore, type: PoiType, label: string) {
    store.selectedPoiTypeLabel = label;
    store.currentPageKey = NavPageKey.DESTINATIONS;
    store.isLoading = true;

    void this.appClient.search
      .query({
        type,
        scope: ScopeType.NEARBY,
      })
      .then(
        action(response => {
          store.destinations = response;
          store.selectedDestination = undefined;
        }),
      )
      .finally(action(() => (store.isLoading = false)));
  }

  onDestinationHighlight(store: NavSheetStore, dest: SearchResult): void {
    // toggles if `dest` is the currently selected dest.
    store.selectedDestination =
      dest === store.selectedDestination ? undefined : dest;
  }

  onDestinationGoClick(store: NavSheetStore, dest: SearchResult): void {
    console.log('go', dest);
    store.selectedDestination = dest;
  }

  onDestinationRoutesClick(store: NavSheetStore, dest: SearchResult): void {
    console.log('routes', dest);
    store.selectedDestination = dest;
    store.currentPageKey = NavPageKey.ROUTES;
    store.isLoading = true;

    void this.appClient.previewRoutes
      .query({
        toNodeUid: dest.nodeUid,
      })
      .then(
        action(routes => {
          store.isLoading = false;
          store.routes = routes;
          // highlight the first one
          store.selectedRoute = store.routes[0];
        }),
      );
  }

  onRouteHighlight(store: NavSheetStore, route: Route): void {
    console.log('highlight route', route);
    store.selectedRoute = route;
  }

  onRouteGoClick(store: NavSheetStore, route: Route): void {
    console.log('go route', route);
    store.selectedRoute = route;
  }

  reset(store: NavSheetStore) {
    console.log('nav sheet reset');
    store.currentPageKey = NavPageKey.CATEGORIES;

    store.isLoading = false;
    store.selectedPoiTypeLabel = undefined;

    store.destinations = [];
    store.selectedDestination = undefined;

    store.routes = [];
    store.selectedRoute = undefined;
  }
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
