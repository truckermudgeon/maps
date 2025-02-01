import { assert } from '@truckermudgeon/base/assert';
import type { Node } from '@truckermudgeon/map/types';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * Reads the contents of a serialized JSON array. Transforms:
 * - string properties named `uid` or ending in `Uid` into bigints
 * - string array properties with key name ending in `Uids` into bigint arrays
 */
export function readArrayFile<T>(
  filepath: string,
  filter?: (t: T) => boolean,
): T[] {
  const basename = path.basename(filepath, '.json');
  const start = Date.now();
  const reviver =
    basename.endsWith('elevation') ||
    basename.endsWith('prefabDescriptions') ||
    basename.endsWith('nodes')
      ? undefined
      : bigintReviver;
  const results: unknown = JSON.parse(
    fs.readFileSync(filepath, 'utf-8'),
    reviver,
  );
  if (!Array.isArray(results)) {
    throw new Error();
  }
  const filtered = filter ? (results as T[]).filter(filter) : (results as T[]);
  if (basename.endsWith('nodes')) {
    for (const t of filtered) {
      const node = t as { -readonly [K in keyof Node]: Node[K] };
      node.uid = BigInt('0x' + node.uid);
      node.forwardItemUid = BigInt('0x' + node.forwardItemUid);
      node.backwardItemUid = BigInt('0x' + node.backwardItemUid);
    }
  }
  logger.debug((Date.now() - start) / 1000, 'seconds:', basename);
  return filtered;
}

function bigintReviver(key: string, value: unknown): unknown {
  if (key === 'uid' || key.endsWith('Uid')) {
    return toBigInt(value);
  } else if (key.endsWith('Uids')) {
    assert(Array.isArray(value));
    return (value as unknown[]).map(toBigInt);
  }
  return value;
}

function toBigInt(v: unknown): bigint {
  assert(typeof v === 'string' && /^[0-9a-f]+$/.test(v));
  return BigInt('0x' + (v as string));
}
