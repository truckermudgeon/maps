import polyline from '@mapbox/polyline';
import { assertExists } from '@truckermudgeon/base/assert';
import { Preconditions } from '@truckermudgeon/base/precon';
import type { MappedDataForKeys } from '@truckermudgeon/io';
import type { Neighbor } from '@truckermudgeon/map/types';
import type { RouteStep } from '../../types';
import type { GraphAndMapData } from '../lookup-data';
import { RouteStepBuilder } from './route-step-builder';

type GuidanceMappedData = MappedDataForKeys<
  [
    'nodes',
    'roads',
    'prefabs',
    'companies',
    'ferries',
    'prefabDescriptions',
    'roadLooks',
  ]
>;

// doesn't produce RouteSteps with arrive | depart maneuvers. up to callers to
// do that.
// TODO enforce in types.
export function calculateSteps(
  neighbors: Neighbor[],
  context: GuidanceMappedData,
  signRTree: GraphAndMapData['signRTree'],
  roundaboutData: GraphAndMapData['roundaboutData'],
): RouteStep[] {
  Preconditions.checkArgument(
    neighbors.length > 0,
    'neighbors must not be empty',
  );

  const start = Date.now();
  console.log('calculating steps for', neighbors.length, 'neighbors');

  let curNode = assertExists(context.nodes.get(neighbors[0].nodeUid));
  console.log('first node', curNode);
  console.log('last node', neighbors.at(-1)!.nodeUid);

  // TODO make builder long-lived
  const builder = new RouteStepBuilder(context, signRTree, roundaboutData);

  for (let i = 1; i < neighbors.length; i++) {
    const neighbor = neighbors[i];
    const nextNode = assertExists(context.nodes.get(neighbor.nodeUid));
    if (curNode.uid === nextNode.uid) {
      // expected for degenerate routes.
      continue;
    }
    builder.add(curNode, nextNode, neighbor);
    curNode = nextNode;
  }

  // do a preliminary cleanup pass, because of bad route data, e.g.,
  // consecutive company edges that ping-pong back and forth, and/or
  // can be skipped because of roads.
  // MAYBE solution to the GARC problem is to re-assign company item's node to
  // be that of the nearest road node or prefab node?

  const routeSteps = builder.build();
  const encoded = routeSteps.map(step => {
    return {
      ...step,
      geometry: polyline.encode(step.geometry),
    };
  });

  console.log('calculate steps duration:', Date.now() - start, 'ms');

  return encoded;
}
