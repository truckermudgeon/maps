import { ItemType } from '@truckermudgeon/map/constants';
import type {
  MapData,
  Node,
  Prefab,
  Road,
  RoadLook,
  WithToken,
} from '@truckermudgeon/map/types';
import type { MappedData } from '../../mapped-data';
import { generateGraph } from '../graph';
import { prefab_us_405 } from './fixtures';

describe('generateGraph', () => {
  it('generates a graph for roads and road-y prefabs', () => {
    // Create map data for a T intersection where the top points of the T are
    // connected to a one-way road, and the bottom of the T is connected to a
    // two-way road:
    //
    // node-0   node-1  node-2     node-3
    // v          v       v          v
    // *-road-1-→ *---+---* -road-2-→*
    //                |
    //                | prefab-4
    //                |
    //                * < node-4 (origin node for prefab)
    //               ↓ ↑
    //             road-3 (forward direction is up)
    //               ↓ ↑
    //                * < node-5

    const fakeNodes = [
      aNodeWith({
        uid: 0n,
        forwardItemUid: 1n, // road-1
        backwardItemUid: 0n, // dead-end
      }),
      aNodeWith({
        uid: 1n,
        forwardItemUid: 4n, // prefab-4
        backwardItemUid: 1n, // road-1
      }),
      aNodeWith({
        uid: 2n,
        forwardItemUid: 2n,
        backwardItemUid: 4n,
      }),
      aNodeWith({
        uid: 3n,
        forwardItemUid: 0n, // dead-end
        backwardItemUid: 2n,
      }),
      aNodeWith({
        uid: 4n,
        forwardItemUid: 4n, // prefab-4
        backwardItemUid: 3n,
      }),
      aNodeWith({
        uid: 5n,
        forwardItemUid: 3n,
        backwardItemUid: 0n, // dead-end
      }),
    ];
    const fakeRoads = [
      aRoadItemWith({
        uid: 1n,
        roadLookToken: 'one-way',
        startNodeUid: 0n,
        endNodeUid: 1n,
      }),
      aRoadItemWith({
        uid: 2n,
        roadLookToken: 'one-way',
        startNodeUid: 2n,
        endNodeUid: 3n,
      }),
      aRoadItemWith({
        uid: 3n,
        roadLookToken: 'two-way',
        startNodeUid: 5n,
        endNodeUid: 4n,
      }),
    ];

    const fakeMapData = createFakeMapData({
      nodes: fakeNodes,
      roads: fakeRoads,
      prefabs: [
        aPrefabItemWith({
          uid: 4n,
          nodeUids: [1n, 2n, 4n],
          originNodeIndex: 1,
          token: prefab_us_405.token,
        }),
      ],
      prefabDescriptions: [prefab_us_405],
    });

    const res = generateGraph(fakeMapData);
    expect(res.get('0')).toMatchObject({
      forward: [
        expect.objectContaining({
          nodeId: '1',
          direction: 'forward',
        }),
      ],
      backward: [],
    });
    expect(res.get('1')).toMatchObject({
      forward: [
        expect.objectContaining({
          nodeId: '2',
          direction: 'forward',
        }),
        expect.objectContaining({
          nodeId: '4',
          direction: 'backward',
        }),
      ],
      backward: [],
    });
    expect(res.get('2')).toMatchObject({
      forward: [
        expect.objectContaining({
          nodeId: '3',
          direction: 'forward',
        }),
      ],
      backward: [],
    });
    // can't navigate _from_ node-3 (can only navigate _to_ node-3).
    expect(res.get('3')).toBeUndefined();
    expect(res.get('4')).toMatchObject({
      forward: [
        expect.objectContaining({
          nodeId: '2',
          direction: 'forward',
        }),
      ],
      backward: [
        expect.objectContaining({
          nodeId: '5',
          direction: 'backward',
        }),
      ],
    });
    expect(res.get('5')).toMatchObject({
      forward: [
        expect.objectContaining({
          nodeId: '4',
          direction: 'forward',
        }),
      ],
      backward: [
        // added because node-5 is a "dead-end" node that can be exited in one
        // direction ('forward', in this case), but can't be exited in the
        // opposite direction ('backward', in this case). this edge is added
        // as a fudged, hacky dead-end edge.
        expect.objectContaining({
          nodeId: '4',
          direction: 'forward',
        }),
      ],
    });
  });
});

function aNodeWith({
  uid,
  forwardItemUid,
  backwardItemUid,
}: Pick<Node, 'uid' | 'forwardItemUid' | 'backwardItemUid'>): Node {
  return {
    uid,
    backwardItemUid,
    forwardItemUid,
    backwardCountryId: 0,
    forwardCountryId: 0,
    rotation: 0,
    rotationQuat: [0, 0, 0, 0],
    sectorX: 0,
    sectorY: 0,
    x: 0,
    y: 0,
    z: 0,
  };
}

function aRoadItemWith({
  uid,
  startNodeUid,
  endNodeUid,
  roadLookToken,
}: Pick<Road, 'uid' | 'startNodeUid' | 'endNodeUid'> & {
  roadLookToken: 'one-way' | 'two-way';
}): Road {
  return {
    uid,
    startNodeUid,
    endNodeUid,
    roadLookToken,
    dlcGuard: 0,
    length: 0,
    sectorX: 0,
    sectorY: 0,
    type: ItemType.Road,
    x: 0,
    y: 0,
  };
}

function aPrefabItemWith({
  uid,
  nodeUids,
  originNodeIndex,
  token,
}: Pick<Prefab, 'uid' | 'nodeUids' | 'originNodeIndex' | 'token'>): Prefab {
  return {
    uid,
    nodeUids,
    originNodeIndex,
    token,
    dlcGuard: 0,
    sectorX: 0,
    sectorY: 0,
    type: ItemType.Prefab,
    x: 0,
    y: 0,
  };
}

function aRoadLook(token: 'one-way' | 'two-way'): WithToken<RoadLook> {
  return token === 'one-way'
    ? {
        token,
        lanesLeft: [],
        lanesRight: ['local'],
      }
    : {
        token,
        lanesLeft: ['local'],
        lanesRight: ['local'],
      };
}

type PartialMapData = Pick<
  Partial<MapData>,
  'nodes' | 'roads' | 'prefabs' | 'companies' | 'ferries' | 'prefabDescriptions'
>;

function createFakeMapData(arrays: PartialMapData): MappedData<'usa'> {
  const {
    nodes = [],
    roads = [],
    prefabs = [],
    companies = [],
    ferries = [],
    prefabDescriptions = [],
  } = arrays;

  return {
    map: 'usa',
    nodes: mapify(nodes, n => String(n.uid)),
    roads: mapify(roads, r => String(r.uid)),
    prefabs: mapify(prefabs, p => String(p.uid)),
    companies: mapify(companies, c => String(c.uid)),
    prefabDescriptions: mapify(prefabDescriptions, p => String(p.token)),
    ferries: mapify(ferries, f => f.token),
    achievements: new Map(),
    cities: new Map(),
    companyDefs: new Map(),
    countries: new Map(),
    cutscenes: new Map(),
    dividers: new Map(),
    mapAreas: new Map(),
    mileageTargets: new Map(),
    modelDescriptions: new Map(),
    models: new Map(),
    roadLooks: new Map([
      ['one-way', aRoadLook('one-way')],
      ['two-way', aRoadLook('two-way')],
    ]),
    routes: new Map(),
    trajectories: new Map(),
    triggers: new Map(),
    pois: [],
    elevation: [],
  };
}

function mapify<T>(arr: T[], k: (t: T) => string): Map<string, T> {
  return new Map(arr.map(item => [k(item), item]));
}
