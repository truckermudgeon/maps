import { assertExists } from '@truckermudgeon/base/assert';
import { beforeAll, expect } from 'vitest';
import type { GraphAndMapData, GraphMappedData } from '../../lookup-data';
import { RouteStepBuilder } from '../route-step-builder';
import { testLookupService } from './test-lookup-service';

const dummyCost = {
  distance: 0,
  duration: 0,
};

describe('RouteStepBuilder', () => {
  let graphAndMapData: GraphAndMapData<GraphMappedData>;
  let builder: RouteStepBuilder;
  beforeAll(() => {
    graphAndMapData = testLookupService('europe').getData().graphAndMapData;
    builder = new RouteStepBuilder(
      graphAndMapData.tsMapData,
      graphAndMapData.signRTree,
      graphAndMapData.roundaboutData,
    );
  }, 15_000);

  const getNode = (nid: bigint) =>
    assertExists(graphAndMapData.tsMapData.nodes.get(nid));

  it('builds steps including prefab roundabouts (prefab node to prefab node)', () => {
    // start at west end of 4-point roundabout
    const start = getNode(0x56b0ba5e5e50004n);
    // end at north end of 4-point roundabout
    const end = getNode(0x52ce47926150002n);

    builder.add(start, end, dummyCost);
    const steps = builder.build();
    console.log(steps);
    expect(steps).toBe(1);
  });
});
