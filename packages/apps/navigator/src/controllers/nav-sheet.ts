import { assertExists } from '@truckermudgeon/base/assert';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import type { PoiType } from '@truckermudgeon/navigation/constants';
import { ScopeType } from '@truckermudgeon/navigation/constants';
import type {
  Route,
  RouteWithSummary,
  SearchResult,
  SearchResultWithRelativeTruckInfo,
} from '@truckermudgeon/navigation/types';
import { action, makeAutoObservable, observable, when } from 'mobx';
import { destinations } from '../components/DestinationTypes';
import { NavPageKey } from './constants';
import type {
  AppClient,
  AppController,
  NavSheetController,
  NavSheetStore,
} from './types';

export class NavSheetStoreImpl implements NavSheetStore {
  readonly pageStack: NavPageKey[] = [NavPageKey.CHOOSE_DESTINATION];

  isLoading = false;
  disableFitToBounds = false;

  searchQuery = '';
  destinations: SearchResultWithRelativeTruckInfo[] = [];
  selectedDestination: SearchResult | undefined = undefined;

  routes: RouteWithSummary[] = [];
  selectedRoute: Route | undefined = undefined;

  constructor() {
    makeAutoObservable(this, {
      destinations: observable.ref,
      selectedDestination: observable.ref,
      routes: observable.ref,
      selectedRoute: observable.ref,
    });
  }

  get currentPageKey(): NavPageKey {
    return assertExists(this.pageStack.at(-1));
  }

  get title(): string {
    switch (this.currentPageKey) {
      case NavPageKey.CHOOSE_DESTINATION:
        return 'Choose destination';
      case NavPageKey.SEARCH_ALONG:
        return 'Search along route';
      case NavPageKey.CHOOSE_ON_MAP:
        return 'Choose destination';
      case NavPageKey.DESTINATIONS:
        // TODO improve
        return this.searchQuery || 'Search results';
      case NavPageKey.ROUTES:
        return `Routes to ${assertExists(this.selectedDestination).label}`;
      case NavPageKey.DIRECTIONS_FROM_ROUTE_CONTROLS:
        return 'Directions';
      case NavPageKey.DIRECTIONS_FROM_ROUTES_LIST:
        return 'Details';
      case NavPageKey.MANAGE_STOPS:
        return 'Manage stops';
      default:
        throw new UnreachableError(this.currentPageKey);
    }
  }

  get showBackButton(): boolean {
    return this.pageStack.length > 1;
  }
}

export class NavSheetControllerImpl implements NavSheetController {
  constructor(private readonly appClient: AppClient) {}

  startChooseDestinationFlow(navSheetStore: NavSheetStore): void {
    this.reset(navSheetStore);
    navSheetStore.pageStack[0] = NavPageKey.CHOOSE_DESTINATION;
  }

  startSearchAlongFlow(navSheetStore: NavSheetStore): void {
    this.reset(navSheetStore);
    navSheetStore.pageStack[0] = NavPageKey.SEARCH_ALONG;
  }

  startShowActiveRouteDirectionsFlow(navSheetStore: NavSheetStore): void {
    this.reset(navSheetStore);
    navSheetStore.pageStack[0] = NavPageKey.DIRECTIONS_FROM_ROUTE_CONTROLS;
  }

  startManageStopsFlow(navSheetStore: NavSheetStore): void {
    this.reset(navSheetStore);
    navSheetStore.pageStack[0] = NavPageKey.MANAGE_STOPS;
  }

  search(
    _store: NavSheetStore,
    query: string,
  ): Promise<SearchResultWithRelativeTruckInfo[]> {
    return this.appClient.getAutocompleteOptions.query(query);
  }

  onSearchSelect(store: NavSheetStore, queryOrResult: string | SearchResult) {
    if (typeof queryOrResult === 'string') {
      store.pageStack.push(NavPageKey.DESTINATIONS);
      store.isLoading = true;

      void this.search(store, queryOrResult)
        .then(
          action(response => {
            store.searchQuery = queryOrResult;
            store.destinations = response;
            store.selectedDestination = undefined;
          }),
        )
        .finally(action(() => (store.isLoading = false)));
    } else {
      this.onDestinationRoutesClick(store, queryOrResult);
    }
  }

  onBackClick(store: NavSheetStore) {
    Preconditions.checkState(store.pageStack.length > 0);

    // reset store state associated with currentPageKey.
    switch (store.currentPageKey) {
      case NavPageKey.CHOOSE_DESTINATION:
      case NavPageKey.SEARCH_ALONG:
      case NavPageKey.DIRECTIONS_FROM_ROUTE_CONTROLS:
      case NavPageKey.DIRECTIONS_FROM_ROUTES_LIST:
      case NavPageKey.CHOOSE_ON_MAP:
      case NavPageKey.MANAGE_STOPS:
        store.pageStack.pop();
        break;
      case NavPageKey.DESTINATIONS:
        this.reset(store);
        // N.B.: do not pop page stack, because `this.reset` manually sets its
        // length to 1 :-/
        break;
      case NavPageKey.ROUTES:
        store.selectedDestination = undefined;
        store.routes = [];
        store.selectedRoute = undefined;
        store.pageStack.pop();
        break;
      default:
        throw new UnreachableError(store.currentPageKey);
    }
  }

  onChooseOnMapClick(store: NavSheetStore) {
    store.pageStack.push(NavPageKey.CHOOSE_ON_MAP);
  }

  onDestinationTypeClick(
    store: NavSheetStore,
    type: PoiType,
    _label: string,
    // TODO get this out of here. handle in create-app, e.g., via
    //  a NavSheetProp for onDestinationTypeClick
    appController: AppController,
  ): void {
    const currentPage = store.currentPageKey;
    console.log('currentPage', currentPage);
    const scope =
      currentPage === NavPageKey.CHOOSE_DESTINATION
        ? ScopeType.NEARBY
        : ScopeType.ROUTE;

    store.pageStack.push(NavPageKey.DESTINATIONS);
    store.isLoading = true;

    void this.appClient.search
      .query({
        type,
        scope,
      })
      .then(
        action(response => {
          store.searchQuery = destinations[type].label;
          store.destinations = response;
          store.selectedDestination = undefined;
        }),
      )
      .finally(action(() => (store.isLoading = false)));

    if (scope === ScopeType.NEARBY) {
      // TODO how to reattach this listener when pressing Back into NavPageKey.DESTINATIONS?
      const mapDragUnsubscribe = appController.addMapDragEndListener(center => {
        void this.appClient.search
          .query({
            type,
            scope,
            center,
          })
          .then(
            action(response => {
              store.searchQuery = destinations[type].label;
              store.destinations = response;
              store.selectedDestination = undefined;
              store.disableFitToBounds = true;
            }),
          );
      });
      when(
        () => store.currentPageKey !== NavPageKey.DESTINATIONS,
        () => {
          console.log('clearing map drag listener!');
          mapDragUnsubscribe();
          store.disableFitToBounds = false;
        },
      );
    }
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
    store.pageStack.push(NavPageKey.ROUTES);
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

  onRouteDetailsClick(store: NavSheetStore, route: Route): void {
    console.log('route details', route);
    store.selectedRoute = route;
    store.pageStack.push(NavPageKey.DIRECTIONS_FROM_ROUTES_LIST);
  }

  onRouteGoClick(store: NavSheetStore, route: Route): void {
    console.log('go route', route);
    store.selectedRoute = route;
  }

  reset(store: NavSheetStore) {
    console.log('nav sheet reset');
    store.pageStack.length = 1;

    store.isLoading = false;

    store.destinations = [];
    store.selectedDestination = undefined;

    store.routes = [];
    store.selectedRoute = undefined;
  }
}
