import fs from 'fs';

export function readArrayFile<T>(
  path: string,
  filter?: (t: T) => boolean,
): T[] {
  const results: unknown = JSON.parse(fs.readFileSync(path, 'utf-8'));
  if (!Array.isArray(results)) {
    throw new Error();
  }
  return filter ? (results as T[]).filter(filter) : (results as T[]);
}
