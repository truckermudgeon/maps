import { assert } from '@truckermudgeon/base/assert';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * Reads the contents of a serialized JSON array. Transforms string properties
 * with key names that are either `uid` or end in `Uid` into bigints.
 */
export function readArrayFile<T>(
  filepath: string,
  filter?: (t: T) => boolean,
): T[] {
  const start = Date.now();
  const results: unknown = JSON.parse(
    fs.readFileSync(path, 'utf-8'),
    bigintReviver,
  );
  if (!Array.isArray(results)) {
    throw new Error();
  }
  const filtered = filter ? (results as T[]).filter(filter) : (results as T[]);
  const end = Date.now();
  logger.debug((end - start) / 1000, 'seconds:', path.basename(filepath));
  return filtered;
}

function bigintReviver(key: string, value: unknown): unknown {
  if (key === 'uid' || key.endsWith('Uid')) {
    assert(typeof value === 'string' && /^[0-9a-f]+$/.test(value));
    return BigInt('0x' + (value as string));
  }
  if (key.endsWith('Uids')) {
    assert(Array.isArray(value));
    return (value as string[]).map(v => {
      assert(/^[0-9a-f]+$/.test(v));
      return BigInt('0x' + v);
    });
  }
  return value;
}
