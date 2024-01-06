import { assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import { rotate, translate } from '@truckermudgeon/base/geom';
import type { Node, Prefab, PrefabDescription } from './types';

/**
 * Transforms `position` (in `PrefabDescription` space) into map space.
 */
export function toMapPosition(
  position: Position,
  prefabItem: Prefab,
  prefabDescription: PrefabDescription,
  nodes: Map<string | bigint, Node>,
): Position {
  const prefabOrigin = prefabDescription.nodes[prefabItem.originNodeIndex];
  const originNode = assertExists(nodes.get(prefabItem.nodeUids[0]));
  const originPosition = toPosition(originNode);
  const prefabStart = translate(originPosition, [
    -prefabOrigin.x,
    -prefabOrigin.y,
  ]);
  const rotation = originNode.rotation - prefabOrigin.rotation;

  return rotate(translate(position, prefabStart), rotation, originPosition);
}

function toPosition(p: { x: number; y: number }) {
  return [p.x, p.y] as [number, number];
}
