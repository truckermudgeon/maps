import { rotateRight } from '@truckermudgeon/base/array';
import { assert, assertExists } from '@truckermudgeon/base/assert';
import { areSetsEqual } from '@truckermudgeon/base/equals';
import type { Extent, Position } from '@truckermudgeon/base/geom';
import { contains, distance, getExtent } from '@truckermudgeon/base/geom';
import { mapValues, putIfAbsent } from '@truckermudgeon/base/map';
import { UnreachableError } from '@truckermudgeon/base/precon';
import {
  AtsSelectableDlcs,
  FacilitySpawnPointTypes,
  ItemType,
  toAtsDlcGuards,
  toFacilityIcon,
} from '@truckermudgeon/map/constants';
import type { Lane } from '@truckermudgeon/map/prefabs';
import { calculateLaneInfo, toMapPosition } from '@truckermudgeon/map/prefabs';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
} from '@truckermudgeon/map/projections';
import type { Direction } from '@truckermudgeon/map/routing';
import type {
  CompanyItem,
  FacilityIcon,
  GraphData,
  MapArea,
  Neighbor,
  Node,
  Poi,
  Prefab,
  PrefabDescription,
} from '@truckermudgeon/map/types';
import { lineString, point } from '@turf/helpers';
import { quadtree } from 'd3-quadtree';
import type { GeoJSON } from 'geojson';
import { dlcGuardMapDataKeys, normalizeDlcGuards } from '../dlc-guards';
import { createNormalizeFeature } from '../geo-json/normalize';
import { logger } from '../logger';
import type { MapDataKeys, MappedDataForKeys } from '../mapped-data';

type GraphContextMappedData = MappedDataForKeys<
  [
    'nodes',
    'roads',
    'roadLooks',
    'prefabs',
    'prefabDescriptions',
    'companies',
    'ferries',
  ]
>;

type DebugFC = GeoJSON.FeatureCollection<
  GeoJSON.Point | GeoJSON.LineString,
  { debugType: 'overview' | 'detail' }
>;

type Context = GraphContextMappedData & {
  prefabLanes: Map<string, Map<number, Lane[]>>;
  companiesByPrefabItemId: Map<bigint, CompanyItem>;
  getDlcGuard: (node: Node) => number;
  graphDebug: DebugFC;
};

export const graphMapDataKeys = [
  ...dlcGuardMapDataKeys,
  'companies',
  'ferries',
  'prefabDescriptions',
  'roadLooks',
  'cities',
] satisfies MapDataKeys;

type GraphMappedData = MappedDataForKeys<typeof graphMapDataKeys>;

export function generateGraph(
  tsMapData: GraphMappedData,
): GraphData & { graphDebug: DebugFC } {
  const {
    map,
    nodes: _nodes,
    roads: _roads,
    prefabs: _prefabs,
    companies: _companies,
    ferries,
    pois,
    mapAreas,
    prefabDescriptions,
    roadLooks,
    dlcGuardQuadTree,
  } = normalizeDlcGuards(tsMapData);
  const getDlcGuard = (node: Node): number =>
    dlcGuardQuadTree?.find(node.x, node.y)?.dlcGuard ?? -1;
  const toNode = (nodeUid: bigint): Node => assertExists(nodes.get(nodeUid));

  const graphDebug: DebugFC = {
    type: 'FeatureCollection',
    features: [],
  };

  //
  // Set up supporting data based on input data
  //

  // Part of the pre-processing phase involves deleting entries from the nodes
  // and prefabs maps. Create mutable copies to allow for this.
  const nodes = new Map(_nodes);
  const prefabs = new Map(_prefabs);
  const roads = new Map(_roads);

  // delete roads + prefabs in unselectable dlc content.
  const guards = toAtsDlcGuards(AtsSelectableDlcs) as Set<number>;
  for (const [key, prefab] of prefabs) {
    if (!guards.has(prefab.dlcGuard)) {
      prefabs.delete(key);
    }
  }
  for (const [key, road] of roads) {
    if (!guards.has(road.dlcGuard)) {
      roads.delete(key);
    }
  }

  const companies = new Map(
    [..._companies.entries()].filter(([, company]) =>
      // filter out companies in unknown cities (e.g., cities in upcoming DLC)
      tsMapData.cities.has(company.cityToken),
    ),
  );
  const companiesByPrefabItemId = new Map(
    companies.values().map(company => {
      const companyPrefabUid = company.prefabUid;
      assert(prefabs.has(companyPrefabUid));
      return [companyPrefabUid, company];
    }),
  );

  const prefabsWithFacilities = new Set<Prefab>(
    prefabs.values().filter(prefab => {
      const prefabDesc = assertExists(prefabDescriptions.get(prefab.token));
      return (
        prefabDesc.spawnPoints.some(sp =>
          FacilitySpawnPointTypes.has(sp.type),
        ) || prefabDesc.triggerPoints.some(tp => tp.action === 'hud_parking')
      );
    }),
  );

  const toSectorKey = (o: { x: number; y: number }) =>
    `${Math.floor(o.x / 4000)},${Math.floor(o.y / 4000)}`;
  const nodesBySector = new Map<string, Node[]>();
  const getRoadOrPrefab = (id: bigint) => roads.get(id) ?? prefabs.get(id);
  for (const node of nodes.values()) {
    const { forwardItemUid, backwardItemUid } = node;
    const connectedItem =
      getRoadOrPrefab(forwardItemUid) ?? getRoadOrPrefab(backwardItemUid);
    if (connectedItem) {
      putIfAbsent(toSectorKey(node), [], nodesBySector).push(node);
    }
  }

  //
  // Pre-process data for islands, i.e., prefabs that aren't linked to other
  // prefabs or roads via node forward/backward item references (e.g., the
  // prefab used for gas station pumps):
  // - collect references to islands
  // - deletes references to islands from `nodes`, `nodesBySector`, `prefabs`,
  //   and `prefabsWithFacilities`
  //

  // Search for company and facility prefab islands. Remove such prefabs and
  // their associated nodes from our lookup tables, in the hopes that the
  // regular graph-building logic + fallback graph-building logic will produce
  // connected routes for all companies and facilities.
  const islandCompanyPrefabs: Prefab[] = [];
  // Note: this set may contain entries in islandCompanyPrefabs (the
  // intersection of the sets seems to be made up of truck dealers, only).
  const islandFacilityPrefabs = new Set<Prefab>();
  let connectedFacilityPrefabsCount = 0;
  const allPrefabs = [...prefabs.values()];
  for (const prefab of allPrefabs) {
    const prefabNodes = prefab.nodeUids.map(toNode);

    // check if `prefab` is an "island" that is disconnected from any other
    // roads / prefabs.
    const isIsland = prefabNodes.every(
      node =>
        (node.forwardItemUid === prefab.uid &&
          getRoadOrPrefab(node.backwardItemUid) == null) ||
        (node.backwardItemUid === prefab.uid &&
          getRoadOrPrefab(node.forwardItemUid) == null),
    );
    if (!isIsland) {
      if (prefabsWithFacilities.has(prefab)) {
        connectedFacilityPrefabsCount++;
      }
      // this prefab is fine; it's connected to other roads / prefabs and should
      // be reachable.
      continue;
    }

    // delete the unreachable island prefab from the lookup tables, but mark it
    // for later graph massaging if it's a company or contains facilities, since
    // we want to be able to route to the company and/or facilities.

    prefabs.delete(prefab.uid);
    // delete prefab nodes from `nodes` map
    prefab.nodeUids.forEach(id => nodes.delete(id));
    // delete prefab nodes from `nodesBySector`
    const prefabNodeUids = new Set(prefab.nodeUids);
    const sectorKey = toSectorKey(prefab);
    const otherNodes = assertExists(nodesBySector.get(sectorKey)).filter(
      node => !prefabNodeUids.has(node.uid),
    );
    nodesBySector.set(sectorKey, otherNodes);

    if (companiesByPrefabItemId.has(prefab.uid)) {
      islandCompanyPrefabs.push(prefab);
    }
    if (prefabsWithFacilities.has(prefab)) {
      islandFacilityPrefabs.add(prefab);
      prefabsWithFacilities.delete(prefab);
    }
  }
  logger.info('island company prefabs', islandCompanyPrefabs.length);
  logger.info('island facility prefabs', islandFacilityPrefabs.size);
  logger.info('connected facility prefabs', connectedFacilityPrefabsCount);

  //
  // Build the graph
  //

  logger.log('building graph...');

  const context: Context = {
    map,
    nodes,
    roads,
    roadLooks,
    prefabs,
    prefabDescriptions,
    prefabLanes: mapValues(prefabDescriptions, prefabDesc =>
      calculateLaneInfo(prefabDesc),
    ),
    companies,
    companiesByPrefabItemId,
    ferries,
    getDlcGuard,
    graphDebug,
  };

  // keyed by node uids
  const graph = new Map<
    bigint,
    { forward: Neighbor[]; backward: Neighbor[] }
  >();
  for (const node of nodes.values()) {
    const neighbors = {
      forward: getNeighborsInDirection(node, 'forward', context),
      backward: getNeighborsInDirection(node, 'backward', context),
    };
    const hasNeighbors = neighbors.forward.length || neighbors.backward.length;
    if (hasNeighbors) {
      graph.set(node.uid, neighbors);
    }
  }

  updateGraphWithFerries(graph, context);

  //
  // Post-process graph
  //

  // Problematic intersections.
  //
  // Look for "dead end" nodes that can be exited in one direction, but can't be
  // exited in the opposite direction. such dead-end nodes should be exit-able
  // in any direction; e.g., if i start at a dead-end node, and there's a valid
  // edge in the backward direction to node N, then i should be able to reach
  // node N in the forward direction, too.
  // establish an exit edge in the opposite direction to deal with "bad"
  // intersections, like the one near the Wallbert warehouse in sacramento.
  let fudged = 0;
  for (const [nodeId, edges] of graph.entries()) {
    const node = assertExists(nodes.get(nodeId));
    const forwardItem =
      roads.get(node.forwardItemUid) ?? prefabs.get(node.forwardItemUid);
    const backwardItem =
      roads.get(node.backwardItemUid) ?? prefabs.get(node.backwardItemUid);
    if (
      !forwardItem &&
      edges.forward.length === 0 &&
      edges.backward.length > 0
    ) {
      const backwardEdges = edges.backward.filter(edge => {
        const node = graph.get(edge.nodeUid);
        if (!node) {
          return false;
        }
        return [...node.forward, ...node.backward].some(
          returnEdge => returnEdge.nodeUid === nodeId,
        );
      });
      for (const edge of backwardEdges) {
        edges.forward.push(edge);
        fudged++;
      }
    } else if (
      !backwardItem &&
      edges.backward.length === 0 &&
      edges.forward.length > 0
    ) {
      const forwardEdges = edges.forward.filter(edge => {
        const node = graph.get(edge.nodeUid);
        if (!node) {
          return false;
        }
        return [...node.forward, ...node.backward].some(
          returnEdge => returnEdge.nodeUid === nodeId,
        );
      });
      for (const edge of forwardEdges) {
        edges.backward.push(edge);
        fudged++;
      }
    }
  }
  logger.info(fudged, 'hacky dead-end edges added');

  // Island companies.
  //
  // Deal with island companies (i.e., company nodes that haven't been
  // connected to a prefab node in prior graph-building steps) by forcing a
  // connection to the closest node.
  for (const prefab of islandCompanyPrefabs) {
    const company = assertExists(companiesByPrefabItemId.get(prefab.uid));
    const companyNode = assertExists(nodes.get(company.nodeUid));
    assert(!graph.has(companyNode.uid));
    // at ths point, companyNodeUid is completely absent in the graph.
    // link the company node to the closest node already in the graph.
    const nodesInSectorRange = getObjectsInSectorRange(
      companyNode,
      nodesBySector,
    );
    let closest = nodesInSectorRange
      .sort((a, b) => distance(a, companyNode) - distance(b, companyNode))
      .find(n => n.uid !== companyNode.uid);
    if (!closest) {
      logger.error('no eligible nodes for', company.token, company.cityToken);
      throw new Error();
    }
    const closestInGraph = nodesInSectorRange
      .sort((a, b) => distance(a, companyNode) - distance(b, companyNode))
      .find(n => n.uid !== companyNode.uid && graph.has(n.uid));
    if (closestInGraph && closest.uid !== closestInGraph.uid) {
      logger.warn(
        `${company.cityToken}.${company.token} ${company.uid.toString(16)}:`,
        `graph does not contain entry for node ${closest.uid.toString(16)};`,
        `using ${closestInGraph.uid.toString(16)} instead.`,
        distance(closest, companyNode),
        'vs',
        distance(closestInGraph, companyNode),
      );
      closest = closestInGraph;
    }
    assert(graph.has(closest.uid));
    //logger.info(
    //  'hacked connection',
    //  Number(dist.toFixed(3)),
    //  company.token,
    //  company.cityToken,
    //  closest.uid.toString(16),
    //);
    // establish edges from company node to closest node
    graphDebug.features.push(
      createDebugLineString(
        companyNode,
        closest,
        'island:company-to-closest',
        'detail',
      ),
    );
    graph.set(companyNode.uid, {
      forward: [
        createNeighbor(companyNode, closest, 'forward', getDlcGuard),
        createNeighbor(companyNode, closest, 'backward', getDlcGuard),
      ],
      backward: [],
    });
    // establish edges from closest node to company node
    const neighbors = graph.get(closest.uid)!;
    graphDebug.features.push(
      createDebugLineString(
        closest,
        companyNode,
        'island:closest-to-company',
        'detail',
      ),
    );
    neighbors.forward.push(
      createNeighbor(closest, companyNode, 'forward', getDlcGuard),
      createNeighbor(closest, companyNode, 'backward', getDlcGuard),
    );
    neighbors.backward.push(
      createNeighbor(closest, companyNode, 'forward', getDlcGuard),
      createNeighbor(closest, companyNode, 'backward', getDlcGuard),
    );
  }

  logger.info(islandCompanyPrefabs.length, 'hacky company edges added');

  // HACK deal with the prefab intersection that enters the wal_mkt company in
  // Lamar, Colorado. Connectivity says it can enter the wal_mkt, but it can
  // never exit, so fudge an edge that says we _can_ exit.
  // TODO write a general solution and search for all prefab intersections that
  //  lead into a company prefab one-way, then add fudged edges (similar to the
  //  dead-end fudging earlier).
  if (map === 'usa' && graph.has(0x3301e888d4055f5en)) {
    const hackNeighbors = assertExists(graph.get(0x3301e888d4055f5en));
    hackNeighbors.forward.push({
      nodeUid: 0x3301e888b6855e83n,
      distance: 32,
      direction: 'forward',
      dlcGuard: 13, // The DLC Guard value for Colorado, which is where Lamar is.
    });
  }

  logger.info(
    graph.size,
    'nodes,',
    graph
      .values()
      .reduce((acc, ns) => acc + ns.forward.length + ns.backward.length, 0),
    'edges',
  );

  // TODO the graph currently being generated still includes disconnected
  //  sub-graphs (e.g., 4a3f975872850005). Figure out why, and either detect +
  //  exclude them or find the bug.

  // Facilities.

  // notes:
  // - "entry" nodes to prefabs are ones that either:
  //    - link a road-prefab/road to a prefab referenced by a company
  //    - link a road-prefab/road to 0, and are near a navigation mapArea
  //      (which is assumed to overlap a larger mapArea containing facilities).

  // Note: we're building these maps _now_ instead of _before_ the "delete
  // island references from nodes and prefabs" step. Not sure if this is right.
  const areafulPrefabsBySector = new Map<
    string,
    {
      prefab: Prefab;
      mbr: Extent;
    }[]
  >();
  for (const prefab of prefabs.values()) {
    const prefabDesc = assertExists(prefabDescriptions.get(prefab.token));
    const polygonPoints = prefabDesc.mapPoints.filter(
      mp => mp.type === 'polygon',
    );
    if (polygonPoints.length === 0) {
      continue;
    }

    const tx = (pos: Position) => toMapPosition(pos, prefab, prefabDesc, nodes);
    const mbr = getExtent(polygonPoints.map(pp => tx([pp.x, pp.y])));
    const sectorKey = toSectorKey(prefab);
    putIfAbsent(sectorKey, [], areafulPrefabsBySector).push({ prefab, mbr });
  }

  const mapAreasBySector = new Map<
    string,
    { mapArea: MapArea; mbr: Extent }[]
  >();
  for (const mapArea of mapAreas.values()) {
    const mbr = getExtent(mapArea.nodeUids.map(toNode));
    const sectorKey = toSectorKey(mapArea);
    putIfAbsent(sectorKey, [], mapAreasBySector).push({ mapArea, mbr });
  }

  const facilityNodes = new Map<
    // TODO should we include all of a prefab's node uids, instead of one?
    bigint, // one of the containing prefab's prefab node ids
    {
      facilities: Set<FacilityIcon>;
      itemUid: bigint;
      itemType: ItemType.Prefab | ItemType.MapArea;
    }
  >();

  // Connected facility prefabs
  const knownGraphNodes = new Set(graph.keys());
  for (const prefab of prefabsWithFacilities) {
    assert(!islandFacilityPrefabs.has(prefab));
    const { key, value } = getPrefabFacilitiesEntry(prefab, {
      prefabDescriptions,
      nodes,
      knownGraphNodes,
    });
    assert(!facilityNodes.has(key));
    facilityNodes.set(key, value);
  }

  // Island facility prefabs.
  //
  // Match island facility prefabs to larger, reachable prefabs (like a truck
  // stop prefab or a company prefab) that contain them.
  // Find the prefab node of those containing prefabs closest to a facility,
  // then associate those prefab nodes with a facility entry.
  const containingPrefabs = new Set<Prefab>();
  logger.log(
    'checking',
    islandFacilityPrefabs.size,
    'island facility prefabs for containing prefabs',
  );
  for (const islandPrefab of islandFacilityPrefabs) {
    const otherPrefabs = getObjectsInSectorRange(
      islandPrefab,
      areafulPrefabsBySector,
    ).filter(({ prefab }) => prefab.uid !== islandPrefab.uid);

    const ipfns = islandPrefab.nodeUids.map(id =>
      // note: must check original `_nodes` map, because `nodes` is guaranteed
      // not to contain any of an island prefab's nodes :-/
      assertExists(_nodes.get(id)),
    );
    const containingPrefab = otherPrefabs.find(p =>
      ipfns.some(ipfn => contains(p.mbr, ipfn)),
    )?.prefab;
    if (!containingPrefab) {
      // this island has no containing prefab. it might have a containing
      // map area, or it might need special treatment.
      continue;
    }

    const cpns = containingPrefab.nodeUids.map(id =>
      assertExists(nodes.get(id)),
    );
    // assert containing prefab is connected and doesn't already contain another
    // island prefab
    assert(cpns.some(n => graph.has(n.uid)));
    assert(!containingPrefabs.has(containingPrefab));
    containingPrefabs.add(containingPrefab);

    const { key, value } = getPrefabFacilitiesEntry(containingPrefab, {
      prefabDescriptions,
      nodes,
      knownGraphNodes,
    });

    if (facilityNodes.has(key)) {
      const existing = facilityNodes.get(key)!;
      assert(existing.itemUid === value.itemUid);
      assert(areSetsEqual(existing.facilities, value.facilities));
      logger.warn('encountered a benign duplicate key', key.toString(16));
      continue;
    }

    facilityNodes.set(key, {
      ...value,
      facilities: new Set([
        // the facilities of `containingPrefab`
        ...value.facilities,
        // the facilities of `islandPrefab`
        ...getFacilities(
          assertExists(prefabDescriptions.get(islandPrefab.token)),
        ),
      ]),
    });

    logger.info(
      'islandPrefab',
      islandPrefab.token,
      'contained by',
      containingPrefab.token,
    );
    islandFacilityPrefabs.delete(islandPrefab);
  }

  logger.log(
    'checking',
    islandFacilityPrefabs.size,
    'island facility prefabs for containing map areas',
  );
  const islandAreas = new Map<MapArea, Prefab[]>();
  for (const islandPrefab of islandFacilityPrefabs) {
    const mapAreas = getObjectsInSectorRange(islandPrefab, mapAreasBySector);
    const ipfns = islandPrefab.nodeUids.map(id =>
      // note: must check original `_nodes` map, because `nodes` is guaranteed
      // not to contain any of an island prefab's nodes :-/
      assertExists(_nodes.get(id)),
    );
    const containingMapArea = mapAreas
      .filter(({ mbr }) => ipfns.some(ipfn => contains(mbr, ipfn)))
      .sort((a, b) => largestFirstComparator(a.mbr, b.mbr))[0];
    if (!containingMapArea) {
      // island prefab isn't contained within a map area. ignore it for now;
      // will be dealt with in final pass through `islandFacilityPrefabs`.
      continue;
    }

    // find existing graph node within a map area node
    // TODO find "entrance" map area and use node closest to that, if found.

    const containedNodes = getObjectsInSectorRange(
      containingMapArea.mapArea,
      nodesBySector,
    ).filter(
      node => graph.has(node.uid) && contains(containingMapArea.mbr, node),
    );
    if (containedNodes.length === 0) {
      // map area contains the island prefab, but can't reach the map area.
      // Save them for later processing.
      putIfAbsent(containingMapArea.mapArea, [], islandAreas).push(
        islandPrefab,
      );
      islandFacilityPrefabs.delete(islandPrefab);
      continue;
    }

    const prefabDesc = assertExists(prefabDescriptions.get(islandPrefab.token));
    const tx = ({ x, y }: { x: number; y: number }) =>
      toMapPosition([x, y], islandPrefab, prefabDesc, _nodes);
    const { facilityPoints: fps, facilities: islandFacilities } =
      getFacilitiesAndPoints(prefabDesc, tx);
    const closestContainedNodeUid = containedNodes.sort((a, b) => {
      const minDistA = Math.min(...fps.map(fp => distance(fp, a)));
      const minDistB = Math.min(...fps.map(fp => distance(fp, b)));
      return minDistA - minDistB;
    })[0].uid;
    const facility = putIfAbsent(
      closestContainedNodeUid,
      {
        facilities: getFacilities(prefabDesc),
        itemUid: containingMapArea.mapArea.uid,
        itemType: ItemType.MapArea,
      },
      facilityNodes,
    );
    islandFacilities.forEach(f => facility.facilities.add(f));
    islandFacilityPrefabs.delete(islandPrefab);
  }

  if (islandAreas.size > 0) {
    logger.log(
      'checking',
      islandAreas.size,
      'island prefab-containing map areas for nearest node',
    );
    // TODO prefer 'dead end' nodes (nodes with a forward or backward item id of
    // 0), assuming that they're nodes for prefab intersections leading to map
    // areas.
  }

  logger.info(
    'checking',
    islandFacilityPrefabs.size,
    'island facility prefabs for nearest prefabs / map areas',
  );

  logger.info('service areas', facilityNodes.size);

  // Parking.
  // associate trigger- and overlay-based parking POIs with prefab or map area
  let ignoredCount = 0;
  let inPrefab = 0;
  let inArea = 0;
  const uncontainedParking: Poi[] = [];
  for (const poi of pois) {
    if (poi.type !== 'facility' || poi.icon !== 'parking_ico') {
      continue;
    }
    const fromItemType = poi.fromItemType;
    if (fromItemType !== 'trigger' && fromItemType !== 'mapOverlay') {
      continue;
    }

    const prefabs = getObjectsInSectorRange(poi, areafulPrefabsBySector);
    const containingPrefab = prefabs.find(p => contains(p.mbr, poi));
    if (containingPrefab) {
      const prefabDesc = assertExists(
        prefabDescriptions.get(containingPrefab.prefab.token),
      );
      if (prefabDesc.triggerPoints.some(tp => tp.action === 'hud_parking')) {
        // TODO: why are we ignoring this? is it because it's accounted for by
        // whatever is calling `getFacilities`?
        ignoredCount++;
      } else {
        inPrefab++;
      }
      continue;
    }

    const mapAreas = getObjectsInSectorRange(poi, mapAreasBySector);
    const containingArea = mapAreas.find(a => contains(a.mbr, poi));
    if (containingArea) {
      // link
      inArea++;
      continue;
    }

    uncontainedParking.push(poi);
  }
  logger.info(inPrefab, inArea, ignoredCount, 'prefab, area, ignored');
  // parking spots not present in a prefab, or a map area.
  // list first 5.
  // maybe they can be associated with nearby prefabs / map areas? e.g.,
  // 35.640/-94.877 {
  //   x: 5143.46484375,
  //   y: 18881.69921875,
  //   sectorX: 1,
  //   sectorY: 4,
  //   type: 'facility',
  //   dlcGuard: 25,
  //   itemNodeUids: [
  //     '4e0e5570c351308a',
  //     '4e0e55702711308b',
  //     '4e0e55703691308c',
  //     '4e0e5570c651308d',
  //     '4e0e55706cd1308e',
  //     '4e0e5570a811308f',
  //     '4e0e55709bd13090'
  //   ],
  //   icon: 'parking_ico',
  //   fromItemType: 'trigger'
  // }
  // is awfully close to a map area.
  logger.warn('uncontained parking', uncontainedParking.length);
  if (uncontainedParking.length) {
    const project =
      map === 'usa' ? fromAtsCoordsToWgs84 : fromEts2CoordsToWgs84;
    for (let i = 0; i < Math.min(5, uncontainedParking.length); i++) {
      const poi = uncontainedParking[i];
      console.log(
        project([poi.x, poi.y])
          .reverse()
          .map(f => f.toFixed(3))
          .join('/'),
        poi,
      );
    }
  }

  // Simple graph checks.

  const nodesWithEdgesTo = new Set<bigint>();
  for (const neighbors of graph.values()) {
    for (const n of neighbors.forward) {
      nodesWithEdgesTo.add(n.nodeUid);
    }
    for (const n of neighbors.backward) {
      nodesWithEdgesTo.add(n.nodeUid);
    }
  }

  const nodesWithoutEdgesTo = new Set<bigint>();
  for (const [nodeUid, neighbors] of graph.entries()) {
    if (neighbors.forward.length === 0 && neighbors.backward.length === 0) {
      logger.warn('no edge _from_', nodeUid);
    }
    if (!nodesWithEdgesTo.has(nodeUid)) {
      //logger.warn('no edge _to_', nodeUid);
      nodesWithoutEdgesTo.add(nodeUid);
    }
  }
  // maybe this is ok? e.g., one-way roads that dead-end somewhere?
  // TODO look into these.
  logger.warn('no edges to', nodesWithoutEdgesTo.size, 'nodes');

  // verify facilityNodes have at least one edge _to_ them and at least one edge
  // _from_ them.
  const unreachableFacilityNodes = new Set<bigint>();
  for (const nodeUid of facilityNodes.keys()) {
    const neighbors = assertExists(graph.get(nodeUid));
    // verify facility node can be routed _from_
    assert(neighbors.backward.length > 0 || neighbors.forward.length > 0);
    // verify facility node can be routed _to_
    if (!nodesWithEdgesTo.has(nodeUid)) {
      // why? is it because of one-way roads? if so, should they be coerced
      // into two-way roads?
      // what if we checked prefabs inside map areas associated with these
      // nodes, then forced them to be two-way?
      unreachableFacilityNodes.add(nodeUid);
      const node = assertExists(nodes.get(nodeUid));
      graphDebug.features.push(
        point([node.x, node.y], {
          tag: 'facility:unreachable',
          debugType: 'overview',
        }),
      );
    }
  }
  logger.warn('no edges to', unreachableFacilityNodes.size, 'facility nodes');

  const unknownEdges = new Set<bigint>();
  for (const nid of graph.keys()) {
    const node = assertExists(nodes.get(nid));
    const entry = assertExists(graph.get(nid));

    const neighbors = [...entry.backward, ...entry.forward];
    for (const e of neighbors) {
      const destEntry = graph.get(e.nodeUid);
      if (!destEntry) {
        const destNode = assertExists(nodes.get(e.nodeUid));
        graphDebug.features.push(
          lineString(
            [
              [node.x, node.y],
              [destNode.x, destNode.y],
            ],
            {
              debugType: 'overview',
              tag: 'edge:unknown-node',
              color: '#f00',
              unknownNodeUid: destNode.uid.toString(16),
            },
          ),
        );
        unknownEdges.add(e.nodeUid);
        continue;
      }
      const destNode = assertExists(nodes.get(e.nodeUid));
      const destNeighbors = [...destEntry.forward, ...destEntry.backward];
      const color = destNeighbors.some(n => n.nodeUid === nid)
        ? '#0c08' // two-way connectivity
        : '#ca08'; // one-way connectivity
      graphDebug.features.push(
        lineString(
          [
            [node.x, node.y],
            [destNode.x, destNode.y],
          ],
          {
            debugType: 'overview',
            color,
          },
        ),
      );
    }
  }
  graph.keys().forEach(nid => {
    const { x, y } = assertExists(nodes.get(nid));
    graphDebug.features.push(
      point([x, y], {
        tag: 'graphNode',
        id: nid.toString(16),
        debugType: 'detail',
      }),
    );
  });
  if (unknownEdges.size) {
    logger.warn(unknownEdges.size, 'unknown nodes with edges to them.');
    // const some = [...unknownEdges.values()].slice(0, 5);
    // console.log(
    //   some
    //     .map(b => nodes.get(b))
    //     .map(n => ({
    //       uid: n?.uid.toString(16),
    //       forwardItem: n?.forwardItemUid.toString(16),
    //       backwardItem: n?.backwardItemUid.toString(16),
    //     })),
    // );
  }

  const normalize = createNormalizeFeature(map, 4);
  graphDebug.features.map(f => normalize(f));

  return {
    graph,
    serviceAreas: facilityNodes,
    graphDebug,
  };
}

function updateGraphWithFerries(
  graph: Map<
    bigint,
    {
      forward: Neighbor[];
      backward: Neighbor[];
    }
  >,
  context: Context,
) {
  const { nodes, roads, prefabs, prefabDescriptions, ferries, getDlcGuard } =
    context;
  const roadQuadtree = quadtree<{
    x: number;
    y: number;
    nodeUid: bigint;
  }>()
    .x(e => e.x)
    .y(e => e.y);

  const maybeAddNode = (nid: bigint) => {
    const maybeNode = nodes.get(nid);
    if (maybeNode) {
      roadQuadtree.add({
        x: maybeNode.x,
        y: maybeNode.y,
        nodeUid: nid,
      });
    }
  };

  for (const road of roads.values()) {
    maybeAddNode(road.startNodeUid);
    maybeAddNode(road.endNodeUid);
  }
  for (const prefab of prefabs.values()) {
    // HACK ignore troublesome prefab near priwall ferry station:
    //   "token": "14004"
    //   "path": "prefab2/fork_temp/invis/invis_r1_fork_tmpl.ppd"
    // (navCurves data has empty nextLines and prevLines arrays)
    if (context.map === 'europe' && prefab.uid === 0x4cd14de4b6e67ccfn) {
      continue;
    }
    const desc = assertExists(prefabDescriptions.get(prefab.token));
    if (
      desc.mapPoints.every(p => p.type === 'road') &&
      desc.navCurves.length > 0
    ) {
      for (const nid of prefab.nodeUids) {
        maybeAddNode(nid);
      }
    }
  }

  for (const ferry of ferries.values()) {
    const ferryNodeUid = ferry.nodeUid;
    const ferryNode = assertExists(nodes.get(ferryNodeUid));
    const road = assertExists(roadQuadtree.find(ferry.x, ferry.y));

    // establish edges from closest road to ferry
    // TODO look into simplying graph by only having one direction to/from ferry
    const roadToFerryEdges: readonly Neighbor[] = [
      createNeighbor(road, ferryNode, 'forward', getDlcGuard),
      createNeighbor(road, ferryNode, 'backward', getDlcGuard),
    ];
    const roadNeighbors = assertExists(graph.get(road.nodeUid));
    roadNeighbors.forward.push(...roadToFerryEdges);
    roadNeighbors.backward.push(...roadToFerryEdges);

    assert(graph.get(ferryNodeUid) == null);
    graph.set(ferryNodeUid, { forward: [], backward: [] });
    const ferryNeighbors = assertExists(graph.get(ferryNodeUid));
    const roadNode = assertExists(nodes.get(road.nodeUid));
    // establish edges from origin ferry to closet road
    const ferryToRoadEdges: readonly Neighbor[] = [
      createNeighbor(ferryNode, roadNode, 'forward', getDlcGuard),
      createNeighbor(ferryNode, roadNode, 'backward', getDlcGuard),
    ];
    ferryNeighbors.forward.push(...ferryToRoadEdges);
    ferryNeighbors.backward.push(...ferryToRoadEdges);

    for (const connection of ferry.connections) {
      const otherFerryNodeUid = connection.nodeUid;
      const otherFerryNode = assertExists(nodes.get(otherFerryNodeUid));
      // establish edges from origin ferry to destination ferry
      const ferryToFerryEdges: readonly Neighbor[] = [
        {
          ...createNeighbor(ferryNode, otherFerryNode, 'forward', getDlcGuard),
          distance: connection.distance,
          isFerry: true,
        },
        {
          ...createNeighbor(ferryNode, otherFerryNode, 'backward', getDlcGuard),
          distance: connection.distance,
          isFerry: true,
        },
      ];
      ferryNeighbors.forward.push(...ferryToFerryEdges);
      ferryNeighbors.backward.push(...ferryToFerryEdges);
    }
  }
}

function getNeighborsInDirection(
  originNode: Node,
  direction: 'forward' | 'backward',
  context: Context,
): Neighbor[] {
  const getNeighborItemId = (n: Node) =>
    direction === 'forward' ? n.forwardItemUid : n.backwardItemUid;
  const getItem = (id: bigint) =>
    context.roads.get(id) ??
    context.prefabs.get(id) ??
    context.companies.get(id);
  const item = getItem(getNeighborItemId(originNode));
  if (!item) {
    // unknown neighbor item, e.g., a hidden or unknown road not present in context.
    return [];
  }

  const toNeighbor = (
    nextNode: Node,
    options: {
      distance?: number;
      direction?: 'forward' | 'backward';
      isOneLaneRoad?: true;
    } = {},
  ): Neighbor => {
    const dist =
      options.distance ??
      distance([nextNode.x, nextNode.y], [originNode.x, originNode.y]);
    const dir = options.direction ?? direction;
    return {
      nodeUid: nextNode.uid,
      distance: dist,
      direction: dir,
      isOneLaneRoad: options.isOneLaneRoad,
      dlcGuard: context.getDlcGuard(nextNode),
    };
  };

  switch (item.type) {
    case ItemType.Road: {
      const originNodeId =
        direction === 'forward' ? item.startNodeUid : item.endNodeUid;
      const destNodeId =
        direction === 'forward' ? item.endNodeUid : item.startNodeUid;

      assert(originNodeId === originNode.uid);
      const roadLook = assertExists(context.roadLooks.get(item.roadLookToken));
      const lanesInDirection =
        direction === 'forward'
          ? roadLook.lanesRight.length
          : roadLook.lanesLeft.length;
      if (lanesInDirection === 0) {
        // can't go in direction.
        return [];
      }

      const nextNode = assertExists(context.nodes.get(destNodeId));
      return [
        toNeighbor(nextNode, {
          distance: item.length,
          isOneLaneRoad: lanesInDirection === 1 ? true : undefined,
        }),
      ];
    }
    case ItemType.Prefab: {
      const neighbors: Neighbor[] = [];
      const companyItem = context.companiesByPrefabItemId.get(item.uid);
      if (companyItem) {
        // establish edge between `node` and the company node associated with
        // `node`'s neighbor prefab item.
        const nextNode = assertExists(context.nodes.get(companyItem.nodeUid));
        if (
          (direction === 'forward' && originNode.backwardItemUid === 0n) ||
          (direction === 'backward' && originNode.forwardItemUid === 0n)
        ) {
          return neighbors;
        }
        neighbors.push(toNeighbor(nextNode));
        context.graphDebug.features.push(
          createDebugLineString(
            originNode,
            nextNode,
            'gNID:Prefab:CompanyItem',
            'detail',
          ),
        );
        return neighbors;
      }

      const laneInfo = assertExists(context.prefabLanes.get(item.token));
      assert(laneInfo.size > 0);

      const connectionNodes = createConnectionsMap(
        laneInfo,
        item,
        context.nodes,
      );
      const connections = connectionNodes.get(originNode);
      if (connections == null) {
        // `connectionNodes` may be missing `node` if `node` is one of those
        // weird island unrouteable nodes that point to a prefab and nothing
        // else, like node `61d14e464b25d87` in Carson City.
        return neighbors;
      }
      if (connections.length === 0) {
        // no connections for `node` in `direction` could mean that the prefab:
        // - is one-way
        // - has no internal roads connecting its nodes, e.g., in company
        //   depots.
        return neighbors;
      }
      neighbors.push(
        // establish edges between `node` and the output nodes that the prefab
        // connects it to.
        ...connections.map(({ nextNode, distance }) => {
          context.graphDebug.features.push(
            createDebugLineString(
              originNode,
              nextNode,
              'gNID:Prefab:Connection',
              'detail',
            ),
          );
          return toNeighbor(nextNode, {
            distance,
            direction:
              getNeighborItemId(originNode) === getNeighborItemId(nextNode)
                ? direction === 'forward'
                  ? 'backward'
                  : 'forward'
                : direction,
          });
        }),
      );
      return neighbors;
    }
    case ItemType.Company: {
      assert(direction === 'forward');
      const prefab = context.prefabs.get(item.prefabUid);
      if (!prefab) {
        // prefab is unknown because it was removed as an "island prefab" during
        // graph pre-processing. assume that edges to the company item's node
        // will be added later.
        // logger.warn(
        //   'unknown prefab',
        //   item.prefabUid,
        //   'for company',
        //   item.uid,
        //   item.token,
        //   item.cityToken,
        // );
        return [];
      }
      const prefabNodes = prefab.nodeUids
        .map(id => assertExists(context.nodes.get(id)))
        .filter(
          node =>
            !(
              node.forwardItemUid === prefab.uid && node.backwardItemUid === 0n
            ),
        );
      context.graphDebug.features.push(
        ...prefabNodes.map(nextNode =>
          createDebugLineString(
            originNode,
            nextNode,
            'gNID:Company:PrefabNode',
            'detail',
          ),
        ),
      );
      return prefabNodes.flatMap(nextNode => [
        toNeighbor(nextNode),
        toNeighbor(nextNode, { direction: 'backward' }),
      ]);
    }
    default:
      throw new UnreachableError(item);
  }
}

function createConnectionsMap(
  laneInfo: Map<number, Lane[]>,
  item: Prefab,
  nodes: ReadonlyMap<bigint, Node>,
): Map<Node, { nextNode: Node; distance: number }[]> {
  // a map of origin Nodes to a list of target Nodes
  const connectionsMap = new Map<
    Node,
    { nextNode: Node; distance: number }[]
  >();
  const targetNodes = rotateRight(
    item.nodeUids.map(id => nodes.get(id)),
    item.originNodeIndex,
  );
  for (const [nodeIdx, lanes] of laneInfo) {
    connectionsMap.set(
      assertExists(targetNodes[nodeIdx]),
      lanes.flatMap(({ branches }) =>
        branches.map(({ curvePoints, targetNodeIndex }) => {
          const nextNode = assertExists(targetNodes[targetNodeIndex]);
          let totalCurveLength = 0;
          let prevPoint = curvePoints[0];
          for (let i = 1; i < curvePoints.length; i++) {
            const curPoint = curvePoints[i];
            totalCurveLength += distance(prevPoint, curPoint);
            prevPoint = curPoint;
          }
          return {
            nextNode,
            distance: totalCurveLength,
          };
        }),
      ),
    );
  }

  // a `connectionsMap` list may have multiple entries for the same
  // Node, because `laneInfo` also has that property. graph generation doesn't
  // care, though, so pick the entry with the shortest distance.
  for (const list of connectionsMap.values()) {
    list.sort((a, b) => a.distance - b.distance);
    const seenNextNodes = new Set<Node>();
    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      const { nextNode } = entry;
      if (seenNextNodes.has(nextNode)) {
        list.splice(i, 1); // 2nd parameter means remove one item only
      }
      seenNextNodes.add(nextNode);
    }
  }

  return connectionsMap;
}

function createDebugLineString(
  from: Node,
  to: Node,
  tag: string,
  debugType: 'overview' | 'detail',
) {
  return lineString(
    [
      [from.x, from.y],
      [to.x, to.y],
    ],
    {
      tag,
      debugType,
      from: from.uid.toString(16),
      to: to.uid.toString(16),
    },
  );
}

function createNeighbor(
  from: { x: number; y: number },
  toNode: Node,
  direction: Direction,
  getDlcGuard: (n: Node) => number,
): Neighbor {
  return {
    nodeUid: toNode.uid,
    distance: distance(from, toNode),
    direction,
    dlcGuard: getDlcGuard(toNode),
  };
}

function getObjectsInSectorRange<T>(
  pos: { x: number; y: number },
  objectsBySector: Map<string, T[]>,
): T[] {
  const toKey = (x: number, y: number) => `${x},${y}`;
  let { x: sx, y: sy } = pos;
  sx = Math.floor(sx / 4000);
  sy = Math.floor(sy / 4000);
  return [
    ...(objectsBySector.get(toKey(sx - 1, sy - 1)) ?? []),
    ...(objectsBySector.get(toKey(sx + 0, sy - 1)) ?? []),
    ...(objectsBySector.get(toKey(sx + 1, sy - 1)) ?? []),
    ...(objectsBySector.get(toKey(sx - 1, sy + 0)) ?? []),
    ...(objectsBySector.get(toKey(sx + 0, sy + 0)) ?? []),
    ...(objectsBySector.get(toKey(sx + 1, sy + 0)) ?? []),
    ...(objectsBySector.get(toKey(sx - 1, sy + 1)) ?? []),
    ...(objectsBySector.get(toKey(sx + 0, sy + 1)) ?? []),
    ...(objectsBySector.get(toKey(sx + 1, sy + 1)) ?? []),
  ];
}

/**
 * Returns a key and value, where:
 * - `value` is a Prefab or MapArea item containing a set of facilities, and
 * - `key` is the node uid used to navigate to the value
 *
 * @param prefab a Prefab with facilities
 * @param context context needed to perform this calculation
 */
function getPrefabFacilitiesEntry(
  prefab: Prefab,
  context: {
    prefabDescriptions: ReadonlyMap<string, PrefabDescription>;
    nodes: ReadonlyMap<bigint, Node>;
    knownGraphNodes: ReadonlySet<bigint>;
  },
): {
  key: bigint;
  value: {
    facilities: Set<FacilityIcon>;
    itemUid: bigint;
    itemType: ItemType.Prefab | ItemType.MapArea;
  };
} {
  const { prefabDescriptions, nodes } = context;
  const pfns = prefab.nodeUids
    .filter(id => context.knownGraphNodes.has(id))
    .map(id => assertExists(nodes.get(id)));
  assert(pfns.length > 0);
  const prefabDesc = assertExists(prefabDescriptions.get(prefab.token));
  const tx = ({ x, y }: { x: number; y: number }) =>
    toMapPosition([x, y], prefab, prefabDesc, nodes);
  const { facilityPoints, facilities } = getFacilitiesAndPoints(prefabDesc, tx);

  const closestPfnUid = pfns.sort((a, b) => {
    const minDistA = Math.min(...facilityPoints.map(fp => distance(fp, a)));
    const minDistB = Math.min(...facilityPoints.map(fp => distance(fp, b)));
    return minDistA - minDistB;
  })[0].uid;
  return {
    key: closestPfnUid,
    value: {
      facilities,
      itemUid: prefab.uid,
      itemType: ItemType.Prefab,
    },
  };
}

function getFacilities(prefabDesc: PrefabDescription): Set<FacilityIcon> {
  const facilities = new Set<FacilityIcon>();
  for (const sp of prefabDesc.spawnPoints) {
    if (FacilitySpawnPointTypes.has(sp.type)) {
      facilities.add(toFacilityIcon(sp.type));
    }
  }
  for (const tp of prefabDesc.triggerPoints) {
    if (tp.action === 'hud_parking') {
      facilities.add('parking_ico');
    }
  }
  return facilities;
}

function getFacilitiesAndPoints(
  prefabDesc: PrefabDescription,
  tx: ({ x, y }: { x: number; y: number }) => [number, number],
): { facilities: Set<FacilityIcon>; facilityPoints: Position[] } {
  const facilities = new Set<FacilityIcon>();
  const facilityPoints: Position[] = [];
  for (const sp of prefabDesc.spawnPoints) {
    if (FacilitySpawnPointTypes.has(sp.type)) {
      facilities.add(toFacilityIcon(sp.type));
      facilityPoints.push(tx(sp));
    }
  }
  for (const tp of prefabDesc.triggerPoints) {
    if (tp.action === 'hud_parking') {
      facilities.add('parking_ico');
      facilityPoints.push(tx(tp));
    }
  }
  return { facilities, facilityPoints };
}

function largestFirstComparator(a: Extent, b: Extent) {
  const [aMinX, aMinY, aMaxX, aMaxY] = a;
  const [bMinX, bMinY, bMaxX, bMaxY] = b;
  const widthA = aMaxX - aMinX;
  const heightA = aMaxY - aMinY;
  const widthB = bMaxX - bMinX;
  const heightB = bMaxY - bMinY;
  return widthB * heightB - widthA * heightA;
}
