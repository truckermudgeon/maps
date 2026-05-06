import { UnreachableError } from '@truckermudgeon/base/precon';
import type { PoiType } from '@truckermudgeon/navigation/constants';
import { ScopeType } from '@truckermudgeon/navigation/constants';
import type {
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

/**
 * Coordinates the cross-domain or async-IO flows for the nav sheet —
 * search, page transitions involving tRPC calls, back-navigation
 * cleanup. Pure state mutations live as actions on NavSheetStore.
 */
export class NavSheetControllerImpl implements NavSheetController {
  constructor(
    private readonly store: NavSheetStore,
    private readonly appClient: AppClient,
  ) {}

  search(query: string): Promise<SearchResultWithRelativeTruckInfo[]> {
    return searchApi.getAutocompleteOptions(this.appClient, query);
  }

  onSearchSelect(queryOrResult: string | SearchResult) {
    const { store } = this;
    if (typeof queryOrResult === 'string') {
      store.pushPage(NavPageKey.DESTINATIONS);
      store.isLoading = true;

      void this.search(queryOrResult)
        .then(
          action(response => {
            store.searchQuery = queryOrResult;
            store.destinations = response;
            store.selectedDestination = undefined;
          }),
        )
        .finally(action(() => (store.isLoading = false)));
    } else {
      this.onDestinationRoutesClick(queryOrResult);
    }
  }

  onBackClick() {
    const { store } = this;
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
        store.reset();
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

  onDestinationTypeClick(
    type: PoiType,
    _label: string,
    // TODO get this out of here. handle in create-app, e.g., via
    //  a NavSheetProp for onDestinationTypeClick
    appController: AppController,
  ): void {
    const { store } = this;
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

  onDestinationRoutesClick(dest: SearchResult): void {
    const { store } = this;
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
}
