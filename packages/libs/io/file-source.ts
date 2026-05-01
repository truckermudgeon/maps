import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

/**
 * Read-only source of named text files. Backs the parser-data readers so they
 * work uniformly against an on-disk directory or a zip archive.
 *
 * Names are bare filenames (e.g. `"usa-roads.json"`). Implementations are
 * responsible for resolving them within their underlying storage.
 */
export interface FileSource {
  has(name: string): boolean;
  readUtf8(name: string): string;
  /** Human-readable identifier used in error messages. */
  describe(): string;
}

export function fromDir(dir: string): FileSource {
  return {
    has: name => fs.existsSync(path.join(dir, name)),
    readUtf8: name => fs.readFileSync(path.join(dir, name), 'utf-8'),
    describe: () => dir,
  };
}

export function fromZip(zipPath: string): FileSource {
  const zip = new AdmZip(zipPath);
  // Index by basename so both "usa-roads.json" and "subset/usa-roads.json"
  // entries resolve from the same lookup.
  const entriesByName = new Map<string, AdmZip.IZipEntry>();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    entriesByName.set(path.basename(entry.entryName), entry);
  }
  return {
    has: name => entriesByName.has(name),
    readUtf8: name => {
      const entry = entriesByName.get(name);
      if (!entry) {
        throw new Error(`zip ${zipPath} has no entry named ${name}`);
      }
      return entry.getData().toString('utf-8');
    },
    describe: () => zipPath,
  };
}
