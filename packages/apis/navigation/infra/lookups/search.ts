import { assert, assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import { distance } from '@truckermudgeon/base/geom';
import { UnreachableError } from '@truckermudgeon/base/precon';
import type { MappedDataForKeys } from '@truckermudgeon/generator/mapped-data';
import { PointRBush } from '@truckermudgeon/map/point-rbush';
import {
  fromAtsCoordsToWgs84,
  fromWgs84ToAtsCoords,
  fromWgs84ToEts2Coords,
} from '@truckermudgeon/map/projections';
import type {
  CompanyItem,
  Country,
  FacilityIcon,
  Node,
  SearchPoiProperties,
  SearchProperties,
  ServiceArea,
} from '@truckermudgeon/map/types';
import type { GeoJSON } from 'geojson';
import fs from 'node:fs';
import path from 'node:path';
import RBush, { type BBox } from 'rbush';
import { toBaseProperties } from '../../domain/actor/search';
import type {
  GraphAndMapData,
  GraphMappedData,
  ProcessedSearchData,
  SearchIndices,
} from '../../domain/lookup-data';
import type { SearchResult } from '../../types';

type SearchGeoJson = GeoJSON.FeatureCollection<GeoJSON.Point, SearchProperties>;

export function readAndProcessSearchData(
  inputDir: string,
  context: GraphAndMapData<GraphMappedData>,
): ProcessedSearchData {
  console.log('reading', context.tsMapData.map, 'search data...');
  const geojson = JSON.parse(
    fs.readFileSync(
      path.join(
        inputDir,
        `${context.tsMapData.map === 'usa' ? 'ats' : 'ets2'}-search.geojson`,
      ),
      'utf-8',
    ),
  ) as unknown as SearchGeoJson;

  const toGameCoords =
    context.tsMapData.map === 'usa'
      ? fromWgs84ToAtsCoords
      : fromWgs84ToEts2Coords;

  let correctCompanyNodes = 0;
  let incorrectCompanyNodes = 0;
  let id = 0;
  const searchResults = geojson.features
    // Dealers will be handled by ServiceAreas
    .filter(f => f.properties.type !== 'dealer')
    .map<SearchResult>(f => {
      const lonLat = f.geometry.coordinates as Position;
      const gameCoords = toGameCoords(lonLat);
      const closestNode = context.graphNodeRTree.findClosest(
        ...gameCoords,
      ).node;
      if (f.properties.type === 'city' || f.properties.type === 'scenery') {
        return {
          id: id++,
          ...f.properties,
          nodeUid: closestNode.uid.toString(16),
          lonLat,
          facilityUrls: [], // TODO search all facilities in city?
        };
      }

      const poiProperties = f.properties as SearchPoiProperties;
      const facilityUrls: string[] = [];
      switch (f.properties.type) {
        case 'company': {
          let company: CompanyItem;
          if (context.graphCompaniesByNodeUid.has(closestNode.uid)) {
            // do nothing; node is correct
            correctCompanyNodes++;
            company = assertExists(
              context.tsMapData.companies
                .values()
                .find(c => c.nodeUid === closestNode.uid),
            );
          } else {
            const companyNode = context.graphNodeRTree.findClosest(
              ...gameCoords,
              {
                predicate: item =>
                  context.graphCompaniesByNodeUid.has(item.node.uid),
              },
            ).node;
            assert(
              companyNode.uid ===
                context.graphCompaniesByNodeUid.get(companyNode.uid)?.nodeUid,
            );
            company = assertExists(
              context.tsMapData.companies
                .values()
                .find(c => c.nodeUid === companyNode.uid),
            );
            console.log(
              'bad company node',
              poiProperties.sprite,
              poiProperties.city.name,
              poiProperties.stateCode,

              distance(closestNode, gameCoords),
              distance(closestNode, companyNode),
            );
            incorrectCompanyNodes++;
          }

          const prefab = context.tsMapData.prefabs.get(company.prefabUid);
          if (
            prefab &&
            prefab.nodeUids.some(nid => context.graphData.serviceAreas.has(nid))
          ) {
            const serviceArea = assertExists(
              prefab.nodeUids
                .map(nid => context.graphData.serviceAreas.get(nid))
                .find(serviceArea => serviceArea != null),
              `service area does not exist for company node id ${company.nodeUid}`,
            );
            for (const facility of serviceArea.facilities) {
              facilityUrls.push(`/icons/${facility}.png`);
            }
          }
          break;
        }
        case 'dealer':
          throw new Error('dealers should be filtered out.');
        case 'landmark':
        case 'viewpoint':
        case 'ferry':
        case 'train':
          // no facility URLs for these poi types.
          break;
        default:
          throw new Error(f.properties.type);
      }

      return {
        ...poiProperties,
        id: id++,
        nodeUid: closestNode.uid.toString(16),
        lonLat,
        facilityUrls: facilityUrls.sort(),
      };
    });

  // adding location info to facilities
  const sceneryTowns = JSON.parse(
    fs.readFileSync(path.join(inputDir, 'extra-labels.geojson'), 'utf-8'),
  ) as unknown as ExtraLabelsGeoJSON;
  sceneryTowns.features = sceneryTowns.features
    .filter(
      ({ properties: { show, kind, text } }) =>
        (kind == null && show == null) ||
        ((kind == 'town' || kind == null) &&
          show === true &&
          text !== 'Golden Gate Bridge'),
    )
    .map(f => {
      f.geometry.coordinates = fromWgs84ToAtsCoords(
        f.geometry.coordinates as [number, number],
      );
      return f;
    });

  const searchIndices = {
    ...createSpatialIndices(context.tsMapData, sceneryTowns),
    countriesById: new Map<number, Country>(
      context.tsMapData.countries.values().map(c => [c.id, c]),
    ),
  };
  const facilityResults: (SearchResult & { description?: string })[] =
    context.graphData.serviceAreas
      .entries()
      .map(([nodeUid, serviceArea]) => {
        const node = assertExists(context.tsMapData.nodes.get(nodeUid));
        const nodePos: Position = [node.x, node.y];
        const lonLat = fromAtsCoordsToWgs84(nodePos);

        const res: SearchResult & { description?: string } = {
          id: id++,
          type: 'serviceArea',
          nodeUid: nodeUid.toString(16),
          lonLat,
          facilityUrls: [...serviceArea.facilities]
            .map(f => `/icons/${f}.png`)
            .sort(),
          tags: [...serviceArea.facilities].flatMap(toSearchTags),
          // "base" properties
          label: toServiceAreaLabel(serviceArea),
          description:
            serviceArea.description !== ''
              ? serviceArea.description
              : undefined,
          sprite: toServiceAreaSprite(serviceArea),
          ...toBaseProperties(node, searchIndices),
        };
        return res;
      })
      .toArray();

  console.log({ correctCompanyNodes, incorrectCompanyNodes });
  const searchData = searchResults.concat(facilityResults);

  const searchDataLngLatRTree = new PointRBush<{
    x: number;
    y: number;
    searchResult: SearchResult;
  }>();
  searchDataLngLatRTree.load(
    searchData.map(searchResult => ({
      x: searchResult.lonLat[0],
      y: searchResult.lonLat[1],
      searchResult,
    })),
  );

  console.log(searchData.length, 'searchable items');

  return {
    searchData,
    ...searchIndices,
    searchDataLngLatRTreeJSON: searchDataLngLatRTree.toJSON(),
  };
}

function toSearchTags(facilityIcon: FacilityIcon): string[] {
  switch (facilityIcon) {
    case 'parking_ico':
      return ['rest', 'parking'];
    case 'gas_ico':
      return ['gas', 'fuel'];
    case 'service_ico':
      return ['service'];
    case 'weigh_station_ico':
      return ['weigh'];
    case 'dealer_ico':
      return ['dealer'];
    case 'garage_large_ico':
      return ['garage'];
    case 'recruitment_ico':
      return ['recruitment', 'recruiting'];
    default:
      throw new UnreachableError(facilityIcon);
  }
}

type ExtraLabelsGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  {
    text: string;
    country: string;
    kind?: string;
    show?: boolean;
  }
>;

// TODO dry up from commands/search.ts
function createSpatialIndices(
  tsMapData: MappedDataForKeys<['cities', 'countries', 'nodes']>,
  sceneryTowns: ExtraLabelsGeoJSON,
): Pick<SearchIndices, 'cityRTree' | 'cityPointRTree' | 'nodePointRTree'> {
  const cityRTree = new RBush<
    BBox & {
      cityName: string;
      stateCode: string;
    }
  >();
  cityRTree.load(
    [...tsMapData.cities.values()].flatMap(city =>
      city.areas.map(area => {
        const buffer = 100;
        return {
          minX: area.x - buffer,
          minY: area.y - buffer,
          maxX: area.x + area.width + buffer,
          maxY: area.y + area.height + buffer,
          cityName: city.name,
          stateCode: assertExists(tsMapData.countries.get(city.countryToken))
            .code,
        };
      }),
    ),
  );
  const cityPointRTree = new PointRBush<{
    x: number;
    y: number;
    cityName: string;
    stateCode: string;
  }>();
  cityPointRTree.load(
    [...tsMapData.cities.values()]
      .flatMap(city =>
        city.areas.map(area => ({
          x: area.x + area.width / 2,
          y: area.y + area.height / 2,
          cityName: city.name,
          stateCode: assertExists(tsMapData.countries.get(city.countryToken))
            .code,
        })),
      )
      .concat(
        sceneryTowns.features.map(f => {
          let stateCode: string;
          if (tsMapData.map === 'usa') {
            const [country, state] = f.properties.country.split('-');
            if (country !== 'US') {
              throw new Error();
            }
            stateCode = state;
          } else {
            stateCode = f.properties.country;
          }
          return {
            x: f.geometry.coordinates[0],
            y: f.geometry.coordinates[1],
            cityName: f.properties.text,
            stateCode,
          };
        }),
      ),
  );
  const nodePointRTree = new PointRBush<{ x: number; y: number; node: Node }>();
  nodePointRTree.load(
    [...tsMapData.nodes.values()]
      .filter(
        n =>
          n.forwardCountryId !== 0 &&
          n.forwardCountryId === n.backwardCountryId,
      )
      .map(node => ({
        x: node.x,
        y: node.y,
        node,
      })),
  );

  return {
    cityRTree,
    cityPointRTree,
    nodePointRTree,
  };
}

function toServiceAreaLabel(serviceArea: ServiceArea): string {
  if (serviceArea.facilities.has('garage_large_ico')) {
    return 'Garage';
  }

  if (serviceArea.facilities.has('gas_ico')) {
    return 'Gas Station';
  }

  if (serviceArea.facilities.size === 1) {
    const [faciltyIcon] = serviceArea.facilities;
    switch (faciltyIcon) {
      case 'parking_ico':
        return 'Rest Area';
      case 'recruitment_ico':
        return 'Recruitment Center';
      case 'weigh_station_ico':
        return 'Weigh Station';
      default:
        break;
    }
  }

  return 'Service Area';
}

function toServiceAreaSprite(serviceArea: ServiceArea): string {
  if (serviceArea.description !== '') {
    // description is a gas or dealer brand name
    switch (serviceArea.description) {
      case 'Gallon Oil':
      case 'Phoenix':
      case 'Aron':
      case 'Vortex':
      case 'WP':
      case 'NAF':
      case 'Fusion':
      case 'Driverse':
      case 'GreenPetrol':
      case 'Haulett': {
        const prefix =
          serviceArea.description === 'GreenPetrol'
            ? 'grp'
            : serviceArea.description.toLowerCase().slice(0, 3);
        return `${prefix}_oil_gst`;
      }
      case 'Western Star':
        return 'ws_trk_dlr';
      case 'Kenworth':
        return 'kw_trk_dlr';
      case 'Peterbilt':
        return 'pt_trk_dlr';
      case 'Volvo':
        return 'volvo_dlr';
      case 'Freightliner':
      case 'International':
      case 'Mack':
        return 'blank';
      default:
        throw new Error(
          'unknown service area description: ' + serviceArea.description,
        );
    }
  }

  if (serviceArea.facilities.has('garage_large_ico')) {
    return 'garage_large_ico';
  }

  if (serviceArea.facilities.has('gas_ico')) {
    return 'gas_ico';
  }

  if (serviceArea.facilities.size > 0) {
    const [faciltyIcon] = serviceArea.facilities;
    return faciltyIcon;
  }

  return 'blank';
}
