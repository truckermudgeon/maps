import { assert, assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import {
  distance,
  dot,
  magnitude,
  midPoint,
  normalizeRadians,
  rotate,
  subtract,
  toRadians,
  toSplinePoints,
  translate,
} from '@truckermudgeon/base/geom';
import { mapValues, putIfAbsent } from '@truckermudgeon/base/map';
import { Preconditions } from '@truckermudgeon/base/precon';
import * as turf from '@turf/helpers';
import lineIntersect from '@turf/line-intersect';
import lineOffset from '@turf/line-offset';
import simplify from '@turf/simplify';
import { MapAreaColor } from './constants';
import type {
  MapPoint,
  Node,
  PolygonMapPoint,
  Prefab,
  PrefabDescription,
  RoadMapPoint,
} from './types';

/**
 * Transforms `position` (in `PrefabDescription` space) into map space.
 *
 * TODO move this function to some shared maplib
 */
export function toMapPosition(
  position: Position,
  prefabItem: Prefab,
  prefabDescription: PrefabDescription,
  nodes: ReadonlyMap<string | bigint, Node>,
): Position {
  const prefabOrigin = prefabDescription.nodes[prefabItem.originNodeIndex];
  const originNode = assertExists(nodes.get(prefabItem.nodeUids[0]));
  const originPosition = toPosition(originNode);
  const prefabStart = translate(originPosition, [
    -prefabOrigin.x,
    -prefabOrigin.y,
  ]);
  const rotation = originNode.rotation - prefabOrigin.rotation;

  return rotate(translate(position, prefabStart), rotation, originPosition);
}

const colorZIndexes: Record<MapAreaColor, number> = {
  [MapAreaColor.Road]: 3,
  [MapAreaColor.Light]: 0,
  [MapAreaColor.Dark]: 2,
  [MapAreaColor.Green]: 1,
  [MapAreaColor.NavRed]: 99,
  [MapAreaColor.NavGreen]: 98,
  [MapAreaColor.NavBlue]: 97,
  [MapAreaColor.NavYellow]: 96,
  [MapAreaColor.NavPurple]: 95,
};

interface RoadSegment {
  points: [RoadMapPoint, RoadMapPoint];
  offset: number;
  lanesLeft: number;
  lanesRight: number;
  /** start neighbor count */
  snc: number;
  /** end neighbor count */
  enc: number;
}

interface BaseRoadString {
  offset: number;
  lanesLeft: number;
  lanesRight: number;
}

type InternalRoadString = BaseRoadString & {
  points: RoadMapPoint[];
  fuse?: true;
};

export type RoadString = BaseRoadString & {
  points: Position[];
};

export interface Polygon {
  points: Position[];
  zIndex: number;
  color: MapAreaColor;
}

export function toRoadStringsAndPolygons(prefab: PrefabDescription): {
  roadStrings: RoadString[];
  polygons: Polygon[];
  isVJunction: boolean;
  connections: Record<number, number[]>;
} {
  // partition points
  const roadPoints: RoadMapPoint[] = [];
  const polyPoints: PolygonMapPoint[] = [];
  for (const point of prefab.mapPoints) {
    if (point.type === 'road') {
      roadPoints.push(point);
    } else {
      polyPoints.push(point);
    }
  }

  // build road segments
  const visitedPoints = new Set<MapPoint>();
  const roadSegments: RoadSegment[] = [];
  for (const point of roadPoints) {
    visitedPoints.add(point);
    for (const i of point.neighbors) {
      const neighbor = prefab.mapPoints[i] as RoadMapPoint;
      if (visitedPoints.has(neighbor)) {
        continue;
      }
      roadSegments.push({
        points: [point, neighbor],
        offset:
          point.neighbors.length < neighbor.neighbors.length
            ? point.offset
            : Math.min(point.offset, neighbor.offset),
        lanesLeft:
          point.neighbors.length < neighbor.neighbors.length
            ? toNumber(point.lanesLeft)
            : Math.min(toNumber(point.lanesLeft), toNumber(neighbor.lanesLeft)),
        lanesRight:
          point.neighbors.length < neighbor.neighbors.length
            ? toNumber(point.lanesRight)
            : Math.min(
                toNumber(point.lanesRight),
                toNumber(neighbor.lanesRight),
              ),
        snc: point.neighbors.length,
        enc: neighbor.neighbors.length,
      });
    }
  }

  const visitedSegments = new Set<RoadSegment>();
  const buildRoad = (
    segment: RoadSegment,
    startPos: Position | RoadMapPoint,
  ) => {
    assert(!visitedSegments.has(segment));
    visitedSegments.add(segment);
    const [a, b] = segment.points;
    const road: InternalRoadString = {
      ...segment,
      points: [
        distance(a, startPos) < 2 ? a : b,
        distance(a, startPos) < 2 ? b : a,
      ],
    };

    let prevSegment = segment;
    let prevPoint = road.points.at(-1)!;
    const getNextSegment = () =>
      roadSegments
        .filter(
          s =>
            !visitedSegments.has(s) &&
            sharesPoint(s.points, prevPoint) &&
            canBeJoined(s, prevSegment),
        )
        .sort((a, b) => {
          const thetaA = angleBetween(prevSegment, a);
          const thetaB = angleBetween(prevSegment, b);
          return thetaA - thetaB;
        })[0];

    let nextSegment;
    while ((nextSegment = getNextSegment())) {
      visitedSegments.add(nextSegment);
      const [a, b] = nextSegment.points;
      road.points.push(distance(a, prevPoint) < 1 ? b : a);

      prevSegment = nextSegment;
      prevPoint = road.points.at(-1)!;
      if (prefab.nodes.some(n => distance(prevPoint, [n.x, n.y]) < 1)) {
        // stop wraparound / progressing when we reach another node point.
        break;
      }
    }
    return road;
  };

  let roadStrings: InternalRoadString[] = [];
  // build roads that start from prefab nodes
  for (const startPoint of prefab.nodes) {
    const startPos = toPosition(startPoint);
    // search for line segments starting/ending at startPoint
    const startSegments = roadSegments.filter(
      s => !visitedSegments.has(s) && sharesPoint(s.points, startPos, 2),
    );
    for (const segment of startSegments) {
      if (visitedSegments.has(segment)) {
        continue;
      }
      roadStrings.push(buildRoad(segment, startPos));
    }
  }

  // split road strings up, at boundaries where their attributes differ (e.g.,
  // at lane-count changes)
  roadStrings = roadStrings.flatMap(rs => {
    if (
      roadPoints.length === 2 &&
      rs.points.length === 2 &&
      rs.points.some(p => p.offset) &&
      rs.points.every(
        p => p.lanesLeft === p.lanesRight && p.lanesLeft !== 'auto',
      )
    ) {
      // this road string is a divided road that merges or changes lane count.
      // represent it as two separate roads that look like a V.
      // TODO re-eval if this should be done (see tucumari); offset-based rule means that prefabs
      // may not line up with non-offset roads. Maybe this should only be done _after_ offset
      // values are known for adjacent roads.
      // return toVRoadStrings(rs);
    }
    // Because of how road segments are built with one set of attributes, even
    // though their start and end points may have different attributes, multiple
    // road segments with different offsets may be joined as one
    // (e.g., hw3-2_x_hw1-1_thru). split those road segments up, because map
    // rendering tries to accurately represent offset roads.
    if (!canBeParallelified(rs)) {
      // rs isn't offset
      return [rs];
    }
    if (rs.points.length === 2) {
      // rs can't be split up into multiple segments
      return [rs];
    }
    if (
      rs.points.length === 3 &&
      rs.points[0].offset === rs.points.at(-1)!.offset &&
      rs.points[0].lanesLeft === rs.points.at(-1)!.lanesLeft &&
      rs.points[0].lanesRight === rs.points.at(-1)!.lanesRight
    ) {
      // rs is a thru-line, but passes through an intermediary point that
      // we don't care about, e.g. the center point of prefab/cross_temp/us_cross_2-1-2_city_i3_gas_tmpl
      // TODO verify that this isn't too relaxed, e.g., should we check that the
      // intermediary point only differs in offset, instead of being allowed to differ in any way?
      return [rs];
    }
    const diffIndex = rs.points.findIndex(
      p =>
        p.offset !== rs.points[0].offset ||
        p.lanesLeft !== rs.points[0].lanesLeft ||
        p.lanesRight !== rs.points[0].lanesRight,
    );
    if (diffIndex === -1) {
      // no need to split rs, because all points are the same.
      return [rs];
    }
    if (diffIndex === rs.points.length - 1) {
      // can't split up rs; difference is at end.
      // TODO verify that it's ok for this to happen, and/or loosen the criteria for what a "difference" is.
      return [rs];
    }
    const diffPoint = rs.points[diffIndex];
    const diffOffsetAttrs = {
      offset: diffPoint.offset,
      lanesLeft: toNumber(diffPoint.lanesLeft),
      lanesRight: toNumber(diffPoint.lanesRight),
    };
    const firstSection = {
      ...rs,
      offset: rs.points[0].offset,
      lanesLeft: toNumber(rs.points[0].lanesLeft),
      lanesRight: toNumber(rs.points[0].lanesRight),
      points: rs.points.slice(0, diffIndex + 1),
    };
    const secondSection = {
      ...rs,
      ...diffOffsetAttrs,
      points: rs.points.slice(diffIndex),
    };

    // TODO what about road strings that have more than 2 sets of uniformly-
    // attributed segments? should this list need to be built recursively?
    return [firstSection, secondSection];
  });

  // build "internal" roads that don't start from prefab nodes
  while (visitedSegments.size !== roadSegments.length) {
    // sort remaining segments, ones closest to an existing
    // road endpoint, first.
    const roadEndpoints = roadStrings.flatMap(r => [
      r.points[0],
      r.points.at(-1)!,
    ]);
    const segment = roadSegments
      .filter(s => !visitedSegments.has(s))
      // brute force :grimacing:
      .sort((a, b) => {
        const aMin = Math.min(
          ...roadEndpoints.map(p => distance(p, a.points[0])),
          ...roadEndpoints.map(p => distance(p, a.points[1])),
        );
        const bMin = Math.min(
          ...roadEndpoints.map(p => distance(p, b.points[0])),
          ...roadEndpoints.map(p => distance(p, b.points[1])),
        );
        return aMin - bMin;
      })[0];
    const startDistance = Math.min(
      ...roadEndpoints.map(p => distance(p, segment.points[0])),
    );
    const endDistance = Math.min(
      ...roadEndpoints.map(p => distance(p, segment.points[1])),
    );
    let startPos =
      startDistance < endDistance ? segment.points[0] : segment.points[1];
    // special case us_cross_2-2_country_20m_t_1-1_country_no_right_u_turn_tmpl,
    // where segment points don't line up with prefab nodes, for some reason.
    if (
      Math.min(...prefab.nodes.map(p => distance(p, segment.points[1]))) < 5
    ) {
      startPos = segment.points[1];
    }

    roadStrings.push(buildRoad(segment, startPos));
  }

  // treat 'V' junctions as special-case
  if (
    roadStrings.length === 2 &&
    roadPoints.length === 3 &&
    prefab.nodes.length === 3 &&
    roadPoints.filter(p => p.offset).length === 1
  ) {
    // find shared point
    const sharedPoint = sharesPoint(
      roadStrings[0].points as [RoadMapPoint, RoadMapPoint],
      roadStrings[1].points[0],
    )
      ? roadStrings[1].points[0]
      : roadStrings[1].points[1];
    const otherPoints = roadPoints.filter(p => p !== sharedPoint) as [
      RoadMapPoint,
      RoadMapPoint,
    ];
    const mid = midPoint(...otherPoints);
    const midLine = turf.lineString([mid, [sharedPoint.x, sharedPoint.y]]);
    const halfOffset = calculateHalfOffset(sharedPoint);
    const aMid = lineOffset(midLine, +halfOffset, {
      units: 'degrees',
    });
    const bMid = lineOffset(midLine, -halfOffset, {
      units: 'degrees',
    });
    const aLine = turf.lineString(
      [otherPoints[0], sharedPoint].map(toPosition),
    );
    const bLine = turf.lineString(
      [otherPoints[1], sharedPoint].map(toPosition),
    );
    const intersectA = [
      lineIntersect(aLine, aMid),
      lineIntersect(aLine, bMid),
    ].flatMap(fc => fc.features)[0]?.geometry.coordinates as Position;
    const intersectB = [
      lineIntersect(bLine, aMid),
      lineIntersect(bLine, bMid),
    ].flatMap(fc => fc.features)[0]?.geometry.coordinates as Position;
    const rsa = roadStrings.find(rs => rs.points.includes(otherPoints[0]))!;
    const rsb = roadStrings.find(rs => rs.points.includes(otherPoints[1]))!;
    rsa.points = rsa.points.map(p => {
      return p === sharedPoint && intersectA
        ? {
            ...p,
            x: intersectA[0],
            y: intersectA[1],
          }
        : p;
    });
    rsb.points = rsb.points.map(p => {
      return p === sharedPoint && intersectB
        ? {
            ...p,
            x: intersectB[0],
            y: intersectB[1],
          }
        : p;
    });
    rsa.fuse = true;
    rsb.fuse = true;
  } else {
    // reposition road segment points, if necessary, so that things look correct
    // after parallelification.
    for (const rs of roadStrings) {
      const startPoint = rs.points[0];
      const endPoint = rs.points.at(-1)!;
      const otherRs = roadStrings.filter(r => r !== rs);
      if (
        endPoint.neighbors.length === 3 ||
        startPoint.neighbors.length === 3
      ) {
        const otherPRs = otherRs.filter(r => canBeParallelified(r));
        // TODO do startPoint equivalent
        const plThruRs = otherPRs.find(
          r =>
            // the following conditions check that `rs` and `r` form a T-junction
            // TODO false positive with "big" prefab junction.
            // take angle of intersection into account?
            r.points[0] !== endPoint &&
            r.points.at(-1) !== endPoint &&
            r.points.includes(endPoint),
        );
        if (plThruRs) {
          // T-junction with offset lanes; shift rs' current endpoint to the
          // further lane. do this in a non-optimal way: project the intersection
          // point outward, then find the intersection between the offset lanes.
          const prevPoint = rs.points.at(-2)!;
          const intersectionXY = calculateProjectedIntersectionFor(
            prevPoint,
            endPoint,
            plThruRs,
          );
          if (intersectionXY) {
            rs.points[rs.points.length - 1] = {
              ...endPoint,
              ...intersectionXY,
            };
          }
          continue;
        }

        const intersectingPlA = otherPRs.find(r =>
          r.points.some(p => p === endPoint),
        );
        if (intersectingPlA) {
          // `rs` shares an endpoint with a parallel lines. shift `rs`' endpoint
          // to where it would intersect with those parallel lines.
          const prevPoint = rs.points.at(-2)!;
          const intersectionXY = calculateIntersectionFor(
            prevPoint,
            endPoint,
            intersectingPlA,
          );
          rs.points[rs.points.length - 1] = {
            ...endPoint,
            ...intersectionXY,
          };
        }
        const intersectingPlB = otherPRs.find(r =>
          r.points.some(p => p === startPoint),
        );
        if (intersectingPlB) {
          // `rs` shares an endpoint with a parallel lines. shift `rs`' endpoint
          // to where it would intersect with those parallel lines.
          const nextPoint = rs.points[1];
          const intersectionXY = calculateIntersectionFor(
            startPoint,
            nextPoint,
            intersectingPlB,
          );
          rs.points[0] = {
            ...startPoint,
            ...intersectionXY,
          };
          continue;
        }
      } else if (!rs.offset || !rs.lanesRight || !rs.lanesLeft) {
        const otherPRs = otherRs.filter(r => canBeParallelified(r));
        const intersectingPlA = otherPRs.find(r =>
          r.points.some(p => p === endPoint),
        );
        if (intersectingPlA) {
          // `rs` shares an endpoint with a parallel lines. shift `rs`' endpoint
          // to where it would intersect with those parallel lines.
          const prevPoint = rs.points.at(-2)!;
          const intersectionXY = calculateIntersectionFor(
            prevPoint,
            endPoint,
            intersectingPlA,
          );
          rs.points[rs.points.length - 1] = {
            ...endPoint,
            ...intersectionXY,
          };
        }
        const intersectingPlB = otherPRs.find(r =>
          r.points.some(p => p === startPoint),
        );
        if (intersectingPlB) {
          // `rs` shares an endpoint with a parallel lines. shift `rs`' endpoint
          // to where it would intersect with those parallel lines.
          const nextPoint = rs.points[1];
          const intersectionXY = calculateIntersectionFor(
            startPoint,
            nextPoint,
            intersectingPlB,
          );
          rs.points[0] = {
            ...startPoint,
            ...intersectionXY,
          };
          continue;
        }
      }
    }
  }

  const maybeParallelRoadStrings = roadStrings.flatMap(r =>
    canBeParallelified(r)
      ? toParallelRoadStrings(r)
      : [
          {
            ...r,
            coordinates: r.points.map(toPosition),
            parallel: false,
          },
        ],
  );

  // post-process parallelified strings, to connect roads that underwent a
  // lane change (e.g., in stockton highway prefab)
  for (const rsA of maybeParallelRoadStrings) {
    if (!rsA.parallel) {
      continue;
    }
    {
      const rsB = maybeParallelRoadStrings.find(
        rs =>
          rs !== rsA &&
          rs.parallel &&
          distance(rsA.points[0], rs.points.at(-1)!) < 3,
      );
      if (rsB) {
        rsA.parallel = false;
        rsB.parallel = false;
        const mid = midPoint(rsA.coordinates[0], rsB.coordinates.at(-1)!);
        rsA.coordinates[0][0] = rsB.coordinates.at(-1)![0] = mid[0];
        rsA.coordinates[0][1] = rsB.coordinates.at(-1)![1] = mid[1];
      }
    }
    {
      const rsB = maybeParallelRoadStrings.find(
        rs =>
          rs !== rsA &&
          rs.parallel &&
          distance(rsA.coordinates.at(-1)!, rs.coordinates.at(-1)!) < 3,
      );
      if (rsB) {
        rsA.parallel = false;
        rsB.parallel = false;
        const mid = midPoint(rsA.coordinates.at(-1)!, rsB.coordinates.at(-1)!);
        rsA.coordinates.at(-1)![0] = rsB.coordinates.at(-1)![0] = mid[0];
        rsA.coordinates.at(-1)![1] = rsB.coordinates.at(-1)![1] = mid[1];
      }
    }
  }

  // build polygons
  const polygons: Polygon[] = [];
  for (const point of polyPoints) {
    if (visitedPoints.has(point)) {
      continue;
    }
    const polygon = new Set<PolygonMapPoint>();
    let nextPoint = point;
    do {
      polygon.add(nextPoint);
      visitedPoints.add(nextPoint);
      const [a, b] = nextPoint.neighbors.map(
        i => prefab.mapPoints[i],
      ) as PolygonMapPoint[];
      if (!polygon.has(a)) {
        nextPoint = a;
      } else if (!polygon.has(b)) {
        nextPoint = b;
      }
    } while (!polygon.has(nextPoint));
    const [firstPoint] = polygon;
    polygons.push({
      points: [...polygon].map(toPosition),
      zIndex: (firstPoint.roadOver ? 10 : 0) + colorZIndexes[firstPoint.color],
      color: firstPoint.color,
    });
  }

  const connectionsMap = calculateNodeConnections(prefab);
  const connections: Record<number, number[]> = {};
  for (const [start, ends] of connectionsMap) {
    connections[start] = ends;
  }

  return {
    roadStrings: maybeParallelRoadStrings.map(r => ({
      ...r,
      points: r.coordinates,
    })),
    polygons: polygons.sort((a, b) => a.zIndex - b.zIndex),
    isVJunction:
      polygons.length === 0 &&
      maybeParallelRoadStrings.length === 2 &&
      maybeParallelRoadStrings.every(rs => rs.fuse),
    connections,
  };
}

export interface Lane {
  branches: {
    curvePoints: [number, number][]; // in prefab space
    targetNodeIndex: number;
  }[];
}

/**
 * Returns a map of 0-based starting node indices to a list of `Lane`s
 * originating at that node index, ordered by closest-to-"divider" first.
 */
export function calculateLaneInfo(
  prefabDesc: PrefabDescription,
): Map<number, Lane[]> {
  return new Map(
    prefabDesc.nodes.map((node, nodeIndex) => [
      nodeIndex,
      node.inputLanes.map(inputLaneIndex =>
        getLane(prefabDesc, inputLaneIndex),
      ),
    ]),
  );
}

function getLane(prefabDesc: PrefabDescription, inputLaneIndex: number): Lane {
  const startCurve = prefabDesc.navCurves[inputLaneIndex];
  Preconditions.checkArgument(
    startCurve.prevLines.length === 0,
    'inputLaneIndex must refer to a starting navCurve',
  );

  return {
    branches: getCurvePaths(prefabDesc, inputLaneIndex).map(p => {
      const cis = p.curvePathIndices;
      const curvePoints: [number, number][] = [];
      for (const ci of cis) {
        const curve = prefabDesc.navCurves[ci];
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
        curvePoints.push(...points);
      }
      const simplified = simplify(turf.lineString(curvePoints), {
        tolerance: 0.1,
        mutate: true,
      });

      return {
        curvePoints: simplified.geometry.coordinates as [number, number][],
        targetNodeIndex: p.endingNodeIndex,
      };
    }),
  };
}

/**
 * Returns a map of 0-based starting node indices to a list of 0-based ending node indices
 */
export function calculateNodeConnections(
  prefabDesc: PrefabDescription,
): Map<number, number[]> {
  const connections = new Map<number, number[]>();
  for (
    let startingNodeIndex = 0;
    startingNodeIndex < prefabDesc.nodes.length;
    startingNodeIndex++
  ) {
    const node = prefabDesc.nodes[startingNodeIndex];
    for (const inputLaneIndex of node.inputLanes) {
      const endingNodeIndices = getEndingNodeIndices(
        prefabDesc,
        inputLaneIndex,
      );
      putIfAbsent(startingNodeIndex, [], connections).push(
        ...endingNodeIndices,
      );
    }
  }
  return mapValues(connections, numbers => [...new Set(numbers)]);
}

interface CurvePath {
  endingNodeIndex: number;
  curvePathIndices: number[];
}

function getCurvePaths(
  prefabDesc: PrefabDescription,
  inputLaneIndex: number,
): CurvePath[] {
  // there's probably a better way to do this, using more of the information stored in a prefab desc
  // (e.g., navNode.connections info). but i don't get how that stuff works, so trace where
  // curves lead.

  // keys: curve index; values: node index
  const endingCurveIndexToNodeIndex = new Map<number, number>();
  for (let nodeIndex = 0; nodeIndex < prefabDesc.nodes.length; nodeIndex++) {
    const node = prefabDesc.nodes[nodeIndex];
    for (const outputLane of node.outputLanes) {
      endingCurveIndexToNodeIndex.set(outputLane, nodeIndex);
    }
  }

  const prefix = (curvePath: CurvePath, curveIndex: number): CurvePath => ({
    ...curvePath,
    curvePathIndices: [curveIndex, ...curvePath.curvePathIndices],
  });

  // recursively follow a tree of curves to the ending-curve leaves, collecting
  // the curves travelled along the way.
  const seenIndices = new Set<number>();
  const getPaths = (curveIndex: number): CurvePath[] => {
    if (seenIndices.has(curveIndex)) {
      // in a cycle (e.g., a roundabout); return an empty array, because this
      // curve does not lead to an ending-curve.
      return [];
    }
    seenIndices.add(curveIndex);

    if (endingCurveIndexToNodeIndex.has(curveIndex)) {
      return [
        {
          endingNodeIndex: endingCurveIndexToNodeIndex.get(curveIndex)!,
          curvePathIndices: [],
        },
      ];
    }

    const endingCurveIndices: CurvePath[] = [];
    for (const nextCurveIndex of prefabDesc.navCurves[curveIndex].nextLines) {
      endingCurveIndices.push(
        ...getPaths(nextCurveIndex).map(p => prefix(p, nextCurveIndex)),
      );
    }
    return endingCurveIndices;
  };

  return getPaths(inputLaneIndex).map(p => prefix(p, inputLaneIndex));
}

function getEndingNodeIndices(
  prefabDesc: PrefabDescription,
  inputLaneIndex: number,
): number[] {
  const curvePaths = getCurvePaths(prefabDesc, inputLaneIndex);
  const endingNodeIndices = new Set(curvePaths.map(c => c.endingNodeIndex));
  return [...endingNodeIndices];
}

function toNumber(numberOrAuto: number | 'auto') {
  return typeof numberOrAuto === 'string' ? -1 : numberOrAuto;
}

function sharesPoint(
  [start, end]: [RoadMapPoint, RoadMapPoint],
  pos: Position | RoadMapPoint,
  tolerance = 1,
): boolean {
  return distance(start, pos) < tolerance || distance(end, pos) < tolerance;
}

function angleBetween(a: RoadSegment, b: RoadSegment) {
  let an: Position, bn: Position;
  if (distance(a.points[0], b.points[0]) < 1) {
    an = subtract(a.points[1], a.points[0]);
    bn = subtract(b.points[1], b.points[0]);
  } else if (distance(a.points[0], b.points[1]) < 1) {
    an = subtract(a.points[1], a.points[0]);
    bn = subtract(b.points[0], b.points[1]);
  } else if (distance(a.points[1], b.points[0]) < 1) {
    an = subtract(a.points[0], a.points[1]);
    bn = subtract(b.points[1], b.points[0]);
  } else if (distance(a.points[1], b.points[1]) < 1) {
    an = subtract(a.points[0], a.points[1]);
    bn = subtract(b.points[0], b.points[1]);
  } else {
    throw new Error('segments do not share a point');
  }
  return normalizeRadians(
    Math.acos(dot(an, bn) / (magnitude(an) * magnitude(bn))),
  );
}

function canBeJoined(a: RoadSegment, b: RoadSegment): boolean {
  // Note: the isStart + distance checks are there to prevent shallow V prefabs
  // that represent a fork from being joined into a single line segment.
  if (
    a.offset !== b.offset ||
    a.lanesLeft !== b.lanesLeft ||
    a.lanesRight !== b.lanesRight ||
    (a.points[0].navFlags.isStart &&
      b.points[0].navFlags.isStart &&
      distance(a.points[0], b.points[0]) < 2) ||
    (a.points[0].navFlags.isStart &&
      b.points[1].navFlags.isStart &&
      distance(a.points[0], b.points[1]) < 2) ||
    (a.points[1].navFlags.isStart &&
      b.points[0].navFlags.isStart &&
      distance(a.points[1], b.points[0]) < 2) ||
    (a.points[1].navFlags.isStart &&
      b.points[1].navFlags.isStart &&
      distance(a.points[1], b.points[1]) < 2)
  ) {
    return false;
  }

  let noChoice;
  if (distance(a.points[0], b.points[0]) < 1) {
    noChoice = a.snc <= 2 && b.snc <= 2;
  } else if (distance(a.points[0], b.points[1]) < 1) {
    noChoice = a.snc <= 2 && b.enc <= 2;
  } else if (distance(a.points[1], b.points[0]) < 1) {
    noChoice = a.enc <= 2 && b.snc <= 2;
  } else {
    noChoice = a.enc <= 2 && b.enc <= 2;
  }
  if (noChoice) {
    // TODO this returns true when candidate segment
    // connects two nodepoints (in which case, there is
    // a choice to connect: the choice is "no").
    // see prefab/fork_temp/us_split_0-2_0-2_mirrored_tmpl.ppd
    // might need to use connectivity to node points as another signal.
    return true;
  }

  const theta = angleBetween(a, b);
  // segments can be joined if the angle between them if they're within 25deg of
  // forming a straight line.
  const tolerance = toRadians(25);
  return Math.abs(theta) > Math.PI - tolerance;
}

function canBeParallelified(roadString: BaseRoadString) {
  return (
    roadString.offset > 0 &&
    roadString.lanesLeft > 0 &&
    roadString.lanesLeft === roadString.lanesRight
  );
}

function toParallelRoadStrings(roadString: InternalRoadString): [
  InternalRoadString & {
    coordinates: Position[];
    parallel: true;
  },
  InternalRoadString & {
    coordinates: Position[];
    parallel: true;
  },
] {
  Preconditions.checkArgument(canBeParallelified(roadString));
  const lineString = turf.lineString(roadString.points.map(toPosition));
  const halfOffset = calculateHalfOffset(roadString);
  const aPoints = lineOffset(lineString, +halfOffset, {
    units: 'degrees',
  }).geometry.coordinates as Position[];
  const bPoints = lineOffset(lineString, -halfOffset, {
    units: 'degrees',
  }).geometry.coordinates as Position[];
  return [
    {
      ...roadString,
      offset: 0,
      lanesLeft: 0,
      coordinates: aPoints,
      parallel: true,
    },
    {
      ...roadString,
      offset: 0,
      lanesRight: 0,
      coordinates: bPoints,
      parallel: true,
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function toVRoadStrings(
  roadString: InternalRoadString,
): [InternalRoadString, InternalRoadString] {
  const l = turf.lineString(roadString.points.map(toPosition));
  const aOffset = calculateHalfOffset(roadString.points[0]);
  const bOffset = calculateHalfOffset(roadString.points[1]);
  const aPoints = [
    lineOffset(l, +aOffset, { units: 'degrees' }),
    lineOffset(l, -aOffset, { units: 'degrees' }),
  ].map(ls => ls.geometry.coordinates[0]);
  const bPoints = [
    lineOffset(l, +bOffset, { units: 'degrees' }),
    lineOffset(l, -bOffset, { units: 'degrees' }),
  ].map(ls => ls.geometry.coordinates[1]);
  return [
    {
      ...roadString,
      offset: 0,
      lanesLeft: 0,
      points: [
        {
          ...roadString.points[0],
          lanesLeft: 0,
          x: aPoints[0][0],
          y: aPoints[0][1],
        },
        {
          ...roadString.points[0],
          lanesLeft: 0,
          x: bPoints[0][0],
          y: bPoints[0][1],
        },
      ],
    },
    {
      ...roadString,
      offset: 0,
      lanesRight: 0,
      points: [
        {
          ...roadString.points[1],
          lanesRight: 0,
          x: aPoints[1][0],
          y: aPoints[1][1],
        },
        {
          ...roadString.points[1],
          lanesRight: 0,
          x: bPoints[1][0],
          y: bPoints[1][1],
        },
      ],
    },
  ];
}

function calculateProjectedIntersectionFor(
  start: {
    x: number;
    y: number;
  },
  end: {
    x: number;
    y: number;
  },
  rsToOffset: InternalRoadString,
):
  | {
      x: number;
      y: number;
    }
  | undefined {
  const x0 = start.x;
  const y0 = start.y;
  const x1 = end.x;
  const y1 = end.y;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const px = x0 + dx * 2;
  const py = y0 + dy * 2;
  const projectedLine = turf.lineString([
    [x1, y1],
    [px, py],
  ]);
  const intersectionPoint = toParallelRoadStrings(rsToOffset)
    .map(rs =>
      lineIntersect(
        projectedLine,
        turf.lineString(rs.coordinates),
      ).features.map(p => p.geometry.coordinates),
    )
    .find(p => p.length);

  if (intersectionPoint == null) {
    // this was put here because of prefabs like prefab/cross/hw2-2_x_city2-1_t_small.ppd
    // looks similar to prefab/cross/hw2-2_x_hw2-2_t_small.ppd, which parses fine.
    // TODO see if the two can be treated the same, and then restore the assertion that an intersection exists above.
    return undefined;
  }

  return {
    x: intersectionPoint[0][0],
    y: intersectionPoint[0][1],
  };
}

function calculateIntersectionFor(
  start: {
    x: number;
    y: number;
  },
  end: {
    x: number;
    y: number;
  },
  rsToOffset: InternalRoadString,
):
  | {
      x: number;
      y: number;
    }
  | undefined {
  const intersectionPoint = toParallelRoadStrings(rsToOffset)
    .map(rs =>
      lineIntersect(
        turf.lineString([
          [start.x, start.y],
          [end.x, end.y],
        ]),
        turf.lineString(rs.coordinates),
      ).features.map(p => p.geometry.coordinates),
    )
    .find(p => p.length);
  if (!intersectionPoint?.length) {
    return;
  }

  return {
    x: intersectionPoint[0][0],
    y: intersectionPoint[0][1],
  };
}

function toPosition(p: { x: number; y: number }) {
  return [p.x, p.y] as [number, number];
}

function calculateHalfOffset(p: {
  offset: number;
  lanesLeft: number | 'auto';
}): number {
  return p.offset / 2 + (toNumber(p.lanesLeft) / 2) * 4.5;
}
