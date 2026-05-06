import { UnreachableError } from '@truckermudgeon/base/precon';
import type { PoiType } from '@truckermudgeon/navigation/constants';
import { ScopeType } from '@truckermudgeon/navigation/constants';
import type {
  Route,
  SearchResult,
  SearchResultWithRelativeTruckInfo,
} from '@truckermudgeon/navigation/types';
import { action, when } from 'mobx';
import { destinations } from '../components/DestinationTypes';
import * as routeApi from '../services/route-api';
import * as searchApi from '../services/search-api';
import { NavPageKey } from './constants';
import type {
  AppClient,
  AppController,
  NavSheetController,
  NavSheetStore,
} from './types';

export class NavSheetControllerImpl implements NavSheetController {
  constructor(private readonly appClient: AppClient) {}

  startChooseDestinationFlow(store: NavSheetStore): void {
    this.reset(store, NavPageKey.CHOOSE_DESTINATION);
  }

  startSearchAlongFlow(store: NavSheetStore): void {
    this.reset(store, NavPageKey.SEARCH_ALONG);
  }

  startShowActiveRouteDirectionsFlow(store: NavSheetStore): void {
    this.reset(store, NavPageKey.DIRECTIONS_FROM_ROUTE_CONTROLS);
  }

  startManageStopsFlow(store: NavSheetStore): void {
    this.reset(store, NavPageKey.MANAGE_STOPS);
  }

  search(
    _store: NavSheetStore,
    query: string,
  ): Promise<SearchResultWithRelativeTruckInfo[]> {
    return searchApi.getAutocompleteOptions(this.appClient, query);
  }

  onSearchSelect(store: NavSheetStore, queryOrResult: string | SearchResult) {
    if (typeof queryOrResult === 'string') {
      store.pushPage(NavPageKey.DESTINATIONS);
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
    switch (store.currentPageKey) {
      case NavPageKey.CHOOSE_DESTINATION:
      case NavPageKey.SEARCH_ALONG:
      case NavPageKey.DIRECTIONS_FROM_ROUTE_CONTROLS:
      case NavPageKey.DIRECTIONS_FROM_ROUTES_LIST:
      case NavPageKey.CHOOSE_ON_MAP:
      case NavPageKey.MANAGE_STOPS:
        store.popPage();
        break;
      case NavPageKey.DESTINATIONS:
        // reset() forces the stack to length 1 with CHOOSE_DESTINATION on
        // top, so callers must not also pop after invoking reset().
        this.reset(store);
        break;
      case NavPageKey.ROUTES:
        store.selectedDestination = undefined;
        store.routes = [];
        store.selectedRoute = undefined;
        store.popPage();
        break;
      default:
        throw new UnreachableError(store.currentPageKey);
    }
  }

  onChooseOnMapClick(store: NavSheetStore) {
    store.pushPage(NavPageKey.CHOOSE_ON_MAP);
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

    store.pushPage(NavPageKey.DESTINATIONS);
    store.isLoading = true;

    void searchApi
      .searchPoi(this.appClient, { type, scope })
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
        void searchApi.searchPoi(this.appClient, { type, scope, center }).then(
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
    store.pushPage(NavPageKey.ROUTES);
    store.isLoading = true;

    void routeApi.previewRoutes(this.appClient, dest.nodeUid).then(
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
    store.pushPage(NavPageKey.DIRECTIONS_FROM_ROUTES_LIST);
  }

  onRouteGoClick(store: NavSheetStore, route: Route): void {
    console.log('go route', route);
    store.selectedRoute = route;
  }

  reset(
    store: NavSheetStore,
    initialPage: NavPageKey = NavPageKey.CHOOSE_DESTINATION,
  ) {
    console.log('nav sheet reset');
    store.resetStack(initialPage);
    store.isLoading = false;
    store.destinations = [];
    store.selectedDestination = undefined;
    store.routes = [];
    store.selectedRoute = undefined;
  }
}
