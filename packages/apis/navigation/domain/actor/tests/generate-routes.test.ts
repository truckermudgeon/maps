import type { MappedDataForKeys } from '@truckermudgeon/generator/mapped-data';
import { readMapData } from '@truckermudgeon/generator/mapped-data';
import {
  AtsSelectableDlcs,
  toAtsDlcGuards,
} from '@truckermudgeon/map/constants';
import { fromAtsCoordsToWgs84 } from '@truckermudgeon/map/projections';
import { createRouteKey } from '@truckermudgeon/map/routing';
import type { Node, Prefab } from '@truckermudgeon/map/types';
import { toStepText } from '@truckermudgeon/navigator-app/src/components/text';
import { EventEmitter } from 'events';
import * as path from 'node:path';
import * as url from 'node:url';
import { beforeAll } from 'vitest';
import { readGraphAndMapData } from '../../../infra/lookups/graph-and-map';
import { ConsoleWorkerMetrics } from '../../../infra/metrics/worker';
import { createRoutingService } from '../../../infra/routing/service';
import type { DomainEventSink } from '../../events';
import type { GraphAndMapData, GraphMappedData } from '../../lookup-data';
import {
  SessionActorImpl,
  type TelemetryEventEmitter,
} from '../../session-actor';
import { toPosAndBearing } from '../game-state';
import {
  forTesting,
  generateRouteFromKeys,
  generateRoutes,
  getDirectionOnPrefab,
  getRelativePositionOfPoint,
  type RoutingService,
} from '../generate-routes';
import {
  aNodeWith,
  aRoadWith,
  aRouteWithLookup,
  aSegmentWithSteps,
  aStepWith,
  aTruckWith,
  lookupForNodeUids,
} from './builders';
import { nodes, prefabDesc_2o0cb } from './fixtures';

const { combineRoutes, getDirectionOnRoad } = forTesting;
const dummyEventSink: DomainEventSink = {
  publish: () => void 0,
};

describe('combineRoutes', () => {
  it('combines single-segment routes', () => {
    const routeA = aRouteWithLookup({
      lookup: lookupForNodeUids([[1n, 2n]]),
      segments: [
        aSegmentWithSteps([
          aStepWith({
            geometry: [
              [1, 1],
              [2, 2],
            ],
            distanceMeters: 1,
            duration: 2,
          }),
        ]),
      ],
    });
    const routeB = aRouteWithLookup({
      lookup: lookupForNodeUids([[2n, 3n]]),
      segments: [
        aSegmentWithSteps([
          aStepWith({
            geometry: [
              [2, 2],
              [3, 3],
            ],
            distanceMeters: 3,
            duration: 4,
          }),
        ]),
      ],
    });
    expect(combineRoutes([routeA, routeB])).toMatchObject({
      lookup: lookupForNodeUids([
        [1n, 2n],
        [2n, 3n],
      ]),
      segments: [routeA.segments[0], routeB.segments[0]],
      distanceMeters: 4,
      duration: 6,
    });
  });

  it('combines multi-segment routes', () => {
    const multiSegmentRouteA = aRouteWithLookup({
      lookup: lookupForNodeUids([
        [1n, 2n],
        [2n, 3n],
      ]),
      segments: [
        aSegmentWithSteps([
          aStepWith({
            geometry: [
              [1, 1],
              [2, 2],
            ],
          }),
        ]),
        aSegmentWithSteps([
          aStepWith({
            geometry: [
              [1, 1],
              [2, 2],
            ],
            distanceMeters: 2,
            duration: 2,
          }),
        ]),
      ],
    });
    const multiSegmentRouteB = aRouteWithLookup({
      lookup: lookupForNodeUids([
        [3n, 4n],
        [4n, 5n],
      ]),
      segments: [
        aSegmentWithSteps([
          aStepWith({
            geometry: [
              [3, 3],
              [4, 4],
            ],
          }),
        ]),
        aSegmentWithSteps([
          aStepWith({
            geometry: [
              [4, 4],
              [5, 5],
            ],
            distanceMeters: 3,
            duration: 3,
          }),
        ]),
      ],
    });
    expect(
      combineRoutes([multiSegmentRouteA, multiSegmentRouteB]),
    ).toMatchObject({
      lookup: lookupForNodeUids([
        [1n, 2n],
        [2n, 3n],
        [3n, 4n],
        [4n, 5n],
      ]),
      segments: [
        multiSegmentRouteA.segments[0],
        multiSegmentRouteA.segments[1],
        multiSegmentRouteB.segments[0],
        multiSegmentRouteB.segments[1],
      ],
      distanceMeters: 7,
      duration: 7,
    });
  });

  it('throws if routes cannot be combined', () => {
    const routeA = aRouteWithLookup({
      lookup: lookupForNodeUids([[1n, 2n]]),
      segments: [
        aSegmentWithSteps([
          aStepWith({
            geometry: [
              [1, 1],
              [2, 2],
            ],
          }),
        ]),
      ],
    });
    const routeB = aRouteWithLookup({
      lookup: lookupForNodeUids([[5n, 6n]]),
      segments: [
        aSegmentWithSteps([
          aStepWith({
            geometry: [
              [5, 5],
              [6, 6],
            ],
          }),
        ]),
      ],
    });
    expect(() => combineRoutes([routeA, routeB])).toThrow(/inconsistent/);
  });
});

describe('getDirectionOnRoad', () => {
  const nodes = new Map<bigint, Node>([
    [0n, aNodeWith({ uid: 0n, y: +100, rotation: Math.PI / 2 })],
    [1n, aNodeWith({ uid: 1n, y: -100, rotation: Math.PI / 2 })],
  ]);
  const southToNorthRoad = aRoadWith({ startNodeUid: 0n, endNodeUid: 1n });

  it('detects direction', () => {
    const truckFacingNorth = aTruckWith({
      position: { X: 0, Y: 0, Z: 0 },
      orientation: { heading: 0 },
    });
    const truckFacingSouth = aTruckWith({
      position: { X: 0, Y: 0, Z: 0 },
      orientation: { heading: 0.5 },
    });

    // before the road
    expect(getDirectionOnRoad(truckFacingNorth, southToNorthRoad, nodes)).toBe(
      'forward',
    );
    expect(getDirectionOnRoad(truckFacingSouth, southToNorthRoad, nodes)).toBe(
      'backward',
    );
  });
});

describe('getDirectionOnPrefab', () => {
  // i think this is all fixed now, after adding roadstrings to prefabs for
  // consideration.
  describe('bugs', () => {
    let tsMapData: MappedDataForKeys<
      ['prefabs', 'prefabDescriptions', 'nodes']
    >;
    beforeAll(() => {
      const __filename = url.fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const outDir = path.join(__dirname, '../../../../../../out/parser');
      tsMapData = readMapData(outDir, 'usa', {
        mapDataKeys: ['prefabs', 'prefabDescriptions', 'nodes'],
      });
    });

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

    it('2', () => {
      const data = {
        prefabToken: '1e00k',
        prefabUid: '52d133ed06059fe1',
        truckGamePos: [
          13321.87804222107, 21.998905181884766, 9100.461112976074,
        ],
        truckHeading: 1.0328307098461664e-7,
      };
      const truck = toTruck(data);
      const prefab = tsMapData.prefabs.get(BigInt('0x' + data.prefabUid))!;
      const prefabDesc = tsMapData.prefabDescriptions.get(data.prefabToken)!;
      console.log(toPosAndBearing(truck));
      expect(
        getDirectionOnPrefab(truck, prefab, prefabDesc, tsMapData.nodes),
      ).toEqual({
        direction: 'forward',
        fromNodeUid: 0x52d133f0f285f9e7n,
      });
    });
    it('3', () => {
      const data = {
        prefabToken: 'mo_01000',
        prefabUid: '572ca544ef8b0001',
        truckGamePos: [
          13188.350715637207, 21.004169464111328, 9164.977996826172,
        ],
        truckHeading: 0.255498468875885,
      };
      const truck = toTruck(data);
      const prefab = tsMapData.prefabs.get(BigInt('0x' + data.prefabUid))!;
      const prefabDesc = tsMapData.prefabDescriptions.get(data.prefabToken)!;
      console.log(toPosAndBearing(truck));
      expect(
        getDirectionOnPrefab(truck, prefab, prefabDesc, tsMapData.nodes),
      ).toEqual({
        direction: 'forward',
        fromNodeUid: 0x572ca546838b0002n,
      });
    });
  });

  it('detects direction on t-intersection', () => {
    const truck = aTruckWith({
      position: {
        X: -3090.70485496521,
        Y: 3.975241184234619,
        Z: 36883.09846687317,
      },
      orientation: {
        heading: 0.49060460925102234,
      },
    });

    const prefab: Prefab = {
      uid: BigInt(0x47d43914a60b0001n),
      type: 4,
      x: -3099.640625,
      y: 36881.9921875,
      dlcGuard: 0,
      token: '2o0cb',
      nodeUids: [0x47d43adc3e0b0002n, 0x47d43914eb8b0002n, 0x441462706bcb0000n],
      originNodeIndex: 0,
    };

    expect(
      getDirectionOnPrefab(truck, prefab, prefabDesc_2o0cb, nodes),
    ).toEqual({
      fromNodeUid: 0x441462706bcb0000n,
      direction: 'backward',
    });
  });
});

// super expensive to run; disable for now until
// data can be constrained to minimal fixtures.
describe('generateRoutes bugs', () => {
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

  // TODO move this to SessionActor test?
  it('generates routes involving ferries', async () => {
    const telemetryEventEmitter: TelemetryEventEmitter = new EventEmitter();
    const actor = new SessionActorImpl(
      'code',
      dummyEventSink,
      telemetryEventEmitter,
      graphAndMapData,
      routingService,
      100,
    );
    const key = '57457ae23e11a7f4-5f76e2647d050b31-forward-fastest';
    const route = await generateRouteFromKeys([key], {
      graphAndMapData,
      routing: routingService,
    });

    actor.setActiveRoute(route);
    expect(route.segments.length).toBe(1);
  });

  it('retries in another direction when inside certain prefabs', async () => {
    const truck = aTruckWith({
      position: {
        X: -5714.30778503418,
        Y: 12.68964672088623,
        Z: 43015.684871673584,
      },
      orientation: {
        heading: 0.6075969934463501,
      },
    });
    console.log(fromAtsCoordsToWgs84([truck.position.X, truck.position.Z]));
    const routes = await generateRoutes(0x5f76e266df850a14n, ['smallRoads'], {
      graphAndMapData,
      routing: routingService,
      truck,
      domainEventSink: dummyEventSink,
    });
    expect(routes.length).toBe(1);
  });

  it('generates routes from prefab, when prefab node is not in graph', async () => {
    const startNodeUid1 = 0x4c760ae87fe60002n;
    expect(graphAndMapData.graphData.graph.has(startNodeUid1)).toBe(false);
    const route1 = await generateRouteFromKeys(
      [
        createRouteKey(
          startNodeUid1,
          0x5f76e26192852154n,
          'forward',
          'shortest',
        ),
      ],
      {
        graphAndMapData,
        routing: routingService,
      },
    );
    expect(route1.segments.length).toBe(1);

    const startNodeUid2 = 0x42da4f50c05b0297n;
    expect(graphAndMapData.graphData.graph.has(startNodeUid2)).toBe(false);
    const route2 = await generateRouteFromKeys(
      [
        createRouteKey(
          startNodeUid2,
          0x42da4f504e9b0426n,
          'forward',
          'shortest',
        ),
      ],
      {
        graphAndMapData,
        routing: routingService,
      },
    );
    expect(route2.segments.length).toBe(1);
  });

  it('generates ferry routes from keys', async () => {
    const route = await generateRouteFromKeys(
      [
        // Port Townsend, WA to Coupeville, WA
        createRouteKey(
          0x2d47ee4c43160431n,
          0x27f9f4d86445076an,
          'backward',
          'shortest',
        ),
      ],
      {
        graphAndMapData,
        routing: routingService,
      },
    );
    expect(route.lookup.nodeUidsSet.has(0x2d47ee4c6c9603e5n)).toBe(true);
    const mans = route.segments.flatMap(segment =>
      segment.steps.flatMap(step => step.maneuver),
    );
    mans.forEach(man => console.log(toStepText(man)));
    console.log(mans);
  });

  it.each([
    // this route failed because truck was in a dealership prefab with no
    // road lines, and calculateLocation ended up picking a road far away
    // from the truck, in a direction that was a no-go.
    {
      position: {
        X: -18962.076023101807,
        Y: 24.77117919921875,
        Z: 36340.879081726074,
      },
      heading: 0.9179850816726685,
      toNodeUid: 0x3f81d1a85413013cn,
    },
    // this route failed because of a bug in generateRoutes that tries to
    // generate routes from a node not within the graph (e.g., gas station
    // prefabs)
    {
      position: {
        X: -19524.231704711914,
        Y: 24.000167846679688,
        Z: 36290.5421295166,
      },
      heading: 0.3183667063713074,
      toNodeUid: 0x3f81d1a85413013cn,
    },
    // route that failed because of an altitude bug in calculateLocation
    {
      position: {
        X: -2381.527801513672,
        Y: 12.032059669494629,
        Z: 34020.006607055664,
      },
      heading: 0.38860344886779785,
      toNodeUid: 0x5f76e26169853a90n,
    },
    // two routes that failed while doing some live testing
    {
      position: {
        X: 13188.350715637207,
        Y: 21.004169464111328,
        Z: 9164.977996826172,
      },
      heading: 0.255498468875885,
      toNodeUid: 0x5888502dbb8f026en,
    },
    {
      position: {
        X: 12010.357940673828,
        Y: 18.858428955078125,
        Z: 9402.706405639648,
      },
      heading: 0.24985112249851227,
      toNodeUid: 0x5f76e267d405042cn,
    },
    //
    // truck traveling on busy interchange near Dallas
    {
      position: {
        X: -1967.2700500488281,
        Y: 4.381705284118652,
        Z: 33998.87658691406,
      },
      heading: 0.2561998665332794,
      toNodeUid: 0x40f702a81b8b0001n,
    },
    // truck traveling on exit prefab
    {
      position: {
        X: 3831.1287536621094,
        Y: 12.001091003417969,
        Z: 32900.21479797363,
      },
      heading: 0.22028927505016327,
      toNodeUid: 0x4c8690649b81308en,
    },
    // truck in company prefab
    {
      position: {
        X: 9018.439025878906,
        Y: 5.001845836639404,
        Z: 31595.647369384766,
      },
      heading: 0.7165212631225586,
      toNodeUid: 0x5df5b83c878124d3n,
    },
    // truck is approaching GARC in dallas, inside a v-junction prefab preceded
    // by a road-like prefab.
    {
      position: {
        X: -3090.70485496521,
        Y: 3.975241184234619,
        Z: 36883.09846687317,
      },
      heading: 0.49060460925102234,
      toNodeUid: 0x40f702a81b8b0001n,
    },
    // truck is within port townsend ferry prefab.
    // - entrance 2d47ee4ce35603e7
    //     "x": -100743.453125,
    //     "y": -66213.22265625,
    //     "z": 3.96875,
    // - exit     2d47ee4cd9d603e6
    //     "x": -100724.41796875,
    //     "y": -66031.140625,
    //     "z": 3.7890625,
    {
      position: {
        X: -100734,
        Y: 3.975241184234619,
        Z: -66100,
      },
      heading: 0.5,
      toNodeUid: 0x27f9f4d86445076an,
    },
  ])('routes to %s', async ({ position, heading, toNodeUid }) => {
    const truck = aTruckWith({
      position,
      orientation: {
        heading,
      },
    });

    // if this fails, then map has probably been updated since test was
    // originally written :/
    expect(graphAndMapData.tsMapData.nodes.has(toNodeUid)).toBe(true);

    const routes = await generateRoutes(toNodeUid, ['shortest'], {
      graphAndMapData,
      routing: routingService,
      truck,
      domainEventSink: dummyEventSink,
    });
    console.log(fromAtsCoordsToWgs84([position.X, position.Z]));
    expect(routes.length).toBe(1);
    console.log(routes[0].lookup.nodeUidsFlat[1].toString(16));
  });
});

describe('getRelativePositionOfPoint', () => {
  it.each([
    {
      position: {
        X: -100734,
        Y: 3.975241184234619,
        Z: -66100,
      },
      heading: 0.5,
      to: {
        x: -99569.76171875,
        y: -66997.7109375,
      },
      expected: 'front',
    },
    {
      position: {
        X: -100734,
        Y: 3.975241184234619,
        Z: -66100,
      },
      heading: 0.25,
      to: {
        x: -99569.76171875,
        y: -66997.7109375,
      },
      expected: 'behind',
    },
  ])(
    'detects points relative to truck %s',
    ({ position, heading, to, expected }) => {
      const truck = aTruckWith({
        position,
        orientation: {
          heading,
        },
      });

      expect(getRelativePositionOfPoint(truck, to)).toBe(expected);
    },
  );
});
