import type { PoiType, ScopeType } from '@truckermudgeon/navigation/constants';
import type { AppClient } from '../controllers/types';

/**
 * Thin wrappers around the search-related tRPC procedures.
 */

export function getAutocompleteOptions(client: AppClient, query: string) {
  return client.getAutocompleteOptions.query(query);
}

export function searchPoi(
  client: AppClient,
  args: { type: PoiType; scope: ScopeType; center?: [number, number] },
) {
  return client.search.query(args);
}
