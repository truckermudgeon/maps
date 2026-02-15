import type { SearchResult } from '@truckermudgeon/navigation/types';

export function aSearchResultWith(result: Partial<SearchResult>): SearchResult {
  return {
    id: Math.random(),
    nodeUid: Math.random() + '',
    lonLat: [0, 0],
    facilityUrls: [],
    type: 'serviceArea',
    city: {
      name: 'city',
      stateCode: 'ST',
      distance: 0,
    },
    sprite: 'gas_ico',
    dlcGuard: 0,
    stateName: 'state',
    stateCode: 'ST',
    label: 'search result',
    tags: [],
    ...result,
  };
}
