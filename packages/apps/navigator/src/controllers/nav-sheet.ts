import { UnreachableError } from '@truckermudgeon/base/precon';
import type { PoiType } from '@truckermudgeon/navigation/constants';
import { ScopeType } from '@truckermudgeon/navigation/constants';
import type {
  SearchResult,
  SearchResultWithRelativeTruckInfo,
} from '@truckermudgeon/navigation/types';
import { action, when } from 'mobx';
import { destinations } from '../components/DestinationTypes';
import type { MapAdapter } from '../services/map-adapter';
import type { RouteApi } from '../services/route-api';
import type { SearchApi } from '../services/search-api';
import { NavPageKey } from './constants';
import type { NavSheetController, NavSheetStore } from './types';

/**
 * Coordinates the cross-domain or async-IO flows for the nav sheet —
 * search, page transitions involving tRPC calls, back-navigation
 * cleanup. Pure state mutations live as actions on NavSheetStore.
 */
export class NavSheetControllerImpl implements NavSheetController {
  constructor(
    private readonly store: NavSheetStore,
    private readonly routeApi: RouteApi,
    private readonly searchApi: SearchApi,
    private readonly mapAdapter: MapAdapter,
  ) {}

  search(query: string): Promise<SearchResultWithRelativeTruckInfo[]> {
    return this.searchApi.getAutocompleteOptions(query);
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

  onDestinationTypeClick(type: PoiType, _label: string): void {
    const { mapAdapter } = this;
    const { store } = this;
    const currentPage = store.currentPageKey;
    console.log('currentPage', currentPage);
    const scope =
      currentPage === NavPageKey.CHOOSE_DESTINATION
        ? ScopeType.NEARBY
        : ScopeType.ROUTE;

    store.pushPage(NavPageKey.DESTINATIONS);
    store.isLoading = true;

    void this.searchApi
      .searchPoi({ type, scope })
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
      const mapDragUnsubscribe = mapAdapter.addMapDragEndListener(center => {
        void this.searchApi.searchPoi({ type, scope, center }).then(
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

    void this.routeApi.previewRoutes(dest.nodeUid).then(
      action(routes => {
        store.isLoading = false;
        store.routes = routes;
        // highlight the first one
        store.selectedRoute = store.routes[0];
      }),
    );
  }
}
