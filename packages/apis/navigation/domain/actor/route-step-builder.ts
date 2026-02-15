import { rotateRight } from '@truckermudgeon/base/array';
import { assert, assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import {
  center,
  distance,
  getExtent,
  midPoint,
  normalizeRadians,
  toRadians,
  toSplinePoints,
} from '@truckermudgeon/base/geom';
import { UnreachableError } from '@truckermudgeon/base/precon';
import type { MappedDataForKeys } from '@truckermudgeon/generator/mapped-data';
import { ItemType } from '@truckermudgeon/map/constants';
import {
  calculateLaneInfo,
  toMapPosition,
  toRoadStringsAndPolygons,
} from '@truckermudgeon/map/prefabs';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
} from '@truckermudgeon/map/projections';
import type {
  CompanyItem,
  Ferry,
  FerryItem,
  Node,
  Prefab,
  PrefabDescription,
  Road,
  RoadLook,
} from '@truckermudgeon/map/types';
import * as turf from '@turf/helpers';
import lineOffset from '@turf/line-offset';
import { BranchType } from '../../constants';
import type {
  RouteStep as _RouteStepPolyline,
  StepManeuver as _StepManeuver,
} from '../../types';
import type { GraphAndMapData } from '../lookup-data';

type RouteStepMappedData = MappedDataForKeys<
  [
    'nodes',
    'roads',
    'prefabs',
    'companies',
    'ferries',
    'roadLooks',
    'prefabDescriptions',
  ]
>;

type NonTerminalBranchType = Exclude<
  BranchType,
  BranchType.DEPART | BranchType.ARRIVE
>;

type StepItem = Prefab | Road | CompanyItem | FerryItem;
type StepManeuver = Omit<_StepManeuver, 'direction'> & {
  direction: NonTerminalBranchType;
};
type RouteStep = Omit<_RouteStepPolyline, 'geometry' | 'maneuver'> & {
  geometry: Position[];
  maneuver: StepManeuver;
};

export class RouteStepBuilder {
  private readonly steps: RouteStep[] = [];
  private readonly ferries: ReadonlyMap<bigint, Ferry>;

  private readonly toLonLat = (p: Position) =>
    this.context.map === 'usa'
      ? (fromAtsCoordsToWgs84(p).map(n => Number(n.toFixed(6))) as Position)
      : (fromEts2CoordsToWgs84(p).map(n => Number(n.toFixed(6))) as Position);

  constructor(
    private readonly context: RouteStepMappedData,
    private readonly signRTree: GraphAndMapData['signRTree'],
  ) {
    this.ferries = new Map(this.context.ferries.values().map(f => [f.uid, f]));
  }

  add(
    item: StepItem,
    startNode: Node,
    endNode: Node,
    cost: { distance: number; duration: number },
  ) {
    switch (item.type) {
      case ItemType.Prefab: {
        if (this.shouldMergePrefab(item, startNode, endNode)) {
          // traveling through prefab doesn't involve a significant maneuver.
          // merge its geometry with the current wip step.
          this.mergeWithPreviousStep(item, startNode, endNode, cost);
        } else {
          const newStep = this.toStep(item, startNode, endNode, cost);
          const prevStep = this.steps.at(-1);
          if (prevStep) {
            this.averageStepJoinPoint(prevStep, newStep);
          }
          this.steps.push(newStep);
        }
        break;
      }
      case ItemType.Ferry: {
        if (
          // traveling from origin ferry node to dest ferry node
          (this.ferries.has(startNode.forwardItemUid) &&
            this.ferries.has(endNode.forwardItemUid)) ||
          // traveling from dest ferry node to ferry prefab exit node
          this.ferries.has(startNode.forwardItemUid)
        ) {
          const newStep = this.toStep(item, startNode, endNode, cost);
          const prevStep = this.steps.at(-1);
          if (prevStep) {
            this.averageStepJoinPoint(prevStep, newStep);
          }
          this.steps.push(newStep);
        } else if (this.ferries.has(endNode.forwardItemUid)) {
          // traveling from ferry prefab exit node to origin ferry node, or
          this.mergeWithPreviousStep(item, startNode, endNode, cost);
        } else {
          console.error({
            startNode,
            endNode,
          });
          throw new Error('unexpected ferry stepitem for nodes');
        }
        break;
      }
      case ItemType.Road:
      case ItemType.Company:
        // traveling through a road or prefab doesn't involve a significant
        // maneuver. merge its geometry with the current wip step.
        this.mergeWithPreviousStep(item, startNode, endNode, cost);
        break;
      default:
        throw new UnreachableError(item);
    }
  }

  private shouldMergePrefab(
    prefab: Prefab,
    startNode: Node,
    endNode: Node,
  ): boolean {
    const prefabDesc = assertExists(
      this.context.prefabDescriptions.get(prefab.token),
    );
    const rsap = toRoadStringsAndPolygons(prefabDesc);

    if (
      // ignore un-navigable prefabs
      prefabDesc.navCurves.length === 0 ||
      // ignore straight lines
      prefabDesc.nodes.length <= 2 ||
      rsap.isVJunction ||
      // ignore prefabs that aren't purely roads
      // TODO what about toll plazas?
      rsap.polygons.length > 0
    ) {
      return true;
    }

    const maneuver = calculateManeuver(
      startNode,
      endNode,
      prefab,
      prefabDesc,
      this.context.nodes,
      this.signRTree,
    );
    if (
      // all lanes of the prefab can be traveled straight through, and we're
      // supposed to go straight through, anyway.
      maneuver.direction === BranchType.THROUGH &&
      (maneuver.laneHint == null ||
        maneuver.laneHint.lanes.every(
          l =>
            l.branches.includes(BranchType.THROUGH) &&
            l.activeBranch === BranchType.THROUGH,
        ))
    ) {
      // no value in having a separate maneuver, so it should be merged.
      return true;
    }

    return false;
  }

  private mergeWithPreviousStep(
    item: StepItem,
    startNode: Node,
    endNode: Node,
    cost: { distance: number; duration: number },
  ) {
    const step = this.toStep(item, startNode, endNode, cost);
    if (this.steps.length === 0) {
      this.steps.push(step);
      return;
    }

    const prevStep = this.steps.at(-1)!;
    const prevPoint = prevStep.geometry.at(-1)!;
    const firstPoint = step.geometry[0];
    // HACK smooth out transitions, e.g. from roads to prefabs that don't line
    // up, because routing along a road uses road nodes, but routing along a
    // prefab uses nav curves that aren't aligned with nodes.
    const mp = midPoint(prevPoint, firstPoint);
    prevPoint[0] = mp[0];
    prevPoint[1] = mp[1];

    prevStep.geometry.push(...step.geometry.slice(1));
    prevStep.nodesTraveled += step.nodesTraveled;
    prevStep.distanceMeters += step.distanceMeters;
    prevStep.duration += step.duration;
    prevStep.trafficIcons.push(...step.trafficIcons);
  }

  private averageStepJoinPoint(a: RouteStep, b: RouteStep) {
    const prevPoint = a.geometry.at(-1)!;
    const firstPoint = b.geometry[0];
    // HACK smooth out transitions, e.g. from roads to prefabs that don't line
    // up, because routing along a road uses road nodes, but routing along a
    // prefab uses nav curves that aren't aligned with nodes.
    const mp = midPoint(prevPoint, firstPoint);
    prevPoint[0] = mp[0];
    prevPoint[1] = mp[1];
    firstPoint[0] = mp[0];
    firstPoint[1] = mp[1];
  }

  private toStep(
    item: StepItem,
    startNode: Node,
    endNode: Node,
    cost: { distance: number; duration: number },
  ): RouteStep {
    let geometry: Position[];
    let maneuver: StepManeuver;
    let arrowPoints;
    const trafficIcons: {
      type: 'stop' | 'trafficLight';
      lonLat: [number, number];
    }[] = [];
    switch (item.type) {
      case ItemType.Prefab:
        geometry = this.prefabToGameGeometry(item, startNode, endNode);
        maneuver = calculateManeuver(
          startNode,
          endNode,
          item,
          assertExists(this.context.prefabDescriptions.get(item.token)),
          this.context.nodes,
          this.signRTree,
        );
        // TODO make this part of calculateManeuver; make that a method.
        maneuver.lonLat = this.toLonLat(center(getExtent(geometry)));
        arrowPoints = geometry.length;
        trafficIcons.push(
          ...toTrafficIcons(
            item,
            startNode,
            endNode,
            assertExists(this.context.prefabDescriptions.get(item.token)),
            this.context.nodes,
          ).map(ti => ({
            ...ti,
            lonLat: this.toLonLat(ti.gameXZ),
          })),
        );
        break;
      case ItemType.Road:
        geometry = this.roadToGameGeometry(
          item,
          assertExists(this.context.roadLooks.get(item.roadLookToken)),
          startNode,
          endNode,
        );
        maneuver = {
          direction: BranchType.THROUGH,
          lonLat: this.toLonLat(geometry[0]),
        };
        break;
      case ItemType.Company:
        geometry = [
          [startNode.x, startNode.y],
          [endNode.x, endNode.y],
        ];
        maneuver = {
          direction: BranchType.THROUGH,
          lonLat: this.toLonLat(geometry[0]),
        };
        break;
      case ItemType.Ferry: {
        // TODO geometry is either straight line,
        //  or if from ferry-ferry: some curve.
        geometry = [
          [startNode.x, startNode.y],
          [endNode.x, endNode.y],
        ];
        if (
          // traveling from origin ferry node to dest ferry node
          this.ferries.has(startNode.forwardItemUid) &&
          this.ferries.has(endNode.forwardItemUid)
        ) {
          maneuver = {
            direction: BranchType.FERRY,
            lonLat: this.toLonLat(geometry[0]),
            banner: {
              text: this.ferries.get(endNode.forwardItemUid)!.name,
            },
          };
        } else if (
          this.ferries.has(startNode.forwardItemUid) ||
          this.ferries.has(endNode.forwardItemUid)
        ) {
          // traveling from dest ferry node to ferry prefab exit node
          maneuver = {
            direction: BranchType.THROUGH,
            lonLat: this.toLonLat(geometry[0]),
          };
        } else {
          console.error({
            startNode,
            endNode,
          });
          throw new Error('toStep: unexpected ferry stepitem for nodes');
        }
        break;
      }
      default:
        throw new UnreachableError(item);
    }

    return {
      distanceMeters: cost.distance,
      duration: cost.duration,
      geometry,
      maneuver,
      arrowPoints,
      nodesTraveled: 1,
      trafficIcons,
    };
  }

  private prefabToGameGeometry(
    prefab: Prefab,
    startNode: Node,
    endNode: Node,
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

    const prefabDesc = assertExists(
      this.context.prefabDescriptions.get(prefab.token),
    );
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
            toMapPosition(p, prefab, prefabDesc, this.context.nodes),
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

  private roadToGameGeometry(
    road: Road,
    roadLook: RoadLook,
    startNode: Node,
    endNode: Node,
  ): Position[] {
    const splineStart =
      road.startNodeUid === startNode.uid ? startNode : endNode;
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
    roadPoints = lineOffset(turf.lineString(roadPoints), -halfOffset, {
      units: 'degrees',
    }).geometry.coordinates as Position[];

    return roadPoints;
  }

  private refineLaneGuidance(steps: RouteStep[]): RouteStep[] {
    let prevStep = steps[0];
    for (const curStep of steps.slice(1)) {
      if (
        prevStep.distanceMeters <= 300 &&
        prevStep.maneuver.laneHint &&
        curStep.maneuver.laneHint
      ) {
        // check prev step for contiguous block of lanes with active branches.
        // (assumes active branches always appear in contiguous lanes)
        const activeBranches = prevStep.maneuver.laneHint.lanes.filter(
          l => l.activeBranch != null,
        );

        // if size of that block is equal to number of lanes in cur step, then
        // refine prev step
        if (activeBranches.length === curStep.maneuver.laneHint.lanes.length) {
          for (let j = 0; j < activeBranches.length; j++) {
            if (curStep.maneuver.laneHint.lanes[j].activeBranch == null) {
              activeBranches[j].activeBranch = undefined;
            }
          }
        }
      }
      // TODO should this be based on duration, instead?
      if (prevStep.distanceMeters <= 300) {
        // prevStep and curStep are close enough that a `thenHint` would be
        // useful.
        const curDirection = curStep.maneuver.direction;
        if (curDirection !== BranchType.THROUGH) {
          prevStep.maneuver.thenHint = {
            direction: curDirection,
          };
        }
      }
      prevStep = curStep;
    }
    return steps;
  }

  build(): RouteStep[] {
    const steps = this.steps.slice();
    this.steps.length = 0;
    return this.refineLaneGuidance(steps).map(step => {
      // TODO simplify line strings?
      step.geometry = step.geometry.map(p => this.toLonLat(p));
      return step;
    });
  }
}

function calculateManeuver(
  startNode: Node,
  endNode: Node,
  prefab: Prefab,
  prefabDesc: PrefabDescription,
  nodes: ReadonlyMap<bigint, Node>,
  signRTree: GraphAndMapData['signRTree'],
): StepManeuver {
  if (prefab.ferryLinkUid != null) {
    // special-case ferry prefabs: it's just a "through" maneuver, from the
    // prefab start/exit to the prefab exit/start.
    assert(
      prefab.nodeUids.includes(startNode.uid) &&
        prefab.nodeUids.includes(endNode.uid),
    );
    return {
      direction: BranchType.THROUGH,
      lonLat: [0, 0], // TODO calculate
    };
  }

  const targetNodeUids = rotateRight(prefab.nodeUids, prefab.originNodeIndex);
  const startNodeIndex = targetNodeUids.findIndex(id => id === startNode.uid);
  const endNodeIndex = targetNodeUids.findIndex(id => id === endNode.uid);
  assert(startNodeIndex >= 0 && endNodeIndex >= 0);

  const laneInfo = calculateLaneInfo(prefabDesc);
  const inputLanes = assertExists(laneInfo.get(startNodeIndex));
  let direction: NonTerminalBranchType | undefined;
  let exitAngle: number | undefined;
  let isMerge = false;
  for (const inputLane of inputLanes) {
    for (const branch of inputLane.branches) {
      if (branch.targetNodeIndex === endNodeIndex) {
        direction = toBranchType(branch.angle);
        const exitPointB = toMapPosition(
          assertExists(branch.curvePoints.at(-1)),
          prefab,
          prefabDesc,
          nodes,
        );
        const exitPointA = toMapPosition(
          assertExists(branch.curvePoints.at(-2)),
          prefab,
          prefabDesc,
          nodes,
        );
        exitAngle = normalizeRadians(
          Math.atan2(
            -exitPointB[1] - -exitPointA[1],
            exitPointB[0] - exitPointA[0],
          ),
        );

        // naive merge detection
        const numOtherInputNodesGoingToSameNode = laneInfo
          .entries()
          .toArray()
          .filter(([index, lanes]) => {
            return (
              // check other lane collections
              index !== startNodeIndex &&
              // for lanes that also end where we're going
              lanes
                .flatMap(l => l.branches)
                .some(b => b.targetNodeIndex === endNodeIndex)
            );
          }).length;
        isMerge =
          (direction === BranchType.SLIGHT_LEFT ||
            direction === BranchType.SLIGHT_RIGHT) &&
          prefab.nodeUids.length === 3 &&
          numOtherInputNodesGoingToSameNode === 1;
      }
    }
  }
  // probably because of hacked graph edges?
  if (direction == null) {
    console.error({
      startNode,
      endNode,
      prefab,
    });
    throw new Error('no direction/branchtype could be found');
    //return undefined;
  }
  // because `direction` and `exitAngle`'s null-ness are tied.
  assert(exitAngle != null);

  let maybeName:
    | {
        icon?: string;
        text?: string;
      }
    | undefined;

  // assume exit signs appear near the ends of prefabs.
  const potentialExitSign = signRTree.findClosest(endNode.x, endNode.y, {
    radius: 30,
    predicate: s => s.type === 'exit',
  });
  // assume Exit guidance never shows for straight-through navigation.
  if (potentialExitSign && direction !== BranchType.THROUGH) {
    maybeName = {
      text: 'Exit ' + potentialExitSign.sign.textItems[0],
    };
  }

  // TODO is there a cheaper way to calculate this?
  const prefabDescBB = getExtent(
    prefabDesc.navCurves.flatMap(n => [n.start, n.end]),
  );
  // expand BB by in each direction
  prefabDescBB[0] -= 10;
  prefabDescBB[1] -= 10;
  prefabDescBB[2] += 10;
  prefabDescBB[3] += 10;
  const topLeft = toMapPosition(
    [prefabDescBB[0], prefabDescBB[1]],
    prefab,
    prefabDesc,
    nodes,
  );
  const bottomRight = toMapPosition(
    [prefabDescBB[2], prefabDescBB[3]],
    prefab,
    prefabDesc,
    nodes,
  );
  const mapBB = getExtent([topLeft, bottomRight]);

  const potentialNameSigns = signRTree
    .search({
      minX: mapBB[0],
      minY: mapBB[1],
      maxX: mapBB[2],
      maxY: mapBB[3],
    })
    .filter(s => s.type === 'name');
  if (!maybeName && potentialNameSigns.length) {
    for (const { sign } of potentialNameSigns) {
      const signNode = assertExists(nodes.get(sign.nodeUid));
      const deltaSign = Math.abs(
        Math.abs(exitAngle) - Math.abs(signNode.rotation),
      );

      if (Math.abs(deltaSign - Math.PI / 2) <= toRadians(30)) {
        console.log({
          exitAngle,
          signNodeRot: signNode.rotation,
          signText: sign.textItems[0],
          signUid: sign.uid.toString(16),
        });

        maybeName = {
          text: assertExists(sign.textItems[0]),
        };

        break;
      }
    }
  }

  return {
    direction: isMerge ? BranchType.MERGE : direction,
    lonLat: [0, 0], // TODO calculate
    laneHint:
      !isMerge && inputLanes.length > 1
        ? {
            lanes: inputLanes.map(lane => {
              const branches = lane.branches.map(({ angle }) =>
                toBranchType(angle),
              );
              return {
                branches,
                activeBranch: branches.includes(direction)
                  ? direction
                  : undefined,
              };
            }),
          }
        : undefined,
    banner: maybeName,
  };
}

function toBranchType(theta: number): NonTerminalBranchType {
  const degrees = Math.round(theta * 57.29578);
  const isNeg = degrees < 0;
  const abs = Math.abs(degrees);
  if (abs <= 2) {
    return BranchType.THROUGH;
  } else if (abs <= 70) {
    return isNeg ? BranchType.SLIGHT_LEFT : BranchType.SLIGHT_RIGHT;
  } else if (abs <= 110) {
    return isNeg ? BranchType.LEFT : BranchType.RIGHT;
  } else if (abs <= 160) {
    return isNeg ? BranchType.SHARP_LEFT : BranchType.SHARP_RIGHT;
  } else if (abs <= 180) {
    return isNeg ? BranchType.U_TURN_LEFT : BranchType.U_TURN_RIGHT;
  } else {
    throw new Error('unexpected angle ' + abs);
  }
}

function toTrafficIcons(
  prefab: Prefab,
  startNode: Node,
  endNode: Node,
  prefabDesc: PrefabDescription,
  nodes: ReadonlyMap<bigint, Node>,
): { type: 'stop' | 'trafficLight'; gameXZ: [number, number] }[] {
  const trafficIcons: {
    type: 'stop' | 'trafficLight';
    gameXZ: [number, number];
  }[] = [];

  const targetNodeUids = rotateRight(prefab.nodeUids, prefab.originNodeIndex);
  const startNodeIndex = targetNodeUids.findIndex(id => id === startNode.uid);
  const endNodeIndex = targetNodeUids.findIndex(id => id === endNode.uid);
  assert(startNodeIndex >= 0 && endNodeIndex >= 0);

  // semaphoreId to curveIndex
  const semaphoreIndices = new Map<number, number>();
  // curveIndex to rule
  const trafficRules = new Map<number, string>();

  const laneInfo = calculateLaneInfo(prefabDesc);
  const inputLanes = assertExists(laneInfo.get(startNodeIndex));
  for (const branch of inputLanes
    .slice()
    .reverse()
    .flatMap(lane => lane.branches)) {
    if (branch.targetNodeIndex !== endNodeIndex) {
      continue;
    }

    if (prefab.showSemaphores) {
      for (const s of branch.semaphoresEncountered) {
        semaphoreIndices.set(s.semaphoreId, s.curveIndex);
      }
    }
    // chances are, if a semaphore for this branch has been encountered,
    // then the "stop" rules for this branch are related to the semaphore,
    // and not for a separate stop sign.
    // TODO this may not always be true. need to verify.
    if (!semaphoreIndices.size) {
      for (const t of branch.trafficRulesEncountered) {
        if (t.rule.startsWith('stop') || t.rule.startsWith('cross_line')) {
          trafficRules.set(t.curveIndex, t.rule);
        }
      }
    }

    // we only need to consider semaphores and stop signs along one
    // valid branch.
    break;
  }

  const tx = (p: [number, number]): [number, number] =>
    toMapPosition(p, prefab, prefabDesc, nodes);
  for (const [, curveIndex] of semaphoreIndices) {
    const semaphoreCenter = center(getExtent(prefabDesc.semaphores));
    trafficIcons.push({
      type: 'trafficLight',
      gameXZ: tx(semaphoreCenter),
    });

    // TODO are there prefabs with > 1 set of semaphores?
    break;
  }
  for (const [curveIndex] of trafficRules) {
    const curve = prefabDesc.navCurves[curveIndex];
    if (
      prefabDesc.signs.some((s, i) => {
        // TODO don't hardcode this token; look for all possible stop signs in sign descriptions.
        if (s.model !== '107') {
          return false;
        }
        const startDist = distance(s, curve.start);
        const endDist = distance(s, curve.end);
        console.log(
          prefab.uid.toString(16),
          'distance from curve to stop sign',
          i,
          { startDist, endDist },
        );
        // TODO do something more accurate, e.g., making sure candidate sign
        //  is perpendicular to curve.
        return Math.min(startDist, endDist) <= 13;
      })
    ) {
      trafficIcons.push({
        type: 'stop',
        gameXZ: tx([curve.end.x, curve.end.y]),
      });
    }
  }

  return trafficIcons;
}
