import { assert } from '@truckermudgeon/base/assert';
import type {
  GraphData,
  Neighbors,
  ServiceArea,
} from '@truckermudgeon/map/types';
import fs from 'fs';
import path from 'path';

export function readGraphData<T extends 'usa' | 'europe'>(
  inputDir: string,
  map: T,
): GraphData {
  console.log('reading', map, 'graph data...');
  const json = fs.readFileSync(
    path.join(inputDir, `${map}-graph.json`),
    'utf-8',
  );
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
