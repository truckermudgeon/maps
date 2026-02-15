import { assertExists } from '@truckermudgeon/base/assert';
import type { MappedDataForKeys } from '@truckermudgeon/generator/mapped-data';
import type { SegmentInfo } from '../../types';
import type { RouteWithLookup } from './generate-routes';

export function toSegmentInfo(
  segmentIndex: number,
  route: RouteWithLookup,
  tsMapData: MappedDataForKeys<
    ['nodes', 'cities', 'countries', 'companies', 'companyDefs']
  >,
): SegmentInfo {
  const nodeUid = assertExists(route.lookup.nodeUids[segmentIndex].at(-1));
  const node = assertExists(tsMapData.nodes.get(nodeUid));
  const maybeCompany = tsMapData.companies
    .values()
    .find(c => c.nodeUid === node.uid);

  let place = 'Your location';
  let placeInfo = '';
  if (maybeCompany) {
    place = assertExists(tsMapData.companyDefs.get(maybeCompany.token)).name;
    const city = assertExists(tsMapData.cities.get(maybeCompany.cityToken));
    const state = assertExists(tsMapData.countries.get(city.countryToken));
    placeInfo = `in ${city.name}, ${state.code}`;
  } else {
    // TODO convert node uid to "place" string, e.g., for facilities
    // TODO use command/search.ts' approach to finding nearest city
  }

  return {
    place,
    placeInfo,
    isFinal: segmentIndex + 1 === route.segments.length,
  };
}
