import { Preconditions } from '@truckermudgeon/base/precon';
import { logger } from '../logger';
import type {
  DirectoryEntry,
  Entries,
  FileEntry,
  ScsArchive,
  Store,
} from './scs-archive';

export class CombinedEntries implements Entries {
  private readonly archives: readonly ScsArchive[];

  constructor(archives: ScsArchive[]) {
    const valid: ScsArchive[] = [];
    for (const archive of archives) {
      if (!archive.isValid()) {
        logger.warn(`${archive.path} is invalid. ignoring.`);
        continue;
      }
      valid.push(archive);
    }
    this.archives = valid;
  }

  get directories(): Store<DirectoryEntry> {
    return {
      get: key => {
        const entries = this.archives
          .map(a => a.parseEntries().directories.get(key))
          .filter((e): e is NonNullable<DirectoryEntry> => e != null);
        return entries.length ? new CompositeDirectory(entries) : undefined;
      },
    };
  }

  get files(): Store<FileEntry> {
    return {
      get: key => {
        const entries = this.archives
          .map(a => a.parseEntries().files.get(key))
          .filter((e): e is NonNullable<FileEntry> => e != null);
        if (entries.length > 1) {
          logger.debug(
            `multiple files found for ${key}; using most recent one.`,
          );
        }
        return entries.length ? entries.at(-1) : undefined;
      },
    };
  }
}

class CompositeDirectory implements DirectoryEntry {
  readonly type = 'directory';
  readonly hash: bigint;
  readonly files: readonly string[];
  readonly subdirectories: readonly string[];

  constructor(directories: DirectoryEntry[]) {
    Preconditions.checkArgument(directories.length > 0);
    this.hash = directories[0].hash;
    this.files = [...new Set(directories.flatMap(d => d.files))];
    this.subdirectories = [
      ...new Set(directories.flatMap(d => d.subdirectories)),
    ];
  }
}
