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
} from '@truckermudgeon/base/geom';
import { UnreachableError } from '@truckermudgeon/base/precon';
import type { MappedDataForKeys } from '@truckermudgeon/io';
import { ItemType } from '@truckermudgeon/map/constants';
import { getCommonItem } from '@truckermudgeon/map/get-common-item';
import { getLineString } from '@truckermudgeon/map/linestring';
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
  RoundaboutData,
} from '@truckermudgeon/map/types';
import type {
  NonTerminalBranchType,
  RoundaboutBranchType,
} from '../../constants';
import { BranchType, isRoundaboutBranchType } from '../../constants';
import type {
  RouteStep as _RouteStepPolyline,
  NonTerminalStepManeuver,
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

type StepItem = Prefab | Road | CompanyItem | FerryItem;
type StepManeuver = NonTerminalStepManeuver;

type RouteStep = Omit<_RouteStepPolyline, 'geometry'> & {
  geometry: Position[];
};

export class RouteStepBuilder {
  private readonly steps: RouteStep[] = [];
  private roundaboutWip:
    | {
        step: RouteStep;
        lastStep: RouteStep | undefined;
        entryNodeUid: bigint;
        exitNodeUid: bigint;
        descIndex: number;
      }
    | undefined = undefined;
  private readonly ferriesByUid: ReadonlyMap<
    bigint,
    Ferry & { type: ItemType.Ferry }
  >;
  private readonly lookup: {
    ferriesByUid: ReadonlyMap<bigint, Ferry & { type: ItemType.Ferry }>;
    companiesByPrefab: ReadonlyMap<bigint, CompanyItem>;
  };

  private readonly toLonLat = (p: Position) =>
    this.tsMapData.map === 'usa'
      ? (fromAtsCoordsToWgs84(p).map(n => Number(n.toFixed(6))) as Position)
      : (fromEts2CoordsToWgs84(p).map(n => Number(n.toFixed(6))) as Position);

  constructor(
    private readonly tsMapData: RouteStepMappedData,
    private readonly signRTree: GraphAndMapData['signRTree'],
    private readonly roundaboutData: RoundaboutData,
  ) {
    this.ferriesByUid = new Map(
      this.tsMapData.ferries
        .values()
        .map(f => [f.uid, { ...f, type: ItemType.Ferry }]),
    );
    this.lookup = {
      ferriesByUid: this.ferriesByUid,
      companiesByPrefab: new Map<bigint, CompanyItem>(
        this.tsMapData.companies.values().map(c => [c.prefabUid, c]),
      ),
    };
  }

  add(
    startNode: Node,
    endNode: Node,
    cost: { distance: number; duration: number },
  ) {
    const item = getCommonItem(
      startNode.uid,
      endNode.uid,
      this.tsMapData,
      this.lookup,
    );

    // If we're inside a multi-prefab roundabout, check whether startNode is
    // still an internal cycle node. If yes, accumulate regardless of item type.
    // If no, we've exited — flush before normal processing.
    if (this.roundaboutWip != null) {
      const { cycleNodeUids } =
        this.roundaboutData.descs[this.roundaboutWip.descIndex];
      if (cycleNodeUids.includes(startNode.uid)) {
        this.accumulateIntoRoundaboutWip(
          this.toStep(item, startNode, endNode, cost),
          endNode,
        );
        return;
      }
      this.flushRoundaboutWip();
    }

    // Check whether startNode is an entrance to a multi-prefab roundabout.
    const descIdx = this.roundaboutData.descsIndex.get(startNode.uid);
    if (descIdx != null) {
      this.roundaboutWip = {
        step: this.toStep(item, startNode, endNode, cost),
        lastStep: undefined,
        entryNodeUid: startNode.uid,
        exitNodeUid: endNode.uid,
        descIndex: descIdx,
      };
      return;
    }

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
          (this.ferriesByUid.has(startNode.forwardItemUid) &&
            this.ferriesByUid.has(endNode.forwardItemUid)) ||
          // traveling from dest ferry node to ferry prefab exit node
          this.ferriesByUid.has(startNode.forwardItemUid)
        ) {
          const newStep = this.toStep(item, startNode, endNode, cost);
          const prevStep = this.steps.at(-1);
          if (prevStep) {
            this.averageStepJoinPoint(prevStep, newStep);
          }
          this.steps.push(newStep);
        } else if (this.ferriesByUid.has(endNode.forwardItemUid)) {
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
        // traveling through a road or company doesn't involve a significant
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
      this.tsMapData.prefabDescriptions.get(prefab.token),
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

    const maneuver = calculatePrefabManeuver(startNode, endNode, prefab, {
      tsMapData: this.tsMapData,
      signRTree: this.signRTree,
      roundabouts: this.roundaboutData,
    });
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
    this.appendToStep(this.steps.at(-1)!, step);
  }

  private appendToStep(target: RouteStep, source: RouteStep): void {
    const prevPoint = target.geometry.at(-1)!;
    const firstPoint = source.geometry[0];
    // HACK smooth out transitions, e.g. from roads to prefabs that don't line
    // up, because routing along a road uses road nodes, but routing along a
    // prefab uses nav curves that aren't aligned with nodes.
    const mp = midPoint(prevPoint, firstPoint);
    prevPoint[0] = mp[0];
    prevPoint[1] = mp[1];
    target.geometry.push(...source.geometry.slice(1));
    target.nodesTraveled += source.nodesTraveled;
    target.distanceMeters += source.distanceMeters;
    target.duration += source.duration;
    target.trafficIcons.push(...source.trafficIcons);
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

  private accumulateIntoRoundaboutWip(newStep: RouteStep, endNode: Node): void {
    const wip = assertExists(this.roundaboutWip);
    if (wip.lastStep != null) {
      this.appendToStep(wip.step, wip.lastStep);
    }
    wip.lastStep = newStep;
    wip.exitNodeUid = endNode.uid;
  }

  private flushRoundaboutWip(): void {
    if (!this.roundaboutWip) {
      return;
    }
    const { step, lastStep, descIndex, entryNodeUid, exitNodeUid } =
      this.roundaboutWip;
    this.roundaboutWip = undefined;

    const exit = this.roundaboutData.descs[descIndex].paths
      .get(entryNodeUid)
      ?.get(exitNodeUid);
    assert(
      exit != null ||
        this.roundaboutData.descs[descIndex].cycleNodeUids.includes(
          exitNodeUid,
        ),
      `roundabout flush at unexpected node ${exitNodeUid.toString(16)}`,
    );
    if (exit != null) {
      const direction = toRoundaboutBranchType(exit.angle);
      const roundaboutExitNumber = exit.exitIndex + 1;
      step.maneuver = {
        lonLat: step.maneuver.lonLat,
        banner: step.maneuver.banner,
        direction,
        roundaboutExitNumber,
      };
    }

    const prevStep = this.steps.at(-1);
    if (prevStep) {
      this.averageStepJoinPoint(prevStep, step);
    }
    this.steps.push(step);

    if (lastStep != null) {
      lastStep.maneuver = {
        lonLat: lastStep.maneuver.lonLat,
        banner: lastStep.maneuver.banner,
        direction: BranchType.ROUND_EXIT,
      };
      this.averageStepJoinPoint(step, lastStep);
      this.steps.push(lastStep);
    }
  }

  private toStep(
    item: StepItem,
    startNode: Node,
    endNode: Node,
    cost: { distance: number; duration: number },
  ): RouteStep {
    let maneuver: NonTerminalStepManeuver;
    let arrowPoints;
    const trafficIcons: {
      type: 'stop' | 'trafficLight';
      lonLat: [number, number];
    }[] = [];
    const geometry = getLineString(
      [startNode.uid, endNode.uid],
      this.tsMapData,
      this.lookup,
    );
    switch (item.type) {
      case ItemType.Prefab:
        maneuver = calculatePrefabManeuver(startNode, endNode, item, {
          tsMapData: this.tsMapData,
          roundabouts: this.roundaboutData,
          signRTree: this.signRTree,
        });
        // TODO make this part of calculateManeuver; make that a method.
        maneuver.lonLat = this.toLonLat(center(getExtent(geometry)));
        arrowPoints = geometry.length;
        trafficIcons.push(
          ...toTrafficIcons(
            item,
            startNode,
            endNode,
            assertExists(this.tsMapData.prefabDescriptions.get(item.token)),
            this.tsMapData.nodes,
          ).map(ti => ({
            ...ti,
            lonLat: this.toLonLat(ti.gameXZ),
          })),
        );
        break;
      case ItemType.Road:
        maneuver = {
          direction: BranchType.THROUGH,
          lonLat: this.toLonLat(geometry[0]),
        };
        break;
      case ItemType.Company:
        maneuver = {
          direction: BranchType.THROUGH,
          lonLat: this.toLonLat(geometry[0]),
        };
        break;
      case ItemType.Ferry: {
        if (
          // traveling from origin ferry node to dest ferry node
          this.ferriesByUid.has(startNode.forwardItemUid) &&
          this.ferriesByUid.has(endNode.forwardItemUid)
        ) {
          maneuver = {
            direction: BranchType.FERRY,
            lonLat: this.toLonLat(geometry[0]),
            banner: {
              text: this.ferriesByUid.get(endNode.forwardItemUid)!.name,
            },
          };
        } else if (
          this.ferriesByUid.has(startNode.forwardItemUid) ||
          this.ferriesByUid.has(endNode.forwardItemUid)
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
    this.flushRoundaboutWip();
    const steps = this.steps.slice();
    this.steps.length = 0;
    return this.refineLaneGuidance(steps).map(step => {
      // TODO simplify line strings?
      step.geometry = step.geometry.map(p => this.toLonLat(p));
      return step;
    });
  }
}

function calculatePrefabManeuver(
  startNode: Node,
  endNode: Node,
  prefab: Prefab,
  context: {
    tsMapData: MappedDataForKeys<['nodes', 'prefabDescriptions']>;
    signRTree: GraphAndMapData['signRTree'];
    roundabouts: RoundaboutData;
  },
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

  const {
    tsMapData: { nodes, prefabDescriptions },
    signRTree,
    roundabouts,
  } = context;

  const isRoundabout = roundabouts.prefabTokens.has(prefab.token);
  const prefabDesc = assertExists(
    prefabDescriptions.get(prefab.token),
    `unknown prefabDesc for token "${prefab.token}"`,
  );
  const laneInfo = calculateLaneInfo(prefabDesc);
  const inputLanes = assertExists(laneInfo.get(startNodeIndex));
  let direction: NonTerminalBranchType | undefined;
  let exitAngle: number | undefined;
  let roundaboutExitNumber: number | undefined;
  let isMerge = false;
  for (const inputLane of inputLanes) {
    for (const branch of inputLane.branches) {
      if (branch.targetNodeIndex === endNodeIndex) {
        direction = isRoundabout
          ? toRoundaboutBranchType(branch.angle)
          : toBranchType(branch.angle);
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

        roundaboutExitNumber =
          (startNodeIndex - endNodeIndex + laneInfo.size) % laneInfo.size;
        if (roundaboutExitNumber === 0) {
          roundaboutExitNumber = laneInfo.size;
        }

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

  const baseManeuver = {
    lonLat: [0, 0] as [number, number], // TODO calculate
    banner: maybeName,
    laneHint: undefined,
  };

  if (isMerge) {
    return {
      ...baseManeuver,
      direction: BranchType.MERGE,
    };
  } else if (!isRoundaboutBranchType(direction)) {
    assert(
      !isRoundabout,
      'cannot return a non-roundabout maneuver for a roundabout prefab',
    );
    return {
      ...baseManeuver,
      direction,
      laneHint:
        inputLanes.length > 1
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
    };
  } else {
    assert(
      isRoundabout,
      'cannot return a roundabout maneuver for a non-roundabout prefab',
    );
    roundaboutExitNumber = assertExists(
      roundaboutExitNumber,
      'roundaboutExit must be calculated',
    );
    return {
      ...baseManeuver,
      direction,
      roundaboutExitNumber,
    };
  }
}

function toBranchType(
  theta: number,
): Exclude<NonTerminalBranchType, RoundaboutBranchType> {
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

function toRoundaboutBranchType(theta: number): RoundaboutBranchType {
  const degrees = Math.round(theta * 57.29578);
  const isNeg = degrees < 0;
  const abs = Math.abs(degrees);
  if (abs <= 22.5) {
    return BranchType.ROUND_T;
  } else if (abs <= 67.5) {
    return isNeg ? BranchType.ROUND_TL : BranchType.ROUND_TR;
  } else if (abs <= 112.5) {
    return isNeg ? BranchType.ROUND_L : BranchType.ROUND_R;
  } else if (abs <= 157.5) {
    return isNeg ? BranchType.ROUND_BL : BranchType.ROUND_BR;
  } else if (abs <= 180) {
    return BranchType.ROUND_B;
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
