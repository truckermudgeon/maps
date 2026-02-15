import { assert, assertExists } from '@truckermudgeon/base/assert';
import {
  getExtent,
  grow,
  type Position,
  toSplinePoints,
} from '@truckermudgeon/base/geom';
import { readMapData } from '@truckermudgeon/generator/mapped-data';
import { PointRBush } from '@truckermudgeon/map/point-rbush';
import {
  toMapPosition,
  toRoadStringsAndPolygons,
} from '@truckermudgeon/map/prefabs';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
} from '@truckermudgeon/map/projections';
import type {
  CompanyItem,
  GraphData,
  Neighbors,
  Node,
  Poi,
  Prefab,
  Road,
  ServiceArea,
  Sign,
} from '@truckermudgeon/map/types';
import * as turf from '@turf/helpers';
import lineOffset from '@turf/line-offset';
import fs from 'node:fs';
import path from 'node:path';
import type { BBox } from 'rbush';
import RBush from 'rbush';
import type {
  GraphAndMapData,
  GraphMappedData,
} from '../../domain/lookup-data';
import { graphMapDataKeys } from '../../domain/lookup-data';

export function readGraphAndMapData(
  dataDir: string,
  map: 'usa' | 'europe',
): GraphAndMapData<GraphMappedData> {
  const tsMapData = readMapData(path.join(dataDir, 'parser'), map, {
    includeHiddenRoadsAndPrefabs: false,
    mapDataKeys: graphMapDataKeys,
  });
  const toLngLat = map === 'usa' ? fromAtsCoordsToWgs84 : fromEts2CoordsToWgs84;
  const graphData = readGraphData(dataDir, map);

  const graphCompaniesByNodeUid = new Map<bigint, CompanyItem>(
    tsMapData.companies
      .values()
      .filter(company => graphData.graph.has(company.nodeUid))
      .map(company => [company.nodeUid, company]),
  );

  const roads = [...tsMapData.roads.values()];
  const prefabs = [...tsMapData.prefabs.values()];

  console.log('building road and prefab rtree...');
  const roadAndPrefabRTree = new RBush<
    BBox & {
      item: Road | Prefab;
      // lngLat
      lines: Position[][];
    }
  >();
  roadAndPrefabRTree.load([
    ...roads.map(road => {
      const splineStart = assertExists(tsMapData.nodes.get(road.startNodeUid));
      const splineEnd = assertExists(tsMapData.nodes.get(road.endNodeUid));
      const roadPoints = toSplinePoints(
        {
          position: [splineStart.x, splineStart.y],
          rotation: splineStart.rotation,
        },
        {
          position: [splineEnd.x, splineEnd.y],
          rotation: splineEnd.rotation,
        },
      );
      const roadLook = assertExists(
        tsMapData.roadLooks.get(road.roadLookToken),
      );
      const offset =
        road.maybeDivided && roadLook.laneOffset
          ? roadLook.laneOffset
          : (roadLook.offset ?? 0);

      const halfOffset =
        offset / 2 +
        // N.B.: there are road looks out there with asymmetric lane counts.
        // split the difference for now.
        // TODO do asymmetric offsets, but gotta verify offsets.
        ((roadLook.lanesLeft.length + roadLook.lanesRight.length) / 4) * 4.5 +
        2.25;
      // TODO add a test to make sure this works no matter the orientation of
      // the road.
      const aRoad = lineOffset(turf.lineString(roadPoints), -halfOffset, {
        units: 'degrees',
      }).geometry.coordinates as Position[];
      const bRoad = lineOffset(turf.lineString(roadPoints), +halfOffset, {
        units: 'degrees',
      }).geometry.coordinates as Position[];

      const [minX, minY, maxX, maxY] = grow(
        getExtent([...aRoad, ...bRoad]),
        10,
      );
      return {
        minX,
        minY,
        maxX,
        maxY,
        item: road,
        lines: [roadPoints.map(toLngLat)],
      };
    }),
    ...prefabs.flatMap(prefab => {
      const prefabDesc = assertExists(
        tsMapData.prefabDescriptions.get(prefab.token),
      );
      const points = [
        ...prefabDesc.navCurves.flatMap(n => [n.start, n.end]),
        ...prefabDesc.mapPoints,
        ...prefabDesc.nodes,
      ].map(({ x, y }) =>
        toMapPosition([x, y], prefab, prefabDesc, tsMapData.nodes),
      );
      if (!points.length) {
        return [];
      }
      const [minX, minY, maxX, maxY] = getExtent(points);

      const tx = (pos: Position) =>
        toLngLat(toMapPosition(pos, prefab, prefabDesc, tsMapData.nodes));
      const lineStrings: Position[][] = [];

      // TODO de-dupe this. add to prefabs.ts?
      for (const nn of prefabDesc.navNodes) {
        for (const conn of nn.connections) {
          for (const curveIdx of conn.curveIndices) {
            const curve = prefabDesc.navCurves[curveIdx];
            const points = toSplinePoints(
              {
                position: [curve.start.x, curve.start.y],
                rotation: curve.start.rotation,
              },
              {
                position: [curve.end.x, curve.end.y],
                rotation: curve.end.rotation,
              },
            );
            lineStrings.push(points.map(tx));
          }
        }
      }
      const otherCurves = prefabDesc.navCurves.filter((_, i) => {
        const nnCis = prefabDesc.navNodes.flatMap(nn =>
          nn.connections.flatMap(conn => conn.curveIndices),
        );
        return !nnCis.includes(i);
      });
      for (const curve of otherCurves) {
        const points = toSplinePoints(
          {
            position: [curve.start.x, curve.start.y],
            rotation: curve.start.rotation,
          },
          {
            position: [curve.end.x, curve.end.y],
            rotation: curve.end.rotation,
          },
        );
        lineStrings.push(points.map(tx));
      }
      // add in road-like lines
      if (!lineStrings.length) {
        const rsap = toRoadStringsAndPolygons(prefabDesc);
        const roadStrings = rsap.roadStrings.map(rs => rs.points.map(tx));
        lineStrings.push(...roadStrings);
      }

      return [
        {
          minX,
          minY,
          maxX,
          maxY,
          item: prefab,
          lines: lineStrings,
        },
      ];
    }),
  ]);

  console.log('building graph node rtree...');
  const graphNodeRTree = new PointRBush<{
    x: number;
    y: number;
    z: number;
    node: Node;
  }>();
  graphNodeRTree.load(
    [...graphData.graph.keys()].map(nid => {
      const node = assertExists(tsMapData.nodes.get(nid));
      return {
        x: node.x,
        y: node.y,
        z: node.z,
        node,
      };
    }),
  );

  console.log('building road rtree...');
  const roadRTree = new PointRBush<{
    x: number;
    y: number;
    nodeUid: bigint;
    road: Road;
    startPos: { x: number; y: number };
    endPos: { x: number; y: number };
  }>();
  roadRTree.load(
    roads.flatMap(road => {
      const [startNode, endNode] = [road.startNodeUid, road.endNodeUid].map(
        nid => assertExists(tsMapData.nodes.get(nid)),
      );
      return [
        {
          x: endNode.x,
          y: endNode.y,
          nodeUid: endNode.uid,
          road,
          startPos: { x: startNode.x, y: startNode.y },
          endPos: { x: endNode.x, y: endNode.y },
        },
        {
          x: startNode.x,
          y: startNode.y,
          nodeUid: endNode.uid,
          road,
          startPos: { x: startNode.x, y: startNode.y },
          endPos: { x: endNode.x, y: endNode.y },
        },
      ];
    }),
  );

  console.log('building sign rtree...');
  const signRTree = new PointRBush<{
    x: number;
    y: number;
    sign: Sign;
    type: 'exit' | 'name' | 'roadNumber';
  }>();
  const potentialExitTokens = new Set(
    tsMapData.signDescriptions
      .values()
      .filter(
        v =>
          v.modelDesc.startsWith('/model/sign/navigation') &&
          ((v.name.includes('exit') && !v.name.includes('exit mph')) ||
            v.name.includes('side board green')),
      )
      .map(v => v.token),
  );
  const potentialNameTokens = new Set(
    tsMapData.signDescriptions
      .values()
      .filter(
        v =>
          v.modelDesc.startsWith('/model/sign/navigation') &&
          !v.name.includes('ovh board') &&
          !v.name.includes('ovh brd') &&
          !v.name.includes('warn side') &&
          !v.name.includes('serv side') &&
          !v.name.includes('dynamic speed limit'),
      )
      .map(v => v.token),
  );
  const potentialRoadNumberTokens = new Set(['rot_bd_44']);

  let exitSignCount = 0;
  let nameSignCount = 0;
  let roadNumberSignCount = 0;
  const reportedLettersNumbers = new Set<string>();
  signRTree.load([
    ...tsMapData.signs.values().flatMap(sign => {
      if (
        !potentialExitTokens.has(sign.token) &&
        !potentialNameTokens.has(sign.token) &&
        !potentialRoadNumberTokens.has(sign.token)
      ) {
        return [];
      }

      sign = {
        ...sign,
        textItems: sign.textItems
          .map(t => t.replaceAll(/<br>/gi, ' '))
          .map(t => t.replaceAll(/<[^>]*>/g, ''))
          .map(t => t.replaceAll(/\s+/g, ' ').trim()),
      };

      const results: {
        x: number;
        y: number;
        sign: Sign;
        type: 'exit' | 'name' | 'roadNumber';
      }[] = [];
      if (potentialExitTokens.has(sign.token)) {
        const [valid] = [sign]
          .filter(s => !s.textItems.some(t => /\d+\s+(MILE|FT)/.exec(t)))
          .filter(s => {
            const desc = assertExists(tsMapData.signDescriptions.get(s.token));
            if (desc.name.includes('side board green')) {
              if (s.textItems.length <= 3) {
                const textItems = s.textItems.filter(t => !t.startsWith('/'));
                if (
                  textItems.length === 1 &&
                  /^(EXIT\s+)?\d+\s*[A-Z]?$/i.exec(textItems[0])
                ) {
                  return true;
                }
              }
              return false;
            }
            return true;
          })
          .map(s => {
            return {
              ...s,
              textItems: s.textItems.filter(
                t =>
                  // ignore text that looks like a path, e.g., /def or /font, or a
                  // traffic rule.
                  !/^(\/|traffic_rule)/.exec(t) &&
                  // we don't care about the part of an exit sign with speed limits
                  !t.includes('MPH') &&
                  // we don't care about the part of an exit sign with street names,
                  // e.g., 1st Ave S
                  !t.includes('Ave') &&
                  // an exit sign must have a number
                  /\d/.exec(t) &&
                  // we only care about singular exits, not, e.g., "EXITS 257 B-A"
                  !/[A-Z]-[A-Z]/.exec(t),
              ),
            };
          })
          .filter(s => s.textItems.length);
        if (valid) {
          results.push({
            x: sign.x,
            y: sign.y,
            sign: valid,
            type: 'exit',
          });
          exitSignCount++;
        }
      }
      if (potentialNameTokens.has(sign.token)) {
        const [valid] = [sign]
          .filter(s =>
            s.textItems.some(t =>
              /\b(Street|Road|Drive|Avenue|Way|Blvd|St|Rd|Dr|Ave|wy)\b/i.exec(
                t,
              ),
            ),
          )
          .map(s => {
            return {
              ...s,
              textItems: s.textItems.filter(t => {
                return (
                  // ignore text that looks like a path, e.g., /def or /font, or a
                  // traffic rule.
                  !/^(\/|traffic_rule)/.exec(t) &&
                  // ignore text that ends with road types, but definitely aren't
                  // road names.
                  !t.startsWith('CAUTION') &&
                  !t.endsWith('ACCESS ROAD') &&
                  t !== 'NOT A THROUGH STREET' &&
                  /\b(Street|Road|Drive|Avenue|Way|Blvd|St|Rd|Dr|Ave|Wy)\.?\s*$/i.exec(
                    t,
                  ) &&
                  t.trim().split(' ').length > 1
                );
              }),
            };
          })
          // multiple street names likely means a sign like:
          //   Foo St   20
          //   Bar Ave  30
          .filter(s => s.textItems.length === 1);

        if (valid) {
          results.push({
            x: sign.x,
            y: sign.y,
            sign: valid,
            type: 'name',
          });
          nameSignCount++;
        }
      }
      if (potentialRoadNumberTokens.has(sign.token)) {
        const [valid] = [sign].filter(
          s =>
            s.textItems.length === 2 &&
            s.textItems[0].startsWith('/def/sign/atlas/') &&
            /^(?:NORTH|SOUTH|EAST|WEST)$/i.test(s.textItems[1]),
        );
        if (valid) {
          const [road, direction] = sign.textItems;
          const [letters, numbers] = road
            .split('/')
            .at(-1)!
            .slice(0, -4)
            .split('_');

          if (!/^\d+/.test(numbers) && !reportedLettersNumbers.has(road)) {
            console.log('unexpected road number for', letters, numbers);
            reportedLettersNumbers.add(road);
          }

          results.push({
            x: sign.x,
            y: sign.y,
            sign: {
              ...valid,
              textItems: [
                `${letters.toUpperCase()}-${numbers.toUpperCase()} ${direction}`,
              ],
            },
            type: 'roadNumber',
          });
          roadNumberSignCount++;
        }
      }

      return results;
    }),
  ]);

  console.log(exitSignCount, 'exit signs');
  console.log(nameSignCount, 'name signs');
  console.log(roadNumberSignCount, 'road number signs');

  console.log('building poi rtree...');
  const poiRTree = new PointRBush<{
    x: number;
    y: number;
    lngLat: [number, number];
    poi: Poi & { type: 'road' };
  }>();
  const nonRoadNumbers = new Set(['agri_check', 'toll_ico']);
  poiRTree.load(
    tsMapData.pois
      .filter(
        (p): p is Poi & { type: 'road' } =>
          p.type === 'road' && !nonRoadNumbers.has(p.icon),
      )
      .map(p => ({
        x: p.x,
        y: p.y,
        lngLat: toLngLat([p.x, p.y]),
        poi: p,
      })),
  );

  return {
    tsMapData,
    graphData,
    graphCompaniesByNodeUid,
    graphNodeRTree,
    roadRTree,
    signRTree,
    roadAndPrefabRTree,
    poiRTree,
  };
}

function readGraphData<T extends 'usa' | 'europe'>(
  inputDir: string,
  map: T,
): GraphData {
  console.log('reading', map, 'graph data...');
  const json = fs.readFileSync(
    path.join(inputDir, `${map}-graph.json`),
    'utf-8',
  );
  const graphData = JSON.parse(json, graphReviver) as unknown as GraphData;
  console.log(graphData.graph.size, 'graph nodes');
  console.log(graphData.serviceAreas.size, 'service areas');
  return graphData;
}

function graphReviver(key: string, value: unknown) {
  if (key === 'graph' && Array.isArray(value) && Array.isArray(value[0])) {
    return new Map<bigint, Neighbors>(
      value.map(([nid, neighbors]) => [BigInt(`0x${nid}`), neighbors]),
    );
  }
  if (
    key === 'serviceAreas' &&
    Array.isArray(value) &&
    Array.isArray(value[0])
  ) {
    return new Map<bigint, ServiceArea>(
      value.map(([nid, serviceArea]) => [BigInt(`0x${nid}`), serviceArea]),
    );
  }
  if (key === 'facilities' && Array.isArray(value)) {
    return new Set(value);
  }

  if (key === 'uid' || key.endsWith('Uid')) {
    assert(typeof value === 'string' && /^[0-9a-f]+$/.test(value));
    return BigInt(`0x${value}`);
  }

  return value;
}
