import type { PoiType, ScopeType } from '@truckermudgeon/navigation/constants';
import type { SearchResultWithRelativeTruckInfo } from '@truckermudgeon/navigation/types';
import type { AppClient } from '../controllers/types';

/**
 * Wraps the search-related tRPC procedures behind a class so consumers
 * (controllers) depend on a small injectable seam instead of the full
 * tRPC client shape.
 */
export interface SearchApi {
  getAutocompleteOptions(
    query: string,
  ): Promise<SearchResultWithRelativeTruckInfo[]>;
  searchPoi(args: {
    type: PoiType;
    scope: ScopeType;
    center?: [number, number];
  }): Promise<SearchResultWithRelativeTruckInfo[]>;
}

export class SearchApiImpl implements SearchApi {
  constructor(private readonly client: AppClient) {}

  getAutocompleteOptions(query: string) {
    return this.client.getAutocompleteOptions.query(query);
  }

  searchPoi(args: {
    type: PoiType;
    scope: ScopeType;
    center?: [number, number];
  }) {
    return this.client.search.query(args);
  }
}
