import { assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import {
  AtsSelectableDlcs,
  ItemType,
  toAtsDlcGuards,
} from '@truckermudgeon/map/constants';
import { fromAtsCoordsToWgs84 } from '@truckermudgeon/map/projections';
import { createRouteKey } from '@truckermudgeon/map/routing';
import type { Road } from '@truckermudgeon/map/types';
import path from 'node:path';
import url from 'node:url';
import { beforeAll, vi } from 'vitest';
import { BranchType } from '../../../constants';
import { readGraphAndMapData } from '../../../infra/lookups/graph-and-map';
import { ConsoleWorkerMetrics } from '../../../infra/metrics/worker';
import { createRoutingService } from '../../../infra/routing/service';
import type { DomainEventSink } from '../../events';
import type { GraphAndMapData, GraphMappedData } from '../../lookup-data';
import { calculateLocation, forTesting } from '../detect-route-events';
import type { RoutingService } from '../generate-routes';
import { generateRouteFromKeys } from '../generate-routes';
import {
  aRouteWith,
  aSegmentWithSteps,
  aStepWith,
  aTelemetryWith,
  aTruckWith,
} from './builders';

const { createUpdateListener, arrayIndexToRouteIndex } = forTesting;

const somePoints: Position[] = [
  [1, 1],
  [2, 2],
];

describe('arrayIndexToRouteIndex', () => {
  const segmentA = aSegmentWithSteps([
    // depart step
    aStepWith({
      geometry: somePoints,
      nodesTraveled: 0,
    }),
    aStepWith({
      geometry: somePoints,
      nodesTraveled: 3,
    }),
    aStepWith({
      geometry: somePoints,
      nodesTraveled: 2,
    }),
    aStepWith({
      geometry: somePoints,
      nodesTraveled: 1,
    }),
    // arrival step
    aStepWith({
      geometry: somePoints,
      nodesTraveled: 0,
    }),
  ]);
  const segmentB = aSegmentWithSteps([
    // depart step
    aStepWith({
      geometry: somePoints,
      nodesTraveled: 0,
    }),
    aStepWith({
      geometry: somePoints,
      nodesTraveled: 1,
    }),
    aStepWith({
      geometry: somePoints,
      nodesTraveled: 2,
    }),
    // arrival step
    aStepWith({
      geometry: somePoints,
      nodesTraveled: 0,
    }),
  ]);
  const segmentC = aSegmentWithSteps([
    // depart step
    aStepWith({
      geometry: somePoints,
      nodesTraveled: 0,
    }),
    aStepWith({
      geometry: somePoints,
      nodesTraveled: 1,
    }),
    aStepWith({
      geometry: somePoints,
      nodesTraveled: 1,
    }),
    // arrival step
    aStepWith({
      geometry: somePoints,
      nodesTraveled: 0,
    }),
  ]);

  const routeA = aRouteWith({ segments: [segmentA] });
  const routeB = aRouteWith({ segments: [segmentB] });
  const routeC = aRouteWith({ segments: [segmentC] });

  it.each([
    // arrayIndex, [segment, step, node]
    [0, [0, 1, 0]],
    [1, [0, 1, 1]],
    [2, [0, 1, 2]],
    //
    [3, [0, 2, 0]],
    [4, [0, 2, 1]],
    //
    [5, [0, 3, 0]],
    //
    [6, [0, 4, 0]],
  ])(
    'routeA: converts %s to %s',
    (arrayIndex, [segmentIndex, stepIndex, nodeIndex]) => {
      expect(arrayIndexToRouteIndex(arrayIndex, routeA, 0)).toEqual({
        segmentIndex,
        stepIndex,
        nodeIndex,
      });
    },
  );

  it.each([
    // arrayIndex, [segment, step, node]
    [0, [0, 1, 0]],
    //
    [1, [0, 2, 0]],
    [2, [0, 2, 1]],
    //
    [3, [0, 3, 0]], // arrival step
  ])(
    'routeB: converts %s to %s',
    (arrayIndex, [segmentIndex, stepIndex, nodeIndex]) => {
      expect(arrayIndexToRouteIndex(arrayIndex, routeB, 0)).toEqual({
        segmentIndex,
        stepIndex,
        nodeIndex,
      });
    },
  );

  it.each([
    // arrayIndex, [segment, step, node]
    [0, [0, 1, 0]],
    //
    [1, [0, 2, 0]],
    //
    [2, [0, 3, 0]], // arrival step
  ])(
    'routeC: converts %s to %s',
    (arrayIndex, [segmentIndex, stepIndex, nodeIndex]) => {
      expect(arrayIndexToRouteIndex(arrayIndex, routeC, 0)).toEqual({
        segmentIndex,
        stepIndex,
        nodeIndex,
      });
    },
  );

  it.each([
    // arrayIndex, [segment, step, node]
    [0, [0, 1, 0], 0],
    //
    [1, [0, 2, 0], 0],
    //
    [2, [0, 3, 0], 0], // arrival step
    ////
    [2, [1, 1, 0], 1],
    //
    [3, [1, 2, 0], 1],
    //
    [4, [1, 3, 0], 1], // arrival step
  ])(
    'repeated segments: converts %s to %s',
    (arrayIndex, [segmentIndex, stepIndex, nodeIndex], curSegmentIndex) => {
      const route = aRouteWith({ segments: [segmentC, segmentC] });
      expect(
        arrayIndexToRouteIndex(arrayIndex, route, curSegmentIndex),
      ).toEqual({
        segmentIndex,
        stepIndex,
        nodeIndex,
      });
    },
  );

  it('throws on invalid indices', () => {
    const route = aRouteWith({ segments: [segmentC, segmentC] });
    expect(() => arrayIndexToRouteIndex(-1, route, 0)).toThrow();
    expect(() => arrayIndexToRouteIndex(5, route, 0)).toThrow();
    expect(() => arrayIndexToRouteIndex(0, route, -1)).toThrow();
    expect(() => arrayIndexToRouteIndex(0, route, 2)).toThrow();
  });
});

// super expensive to run; disable for now until
// data can be constrained to minimal fixtures.
describe('detectRouteEvents bugs', () => {
  let graphAndMapData: GraphAndMapData<GraphMappedData>;
  let routingService: RoutingService;
  beforeAll(() => {
    const __filename = url.fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const outDir = path.join(__dirname, '../../../../../../out');
    graphAndMapData = readGraphAndMapData(outDir, 'usa');
    routingService = createRoutingService(
      {
        nodeLUT: graphAndMapData.tsMapData.nodes,
        graph: graphAndMapData.graphData.graph,
        enabledDlcGuards: toAtsDlcGuards(AtsSelectableDlcs),
      },
      new ConsoleWorkerMetrics(),
    );
    // routing service's thread pool ends up making copies of the routing context,
    // which takes a while.
  }, 15_000);

  function toTruck(data: { truckGamePos: number[]; truckHeading: number }) {
    return aTruckWith({
      position: {
        X: data.truckGamePos[0],
        Y: data.truckGamePos[1],
        Z: data.truckGamePos[2],
      },
      orientation: {
        heading: data.truckHeading,
      },
    });
  }

  it('detects the correct road', () => {
    // tricky: truck is at a point where it looks like it's going backward on
    // one road, when it's really going forward on another.
    const data = {
      truckGamePos: [
        -2381.527801513672, 12.032059669494629, 34020.006607055664,
      ],
      truckHeading: 0.38860344886779785,
    };
    console.log(
      fromAtsCoordsToWgs84([data.truckGamePos[0], data.truckGamePos[2]]),
    );
    const truck = toTruck(data);
    const location = calculateLocation(
      truck,
      graphAndMapData.tsMapData.nodes,
      graphAndMapData.tsMapData.roadLooks,
      graphAndMapData.roadAndPrefabRTree,
    );
    expect(location?.type).toBe(ItemType.Road);
    const road = location! as Road;
    expect(road.roadLookToken).toEqual('us_tmpl11');
    expect(road.uid).toEqual(0x3f2d41f0d30b0000n);
  });

  it('detects the correct road', () => {
    const data = {
      truckGamePos: [17686.6612701416, 3.616464138031006, 21047.653339385986],
      truckHeading: 0.02554202824831009,
    };
    const truck = toTruck(data);
    const location = calculateLocation(
      truck,
      graphAndMapData.tsMapData.nodes,
      graphAndMapData.tsMapData.roadLooks,
      graphAndMapData.roadAndPrefabRTree,
    );
    expect(location?.type).toBe(ItemType.Road);
    const road = location! as Road;
    expect(road.roadLookToken).toEqual('us_tmpl11');
    expect(road.uid).toEqual(0x4eaa3bf4a69f0001n);
  });

  it('detects the correct road', () => {
    const data = {
      truckGamePos: [12010.357940673828, 18.858428955078125, 9402.706405639648],
      truckHeading: 0.24985112249851227,
    };
    const truck = toTruck(data);
    const location = calculateLocation(
      truck,
      graphAndMapData.tsMapData.nodes,
      graphAndMapData.tsMapData.roadLooks,
      graphAndMapData.roadAndPrefabRTree,
    );
    expect(location?.type).toBe(ItemType.Road);
    const road = location! as Road;
    expect(road.roadLookToken).toEqual('us_tmpla33');
    expect(road.uid).toEqual(0x52d133ec030595c4n);
  });

  it('does not repeatedly trigger segment complete events upon waypoint arrival', async () => {
    const nodes = graphAndMapData.tsMapData.nodes;

    // short route to GARC in Dallas and back.
    const startNode = assertExists(nodes.get(0x47d43d84830b0000n));
    const middleNode = assertExists(nodes.get(0x47d43d5cd58b0000n));
    const endNode = assertExists(nodes.get(0x47d43d1c908b0001n));
    const testRoute = await generateRouteFromKeys(
      [
        createRouteKey(startNode.uid, endNode.uid, 'forward', 'fastest'),
        createRouteKey(endNode.uid, startNode.uid, 'forward', 'fastest'),
      ],
      { graphAndMapData, routing: routingService },
    );
    console.log(testRoute.lookup.nodeUids);

    expect(testRoute.segments.length).toBe(2);
    expect(testRoute.segments[0].steps.length).toBe(2);
    expect(
      testRoute.segments[0].steps[0].maneuver.direction === BranchType.THROUGH,
    );
    expect(
      testRoute.segments[0].steps[1].maneuver.direction === BranchType.ARRIVE,
    );
    expect(testRoute.segments[1].steps.length).toBe(2);
    expect(
      testRoute.segments[1].steps[0].maneuver.direction === BranchType.THROUGH,
    );
    expect(
      testRoute.segments[1].steps[1].maneuver.direction === BranchType.ARRIVE,
    );

    const setActiveRoute = () => {
      throw new Error('unexpected setActiveRoute called');
    };
    const setRouteIndex = vi
      .fn()
      .mockImplementation(ri => console.log('setRouteIndex spy:', ri));
    const segmentComplete = vi.fn().mockImplementation(si => {
      console.log('segmentComplete spy:', si);
      console.log('pausing route events.');
      paused.paused = true;
    });
    const paused = { paused: false };

    const domainEventSink: DomainEventSink = {
      publish: () => void 0,
    };

    // TODO add tests for cancel signal
    const { handler, signal } = createUpdateListener(
      testRoute,
      setActiveRoute,
      setRouteIndex,
      segmentComplete,
      paused,
      graphAndMapData,
      routingService,
      domainEventSink,
    );

    // initial telemetry event; truck starting at start node.
    console.log('handler: start');
    handler(
      aTelemetryWith({
        truck: aTruckWith({
          orientation: {
            // west
            heading: 0.25,
          },
          position: toTruckPos(startNode),
        }),
      }),
    );
    // initial route index is 0s. no progress made, so no events fired.
    expect(setRouteIndex).not.toHaveBeenCalled();
    expect(segmentComplete).not.toHaveBeenCalled();

    // truck moves to next node
    console.log('handler: next');
    handler(
      aTelemetryWith({
        truck: aTruckWith({
          orientation: {
            // north-east; aligned with next road
            heading: -0.1,
          },
          position: toTruckPos(middleNode),
        }),
      }),
    );
    expect(setRouteIndex).toHaveBeenCalledTimes(1);
    expect(setRouteIndex).toHaveBeenLastCalledWith({
      segmentIndex: 0,
      stepIndex: 0,
      nodeIndex: 1,
    });
    expect(segmentComplete).toHaveBeenCalledTimes(0);
    expect(segmentComplete).not.toHaveBeenCalled();

    // truck moves to end node
    console.log('handler: end');
    handler(
      aTelemetryWith({
        truck: aTruckWith({
          orientation: {
            // north
            heading: 0,
          },
          position: toTruckPos(endNode),
        }),
      }),
    );
    expect(setRouteIndex).toHaveBeenCalledTimes(2);
    expect(setRouteIndex).toHaveBeenLastCalledWith({
      segmentIndex: 0,
      stepIndex: 1,
      nodeIndex: 0,
    });
    expect(segmentComplete).toHaveBeenCalledTimes(1);
    expect(segmentComplete).toHaveBeenLastCalledWith(0);

    // truck stays at end node
    console.log('handler: stay');
    handler(
      aTelemetryWith({
        truck: aTruckWith({
          orientation: {
            // north
            heading: 0,
          },
          position: toTruckPos(endNode),
        }),
      }),
    );
    expect(paused.paused).toBe(true);
    // Nothing emitted, because this test pauses events upon segmentComplete.
    expect(setRouteIndex).toHaveBeenCalledTimes(2);
    expect(segmentComplete).toHaveBeenCalledTimes(1);

    // unpause (to advance to next segment)
    paused.paused = false;
    // truck stays at end node
    console.log('handler: stay again');
    handler(
      aTelemetryWith({
        truck: aTruckWith({
          orientation: {
            // north
            heading: 0,
          },
          position: toTruckPos(endNode),
        }),
      }),
    );
    expect(setRouteIndex).toHaveBeenCalledTimes(3);
    expect(setRouteIndex).toHaveBeenLastCalledWith({
      segmentIndex: 1,
      stepIndex: 0,
      nodeIndex: 1, // GARC company node is intermediary node.
    });
    expect(segmentComplete).toHaveBeenCalledTimes(1);
  });
});

const toTruckPos = (pos: { x: number; y: number; z: number }) => ({
  X: pos.x,
  Y: pos.z,
  Z: pos.y,
});
