import fs from 'fs';
import path from 'path';
import { logger } from './logger';

export function readArrayFile<T>(
  filepath: string,
  filter?: (t: T) => boolean,
): T[] {
  const start = Date.now();
  const results: unknown = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  if (!Array.isArray(results)) {
    throw new Error();
  }
  const filtered = filter ? (results as T[]).filter(filter) : (results as T[]);
  const end = Date.now();
  logger.debug((end - start) / 1000, 'seconds:', path.basename(filepath));
  return filtered;
}
