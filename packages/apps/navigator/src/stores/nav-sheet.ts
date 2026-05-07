import { assertExists } from '@truckermudgeon/base/assert';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import type {
  Route,
  RouteWithSummary,
  SearchResult,
  SearchResultWithRelativeTruckInfo,
} from '@truckermudgeon/navigation/types';
import { makeAutoObservable, observable } from 'mobx';
import type { NavSheetStore } from './types';

export const enum NavPageKey {
  /** shows search bar and destination types */
  CHOOSE_DESTINATION,
  /** shows search bar and destination types */
  SEARCH_ALONG,
  /** shows instructions for panning/zooming map to choose */
  CHOOSE_ON_MAP,
  /** a list of search results that can be routed to */
  DESTINATIONS,
  /** a list of routes to a destination */
  ROUTES,
  /** step-by-step directions, from an in-progress route */
  DIRECTIONS_FROM_ROUTE_CONTROLS,
  /** step-by-step directions, from the `ROUTES` page */
  DIRECTIONS_FROM_ROUTES_LIST,
  /** re-order and/or delete waypoints in the active route. */
  MANAGE_STOPS,
}

const pagesRequiringMapVisibility = new Set<NavPageKey>([
  NavPageKey.CHOOSE_ON_MAP,
  NavPageKey.DESTINATIONS,
  NavPageKey.ROUTES,
  NavPageKey.DIRECTIONS_FROM_ROUTE_CONTROLS,
  NavPageKey.DIRECTIONS_FROM_ROUTES_LIST,
  NavPageKey.MANAGE_STOPS,
]);

export class NavSheetStoreImpl implements NavSheetStore {
  // Underscore-prefixed so the array reference can't escape; callers
  // mutate via the bound action methods below. Reads go through the
  // `pageStack` getter, which returns a readonly view.
  private _pageStack: NavPageKey[] = [NavPageKey.CHOOSE_DESTINATION];

  showNavSheet = false;
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

  get pageStack(): readonly NavPageKey[] {
    return this._pageStack;
  }

  get currentPageKey(): NavPageKey {
    return assertExists(this._pageStack.at(-1));
  }

  get currentPageRequiresMapVisibility(): boolean {
    return pagesRequiringMapVisibility.has(this.currentPageKey);
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
    return this._pageStack.length > 1;
  }

  pushPage(key: NavPageKey): void {
    this._pageStack.push(key);
  }

  popPage(): void {
    Preconditions.checkState(
      this._pageStack.length > 1,
      'cannot pop the last page off the stack',
    );
    this._pageStack.pop();
  }

  replaceTopPage(key: NavPageKey): void {
    this._pageStack[this._pageStack.length - 1] = key;
  }

  resetStack(initial: NavPageKey = NavPageKey.CHOOSE_DESTINATION): void {
    this._pageStack.length = 1;
    this._pageStack[0] = initial;
  }

  reset(initialPage: NavPageKey = NavPageKey.CHOOSE_DESTINATION): void {
    this.resetStack(initialPage);
    this.isLoading = false;
    this.destinations = [];
    this.selectedDestination = undefined;
    this.routes = [];
    this.selectedRoute = undefined;
  }

  startChooseDestinationFlow(): void {
    this.reset(NavPageKey.CHOOSE_DESTINATION);
    this.showNavSheet = true;
  }

  startSearchAlongFlow(): void {
    this.reset(NavPageKey.SEARCH_ALONG);
    this.showNavSheet = true;
  }

  startShowActiveRouteDirectionsFlow(): void {
    this.reset(NavPageKey.DIRECTIONS_FROM_ROUTE_CONTROLS);
    this.showNavSheet = true;
  }

  startManageStopsFlow(): void {
    this.reset(NavPageKey.MANAGE_STOPS);
    this.showNavSheet = true;
  }

  // Toggles selection — the user re-tapping the highlighted destination
  // un-highlights it.
  highlightDestination(dest: SearchResult): void {
    this.selectedDestination =
      dest === this.selectedDestination ? undefined : dest;
  }

  selectDestination(dest: SearchResult): void {
    this.selectedDestination = dest;
  }

  openChooseOnMap(): void {
    this.pushPage(NavPageKey.CHOOSE_ON_MAP);
  }

  highlightRoute(route: Route): void {
    this.selectedRoute = route;
  }

  selectRoute(route: Route): void {
    this.selectedRoute = route;
  }

  showRouteDetails(route: Route): void {
    this.selectedRoute = route;
    this.pushPage(NavPageKey.DIRECTIONS_FROM_ROUTES_LIST);
  }
}
