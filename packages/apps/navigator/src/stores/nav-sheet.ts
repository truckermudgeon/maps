import { assertExists } from '@truckermudgeon/base/assert';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import type {
  Route,
  RouteWithSummary,
  SearchResult,
  SearchResultWithRelativeTruckInfo,
} from '@truckermudgeon/navigation/types';
import { makeAutoObservable, observable } from 'mobx';
import { NavPageKey } from '../controllers/constants';
import type { NavSheetStore } from './types';

export class NavSheetStoreImpl implements NavSheetStore {
  // Underscore-prefixed so the array reference can't escape; callers
  // mutate via the bound action methods below. Reads go through the
  // `pageStack` getter, which returns a readonly view.
  private _pageStack: NavPageKey[] = [NavPageKey.CHOOSE_DESTINATION];

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
}
