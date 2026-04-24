import type { MappedDataForKeys } from '@truckermudgeon/io';
import type { Lane } from '@truckermudgeon/map/prefabs';

export interface AccessPoint {
  type: 'entrance' | 'exit';
  nodeUid: bigint;
}

export function calculateLaneInfo(
  _cycle: string[],
  _tsMapData: MappedDataForKeys<
    ['nodes', 'roads', 'prefabs', 'prefabDescriptions']
  >,
): {
  accessPoints: AccessPoint[];
  laneInfo: Map<number, Lane[]>;
} {
  throw new Error();
}
