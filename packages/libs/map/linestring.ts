import { rotateRight } from '@truckermudgeon/base/array';
import { assert, assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import { toSplinePoints } from '@truckermudgeon/base/geom';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import type { MappedDataForKeys } from '@truckermudgeon/io';
import { lineString } from '@turf/helpers';
import lineOffset from '@turf/line-offset';
import { ItemType } from './constants';
import { getCommonItem } from './get-common-item';
import { calculateLaneInfo, toMapPosition } from './prefabs';
import type {
  CompanyItem,
  Ferry,
  FerryItem,
  Node,
  Prefab,
  Road,
  RoadLook,
} from './types';

export function getLineString(
  nodeUids: bigint[],
  tsMapData: MappedDataForKeys<
    [
      'nodes',
      'roads',
      'prefabs',
      'companies',
      'ferries',
      'roadLooks',
      'prefabDescriptions',
      'ferries',
    ]
  >,
  lookups: {
    ferriesByUid: ReadonlyMap<bigint, Ferry & { type: ItemType.Ferry }>;
    companiesByPrefab: ReadonlyMap<bigint, CompanyItem>;
  },
): Position[] {
  Preconditions.checkArgument(
    nodeUids.length > 1,
    'nodeUids must have at least 2 items',
  );

  let points: Position[] = [];
  for (let i = 0; i < nodeUids.length - 1; i++) {
    const startNode = assertExists(tsMapData.nodes.get(nodeUids[i]));
    const endNode = assertExists(tsMapData.nodes.get(nodeUids[i + 1]));

    const item = getCommonItem(startNode.uid, endNode.uid, tsMapData, lookups);
    switch (item.type) {
      case ItemType.Road:
        points = points.concat(
          roadLineString(
            item,
            assertExists(tsMapData.roadLooks.get(item.roadLookToken)),
            startNode,
            endNode,
          ),
        );
        break;
      case ItemType.Prefab:
        points = points.concat(
          prefabLineString(item, startNode, endNode, tsMapData),
        );
        break;
      case ItemType.Ferry: {
        points = points.concat(ferryLineString(startNode, endNode, lookups));
        break;
      }
      case ItemType.Company:
        points.push([startNode.x, startNode.y], [endNode.x, endNode.y]);
        break;
      default:
        throw new UnreachableError(item);
    }
  }

  return points;
}

// TODO dry this up with `ferryToFeature` in `generator`'s `map.ts`.
function ferryLineString(
  startNode: Node,
  endNode: Node,
  lookups: { ferriesByUid: ReadonlyMap<bigint, Ferry & FerryItem> },
): Position[] {
  const points: Position[] = [];

  if (
    // traveling from origin ferry node to dest ferry node
    lookups.ferriesByUid.has(startNode.forwardItemUid) &&
    lookups.ferriesByUid.has(endNode.forwardItemUid)
  ) {
    const startFerry = assertExists(
      lookups.ferriesByUid.get(startNode.forwardItemUid),
    );
    const endFerry = assertExists(
      lookups.ferriesByUid.get(endNode.forwardItemUid),
    );
    const conn = assertExists(
      startFerry.connections.find(conn => conn.token === endFerry.token),
      `no ferry connection between from ${startFerry.token} to ${endFerry.token} `,
    );

    if (conn.intermediatePoints.length === 0) {
      points.push([startNode.x, startNode.y], [endNode.x, endNode.y]);
    } else {
      const controlPoints = [
        {
          x: startFerry.x,
          y: startFerry.y,
          rotation:
            // HACK give Travemunde port a tweak so that the line clears the land.
            startFerry.token === 'travemunde_p'
              ? -Math.PI / 4
              : Math.atan2(
                  conn.intermediatePoints[0].y - startFerry.y,
                  conn.intermediatePoints[0].x - startFerry.x,
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

      // HACK: the current UK coordinate massaging ends up with ferry routes from
      // Plymouth where everything past a certain point within a spline gets
      // hard-shifted to the west. This is because we create splines, _then_ project
      // every spline point to WGS84. To work around this, ignore the troublesome
      // point.
      const troublesomePoint = {
        x: -60546.875,
        y: -5859.375,
      };

      points.push(controlPoints[0].position);
      for (let i = 1; i < controlPoints.length; i++) {
        const prev = controlPoints[i - 1];
        const curr = controlPoints[i];
        if (
          prev.position[0] === troublesomePoint.x &&
          prev.position[1] === troublesomePoint.y
        ) {
          continue;
        }
        points.push(...toSplinePoints(prev, curr));
      }
    }
  } else if (
    lookups.ferriesByUid.has(startNode.forwardItemUid) ||
    lookups.ferriesByUid.has(endNode.forwardItemUid)
  ) {
    // straight line
    // traveling from dest ferry node to ferry prefab exit node
    points.push([startNode.x, startNode.y], [endNode.x, endNode.y]);
  } else {
    console.error({
      startNode,
      endNode,
    });
    throw new Error('ferryLineString: unexpected ferry stepitem for nodes');
  }

  return points;
}

function roadLineString(
  road: Road,
  roadLook: RoadLook,
  startNode: Node,
  endNode: Node,
): Position[] {
  const splineStart = road.startNodeUid === startNode.uid ? startNode : endNode;
  const splineEnd = road.endNodeUid === endNode.uid ? endNode : startNode;

  let roadPoints = toSplinePoints(
    {
      position: [splineStart.x, splineStart.y],
      rotation: splineStart.rotation,
    },
    {
      position: [splineEnd.x, splineEnd.y],
      rotation: splineEnd.rotation,
    },
  );
  if (splineStart.uid !== startNode.uid) {
    roadPoints = roadPoints.reverse();
  }

  const offset =
    road.maybeDivided && roadLook.laneOffset
      ? roadLook.laneOffset
      : roadLook.offset;
  if (!offset) {
    return roadPoints;
  }

  const halfOffset =
    offset / 2 +
    // N.B.: there are road looks out there with asymmetric lane counts.
    // split the difference for now.
    // TODO do asymmetric offsets, but gotta verify offsets.
    ((roadLook.lanesLeft.length + roadLook.lanesRight.length) / 4) * 4.5;
  // TODO add a test to make sure this works no matter the orientation of
  // the road.
  roadPoints = lineOffset(lineString(roadPoints), -halfOffset, {
    units: 'degrees',
  }).geometry.coordinates as Position[];

  return roadPoints;
}

function prefabLineString(
  prefab: Prefab,
  startNode: Node,
  endNode: Node,
  context: MappedDataForKeys<['nodes', 'prefabDescriptions']>,
): Position[] {
  if (prefab.ferryLinkUid != null) {
    // special-case ferry prefabs: draw a simple line between the points,
    // because ferry prefabs don't have nav curves.
    assert(
      prefab.nodeUids.includes(startNode.uid) &&
        prefab.nodeUids.includes(endNode.uid),
    );
    return [
      [startNode.x, startNode.y],
      [endNode.x, endNode.y],
    ];
  }

  const prefabDesc = assertExists(context.prefabDescriptions.get(prefab.token));
  const targetNodeUids = rotateRight(prefab.nodeUids, prefab.originNodeIndex);
  const startNodeIndex = targetNodeUids.findIndex(id => id === startNode.uid);
  const endNodeIndex = targetNodeUids.findIndex(id => id === endNode.uid);
  assert(
    startNodeIndex >= 0 && endNodeIndex >= 0,
    `startNode and endNode must be referenced by prefab`,
  );

  const laneInfo = calculateLaneInfo(prefabDesc);
  const inputLanes = assertExists(laneInfo.get(startNodeIndex));
  let branchFound = false;
  let geometry: Position[] | undefined = undefined;
  for (const inputLane of inputLanes) {
    for (const branch of inputLane.branches) {
      if (branch.targetNodeIndex === endNodeIndex) {
        geometry = branch.curvePoints.map(p =>
          toMapPosition(p, prefab, prefabDesc, context.nodes),
        );
        branchFound = true;
        break;
      }
    }
  }
  assert(
    branchFound && geometry != null,
    `no route geometry found for prefab ${prefab.uid.toString(16)}: node ${startNode.uid.toString(16)} => ${endNode.uid.toString(16)}`,
  );
  return geometry;
}
