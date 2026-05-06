import type {
  Route,
  RouteWithSummary,
  SearchResult,
  SearchResultWithRelativeTruckInfo,
} from '@truckermudgeon/navigation/types';
import { describe, expect, it } from 'vitest';
import { NavPageKey } from '../../controllers/constants';
import { NavSheetStoreImpl } from '../../stores/nav-sheet';

describe('NavSheetStoreImpl', () => {
  it('starts with CHOOSE_DESTINATION on the stack', () => {
    const s = new NavSheetStoreImpl();
    expect(s.pageStack).toEqual([NavPageKey.CHOOSE_DESTINATION]);
    expect(s.currentPageKey).toBe(NavPageKey.CHOOSE_DESTINATION);
    expect(s.showBackButton).toBe(false);
  });

  describe('pushPage', () => {
    it('appends and updates currentPageKey + showBackButton', () => {
      const s = new NavSheetStoreImpl();
      s.pushPage(NavPageKey.DESTINATIONS);
      expect(s.pageStack).toEqual([
        NavPageKey.CHOOSE_DESTINATION,
        NavPageKey.DESTINATIONS,
      ]);
      expect(s.currentPageKey).toBe(NavPageKey.DESTINATIONS);
      expect(s.showBackButton).toBe(true);
    });
  });

  describe('popPage', () => {
    it('pops the top page', () => {
      const s = new NavSheetStoreImpl();
      s.pushPage(NavPageKey.DESTINATIONS);
      s.popPage();
      expect(s.pageStack).toEqual([NavPageKey.CHOOSE_DESTINATION]);
      expect(s.showBackButton).toBe(false);
    });

    it('throws if the stack would become empty', () => {
      const s = new NavSheetStoreImpl();
      expect(() => s.popPage()).toThrow();
    });
  });

  describe('replaceTopPage', () => {
    it('overwrites the top page without changing depth', () => {
      const s = new NavSheetStoreImpl();
      s.pushPage(NavPageKey.DESTINATIONS);
      s.replaceTopPage(NavPageKey.ROUTES);
      expect(s.pageStack).toEqual([
        NavPageKey.CHOOSE_DESTINATION,
        NavPageKey.ROUTES,
      ]);
    });
  });

  describe('resetStack', () => {
    it('truncates to length 1 with the given initial page', () => {
      const s = new NavSheetStoreImpl();
      s.pushPage(NavPageKey.DESTINATIONS);
      s.pushPage(NavPageKey.ROUTES);
      s.resetStack(NavPageKey.SEARCH_ALONG);
      expect(s.pageStack).toEqual([NavPageKey.SEARCH_ALONG]);
      expect(s.showBackButton).toBe(false);
    });

    it('defaults to CHOOSE_DESTINATION', () => {
      const s = new NavSheetStoreImpl();
      s.pushPage(NavPageKey.DESTINATIONS);
      s.resetStack();
      expect(s.pageStack).toEqual([NavPageKey.CHOOSE_DESTINATION]);
    });
  });

  describe('title', () => {
    it.each([
      { page: NavPageKey.CHOOSE_DESTINATION, title: 'Choose destination' },
      { page: NavPageKey.SEARCH_ALONG, title: 'Search along route' },
      { page: NavPageKey.CHOOSE_ON_MAP, title: 'Choose destination' },
      {
        page: NavPageKey.DIRECTIONS_FROM_ROUTE_CONTROLS,
        title: 'Directions',
      },
      { page: NavPageKey.DIRECTIONS_FROM_ROUTES_LIST, title: 'Details' },
      { page: NavPageKey.MANAGE_STOPS, title: 'Manage stops' },
    ])('returns "$title" on page $page', ({ page, title }) => {
      const s = new NavSheetStoreImpl();
      s.replaceTopPage(page);
      expect(s.title).toBe(title);
    });

    it('uses the search query for DESTINATIONS, falling back to a default', () => {
      const s = new NavSheetStoreImpl();
      s.pushPage(NavPageKey.DESTINATIONS);
      expect(s.title).toBe('Search results');
      s.searchQuery = 'gas';
      expect(s.title).toBe('gas');
    });
  });

  describe('reset', () => {
    it('clears state and pins the stack to the given initial page', () => {
      const s = new NavSheetStoreImpl();
      s.pushPage(NavPageKey.DESTINATIONS);
      s.destinations = [{ nodeUid: 'a' } as SearchResultWithRelativeTruckInfo];
      s.selectedDestination = { nodeUid: 'a' } as SearchResult;
      s.routes = [{ id: 'r0' } as RouteWithSummary];
      s.selectedRoute = { id: 'r0' } as Route;
      s.isLoading = true;

      s.reset(NavPageKey.SEARCH_ALONG);

      expect(s.pageStack).toEqual([NavPageKey.SEARCH_ALONG]);
      expect(s.destinations).toEqual([]);
      expect(s.selectedDestination).toBeUndefined();
      expect(s.routes).toEqual([]);
      expect(s.selectedRoute).toBeUndefined();
      expect(s.isLoading).toBe(false);
    });

    it('defaults to CHOOSE_DESTINATION', () => {
      const s = new NavSheetStoreImpl();
      s.pushPage(NavPageKey.DESTINATIONS);
      s.reset();
      expect(s.pageStack).toEqual([NavPageKey.CHOOSE_DESTINATION]);
    });
  });

  describe('start*Flow', () => {
    it.each([
      {
        name: 'startChooseDestinationFlow',
        run: (s: NavSheetStoreImpl) => s.startChooseDestinationFlow(),
        expected: NavPageKey.CHOOSE_DESTINATION,
      },
      {
        name: 'startSearchAlongFlow',
        run: (s: NavSheetStoreImpl) => s.startSearchAlongFlow(),
        expected: NavPageKey.SEARCH_ALONG,
      },
      {
        name: 'startShowActiveRouteDirectionsFlow',
        run: (s: NavSheetStoreImpl) => s.startShowActiveRouteDirectionsFlow(),
        expected: NavPageKey.DIRECTIONS_FROM_ROUTE_CONTROLS,
      },
      {
        name: 'startManageStopsFlow',
        run: (s: NavSheetStoreImpl) => s.startManageStopsFlow(),
        expected: NavPageKey.MANAGE_STOPS,
      },
    ])(
      '$name resets to its page and shows the nav sheet',
      ({ run, expected }) => {
        const s = new NavSheetStoreImpl();
        // start in a dirty state to verify reset semantics
        s.pushPage(NavPageKey.DESTINATIONS);
        s.destinations = [
          { nodeUid: 'a' } as SearchResultWithRelativeTruckInfo,
        ];
        run(s);
        expect(s.pageStack).toEqual([expected]);
        expect(s.destinations).toEqual([]);
        expect(s.showNavSheet).toBe(true);
      },
    );
  });

  describe('selection mutations', () => {
    it('highlightDestination toggles when re-applied', () => {
      const s = new NavSheetStoreImpl();
      const dest = { nodeUid: 'a' } as SearchResult;
      s.highlightDestination(dest);
      expect(s.selectedDestination).toBe(dest);
      s.highlightDestination(dest);
      expect(s.selectedDestination).toBeUndefined();
    });

    it('selectDestination sets without toggling', () => {
      const s = new NavSheetStoreImpl();
      const dest = { nodeUid: 'a' } as SearchResult;
      s.selectDestination(dest);
      s.selectDestination(dest);
      expect(s.selectedDestination).toBe(dest);
    });

    it('openChooseOnMap pushes the CHOOSE_ON_MAP page', () => {
      const s = new NavSheetStoreImpl();
      s.openChooseOnMap();
      expect(s.currentPageKey).toBe(NavPageKey.CHOOSE_ON_MAP);
    });

    it('showRouteDetails sets selectedRoute and pushes DIRECTIONS_FROM_ROUTES_LIST', () => {
      const s = new NavSheetStoreImpl();
      const route = { id: 'r0' } as Route;
      s.showRouteDetails(route);
      expect(s.selectedRoute).toBe(route);
      expect(s.currentPageKey).toBe(NavPageKey.DIRECTIONS_FROM_ROUTES_LIST);
    });
  });
});
