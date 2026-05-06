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
});
