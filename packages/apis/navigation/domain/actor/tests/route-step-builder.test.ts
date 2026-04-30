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

  it.each([
    {
      label: 'west > west (full loop)',
      startNid: 0x56b0ba5e5e50004n,
      endNid: 0x56b0ba5e5e50004n,
      direction: BranchType.ROUND_B,
      roundaboutExitNumber: 4,
    },
    {
      label: 'west > north',
      startNid: 0x56b0ba5e5e50004n,
      endNid: 0x52ce47926150002n,
      direction: BranchType.ROUND_L,
      roundaboutExitNumber: 3,
    },
    {
      label: 'north > west',
      startNid: 0x52ce47926150002n,
      endNid: 0x56b0ba5e5e50004n,
      direction: BranchType.ROUND_R,
      roundaboutExitNumber: 1,
    },
    {
      label: 'north > south',
      startNid: 0x52ce47926150002n,
      endNid: 0x56b0ba56aa50003n,
      direction: BranchType.ROUND_T,
      roundaboutExitNumber: 2,
    },
  ])(
    'builds prefab roundabout step ($label)',
    ({ startNid, endNid, direction, roundaboutExitNumber }) => {
      builder.add(getNode(startNid), getNode(endNid), dummyCost);
      const steps = builder.build();
      expect(steps.length).toBe(1);
      expect(steps[0].maneuver).toMatchObject({
        direction,
        roundaboutExitNumber,
      });
    },
  );
});
