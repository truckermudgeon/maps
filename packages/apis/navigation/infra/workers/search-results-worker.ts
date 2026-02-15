import nearestPointOnLine from '@turf/nearest-point-on-line';
import pointToLineDistance from '@turf/point-to-line-distance';
import type { SearchReducerOptions } from '../../domain/actor/search';
import type { SearchResult } from '../../types';

export default function (searchOptions: SearchReducerOptions): SearchResult[] {
  const { searchResults, truckLngLat, routeLine, distanceKm } = searchOptions;
  const truckLocation = nearestPointOnLine(routeLine, truckLngLat).properties
    .location;
  return searchResults
    .filter(searchResult => {
      const dist = pointToLineDistance(searchResult.lonLat, routeLine, {
        units: 'kilometers',
        // using the faster 'planar' method, because the distances we're
        // interested in are relatively small.
        method: 'planar',
      });
      return dist <= distanceKm;
    })
    .map(searchResult => ({
      searchResult,
      properties: nearestPointOnLine(routeLine, searchResult.lonLat).properties,
    }))
    .filter(searchResult => searchResult.properties.location >= truckLocation)
    .sort((a, b) => {
      return a.properties.location - b.properties.location;
    })
    .map(item => item.searchResult);
}
