import { assertExists } from '@truckermudgeon/base/assert';
import { beforeAll, expect } from 'vitest';
import { BranchType } from '../../../constants';
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
    // end at west end of 4-point roundabout
    const end = getNode(0x56b0ba5e5e50004n);

    builder.add(start, end, dummyCost);
    const steps = builder.build();
    expect(steps.length).toBe(1);
    expect(steps[0].maneuver).toMatchObject({
      direction: BranchType.ROUND_B,
      roundaboutExitNumber: 4,
    });
  });

  it('builds steps including prefab roundabouts (prefab node to prefab node)', () => {
    // start at west end of 4-point roundabout
    const start = getNode(0x56b0ba5e5e50004n);
    // end at north end of 4-point roundabout
    const end = getNode(0x52ce47926150002n);

    builder.add(start, end, dummyCost);
    const steps = builder.build();
    expect(steps.length).toBe(1);
    expect(steps[0].maneuver).toMatchObject({
      direction: BranchType.ROUND_L,
      roundaboutExitNumber: 3,
    });
  });

  it('builds steps including prefab roundabouts (prefab node to prefab node)', () => {
    // start at north end of 4-point roundabout
    const start = getNode(0x52ce47926150002n);
    // end at west end of 4-point roundabout
    const end = getNode(0x56b0ba5e5e50004n);

    builder.add(start, end, dummyCost);
    const steps = builder.build();
    expect(steps.length).toBe(1);
    expect(steps[0].maneuver).toMatchObject({
      direction: BranchType.ROUND_R,
      roundaboutExitNumber: 1,
    });
  });

  it('builds steps including prefab roundabouts (prefab node to prefab node)', () => {
    // start at north end of 4-point roundabout
    const start = getNode(0x52ce47926150002n);
    // end at south end of 4-point roundabout
    const end = getNode(0x56b0ba56aa50003n);

    builder.add(start, end, dummyCost);
    const steps = builder.build();
    expect(steps.length).toBe(1);
    expect(steps[0].maneuver).toMatchObject({
      direction: BranchType.ROUND_T,
      roundaboutExitNumber: 2,
    });
  });
});
