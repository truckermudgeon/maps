import { assert, assertExists } from '@truckermudgeon/base/assert';
import { areSetsEqual } from '@truckermudgeon/base/equals';
import type { Position } from '@truckermudgeon/base/geom';
import {
  add,
  distance,
  midPoint,
  nonUniformScale,
  rotate,
  toSplinePoints,
} from '@truckermudgeon/base/geom';
import { mapValues, putIfAbsent } from '@truckermudgeon/base/map';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import type { Polygon, RoadString } from '@truckermudgeon/map/prefabs';
import {
  toMapPosition,
  toRoadStringsAndPolygons,
} from '@truckermudgeon/map/prefabs';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
} from '@truckermudgeon/map/projections';
import type {
  AtsMapGeoJsonFeature,
  City,
  CityFeature,
  ContourFeature,
  Country,
  CountryFeature,
  DebugFeature,
  Ferry,
  FerryFeature,
  FootprintFeature,
  MapArea,
  MapAreaFeature,
  Model,
  ModelDescription,
  Node,
  Poi,
  PoiFeature,
  Prefab,
  PrefabDescription,
  PrefabFeature,
  Road,
  RoadFeature,
  RoadLook,
  RoadLookProperties,
  RoadType,
} from '@truckermudgeon/map/types';
import * as turf from '@turf/helpers';
import lineOffset from '@turf/line-offset';
import * as cliProgress from 'cli-progress';
import type { Quadtree } from 'd3-quadtree';
import { quadtree } from 'd3-quadtree';
import { tricontour } from 'd3-tricontour';
import fs from 'fs';
import type { GeoJSON } from 'geojson';
import path from 'path';
import polygonclipping from 'polygon-clipping';
import url from 'url';
import { normalizeDlcGuards } from './dlc-guards';
import { logger } from './logger';
import type { MappedData } from './mapped-data';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type AtsGeoJson = GeoJSON.FeatureCollection<
  AtsMapGeoJsonFeature['geometry'],
  AtsMapGeoJsonFeature['properties']
>;

interface QtRoadEntry {
  x: number;
  y: number;
  roadLookToken: string;
  roadFeature: RoadFeature;
  startOrEnd: Position;
}
type RoadQuadTree = Quadtree<QtRoadEntry>;

/**
 * Maps ETS2 {@link Country} `code` values to ISO 3166-1 alpha-2 codes.
 * If an entry isn't listed here, then `Country::code` is assumed to
 * be an ISO 3166-1 alpha-2 code.
 */
const ets2IsoA2 = new Map([
  ['A', 'AT'],
  ['B', 'BE'],
  ['BIH', 'BA'],
  ['EST', 'EE'],
  ['F', 'FR'],
  ['D', 'DE'],
  ['H', 'HU'],
  ['I', 'IT'],
  ['RKS', 'XK'], // Kosovo
  ['L', 'LU'],
  ['NMK', 'MK'],
  ['MNE', 'ME'],
  ['N', 'NO'],
  ['P', 'PT'],
  ['SRB', 'RS'],
  ['SLO', 'SI'],
  ['E', 'ES'],
  ['S', 'SE'],
]);

/**
 * Converts TSMapData into a GeoJSON FeatureCollection.
 */
export function convertToGeoJson(
  map: 'usa' | 'europe',
  tsMapData: MappedData,
  options: {
    includeDebug: boolean;
    skipCoalescing: boolean;
  },
): AtsGeoJson {
  const {
    nodes,
    roads,
    ferries,
    prefabs,
    mapAreas,
    dividers,
    pois,
    cities,
    countries,
    roadLooks,
    prefabDescriptions,
  } = tsMapData;

  logger.log('normalizing dlcGuard values...');
  const dlcQuadTree = normalizeDlcGuards(roads, prefabs, mapAreas, pois, {
    map,
    nodes,
  });

  const normalize = createNormalize(map);
  const normalizeCoordinates = createNormalizeCoordinates(map);

  const roadQuadTree = quadtree<{
    x: number;
    y: number;
    roadLookToken: string;
  }>()
    .x(e => e.x)
    .y(e => e.y);
  const vjunctionQuadTree: RoadQuadTree = quadtree<QtRoadEntry>()
    .x(e => e.x)
    .y(e => e.y);
  let lutSize = 0;
  const prefabNodeUids = new Set<bigint>(
    [...prefabs.values()].flatMap(p => {
      assert(p.nodeUids.every(uid => nodes.has(uid.toString())));
      return p.nodeUids;
    }),
  );

  logger.log('creating map areas...');
  const mapAreaFeatures = [...mapAreas.values()].map(a =>
    areaToFeature(a, nodes),
  );

  // TODO ferry lines shown are dependent on DLCs present.
  logger.log('creating ferry/train lines...');
  const uniqFerries: Ferry[] = [];
  const pairs = new Set<string>();
  for (const ferry of ferries.values()) {
    for (const conn of ferry.connections) {
      const pair = [ferry.token, conn.token].sort().join();
      if (pairs.has(pair)) {
        continue;
      }
      pairs.add(pair);
      uniqFerries.push({
        ...ferry,
        connections: [conn],
      });
    }
  }
  const countriesByCityName = new Map<string, Country>(
    [...cities.values()]
      .map(c => [c.name, countries.get(c.countryToken)])
      .filter((tuple): tuple is [string, Country] => tuple[1] != null),
  );
  // hardcoded values
  if (countries.has('uk')) {
    const uk = countries.get('uk')!;
    countriesByCityName.set('Tyne', uk);
    countriesByCityName.set('Folkestone', uk);
    countriesByCityName.set('Harwich', uk);
    countriesByCityName.set('Hull', uk);
  }
  if (countries.has('romania')) {
    const ro = countries.get('romania')!;
    countriesByCityName.set('Brăila', ro);
    countriesByCityName.set('Smârdan', ro);
  }
  if (countries.has('netherlands')) {
    const nl = countries.get('netherlands')!;
    countriesByCityName.set('Europort', nl);
    countriesByCityName.set('IJmuiden', nl);
  }
  if (countries.has('poland')) {
    const pl = countries.get('poland')!;
    countriesByCityName.set('Gdynia', pl);
  }
  if (countries.has('italy')) {
    const it = countries.get('italy')!;
    countriesByCityName.set('Porto Torres', it);
  }
  if (countries.has('germany')) {
    const de = countries.get('germany')!;
    countriesByCityName.set('Priwall', de);
  }
  const normalizedFerryFeatures: FerryFeature[] = uniqFerries.map(f =>
    ferryToNormalizedFeature(
      map,
      f,
      cities,
      countries,
      countriesByCityName,
      normalize,
    ),
  );

  logger.log('creating dividers...');
  const dividerFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const d of dividers.values()) {
    const startNode = Preconditions.checkExists(
      nodes.get(d.startNodeUid.toString(16)),
    );
    const endNode = Preconditions.checkExists(
      nodes.get(d.endNodeUid.toString(16)),
    );
    const points = toSplinePoints(
      {
        position: [startNode.x, startNode.y],
        rotation: startNode.rotation,
      },
      {
        position: [endNode.x, endNode.y],
        rotation: endNode.rotation,
      },
    );
    const properties = {
      type: 'divider-' + d.type,
      startNodeUid: d.startNodeUid.toString(16),
      endNodeUid: d.endNodeUid.toString(16),
    };
    dividerFeatures.push({
      type: 'Feature',
      id: d.uid.toString(),
      properties,
      geometry: {
        type: 'LineString',
        coordinates: points,
      },
    });
  }

  logger.log('creating roads and quadtree of prefab-adjacent roads...');
  const roadFeatures: RoadFeature[] = [];
  for (const r of roads.values()) {
    const fs = roadToFeature(
      r,
      assertExists(roadLooks.get(r.roadLookToken)),
      nodes,
      dividerFeatures,
    );
    for (const f of fs) {
      roadFeatures.push(f);
      if (prefabNodeUids.has(r.startNodeUid)) {
        roadQuadTree.add({
          x: f.geometry.coordinates[0][0],
          y: f.geometry.coordinates[0][1],
          roadLookToken: r.roadLookToken,
        });
        vjunctionQuadTree.add({
          x: f.geometry.coordinates[0][0],
          y: f.geometry.coordinates[0][1],
          roadLookToken: r.roadLookToken,
          roadFeature: f,
          startOrEnd: f.geometry.coordinates[0] as Position,
        });
        lutSize++;
      }
      if (prefabNodeUids.has(r.endNodeUid)) {
        roadQuadTree.add({
          x: f.geometry.coordinates.at(-1)![0],
          y: f.geometry.coordinates.at(-1)![1],
          roadLookToken: r.roadLookToken,
        });
        vjunctionQuadTree.add({
          x: f.geometry.coordinates.at(-1)![0],
          y: f.geometry.coordinates.at(-1)![1],
          roadLookToken: r.roadLookToken,
          roadFeature: f,
          startOrEnd: f.geometry.coordinates.at(-1) as Position,
        });
        lutSize++;
      }
    }
  }

  logger.info(lutSize, 'prefab-adjacent road quadtree entries');
  logger.log('creating prefabs...');
  const prefabComponents = mapValues(prefabDescriptions, pd =>
    toRoadStringsAndPolygons(pd),
  );

  const isUnknownRoad = (p: PrefabFeature | RoadFeature) =>
    p.properties.type === 'road' && p.properties.roadType === 'unknown';
  // "v-junction" Prefabs, which will not be represented by a GeoJSON feature
  const vJunctionList = new Set<Prefab>();
  // Prefabs with roads of unknown type
  const refineList = new Set<Prefab>();
  // Prefabs that have been successfully converted into GeoJSON features
  const prefabAndRoadFeatures: (PrefabFeature | RoadFeature)[] = [];

  for (const p of prefabs.values()) {
    const comps = assertExists(prefabComponents.get(p.token));
    if (!options.skipCoalescing && comps.isVJunction) {
      vJunctionList.add(p);
      continue;
    }

    const pf = prefabToFeatures(
      normalize,
      p,
      assertExists(prefabDescriptions.get(p.token)),
      comps,
      nodes,
      roads,
      roadLooks,
      roadQuadTree,
      { allowUnknownRoadType: true },
    );
    if (pf.some(isUnknownRoad)) {
      refineList.add(p);
    } else {
      prefabAndRoadFeatures.push(...pf);
    }
  }
  if (!options.skipCoalescing) {
    logger.info(vJunctionList.size, 'v-junctions');
  }

  // Keep on trying to refine road types until no refining progress is made.
  logger.log('refining prefab road types...');
  let lastRefineCount = 0;
  let pass = 2;
  while (refineList.size && lastRefineCount !== refineList.size) {
    lastRefineCount = refineList.size;
    logger.info(pass++, 'pass', refineList.size, 'unrefined prefabs left...');
    for (const p of refineList) {
      const pf = prefabToFeatures(
        normalize,
        p,
        assertExists(prefabDescriptions.get(p.token)),
        assertExists(prefabComponents.get(p.token)),
        nodes,
        roads,
        roadLooks,
        roadQuadTree,
        { allowUnknownRoadType: true },
      );
      if (pf.every(f => !isUnknownRoad(f))) {
        refineList.delete(p);
        prefabAndRoadFeatures.push(...pf);
      }
    }
  }
  logger.log('adding unrefined prefabs using fallback road types...');
  for (const p of refineList) {
    const pf = prefabToFeatures(
      normalize,
      p,
      assertExists(prefabDescriptions.get(p.token)),
      assertExists(prefabComponents.get(p.token)),
      nodes,
      roads,
      roadLooks,
      roadQuadTree,
      { allowUnknownRoadType: false },
    );
    prefabAndRoadFeatures.push(...pf);
  }
  const prefabFeatures: PrefabFeature[] = [];
  for (const f of prefabAndRoadFeatures) {
    if (f.geometry.type === 'Polygon' && f.properties.type === 'prefab') {
      prefabFeatures.push(f as PrefabFeature);
    } else if (
      f.geometry.type === 'LineString' &&
      f.properties.type === 'road'
    ) {
      const r = f as RoadFeature;
      roadFeatures.push(r);
      vjunctionQuadTree.addAll([
        {
          x: r.geometry.coordinates[0][0],
          y: r.geometry.coordinates[0][1],
          roadLookToken: 'any',
          roadFeature: r,
          startOrEnd: r.geometry.coordinates[0] as Position,
        },
        {
          x: r.geometry.coordinates.at(-1)![0],
          y: r.geometry.coordinates.at(-1)![1],
          roadLookToken: 'any',
          roadFeature: r,
          startOrEnd: r.geometry.coordinates.at(-1) as Position,
        },
      ]);
    } else {
      throw new Error();
    }
  }

  if (!options.skipCoalescing) {
    logger.log('combining roads at v-junctions...');
    let vjunctionsCombined = 0;
    for (const p of vJunctionList) {
      const pf = prefabToFeatures(
        normalize,
        p,
        assertExists(prefabDescriptions.get(p.token)),
        assertExists(prefabComponents.get(p.token)),
        nodes,
        roads,
        roadLooks,
        roadQuadTree,
        { allowUnknownRoadType: false },
      );
      assert(
        pf.length === 2 &&
          pf.every(
            f =>
              f.properties.type === 'road' &&
              f.geometry.coordinates.length === 2,
          ),
      );
      for (const pfr of pf as RoadFeature[]) {
        // find the road nearest pfr's start
        const pfrStart = pfr.geometry.coordinates[0] as Position;
        const roadA = vjunctionQuadTree.find(...pfrStart);

        // find the road nearest pfr's end
        const pfrEnd = pfr.geometry.coordinates.at(-1) as Position;
        const roadB = vjunctionQuadTree.find(...pfrEnd);

        if (roadA == null) {
          logger.error(
            'could not find road to fuse for prefab start',
            p.uid.toString(),
          );
          continue;
        }
        if (roadB == null) {
          logger.error(
            'could not find road to fuse for prefab end',
            p.uid.toString(),
          );
          continue;
        }
        const roadAData = assertExists(roadA);
        let roadBData = assertExists(roadB);
        if (roadAData.roadFeature === roadBData.roadFeature) {
          // HACK. This is here to cover instances where V-junction is super-short
          // and doesn't quite line up with two separate roads.
          vjunctionQuadTree.remove(roadAData);
          roadBData = vjunctionQuadTree.find(...pfrEnd)!;
          vjunctionQuadTree.add(roadAData);
          //const coords = normalize(roadAData.startOrEnd);
          //logger.warn('v-joint fallback search at', `${coords[1]}/${coords[0]}`);
        }

        const canMove = ({
          roadFeature: {
            id,
            properties: { leftLanes, rightLanes },
          },
        }: QtRoadEntry) =>
          // can't move prefab roads, because i don't want to deal with having to
          // move multiple-prefabs that terminate at a single point, e.g.
          // /38.54968/-122.09539
          !id.includes('road') &&
          // one-way road
          (leftLanes === 0 || rightLanes === 0);

        if (roadAData.roadFeature === roadBData.roadFeature) {
          //const coords = normalize(roadAData.startOrEnd);
          //logger.warn(
          //  'v-joint failure, could not find second road at',
          //  `${coords[1]}/${coords[0]}`,
          //);
          roadFeatures.push(pfr);
        } else if (!canMove(roadAData) && !canMove(roadBData)) {
          //const coords = normalize(roadBData.startOrEnd);
          //logger.warn(
          //  'v-joint failure, roads unmovable at',
          //  `${coords[1]}/${coords[0]}`,
          //);
          roadFeatures.push(pfr);
        } else if (canMove(roadAData) && canMove(roadBData)) {
          const mp = midPoint(roadAData.startOrEnd, roadBData.startOrEnd);
          roadAData.startOrEnd[0] = roadBData.startOrEnd[0] = mp[0];
          roadAData.startOrEnd[1] = roadBData.startOrEnd[1] = mp[1];
          vjunctionsCombined++;
        } else if (canMove(roadBData)) {
          roadBData.startOrEnd[0] = roadAData.startOrEnd[0];
          roadBData.startOrEnd[1] = roadAData.startOrEnd[1];
          vjunctionsCombined++;
        } else if (canMove(roadAData)) {
          roadAData.startOrEnd[0] = roadBData.startOrEnd[0];
          roadAData.startOrEnd[1] = roadBData.startOrEnd[1];
          vjunctionsCombined++;
        } else {
          // unexpected; all canMove/!canMove cases should be handled above.
          throw new Error();
        }
      }
    }
    logger.info(vjunctionsCombined, 'v-junctions combined');
  }

  const processedRoadFeatures = options.skipCoalescing
    ? roadFeatures
    : coalesceRoadFeatures(roadFeatures);
  if (options.skipCoalescing) {
    logger.info('skipped coalescing road features and combining v-junctions.');
    logger.info(processedRoadFeatures.length, 'total road features.');
  }

  logger.log('creating cities...');

  const citiesByCountryIsoA2 = getCitiesByCountryIsoA2();
  let rankedCities: CityWithScaleRank[];
  if (map === 'usa') {
    rankedCities = [...cities.values()].map(c => {
      const toKey = (city: string, state: string) =>
        (city + state).toLowerCase().replace(/[^A-Za-z]/g, '');
      const key = toKey(c.name, c.countryToken);
      const { scalerank, featurecla } = assertExists(
        citiesByCountryIsoA2.get('US'),
      ).find(
        ({ name: city, namealt: cityalt, adm1name: state }) =>
          key === toKey(city, state) ||
          // This is to catch NaturalEarth city names like "Ft. Worth"
          (cityalt != null && key === toKey(cityalt, state)),
      ) ?? { scalerank: undefined, featurecla: undefined };
      return {
        ...c,
        // TODO find a better way to calc a default
        // TODO consider using min_zoom field.
        scaleRank: scalerank != null ? Number(scalerank) : 10,
        capital:
          featurecla === 'Admin-0 capital'
            ? 2
            : featurecla === 'Admin-1 capital'
              ? 1
              : 0,
      };
    });
  } else {
    const normalize = (s: string) =>
      s
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();

    rankedCities = [...cities.values()].map(c => {
      // lowercasing because of Hungary.
      const country = assertExists(countries.get(c.countryToken.toLowerCase()));
      const isoA2 = ets2IsoA2.get(country.code) ?? country.code;
      const countryCities = citiesByCountryIsoA2.get(isoA2);
      if (countryCities == null) {
        // Probably a new DLC or something.
        logger.warn(`unknown country ${country.name} (${country.token})`);
        return {
          ...c,
          scaleRank: 10,
          capital: 0,
        };
      }

      const cityName = normalize(c.name);
      const { scalerank, featurecla } = countryCities.find(
        ({ name, namealt }) =>
          normalize(name) === cityName ||
          // This is to catch NaturalEarth city names like "Frankfurt am Main"
          (namealt != null && normalize(namealt) === cityName),
      ) ?? { scalerank: undefined, featurecla: undefined };
      return {
        ...c,
        // TODO find a better way to calc a default
        // TODO consider using min_zoom field.
        scaleRank: scalerank != null ? Number(scalerank) : 10,
        capital:
          featurecla === 'Admin-0 capital'
            ? 2
            : featurecla === 'Admin-1 capital'
              ? 1
              : 0,
      };
    });
  }
  const cityFeatures = rankedCities.map(cityToFeature);

  logger.log('creating states/countries...');
  const countryFeatures = [...countries.values()].map(countryToFeature);

  logger.log('creating pois...');
  const poiFeatures = pois.map(p => poiToFeature(p));

  const debugCityAreaFeatures: DebugFeature[] = [];
  const debugNodeFeatures: DebugFeature[] = [];
  if (options.includeDebug) {
    logger.log('creating debug features...');
    debugCityAreaFeatures.push(...rankedCities.flatMap(cityToAreaFeatures));
    for (const n of nodes.values()) {
      debugNodeFeatures.push({
        type: 'Feature',
        properties: {
          type: 'debug',
          name: 'node',
          nodeId: n.uid.toString(16),
          nodeForwardItemId: n.forwardItemUid.toString(16),
          nodeBackwardItemId: n.backwardItemUid.toString(16),
        },
        geometry: {
          type: 'Point',
          coordinates: [n.x, n.y],
        },
      });
    }
  }

  const features = [
    ...debugCityAreaFeatures,
    ...mapAreaFeatures,
    ...prefabFeatures,
    ...processedRoadFeatures,
    ...cityFeatures.map(c => withDlcGuard(c, dlcQuadTree)),
    ...countryFeatures,
    ...poiFeatures.map(p => withDlcGuard(p, dlcQuadTree)),
    //...dividerFeatures,
    ...debugNodeFeatures,
  ];

  return {
    type: 'FeatureCollection',
    features: [
      ...features.map(f => normalizeCoordinates(f)),
      ...normalizedFerryFeatures,
    ],
  };
}

function withDlcGuard<T extends CityFeature | PoiFeature>(
  feature: T,
  dlcQuadTree: Quadtree<{ x: number; y: number; dlcGuard: number }> | undefined,
): T {
  if (dlcQuadTree == null) {
    return feature;
  }
  if (
    'dlcGuard' in feature.properties &&
    feature.properties.dlcGuard != null &&
    feature.properties.dlcGuard !== 0
  ) {
    return feature;
  }

  const [x, y] = feature.geometry.coordinates;
  const entry = dlcQuadTree.find(x, y);
  if (!entry) {
    return feature;
  }

  (feature.properties as { dlcGuard: number }).dlcGuard = entry.dlcGuard;
  return feature;
}

export function convertToFootprintsGeoJson({
  map,
  nodes,
  models,
  modelDescriptions,
}: {
  map: 'usa' | 'europe';
  nodes: Node[];
  models: Model[];
  modelDescriptions: (ModelDescription & {
    token: string;
  })[];
}) {
  const nodesByUid = new Map(nodes.map(n => [n.uid, n]));
  const modelDescs = new Map(modelDescriptions.map(m => [m.token, m]));
  const normalizeCoordinates = createNormalizeCoordinates(map);

  return {
    type: 'FeatureCollection',
    features: models
      .map(m => {
        const node = assertExists(nodesByUid.get(m.nodeUid));
        const md = assertExists(modelDescs.get(m.token));
        const o: Position = [node.x + md.center.x, node.y + md.center.y];
        let tl: Position = add([md.start.x, md.start.y], o);
        let tr: Position = add([md.end.x, md.start.y], o);
        let br: Position = add([md.end.x, md.end.y], o);
        let bl: Position = add([md.start.x, md.end.y], o);

        [tl, tr, br, bl] = [tl, tr, br, bl].map(p =>
          nonUniformScale(
            rotate(p, node.rotation - Math.PI / 2, o),
            [m.scale.x, m.scale.y],
            o,
          ),
        );
        return {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[tl, tr, br, bl, tl]],
          },
          properties: {
            type: 'footprint',
            height: Math.round(md.height * m.scale.z),
          },
        } as FootprintFeature;
      })
      .map(f => normalizeCoordinates(f)),
  };
}

export function convertToContoursGeoJson({
  map,
  points,
}: {
  map: 'usa' | 'europe';
  points: [number, number, number][];
}) {
  const normalizeCoordinates = createNormalizeCoordinates(map, 4);
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (p[2] < min) {
      min = p[2];
    }
    if (p[2] > max) {
      max = p[2];
    }
  }
  const levels = max - min + 1;

  logger.log('calculating sector mask...');
  const sectors = new Set<string>();
  const boxes: [number, number][][][] = [];
  for (const p of points) {
    const sx = Math.floor(p[0] / 4000);
    const sy = Math.floor(p[1] / 4000);
    const key = `${sx}/${sy}`;
    if (sectors.has(key)) {
      continue;
    }
    sectors.add(key);

    const minx = sx * 4000;
    const miny = sy * 4000;
    const maxx = minx + 4000;
    const maxy = miny + 4000;
    boxes.push([
      [
        [minx, miny],
        [maxx, miny],
        [maxx, maxy],
        [minx, maxy],
        [minx, miny],
      ],
    ]);
  }
  const sectorUnion = polygonclipping.union(boxes[0], ...boxes.slice(1));

  logger.start(
    'calculating',
    levels,
    map,
    'contour levels',
    `(${min} min, ${max} max)`,
  );
  const tric = tricontour();

  const start = Date.now();
  const bar = new cliProgress.SingleBar(
    {
      format: `[{bar}] | {value} of {total}`,
      stopOnComplete: true,
      clearOnComplete: true,
    },
    cliProgress.Presets.rect,
  );
  bar.start(levels, 0);

  const features: ContourFeature[] = [];
  tric.thresholds(Array.from({ length: levels }, (_, i) => i + min));
  for (const c of tric.contours(points)) {
    const { value, type, coordinates } = c;
    const intersection = polygonclipping.intersection(
      sectorUnion,
      coordinates as Position[][][],
    );
    features.push(
      normalizeCoordinates({
        type: 'Feature',
        properties: { elevation: value },
        geometry: { type, coordinates: intersection },
      }),
    );
    bar.increment();
  }

  logger.success(
    levels,
    'contours calculated and masked in',
    (Date.now() - start) / 1000,
    'seconds',
  );

  return {
    type: 'FeatureCollection',
    features,
  } as const;
}

/**
 * Joins adjacent `roadFeature`s together if their ends are close to each other,
 * and if their properties are compatible.
 */
export function coalesceRoadFeatures(
  roadFeatures: RoadFeature[],
): RoadFeature[] {
  logger.log('coalescing road features...');

  const heads = new Map<string, RoadFeature[]>();
  const tails = new Map<string, RoadFeature[]>();
  for (const f of roadFeatures) {
    f.properties.startNodeUid &&
      putIfAbsent(f.properties.startNodeUid, [], heads).push(f);
    f.properties.endNodeUid &&
      putIfAbsent(f.properties.endNodeUid, [], tails).push(f);
  }

  // Some adjacent roads share the same startNode, or the same endNode. They
  // can't be coalesced, but their endpoints can be nudged to become coincident,
  // so that they look like they're coalesced.
  let nudgeCount = 0;
  const nudgeAdjacentEnds = (
    roadsList: Iterable<RoadFeature[]>,
    getIndex: (arr: number[][]) => number,
  ) => {
    for (const roads of roadsList) {
      if (roads.length < 2) {
        continue;
      }
      const visited = new Set<RoadFeature>();
      // This is O(n^2), but `roads` isn't expected to be a large array.
      for (const a of roads) {
        if (visited.has(a)) {
          continue;
        }
        visited.add(a);

        const aIndex = getIndex(a.geometry.coordinates);
        const maybeB = roads.find(b => {
          const bIndex = getIndex(b.geometry.coordinates);
          return (
            !visited.has(b) &&
            a.properties.roadType === b.properties.roadType &&
            distance(
              a.geometry.coordinates[aIndex],
              b.geometry.coordinates[bIndex],
            ) < 1 // distance threshold can't be too high, because of divided roads that shouldn't merge into non-divided roads.
          );
        });
        if (!maybeB) {
          continue;
        }

        const bIndex = getIndex(maybeB.geometry.coordinates);
        nudgeCount++;
        const mid = midPoint(
          a.geometry.coordinates[aIndex],
          maybeB.geometry.coordinates[bIndex],
        );
        a.geometry.coordinates[aIndex] = mid;
        maybeB.geometry.coordinates[bIndex] = mid;
      }
    }
  };

  nudgeAdjacentEnds(heads.values(), () => 0);
  nudgeAdjacentEnds(tails.values(), arr => arr.length - 1);
  logger.info(nudgeCount, 'adjacent endpoints nudged');

  // roads available to be added to a road string
  const availableRoads = new Set<RoadFeature>(roadFeatures);
  // returns
  const getString = (road: RoadFeature): RoadFeature[] => {
    if (!availableRoads.has(road)) {
      return [];
    }

    const head = getStringConnectingTo(road, 'head');
    const tail = getStringConnectingTo(road, 'tail');
    head.pop();
    tail.shift();
    return [...head, road, ...tail];
  };
  const getStringConnectingTo = (
    road: RoadFeature,
    dir: 'head' | 'tail',
  ): RoadFeature[] => {
    availableRoads.delete(road);

    const inRange = (a: RoadFeature, b: RoadFeature) =>
      distance(a.geometry.coordinates[0], b.geometry.coordinates.at(-1)!) < 2.5;

    if (dir === 'head') {
      const headKey = road.properties.startNodeUid;
      const connectingRoad =
        headKey && tails.has(headKey)
          ? tails
              .get(headKey)!
              .find(
                r =>
                  inRange(road, r) &&
                  arePropsConnectable(road.properties, r.properties),
              )
          : undefined;
      if (!connectingRoad || !availableRoads.has(connectingRoad)) {
        return [road];
      }
      availableRoads.delete(connectingRoad);
      return [...getStringConnectingTo(connectingRoad, 'head'), road];
    } else {
      const tailKey = road.properties.endNodeUid;
      const connectingRoad =
        tailKey && heads.has(tailKey)
          ? heads
              .get(tailKey)!
              .find(
                r =>
                  inRange(r, road) &&
                  arePropsConnectable(r.properties, road.properties),
              )
          : undefined;
      if (!connectingRoad || !availableRoads.has(connectingRoad)) {
        return [road];
      }
      availableRoads.delete(connectingRoad);
      return [road, ...getStringConnectingTo(connectingRoad, 'tail')];
    }
  };
  const roadStrings: RoadFeature[][] = roadFeatures
    .map(r => getString(r))
    // getString may return an empty string if `r` isn't eligible to be stringified.
    // filter such empty arrays out.
    .filter(rs => rs.length);

  const flattenedStrings = roadStrings.flatMap(rs => rs);
  assert(
    flattenedStrings.length === roadFeatures.length,
    `${flattenedStrings.length} != ${roadFeatures.length}`,
  );
  assert(areSetsEqual(new Set(flattenedStrings), new Set(roadFeatures)));

  const coalescedFeatures = roadStrings.map(rs => {
    return rs.slice(1).reduce<RoadFeature>((coalesced, r) => {
      // coalesce by joining midpoints
      const a = assertExists(coalesced.geometry.coordinates.pop());
      const [b, ...tail] = r.geometry.coordinates;
      const mid = midPoint(a, b);
      coalesced.geometry.coordinates.push(mid, ...tail);
      return coalesced;
    }, rs[0]);
  });

  const preSum = roadFeatures.length;
  const postSum = coalescedFeatures.length;
  const diff = preSum - postSum;
  logger.info('features: ', postSum, '/', preSum, `(${diff} reduction)`);
  logger.info(
    'points: ',
    coalescedFeatures.reduce(
      (acc, f) => acc + f.geometry.coordinates.length,
      0,
    ),
  );
  return coalescedFeatures;
}

function createNormalize(map: 'usa' | 'europe', decimalPoints?: number) {
  const tx = map === 'usa' ? fromAtsCoordsToWgs84 : fromEts2CoordsToWgs84;
  return (p: number[]): Position => {
    Preconditions.checkArgument(p.length === 2);
    const pp = tx(p as Position);
    if (decimalPoints == null) {
      return pp;
    }

    const factor = Math.pow(10, decimalPoints);
    return pp.map(v => Math.round(v * factor) / factor) as Position;
  };
}

/**
 * Mutates coordinates in `feature` by normalizing them with `normalizer`.
 */
function createNormalizeCoordinates(
  map: 'usa' | 'europe',
  decimalPoints?: number,
) {
  const normalize = createNormalize(map, decimalPoints);
  return <T extends AtsMapGeoJsonFeature>(feature: T): T => {
    switch (feature.geometry.type) {
      case 'LineString':
        feature.geometry.coordinates =
          feature.geometry.coordinates.map(normalize);
        break;
      case 'Polygon':
        feature.geometry.coordinates = feature.geometry.coordinates.map(p =>
          p.map(normalize),
        );
        break;
      case 'MultiPolygon':
        feature.geometry.coordinates = feature.geometry.coordinates.map(p =>
          p.map(pp => pp.map(ppp => normalize(ppp))),
        );
        break;
      case 'Point':
        feature.geometry.coordinates = normalize(feature.geometry.coordinates);
        break;
      default:
        throw new UnreachableError(feature.geometry);
    }

    return feature;
  };
}

function areaToFeature(
  area: MapArea,
  nodeMap: Map<string | bigint, Node>,
): MapAreaFeature {
  const points = area.nodeUids.map(id => {
    const node = assertExists(nodeMap.get(id));
    return [node.x, node.y];
  });
  // Polygon coordinates need to end where they start.
  points.push(points[0]);
  return {
    type: 'Feature',
    id: area.uid.toString(),
    properties: {
      type: 'mapArea',
      dlcGuard: area.dlcGuard,
      zIndex: area.drawOver ? 1 : 0,
      color: area.color,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [points],
    },
  };
}

function ferryToNormalizedFeature(
  map: 'usa' | 'europe',
  ferry: Ferry,
  // cities by token
  cities: Map<string, City>,
  // countries by token
  countries: Map<string, Country>,
  // city-name-to-country fallback
  countriesFallback: Map<string, Country>,
  normalize: (gameCoords: number[]) => Position,
): FerryFeature {
  Preconditions.checkArgument(ferry.connections.length === 1);
  const conn = ferry.connections[0];

  const nameAndCountry = [ferry, conn]
    .map(ferry => {
      if (map === 'usa') {
        return { ferry, country: undefined };
      }

      const country = cities.has(ferry.token)
        ? assertExists(countries.get(cities.get(ferry.token)!.countryToken))
        : countriesFallback.get(ferry.name);
      if (!country) {
        logger.warn('could not find country info for', ferry.name, ferry.token);
      }
      return {
        ferry,
        country,
      };
    })
    // TODO is there a better way to sort than "closest to upper-left corner"?
    .sort((a, b) => {
      const upperLeft = {
        x: Number.MIN_SAFE_INTEGER,
        y: Number.MIN_SAFE_INTEGER,
      };
      const aPos = a.country
        ? { x: a.country.x, y: a.country.y }
        : { x: Infinity, y: Infinity };
      const bPos = b.country
        ? { x: b.country.x, y: b.country.y }
        : { x: Infinity, y: Infinity };
      return distance(aPos, upperLeft) - distance(bPos, upperLeft);
    })
    .map(({ ferry, country }) => {
      const isoA2 = country
        ? ets2IsoA2.get(country.code) ?? country.code
        : undefined;
      return isoA2 ? `${ferry.name}, ${isoA2}` : ferry.name;
    })
    .join(' – ');

  if (conn.intermediatePoints.length === 0) {
    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [ferry.x, ferry.y],
          [conn.x, conn.y],
        ].map(normalize),
      },
      properties: {
        type: ferry.train ? 'train' : 'ferry',
        name: nameAndCountry,
      },
    };
  }

  const controlPoints = [
    {
      x: ferry.x,
      y: ferry.y,
      rotation:
        // HACK give Travemunde port a tweak so that the line clears the land.
        ferry.name === 'Travemünde'
          ? -Math.PI / 4
          : Math.atan2(
              conn.intermediatePoints[0].y - ferry.y,
              conn.intermediatePoints[0].x - ferry.x,
            ),
    },
    ...conn.intermediatePoints,
    {
      x: conn.x,
      y: conn.y,
      rotation: Math.atan2(
        conn.y - conn.intermediatePoints.at(-1)!.y,
        conn.x - conn.intermediatePoints.at(-1)!.x,
      ),
    },
  ].map(sp => ({
    position: [sp.x, sp.y] as Position,
    rotation: sp.rotation,
  }));

  // HACK: the current UK coordinate massaging ends up ferry routes from Plymouth where everything past a certain
  // point within a spline gets hard-shifted to the west. This is because we create splines, _then_ project every
  // spline point to WGS84. To work around this:
  // - detect the troublesome ferry connection point that produces such splines
  // - normalize the spline endpoints to WGS84 first, _then_ create the spline in normalized space
  //   - this involves some hardcoded rotation adjustments so that the spline looks ok in normalized space.
  const troublesomePoint = {
    x: -60546.875,
    y: -5859.375,
  };

  const splinePoints: Position[] = [normalize(controlPoints[0].position)];
  for (let i = 1; i < controlPoints.length; i++) {
    const prev = controlPoints[i - 1];
    const curr = controlPoints[i];
    if (
      prev.position[0] === troublesomePoint.x &&
      prev.position[1] === troublesomePoint.y
    ) {
      const nprev = {
        ...prev,
        position: normalize(prev.position),
        rotation: -Math.PI / 4,
      };
      const ncurr = {
        ...curr,
        position: normalize(curr.position),
        rotation: -Math.PI / 2,
      };
      // create a spline in normalized space
      splinePoints.push(...toSplinePoints(nprev, ncurr));
    } else {
      // create a spline in game space, _then_ normalize the spline
      splinePoints.push(...toSplinePoints(prev, curr).map(normalize));
    }
  }
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: splinePoints,
    },
    properties: {
      type: ferry.train ? 'train' : 'ferry',
      name: nameAndCountry,
    },
  };
}

function poiToFeature(poi: Poi): PoiFeature {
  return {
    type: 'Feature',
    properties: {
      type: 'poi',
      sprite: poi.icon,
      poiType: poi.type,
      // TODO labels should be present for all `Poi` of type `LabeledPoi`
      poiName: poi.type === 'company' ? poi.label : poi.icon,
      dlcGuard: 'dlcGuard' in poi ? poi.dlcGuard : undefined,
    },
    geometry: {
      type: 'Point',
      coordinates: [poi.x, poi.y],
    },
  };
}

type CityWithScaleRank = City & {
  scaleRank: number;
  capital: 0 | 1 | 2; // 0 = not a capital; 1 = state/province capital; 2 = country capital
};

function cityToFeature(city: CityWithScaleRank): CityFeature {
  const cityArea = assertExists(city.areas.find(a => !a.hidden));
  return {
    type: 'Feature',
    properties: {
      type: 'city',
      name: city.name,
      scaleRank: city.scaleRank,
      capital: city.capital,
    },
    geometry: {
      type: 'Point',
      coordinates: [city.x + cityArea.width / 2, city.y + cityArea.height / 2],
    },
  };
}

function cityToAreaFeatures(city: CityWithScaleRank): DebugFeature[] {
  return city.areas.map(area => ({
    type: 'Feature',
    properties: {
      type: 'debug',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [area.x, area.y],
          [area.x + area.width, area.y],
          [area.x + area.width, area.y + area.height],
          [area.x, area.y + area.height],
          [area.x, area.y],
        ],
      ],
    },
  }));
}

function countryToFeature(country: Country): CountryFeature {
  return {
    type: 'Feature',
    properties: {
      type: 'country',
      name: country.name,
    },
    geometry: {
      type: 'Point',
      coordinates: [country.x, country.y],
    },
  };
}

function prefabToFeatures(
  normalize: (gameCoords: number[]) => Position,
  prefab: Prefab,
  prefabDescription: PrefabDescription,
  {
    polygons,
    roadStrings,
  }: {
    polygons: Polygon[];
    roadStrings: RoadString[];
  },
  nodes: Map<string | bigint, Node>,
  // TODO make use of this to better position roads within a prefab
  _roadMap: Map<string, Road>,
  roadLookMap: Map<string, RoadLook>,
  roadQuadTree: Quadtree<{ x: number; y: number; roadLookToken: string }>,
  opts: {
    allowUnknownRoadType: boolean;
  },
): (PrefabFeature | RoadFeature)[] {
  const tx = (pos: Position) =>
    toMapPosition(pos, prefab, prefabDescription, nodes);

  const prefabNodes = prefab.nodeUids.map(id => assertExists(nodes.get(id)));
  const findClosestNode = (point: Position): Node | undefined =>
    prefabNodes
      .sort((a, b) => distance(a, point) - distance(b, point))
      // distance threshold is here because roadStrings may be a result of parallelification, and parallel roads may
      // be far away from a prefab's entry/exit nodes.
      // TODO store data in RoadStrings that can be used to better determine entry/exit nodes.
      .filter(n => distance(n, point) < 10)[0];

  return [
    ...polygons.map<PrefabFeature>((polygon, i) => {
      const txPoints = polygon.points.map(tx);
      return {
        type: 'Feature',
        id: prefab.uid + 'poly' + i,
        properties: {
          type: 'prefab',
          dlcGuard: prefab.dlcGuard,
          zIndex: polygon.zIndex,
          color: polygon.color,
        },
        geometry: {
          type: 'Polygon',
          // Polygon coordinates need to end where they start.
          coordinates: [[...txPoints, txPoints.at(-1)!]],
        },
      };
    }),
    ...roadStrings.map<RoadFeature>((road, i) => {
      const txPoints = road.points.map(tx);
      let nearestRoadType: RoadType = 'unknown';
      if (!prefab.hidden) {
        // we don't care too much about roads in hidden prefabs, because the map
        // styles all hidden roads the same.
        const roadStart = txPoints[0];
        const roadEnd = txPoints.at(-1)!;
        // search for the first road at the road string's start or end point.
        const nearestRoad = [
          roadQuadTree.find(...roadStart, 2),
          roadQuadTree.find(...roadEnd, 2),
        ]
          .filter((e): e is QtRoadEntry => e != null)
          .sort(
            (a, b) =>
              Math.min(distance(a, roadStart), distance(a, roadEnd)) -
              Math.min(distance(b, roadStart), distance(b, roadEnd)),
          )[0];
        if (nearestRoad && roadLookMap.has(nearestRoad.roadLookToken)) {
          nearestRoadType = getRoadType(
            roadLookMap.get(nearestRoad.roadLookToken)!,
          );
          for (const roadPoint of txPoints) {
            // add road point entries, based on the current road string. used
            // for fallback when detecting road types of prefab-internal road
            // strings.
            roadQuadTree.add({
              ...nearestRoad,
              x: roadPoint[0],
              y: roadPoint[1],
            });
          }
        } else {
          // no road detected at the road string's start or end.
          // fallback to the type of the nearest road segment
          const nearestRoads = [
            roadQuadTree.find(...roadStart)!,
            roadQuadTree.find(...roadEnd)!,
          ];
          let nearestRoad;
          if (!opts.allowUnknownRoadType) {
            const mid = midPoint(roadStart, roadEnd);
            nearestRoad = nearestRoads.sort(
              (a, b) => distance(a, mid) - distance(b, mid),
            )[0];
          } else {
            nearestRoad = nearestRoads.filter(
              entry =>
                distance(entry, roadStart) < 1 || distance(entry, roadEnd) < 1,
            )[0];
          }
          if (nearestRoad && roadLookMap.has(nearestRoad.roadLookToken)) {
            nearestRoadType = getRoadType(
              roadLookMap.get(nearestRoad.roadLookToken)!,
            );
          }
        }
      }
      if (
        !opts.allowUnknownRoadType &&
        nearestRoadType === 'unknown' &&
        !prefab.hidden
      ) {
        const [lon, lat] = normalize([prefab.x, prefab.y]);
        logger.warn(
          'could not infer road type for prefab road at',
          `/${lat.toFixed(3)}/${lon.toFixed(3)}`,
        );
      }
      return {
        type: 'Feature',
        id: prefab.uid + 'road' + i,
        properties: {
          type: 'road',
          dlcGuard: prefab.dlcGuard,
          prefab: prefab.token,
          roadType: nearestRoadType,
          offset: road.offset,
          leftLanes: road.lanesLeft,
          rightLanes: road.lanesRight,
          hidden: !!prefab.hidden,
          startNodeUid: findClosestNode(txPoints[0])?.uid.toString(16),
          endNodeUid: findClosestNode(txPoints.at(-1)!)?.uid.toString(16),
        },
        geometry: {
          type: 'LineString',
          coordinates: txPoints,
        },
      };
    }),
  ];
}

function roadToFeature(
  road: Road,
  roadLook: RoadLook,
  nodes: Map<bigint | string, Node>,
  _dividerFeatures: GeoJSON.Feature<GeoJSON.LineString>[],
): RoadFeature[] {
  const startNode = Preconditions.checkExists(nodes.get(road.startNodeUid));
  const endNode = Preconditions.checkExists(nodes.get(road.endNodeUid));
  const points = toSplinePoints(
    {
      position: [startNode.x, startNode.y],
      rotation: startNode.rotation,
    },
    {
      position: [endNode.x, endNode.y],
      rotation: endNode.rotation,
    },
  );
  const properties = {
    ...roadLookToProperties(roadLook, !!road.hidden),
    dlcGuard: road.dlcGuard,
    startNodeUid: road.startNodeUid.toString(16),
    endNodeUid: road.endNodeUid.toString(16),
  };

  // TODO look into splitting roads by dividers (a.k.a., "center kerbs").
  //if (!road.maybeDivided && roadLook.laneOffset) {
  //  // road has enough space to be divided, but nothing divides it along its entire length.
  //  // it may still be divided partway, though. check for that.
  //  const r: RoadFeature = {
  //    type: 'Feature',
  //    id: road.uid.toString(),
  //    properties,
  //    geometry: {
  //      type: 'LineString',
  //      coordinates: points,
  //    },
  //  };
  //  for (const d of dividerFeatures) {
  //    const splitLines = lineSplit(r, d).features;
  //    if (splitLines.length === 0) {
  //      continue;
  //    }
  //    console.log(
  //      'road',
  //      road.uid,
  //      'split by',
  //      d.id,
  //      splitLines.length,
  //      //JSON.stringify(splitLines, null, 2),
  //      //JSON.stringify(d, null, 2),
  //    );
  //  }
  //}

  const offset =
    road.maybeDivided && roadLook.laneOffset
      ? roadLook.laneOffset
      : roadLook.offset;
  if (!offset) {
    // single carriageway
    return [
      {
        type: 'Feature',
        id: road.uid.toString(),
        properties: {
          ...properties,
          //maybeDivided: road.maybeDivided === true,
        },
        geometry: {
          type: 'LineString',
          coordinates: points,
        },
      },
    ];
  }

  // dual carriageway; split the road.
  const halfOffset =
    offset / 2 +
    // N.B.: there are road looks out there with asymmetric lane counts.
    // split the difference for now.
    // TODO do asymmetric offsets, but gotta verify offsets.
    ((properties.leftLanes + properties.rightLanes) / 4) * 4.5;
  const aLine = lineOffset(turf.lineString(points), -halfOffset, {
    units: 'degrees',
  });
  const bLine = lineOffset(turf.lineString(points), +halfOffset, {
    units: 'degrees',
  });

  return [
    {
      type: 'Feature',
      id: road.uid.toString(),
      properties: {
        ...properties,
        leftLanes: 0,
        //offset,
      },
      geometry: {
        type: 'LineString',
        coordinates: aLine.geometry.coordinates,
      },
    },
    {
      type: 'Feature',
      id: road.uid.toString(),
      properties: {
        ...properties,
        rightLanes: 0,
        //offset,
      },
      geometry: {
        type: 'LineString',
        coordinates: bLine.geometry.coordinates,
      },
    },
  ];
}

function getRoadType(look: RoadLook): RoadType {
  const lanes = look.lanesLeft.concat(look.lanesRight);
  if (lanes.length === 0) {
    // logger.warn(
    //   "trying to get road types without lane info. defaulting to 'local'"
    // );
    return 'local';
  }

  let roadType: RoadType = 'unknown';
  // prioritize types. assumes road looks can contain multiple types.
  if (lanes.some(l => l.includes('freeway') || l.includes('motorway'))) {
    roadType = 'freeway';
  } else if (
    lanes.some(l => l.includes('divided') || l.includes('expressway'))
  ) {
    roadType = 'divided';
  } else if (
    lanes.some(l =>
      ['local', 'no_vehicles', 'side_road', 'slow_road'].some(t =>
        l.includes(t),
      ),
    )
  ) {
    roadType = 'local';
  } else if (lanes.some(l => l.includes('tram'))) {
    roadType = 'tram';
  } else if (lanes.some(l => l.includes('train'))) {
    roadType = 'train';
  }
  return roadType;
}

function roadLookToProperties(
  look: RoadLook,
  hidden: boolean,
): RoadLookProperties {
  return {
    type: 'road',
    roadType: getRoadType(look),
    leftLanes: look.lanesLeft.length,
    rightLanes: look.lanesRight.length,
    laneOffset: look.laneOffset,
    hidden,
  };
}

function arePropsConnectable(
  a: RoadLookProperties & { dlcGuard: number },
  b: RoadLookProperties & { dlcGuard: number },
) {
  if (a.dlcGuard !== b.dlcGuard) {
    return false;
  }

  // we don't care about hidden roads; they can be joined all the time since they're
  // currently rendered the same, regardless of roadType.
  if (a.hidden && b.hidden) {
    return true;
  }

  // TODO this is a legacy check, but maybe it's no longer needed / it's redundant?
  if (JSON.stringify(a) === JSON.stringify(b)) {
    return true;
  }

  const ar = a;
  const br = b;
  if (ar.roadType !== br.roadType) {
    return false;
  }
  if (ar.hidden !== br.hidden) {
    return false;
  }

  if (
    (ar.leftLanes === -1 && ar.rightLanes === -1) ||
    (br.leftLanes === -1 && br.rightLanes === -1)
  ) {
    return true;
  }

  if (ar.leftLanes === 0 || ar.rightLanes === 0) {
    const arLanes = ar.leftLanes || ar.rightLanes;
    if (
      Math.abs(br.leftLanes - arLanes) <= 1 ||
      Math.abs(br.rightLanes - arLanes) <= 1
    ) {
      return true;
    }
  }
  if (br.leftLanes === 0 || br.rightLanes === 0) {
    const brLanes = br.leftLanes || br.rightLanes;
    if (
      Math.abs(ar.leftLanes - brLanes) <= 1 ||
      Math.abs(ar.rightLanes - brLanes) <= 1
    ) {
      return true;
    }
  }

  return false;
}

export interface PopulatedPlacesProperties {
  name: string;
  namealt: string;
  adm1name: string;
  sov0name: string;
  iso_a2: string;
  scalerank: number;
  featurecla: string;
}
export function getCitiesByCountryIsoA2(): Map<
  string,
  PopulatedPlacesProperties[]
> {
  const populatedPlaces = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        'resources',
        // from https://github.com/nvkelso/natural-earth-vector
        'ne_10m_populated_places_simple.geojson',
      ),
      'utf-8',
    ),
  ) as unknown as GeoJSON.FeatureCollection<
    GeoJSON.Point,
    PopulatedPlacesProperties
  >;
  const citiesByCountryIsoA2 = new Map<string, PopulatedPlacesProperties[]>();
  for (const { properties: city } of populatedPlaces.features) {
    const isoA2 = city.sov0name === 'Kosovo' ? 'XK' : city.iso_a2;
    const cities = putIfAbsent(isoA2, [], citiesByCountryIsoA2);
    if (!/^[A-Z][A-Z]$/.test(isoA2)) {
      // logger.warn(city.sov0name, 'has invalid iso a2 code');
    }
    cities.push(city);
  }
  return citiesByCountryIsoA2;
}

export function createIsoA2Map(): {
  get: (gameCountryCode: string) => string;
} {
  const isoA2s = new Set(getCitiesByCountryIsoA2().keys());
  return {
    get: (gameCountryCode: string) => {
      if (isoA2s.has(gameCountryCode)) {
        return gameCountryCode;
      }
      Preconditions.checkArgument(ets2IsoA2.has(gameCountryCode));
      return ets2IsoA2.get(gameCountryCode)!;
    },
  };
}
