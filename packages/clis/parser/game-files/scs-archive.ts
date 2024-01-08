import { Preconditions } from '@truckermudgeon/base/precon';
import fs from 'fs';
import { createRequire } from 'module';
import * as r from 'restructure';
import zlib from 'zlib';
import { uint64le } from './restructure-helpers';
const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const { city64 } = require('bindings')('cityhash') as {
  city64: (s: string) => bigint;
};

const ScsArchiveHeader = new r.Struct({
  magic: new r.String(4),
  version: r.int16le,
  salt: r.int16le,
  hashMethod: new r.String(4),
  numEntries: r.int32le,
  entriesOffset: r.int32le,
});

const ScsArchiveEntryHeader = new r.Struct({
  hash: uint64le,
  // offset within the archive file at which the file for this entry's data starts.
  offset: uint64le,
  // bitfields can be referenced as entry.flags.isDirectory and entry.flags.isCompressed
  flags: new r.Bitfield(r.uint32le, ['isDirectory', 'isCompressed']),
  crc: r.uint32le,
  size: r.uint32le,
  compressedSize: r.uint32le,
});

export interface Store<V> {
  get(key: string): V | undefined;
}

export interface Entries {
  directories: Store<DirectoryEntry>;
  files: Store<FileEntry>;
}

export class ScsArchive {
  private readonly fd: number;
  private readonly header;
  private entries: Entries | undefined;

  constructor(readonly path: string) {
    this.fd = fs.openSync(path, 'r');

    const buffer = Buffer.alloc(ScsArchiveHeader.size());
    fs.readSync(this.fd, buffer, { length: buffer.length });
    this.header = ScsArchiveHeader.fromBuffer(buffer);
  }

  dispose() {
    fs.closeSync(this.fd);
  }

  isValid(): boolean {
    return (
      this.header.magic === 'SCS#' &&
      this.header.hashMethod === 'CITY' &&
      this.header.version === 1
    );
  }

  parseEntries(): Entries {
    Preconditions.checkState(this.isValid());
    if (this.entries) {
      return this.entries;
    }

    const buffer = Buffer.alloc(
      ScsArchiveEntryHeader.size() * this.header.numEntries,
    );
    fs.readSync(this.fd, buffer, {
      length: buffer.length,
      position: this.header.entriesOffset,
    });
    const headers = new r.Array(
      ScsArchiveEntryHeader,
      this.header.numEntries,
    ).fromBuffer(buffer);

    const directories: DirectoryEntry[] = [];
    const files: FileEntry[] = [];
    for (const header of headers) {
      const entry = createEntry(this.fd, {
        hash: header.hash,
        offset: header.offset,
        size: header.compressedSize,
        isDirectory: header.flags.isDirectory,
        isDataCompressed: header.flags.isCompressed,
      });
      if (entry.type === 'directory') {
        directories.push(entry);
      } else {
        files.push(entry);
      }
    }
    this.entries = {
      directories: createStore(directories),
      files: createStore(files),
    };
    return this.entries;
  }
}

function createStore<V extends { hash: bigint }>(values: V[]) {
  const map = new Map(values.map(v => [v.hash, v]));
  return {
    get: (key: string) => map.get(city64(key)),
  };
}

interface EntryMetadata {
  hash: bigint;
  offset: bigint;
  size: number;
  isDirectory: boolean;
  isDataCompressed: boolean;
}

function createEntry(
  fd: number,
  metadata: EntryMetadata,
): DirectoryEntry | FileEntry {
  return metadata.isDirectory
    ? new ScsArchiveDirectory(fd, metadata)
    : new ScsArchiveFile(fd, metadata);
}

export interface FileEntry {
  readonly type: 'file';
  readonly hash: bigint;

  read(): Buffer;
}

export interface DirectoryEntry {
  readonly type: 'directory';
  readonly hash: bigint;
  readonly subdirectories: readonly string[];
  readonly files: readonly string[];
}

abstract class ScsArchiveEntry {
  abstract type: string;

  protected constructor(
    protected readonly fd: number,
    protected readonly metadata: EntryMetadata,
  ) {}

  get hash(): bigint {
    return this.metadata.hash;
  }

  read() {
    const rawData = Buffer.alloc(this.metadata.size);
    fs.readSync(this.fd, rawData, {
      length: rawData.length,
      position: this.metadata.offset,
    });
    if (!this.metadata.isDataCompressed) {
      return rawData;
    }
    return zlib.inflateSync(rawData);
  }
}

class ScsArchiveFile extends ScsArchiveEntry implements FileEntry {
  readonly type = 'file';

  constructor(fd: number, metadata: EntryMetadata) {
    super(fd, metadata);
  }
}

class ScsArchiveDirectory extends ScsArchiveEntry implements DirectoryEntry {
  readonly type = 'directory';
  readonly subdirectories: readonly string[];
  readonly files: readonly string[];

  constructor(fd: number, metadata: EntryMetadata) {
    super(fd, metadata);

    const subdirectories: string[] = [];
    const files: string[] = [];
    for (const str of this.read().toString().split('\n')) {
      if (str === '') {
        continue;
      }
      if (str.startsWith('*')) {
        subdirectories.push(str.substring(1));
      } else {
        files.push(str);
      }
    }
    this.subdirectories = subdirectories;
    this.files = files;
  }
}
