import { assert } from '@truckermudgeon/base/assert';
import type { RoundaboutData, RoundaboutExit } from '@truckermudgeon/map/types';
import type { FileSource } from './file-source';
import { fromDir, fromZip } from './file-source';

export function readRoundaboutsDataFromZip<T extends 'usa' | 'europe'>(
  zipPath: string,
  map: T,
): RoundaboutData {
  return readRoundaboutsData(fromZip(zipPath), map);
}

export function readRoundaboutsData<T extends 'usa' | 'europe'>(
  input: string | FileSource,
  map: T,
): RoundaboutData {
  console.log('reading', map, 'roundabouts data...');
  const source = typeof input === 'string' ? fromDir(input) : input;
  const json = source.readUtf8(`${map}-roundabouts.json`);
  const roundaboutData = JSON.parse(
    json,
    roundaboutsReviver,
  ) as unknown as Omit<RoundaboutData, 'descsIndex'>;
  console.log(roundaboutData.prefabTokens.size, 'roundabout prefab tokens');
  console.log(roundaboutData.descs.length, 'roundabout descriptions');
  const descsIndex = new Map<bigint, number>();
  for (let i = 0; i < roundaboutData.descs.length; i++) {
    const desc = roundaboutData.descs[i];
    for (const key of desc.paths.keys()) {
      descsIndex.set(key, i);
    }
  }

  return {
    ...roundaboutData,
    descsIndex,
  };
}

function roundaboutsReviver(key: string, value: unknown) {
  if (key === 'prefabTokens' && Array.isArray(value)) {
    return new Set(value);
  }
  if (key === 'paths' && Array.isArray(value) && Array.isArray(value[0])) {
    return new Map<bigint, Map<bigint, RoundaboutExit>>(
      value.map(([nid, exit]) => [
        BigInt(`0x${nid}`),
        new Map<bigint, RoundaboutExit>(
          (exit as [string, RoundaboutExit][]).map(([nid, exit]) => [
            BigInt(`0x${nid}`),
            exit,
          ]),
        ),
      ]),
    );
  }

  if (key === 'cycleNodeUids') {
    assert(Array.isArray(value));
    return (value as unknown[]).map(toBigInt);
  }

  return value;
}

function toBigInt(v: unknown): bigint {
  assert(typeof v === 'string' && /^[0-9a-f]+$/.test(v));
  return BigInt('0x' + v);
}
