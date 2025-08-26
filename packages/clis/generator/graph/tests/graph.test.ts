import { Preconditions } from '@truckermudgeon/base/precon';
import { ItemType } from '@truckermudgeon/map/constants';
import type {
  City,
  CompanyItem,
  Country,
  MapData,
  Node,
  Prefab,
  Road,
  RoadLook,
  WithToken,
} from '@truckermudgeon/map/types';
import type { MappedData } from '../../mapped-data';
import { generateGraph } from '../graph';
import { d_farm_grg, d_oil_gst3, prefab_us_405 } from './fixtures';

describe('generateGraph', () => {
  let partialMapData: PartialMapData;
  beforeEach(() => {
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
    const nodes = [
      aNodeWith({
        uid: 0n,
        forwardItemUid: 1n, // road-1
        backwardItemUid: 0n, // dead-end
        x: -20,
        y: 0,
      }),
      aNodeWith({
        uid: 1n,
        forwardItemUid: 4n, // prefab-4
        backwardItemUid: 1n, // road-1
        x: -10,
        y: 0,
      }),
      aNodeWith({
        uid: 2n,
        forwardItemUid: 2n,
        backwardItemUid: 4n,
        x: 10,
        y: 0,
      }),
      aNodeWith({
        uid: 3n,
        forwardItemUid: 0n, // dead-end
        backwardItemUid: 2n,
        x: 20,
        y: 0,
      }),
      aNodeWith({
        uid: 4n,
        forwardItemUid: 4n, // prefab-4
        backwardItemUid: 3n,
        x: 0,
        y: 10,
      }),
      aNodeWith({
        uid: 5n,
        forwardItemUid: 3n,
        backwardItemUid: 0n, // dead-end
        x: 0,
        y: 20,
      }),
    ];
    const roads = [
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
    const prefabs = [
      aPrefabItemWith({
        uid: 4n,
        nodeUids: [1n, 2n, 4n],
        originNodeIndex: 1,
        token: prefab_us_405.token,
      }),
    ];

    partialMapData = {
      nodes,
      roads,
      prefabs,
      companies: [],
      ferries: [],
    };
  });

  it('generates a graph for roads and road-y prefabs', () => {
    const fakeMapData = createFakeMapData(partialMapData);

    const { graph } = generateGraph(fakeMapData);
    expect(graph.get(0n)).toMatchObject({
      forward: [
        expect.objectContaining({
          nodeUid: 1n,
          direction: 'forward',
        }),
      ],
      backward: [],
    });
    expect(graph.get(1n)).toMatchObject({
      forward: [
        expect.objectContaining({
          nodeUid: 4n,
          direction: 'backward',
        }),
        expect.objectContaining({
          nodeUid: 2n,
          direction: 'forward',
        }),
      ],
      backward: [],
    });
    expect(graph.get(2n)).toMatchObject({
      forward: [
        expect.objectContaining({
          nodeUid: 3n,
          direction: 'forward',
        }),
      ],
      backward: [],
    });
    // can't navigate _from_ node-3 (can only navigate _to_ node-3).
    expect(graph.get(3n)).toBeUndefined();
    expect(graph.get(4n)).toMatchObject({
      forward: [
        expect.objectContaining({
          nodeUid: 2n,
          direction: 'forward',
        }),
      ],
      backward: [
        expect.objectContaining({
          nodeUid: 5n,
          direction: 'backward',
        }),
      ],
    });
    expect(graph.get(5n)).toMatchObject({
      forward: [
        expect.objectContaining({
          nodeUid: 4n,
          direction: 'forward',
        }),
      ],
      backward: [
        // added because node-5 is a "dead-end" node that can be exited in one
        // direction ('forward', in this case), but can't be exited in the
        // opposite direction ('backward', in this case). this edge is added
        // as a fudged, hacky dead-end edge.
        expect.objectContaining({
          nodeUid: 4n,
          direction: 'forward',
        }),
      ],
    });
  });

  it('generates a graph that has edges to company nodes (connected prefab)', () => {
    // add a company prefab at node-3, along with associated nodes:
    //
    //             +---------------------------+
    //             |                           |  < prefab-6
    //    node-7 > *                           |
    //             |                           |
    //      node-3 |                           |
    //            \|                           |
    // * -road-2-> *   *  <- node-6, company-5 |
    //             |                           |
    //             |                           |
    //             +---------------------------+
    const companyPrefab = aPrefabItemWith({
      uid: 6n,
      token: 'd_farm_grg',
      nodeUids: [3n, 6n],
      originNodeIndex: 0,
    });
    partialMapData.prefabs.push(companyPrefab);

    const companyItem = aCompanyItemWith({
      uid: 5n,
      token: 'sc_frm_grg',
      nodeUid: 6n,
      prefabUid: companyPrefab.uid,
    });
    partialMapData.companies.push(companyItem);

    const node3 = partialMapData.nodes[3];
    partialMapData.nodes[3] = {
      ...node3,
      forwardItemUid: companyPrefab.uid,
    };
    partialMapData.nodes.push(
      aNodeWith({
        uid: 6n,
        forwardItemUid: companyItem.uid,
        backwardItemUid: 0n,
        x: node3.x + 10,
        y: node3.y,
      }),
      aNodeWith({
        uid: 7n,
        forwardItemUid: companyPrefab.uid,
        backwardItemUid: 0n,
        x: node3.x,
        y: node3.y + 30,
      }),
    );

    const fakeMapData = createFakeMapData(partialMapData);
    const { graph } = generateGraph(fakeMapData);
    // node-3 should have a single edge to the company node.
    expect(graph.get(3n)).toMatchObject({
      forward: [
        expect.objectContaining({
          direction: 'forward',
          nodeUid: 6n,
        }),
      ],
      // TODO what if we arrived at node-3 in the backward direction?
      backward: [],
    });

    // documenting a fixed quirk:
    // node 7 is unreachable (i.e., it has no edges that point to it)
    const allEdgeDestinations = new Set(
      graph
        .values()
        .flatMap(ns => [
          ...ns.forward.map(e => e.nodeUid),
          ...ns.backward.map(e => e.nodeUid),
        ]),
    );
    expect(allEdgeDestinations.has(7n)).toBe(false);

    // and the graph does not contain an entry for it.
    expect(graph.get(7n)).toBeUndefined();
  });

  it('generates a graph that has edges to company nodes (island prefab)', () => {
    // add a company prefab to the right of node-3, along with associated nodes:
    //
    //                            *  < node-8, company-5
    //      node-3     prefab-6
    //            \      v
    // * -road-2-> *   *---* <- node-6 and node-7
    //
    const companyPrefab = aPrefabItemWith({
      uid: 6n,
      token: 'd_oil_gst3',
      nodeUids: [6n, 7n],
      originNodeIndex: 0,
    });
    partialMapData.prefabs.push(companyPrefab);

    const companyItem = aCompanyItemWith({
      uid: 5n,
      token: 'vor_oil_gst',
      nodeUid: 8n,
      prefabUid: companyPrefab.uid,
    });
    partialMapData.companies.push(companyItem);

    // make road-2 a two-way road, so one can navigate back through it from
    // the fuel depot.
    const road2 = partialMapData.roads[1];
    partialMapData.roads[1] = {
      ...road2,
      roadLookToken: 'two-way',
    };

    // note: unlike the connected prefab test, node-3 has no link to the
    // company prefab item.
    const node3 = partialMapData.nodes[3];

    partialMapData.nodes.push(
      aNodeWith({
        uid: 6n,
        forwardItemUid: companyPrefab.uid,
        backwardItemUid: 0n,
        x: node3.x + 10,
        y: node3.y,
      }),
      aNodeWith({
        uid: 7n,
        forwardItemUid: companyPrefab.uid,
        backwardItemUid: 0n,
        x: node3.x + 20,
        y: node3.y,
      }),
      aNodeWith({
        uid: 8n,
        forwardItemUid: companyItem.uid,
        backwardItemUid: 0n,
        x: node3.x + 30,
        y: node3.y - 10,
      }),
    );

    // TODO we only care about a two-way connection between nodes 8 and 3.
    // i'm pretty sure we're adding unnecessary edges to company nodes (both
    // in the island and non-island cases).

    const fakeMapData = createFakeMapData(partialMapData);
    const { graph } = generateGraph(fakeMapData);
    expect(graph.get(3n)).toMatchObject({
      forward: [
        // back to start point of road-2, since road-2 is a two-way road in
        // this test.
        expect.objectContaining({
          direction: 'backward',
          nodeUid: 2n,
        }),
        // edges to company node.
        expect.objectContaining({
          direction: 'forward',
          nodeUid: 8n,
        }),
        expect.objectContaining({
          direction: 'backward',
          nodeUid: 8n,
        }),
      ],
      backward: [
        // back to start point of road-2, since road-2 is a two-way road in
        // this test.
        expect.objectContaining({
          direction: 'backward',
          nodeUid: 2n,
        }),
        // edges to company node.
        expect.objectContaining({
          direction: 'forward',
          nodeUid: 8n,
        }),
        expect.objectContaining({
          direction: 'backward',
          nodeUid: 8n,
        }),
      ],
    });

    // "island" company prefab points aren't present (i.e., routeable) in graph.
    expect(graph.has(6n)).toBe(false);
    expect(graph.has(7n)).toBe(false);

    expect(graph.get(8n)).toMatchObject({
      forward: [
        // edges to nearest routeable node.
        expect.objectContaining({
          direction: 'forward',
          nodeUid: 3n,
        }),
        expect.objectContaining({
          direction: 'backward',
          nodeUid: 3n,
        }),
      ],
      backward: [],
    });
  });
});

function aNodeWith({
  uid,
  forwardItemUid,
  backwardItemUid,
  x,
  y,
}: Pick<Node, 'uid' | 'forwardItemUid' | 'backwardItemUid' | 'x' | 'y'>): Node {
  return {
    uid,
    backwardItemUid,
    forwardItemUid,
    x,
    y,
    backwardCountryId: 0,
    forwardCountryId: 0,
    rotation: 0,
    rotationQuat: [0, 0, 0, 0],
    z: 0,
  };
}

function aCompanyItemWith({
  uid,
  nodeUid,
  prefabUid,
  token,
}: Pick<CompanyItem, 'uid' | 'nodeUid' | 'prefabUid' | 'token'>): CompanyItem {
  return {
    uid,
    nodeUid,
    prefabUid,
    token,
    type: ItemType.Company,
    cityToken: 'city',
    x: 0,
    y: 0,
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
  MapData,
  'nodes' | 'roads' | 'prefabs' | 'companies' | 'ferries'
>;

function createFakeMapData(arrays: PartialMapData): MappedData<'usa'> {
  const { nodes, roads, prefabs, companies, ferries } = arrays;
  const prefabDescriptions = [prefab_us_405, d_farm_grg, d_oil_gst3];

  // node uids must be unique
  Preconditions.checkArgument(
    nodes.length === new Set(nodes.map(n => n.uid)).size,
  );
  // item uids must be unique across all lists and not contain any 0s
  const itemUids = [roads, prefabs, companies].flatMap(i => i.map(i => i.uid));
  Preconditions.checkArgument(itemUids.length === new Set(itemUids).size);
  Preconditions.checkArgument(!itemUids.includes(0n));
  // tokens must be unique within each list
  for (const list of [ferries, prefabDescriptions]) {
    Preconditions.checkArgument(
      list.length === new Set(list.map(n => n.token)).size,
    );
  }

  // The One™ city and country used in tests.
  const city: City = {
    areas: [],
    countryToken: 'country',
    name: 'City',
    nameLocalized: 'City',
    population: 0,
    token: 'city',
    x: 0,
    y: 0,
  };
  const country: Country = {
    code: 'CO',
    id: 0,
    name: 'Country',
    nameLocalized: 'Country',
    token: 'country',
    truckSpeedLimits: {},
    x: 0,
    y: 0,
  };

  return {
    map: 'usa',
    nodes: mapify(nodes, n => n.uid),
    roads: mapify(roads, r => r.uid),
    prefabs: mapify(prefabs, p => p.uid),
    companies: mapify(companies, c => c.uid),
    prefabDescriptions: mapify(prefabDescriptions, p => String(p.token)),
    ferries: mapify(ferries, f => f.token),
    companyDefs: new Map(),
    mapAreas: new Map(),
    roadLooks: new Map([
      ['one-way', aRoadLook('one-way')],
      ['two-way', aRoadLook('two-way')],
    ]),
    cities: new Map([['city', city]]),
    countries: new Map([['country', country]]),
    mileageTargets: new Map(),
    models: new Map(),
    routes: new Map(),
    trajectories: new Map(),
    triggers: new Map(),
    signDescriptions: new Map(),
    signs: new Map(),
    achievements: new Map(),
    cutscenes: new Map(),
    dividers: new Map(),
    modelDescriptions: new Map(),
    pois: [],
    elevation: [],
  };
}

function mapify<T, U>(arr: T[], k: (t: T) => U): Map<U, T> {
  return new Map(arr.map(item => [k(item), item]));
}
