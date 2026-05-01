import { assert } from '@truckermudgeon/base/assert';
import type {
  GraphData,
  Neighbors,
  ServiceArea,
} from '@truckermudgeon/map/types';
import type { FileSource } from './file-source';
import { fromDir, fromZip } from './file-source';

export function readGraphDataFromZip<T extends 'usa' | 'europe'>(
  zipPath: string,
  map: T,
): GraphData {
  return readGraphData(fromZip(zipPath), map);
}

export function readGraphData<T extends 'usa' | 'europe'>(
  input: string | FileSource,
  map: T,
): GraphData {
  console.log('reading', map, 'graph data...');
  const source = typeof input === 'string' ? fromDir(input) : input;
  const json = source.readUtf8(`${map}-graph.json`);
  const graphData = JSON.parse(json, graphReviver) as unknown as GraphData;
  console.log(graphData.graph.size, 'graph nodes');
  console.log(graphData.serviceAreas.size, 'service areas');
  return graphData;
}

function graphReviver(key: string, value: unknown) {
  if (key === 'graph' && Array.isArray(value) && Array.isArray(value[0])) {
    return new Map<bigint, Neighbors>(
      value.map(([nid, neighbors]) => [BigInt(`0x${nid}`), neighbors]),
    );
  }
  if (
    key === 'serviceAreas' &&
    Array.isArray(value) &&
    Array.isArray(value[0])
  ) {
    return new Map<bigint, ServiceArea>(
      value.map(([nid, serviceArea]) => [BigInt(`0x${nid}`), serviceArea]),
    );
  }
  if (key === 'facilities' && Array.isArray(value)) {
    return new Set(value);
  }

  if (key === 'uid' || key.endsWith('Uid')) {
    assert(typeof value === 'string' && /^[0-9a-f]+$/.test(value));
    return BigInt(`0x${value}`);
  }

  return value;
}
