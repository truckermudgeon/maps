import { assert, assertExists } from '@truckermudgeon/base/assert';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import fs from 'fs';
import { createRequire } from 'module';
import type { BaseOf } from 'restructure';
import * as r from 'restructure';
import zlib from 'zlib';
import { logger } from '../logger';
import { DdsHeader } from './dds-parser';
import { MappedNumber, uint64le } from './restructure-helpers';
const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const { city64 } = require('bindings')('cityhash') as {
  city64: (s: string) => bigint;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const { gdeflate } = require('bindings')('gdeflate') as {
  gdeflate: (inBuffer: ArrayBuffer, outBuffer: ArrayBuffer) => number;
};

const FileHeader = new r.Struct({
  magic: new r.String(4),
  version: r.int16le,
  salt: r.int16le,
  hashMethod: new r.String(4),
  entryTableCount: r.uint32le,
  entryTableCompressedSize: r.uint32le,
  metadataTableSize: r.uint32le,
  metadataTableCompressedSize: r.uint32le,
  entryTableOffset: uint64le,
  metadataTableOffset: uint64le,
  securityDescriptorOffset: uint64le,
  hashfsV2Platform: r.uint8,
});

const EntryHeader = new r.Struct({
  hash: uint64le,
  metadataIndex: r.uint32le,
  metadataCount: r.uint16le,
  flags: new r.Bitfield(r.uint8, ['isDirectory']),
  someByte: r.uint8,
});

export const enum MetadataType {
  IMG = 1,
  SAMPLE = 2,
  MIP_PROXY,
  INLINE_DIRECTORY = 4,
  PMA_INFO = 5,
  PMG_INFO = 6,
  PLAIN = 1 << 7,
  DIRECTORY = MetadataType.PLAIN | 1,
  MIP_0 = MetadataType.PLAIN | 2,
  MIP_1 = MetadataType.PLAIN | 3,
  MIP_TAIL = MetadataType.PLAIN | 4,
}

const enum Compression {
  NONE = 0,
  ZLIB = 1,
  ZLIB_HEADERLESS = 2,
  GDEFLATE = 3,
  ZSTD = 4,
}

const toCompression = (compression: number) => {
  switch (compression) {
    case 0:
      return Compression.NONE;
    case 1:
      return Compression.ZLIB;
    case 2:
      return Compression.ZLIB_HEADERLESS;
    case 3:
      return Compression.GDEFLATE;
    case 4:
      return Compression.ZSTD;
    default:
      throw new Error('unknown compression value: ' + compression);
  }
};

// MetadataEntryHeader::type === MetadataType.IMG
const ImageMeta = new r.Struct({
  width: new MappedNumber(r.uint16le, n => n + 1),
  height: new MappedNumber(r.uint16le, n => n + 1),
  image: new MappedNumber(r.uint32le, n => ({
    mipmapCount: 1 + (n & 0xf),
    format: (n >> 4) & 0xff,
    isCube: ((n >> 12) & 0b11) !== 0,
    count: ((n >> 14) & 0b11_1111) + 1,
    pitchAlignment: 1 << ((n >> 20) & 0b1111),
    imageAlignment: 1 << ((n >> 24) & 0b1111),
  })),
}); // 8 bytes

// MetadataEntryHeader::type === MetadataType.SAMPLE
const SampleMeta = new r.Struct({
  sample: new MappedNumber(r.uint32le, n => ({
    magFilter: n & 0b1, // 0 = nearest, 1 = linear
    minFilter: (n >> 1) & 0b1, // 0 = nearest, 1 = linear
    mipFilter: (n >> 2) & 0b11, // 0 = nearest, 1 = trilinear, 2 = nomips
    addr: {
      u: (n >> 4) & 0b111,
      v: (n >> 7) & 0b111,
      w: (n >> 10) & 0b111,
    },
  })),
}); // 4 bytes

// MetadataEntryHeader::type === MetadataType.PMA_INFO
const PmaInfoMeta = new r.Struct({
  flag: r.uint32le,
  animationLength: r.floatle,
  skeletonHash: uint64le,
  bSphereRad: r.floatle,
  bSphereOrgX: r.floatle,
  bSphereOrgY: r.floatle,
  bSphereOrgZ: r.floatle,
}); // 32 bytes

// MetadataEntryHeader::type === MetadataType.PMG_INFO
const PmgInfoMeta = new r.Struct({
  skeletonHash: uint64le,
}); // 8 bytes

// MetadataEntryHeader::type & MetadataType.PLAIN
const PlainMeta = new r.Struct({
  compressedSize: r.uint24le,
  compression: new MappedNumber(r.uint8, n => toCompression(n >> 4)),
  size: r.uint24le,
  _padding: new r.Reserved(r.uint8, 1),
  _unknown: new r.Reserved(r.uint32le, 1),
  offset: new MappedNumber(r.uint32le, n => BigInt(n) * 16n),
}); // 16 bytes

type MetadataEntry = { version: MetadataType } & (
  | BaseOf<typeof ImageMeta>
  | BaseOf<typeof SampleMeta>
  | BaseOf<typeof PlainMeta>
  | BaseOf<typeof PmaInfoMeta>
  | BaseOf<typeof PmgInfoMeta>
);

const MetadataEntryHeader = new r.Struct({
  index: r.uint24le,
  type: r.uint8,
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

    const buffer = Buffer.alloc(FileHeader.size());
    fs.readSync(this.fd, buffer, { length: buffer.length });
    this.header = FileHeader.fromBuffer(buffer);
  }

  dispose() {
    fs.closeSync(this.fd);
  }

  isValid(): boolean {
    return (
      this.header.magic === 'SCS#' &&
      this.header.hashMethod === 'CITY' &&
      this.header.version === 2
    );
  }

  parseEntries(): Entries {
    Preconditions.checkState(this.isValid());
    if (this.entries) {
      return this.entries;
    }

    const entryHeaders = new r.Array(
      EntryHeader,
      this.header.entryTableCount,
    ).fromBuffer(
      this.readData({
        offset: this.header.entryTableOffset,
        compressedSize: this.header.entryTableCompressedSize,
        uncompressedSize: EntryHeader.size() * this.header.entryTableCount,
      }),
    );
    const metadataMap = this.createMetadataMap(entryHeaders);

    const directories: DirectoryEntry[] = [];
    const files: FileEntry[] = [];
    for (const header of entryHeaders) {
      const entry = createEntry(this.fd, header, metadataMap);
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

  private createMetadataMap(
    entryHeaders: BaseOf<typeof EntryHeader>[],
  ): Map<number, MetadataEntry> {
    const metadataMap = new Map<number, MetadataEntry>();

    const metadataTable = this.readData({
      offset: this.header.metadataTableOffset,
      compressedSize: this.header.metadataTableCompressedSize,
      uncompressedSize: this.header.metadataTableSize,
    });
    const skippedMetaTypes = new Set();
    for (const header of entryHeaders) {
      for (let i = 0; i < header.metadataCount; i++) {
        const metadataHeaderByteOffset = 4 * (header.metadataIndex + i);
        const metadataHeader = MetadataEntryHeader.fromBuffer(
          metadataTable.subarray(
            metadataHeaderByteOffset,
            metadataHeaderByteOffset + MetadataEntryHeader.size(),
          ),
        );
        const type = metadataHeader.type as MetadataType;
        switch (type) {
          case MetadataType.IMG:
          case MetadataType.SAMPLE:
          case MetadataType.PLAIN:
          case MetadataType.DIRECTORY:
          case MetadataType.MIP_TAIL:
          case MetadataType.PMA_INFO:
          case MetadataType.PMG_INFO: {
            let descriptor;
            if (type === MetadataType.IMG) {
              descriptor = ImageMeta;
            } else if (type === MetadataType.SAMPLE) {
              descriptor = SampleMeta;
            } else if (type === MetadataType.PMA_INFO) {
              descriptor = PmaInfoMeta;
            } else if (type === MetadataType.PMG_INFO) {
              descriptor = PmgInfoMeta;
            } else {
              descriptor = PlainMeta;
            }
            const metadataEntryByteOffset = 4 * metadataHeader.index;
            metadataMap.set(header.metadataIndex + i, {
              version: metadataHeader.type,
              ...descriptor.fromBuffer(
                metadataTable.subarray(
                  metadataEntryByteOffset,
                  metadataEntryByteOffset + descriptor.size(),
                ),
              ),
            });
            break;
          }
          case MetadataType.MIP_0:
          case MetadataType.MIP_1:
          case MetadataType.MIP_PROXY:
          case MetadataType.INLINE_DIRECTORY:
            skippedMetaTypes.add(metadataHeader.type);
            break;
          default:
            throw new UnreachableError(type);
        }
      }
    }
    if (skippedMetaTypes.size) {
      logger.warn('skipped metadata types', skippedMetaTypes);
    }

    return metadataMap;
  }

  private readData({
    offset,
    compressedSize,
    uncompressedSize,
  }: {
    offset: bigint;
    compressedSize: number;
    uncompressedSize: number;
  }): Buffer {
    const buffer = Buffer.alloc(compressedSize);
    fs.readSync(this.fd, buffer, {
      length: buffer.length,
      position: offset,
    });
    return compressedSize !== uncompressedSize
      ? zlib.inflateSync(buffer)
      : buffer;
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
  compressedSize: number;
  uncompressedSize: number;
  compression: Compression;
  isDirectory: boolean;
}

function createEntry(
  fd: number,
  header: BaseOf<typeof EntryHeader>,
  metadataMap: Map<number, MetadataEntry>,
): DirectoryEntry | FileEntry {
  if (header.metadataCount === 3) {
    return createTobjEntry(fd, header, metadataMap);
  }

  if (header.metadataCount === 2) {
    const metas = [
      assertExists(metadataMap.get(header.metadataIndex)),
      assertExists(metadataMap.get(header.metadataIndex + 1)),
    ];
    assert(metas[0].version === MetadataType.PLAIN);
    // the only entries expected to have two pieces of metadata are PMA and PMG
    // entries info. don't do anything with the metadata for now... treat PMx
    // entries as regular files.
    assert(
      metas[1].version === MetadataType.PMA_INFO ||
        metas[1].version === MetadataType.PMG_INFO,
    );
  } else {
    assert(header.metadataCount === 1);
  }

  const assocMetadata = assertExists(metadataMap.get(header.metadataIndex));
  if (header.flags.isDirectory) {
    assert(
      assocMetadata.version === MetadataType.DIRECTORY,
      `assocMetadata.version ${assocMetadata.version} isn't DIRECTORY`,
    );
  }

  assert(
    assocMetadata.version === MetadataType.PLAIN ||
      assocMetadata.version === MetadataType.DIRECTORY,
  );
  const plainMeta = assocMetadata as BaseOf<typeof PlainMeta>;
  const metadata = {
    hash: header.hash,
    offset: plainMeta.offset,
    compressedSize: plainMeta.compressedSize,
    uncompressedSize: plainMeta.size,
    compression: plainMeta.compression,
    isDirectory: header.flags.isDirectory,
  };

  return metadata.isDirectory
    ? new ScsArchiveDirectory(fd, metadata)
    : new ScsArchiveFile(fd, metadata);
}

function createTobjEntry(
  fd: number,
  header: BaseOf<typeof EntryHeader>,
  metadataMap: Map<number, MetadataEntry>,
): FileEntry {
  Preconditions.checkArgument(
    !header.flags.isDirectory && header.metadataCount === 3,
  );
  const metas = [
    assertExists(metadataMap.get(header.metadataIndex)),
    assertExists(metadataMap.get(header.metadataIndex + 1)),
    assertExists(metadataMap.get(header.metadataIndex + 2)),
  ];
  const imageMeta = assertExists(
    metas.find(m => m.version === MetadataType.IMG),
  ) as BaseOf<typeof ImageMeta>;
  // SampleMeta isn't used by `parser`, but check for it anyway Just In Case™
  assertExists(metas.find(m => m.version === MetadataType.SAMPLE)) as BaseOf<
    typeof SampleMeta
  >;
  const plainMeta = assertExists(
    metas.find(m => m.version === MetadataType.MIP_TAIL),
  ) as BaseOf<typeof PlainMeta>;

  return new ScsArchiveTobjFile(
    fd,
    {
      hash: header.hash,
      offset: plainMeta.offset,
      compressedSize: plainMeta.compressedSize,
      uncompressedSize: plainMeta.size,
      compression: plainMeta.compression,
      isDirectory: header.flags.isDirectory,
    },
    imageMeta,
  );
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

const TileStreamHeader = new r.Struct({
  id: r.uint8,
  magic: r.uint8,
  numTiles: r.uint16le,
  tileSizeIdx: r.uint32le,
  lastTileSize: r.uint32le,
});

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
    const rawData = Buffer.alloc(this.metadata.compressedSize);
    const bytesRead = fs.readSync(this.fd, rawData, {
      length: rawData.length,
      position: this.metadata.offset,
    });
    assert(bytesRead === rawData.length);
    switch (this.metadata.compression) {
      case Compression.NONE:
        return rawData;
      case Compression.ZLIB:
        return zlib.inflateSync(rawData);
      case Compression.GDEFLATE: {
        const outputBuffer = Buffer.alloc(this.metadata.uncompressedSize);
        const result = gdeflate(
          rawData.buffer.slice(TileStreamHeader.size()),
          outputBuffer.buffer,
        );
        if (result !== 0) {
          throw new Error(`gdeflate error: ${result}`);
        }
        return outputBuffer;
      }
      case Compression.ZLIB_HEADERLESS:
      case Compression.ZSTD:
      default:
        throw new Error(
          `unsupported compression type ${this.metadata.compression}`,
        );
    }
  }
}

class ScsArchiveFile extends ScsArchiveEntry implements FileEntry {
  readonly type = 'file';

  constructor(fd: number, metadata: EntryMetadata) {
    super(fd, metadata);
  }
}

class ScsArchiveTobjFile extends ScsArchiveFile {
  constructor(
    fd: number,
    metadata: EntryMetadata,
    private readonly imageMetadata: BaseOf<typeof ImageMeta>,
  ) {
    super(fd, metadata);
  }

  override read() {
    const imageMeta = this.imageMetadata.image;
    const imageFormat = imageMeta.format;

    let ddsBytes: Buffer;
    let { width, height } = this.imageMetadata;
    if (imageFormat === 78) {
      // BC3_UNORM_SRGB
      const firstMipmapBytes = width * height;
      ddsBytes = super.read().subarray(0, firstMipmapBytes);
    } else if (imageFormat === 91 || imageFormat === 88) {
      // 91: B8G8R8A8_UNORM_SRGB
      // 88: B8G8R8X8_UNORM

      // fudge widths/heights. seems to fix problem with ETS2's sr_e763 icon.
      width = closestPowerOf2(this.imageMetadata.width);
      height = closestPowerOf2(this.imageMetadata.height);

      ddsBytes = Buffer.alloc(4 * width * height);
      const rawData = super.read();
      // Is there a nicer way to figure out pitch?
      const factor = Math.ceil(rawData.length / ddsBytes.length);
      for (let i = 0; i < height; i++) {
        if (i * 4 * width * factor > rawData.length) {
          // some image data seems to be incomplete, or pitch is
          // incorrect. abort copying of image data instead of erroring out.
          break;
        }
        rawData.copy(
          ddsBytes,
          i * 4 * width,
          i * 4 * width * factor,
          (i + 1) * 4 * width * factor,
        );
      }
    } else {
      throw new Error('unknown image format ' + imageFormat);
    }

    // Values here are the bare minimum to get DDS via parseDds to work.
    const header = Buffer.from(
      DdsHeader.toBuffer({
        size: DdsHeader.size(),
        flags: 0,
        height,
        width,
        pitchOrLinearSize: ddsBytes.length,
        depth: 0,
        mipMapCount: imageMeta.mipmapCount,
        reserved1: undefined,
        ddsPixelFormat: {
          size: 32,
          flags: 0,
          // this looks like the only field of import.
          fourCc:
            imageFormat === 91 || imageFormat === 88
              ? '\x00\x00\x00\x00'
              : 'DXT5',
          rgbBitCount: 0,
          rBitMask: 0,
          gBitMask: 0,
          bBitMask: 0,
          aBitMask: 0,
        },
        caps: 0,
        caps2: 0,
        caps3: 0,
        caps4: 0,
        reserved2: undefined,
      }),
    );

    const ddsFile = Buffer.alloc(
      4 + // magic
        DdsHeader.size() +
        ddsBytes.length,
    );

    ddsFile.write('DDS ');
    header.copy(ddsFile, 4);
    ddsBytes.copy(ddsFile, 4 + DdsHeader.size());

    return ddsFile;
  }
}

function closestPowerOf2(n: number): number {
  const lg = Math.floor(Math.log2(n));
  return Math.pow(2, lg);
}

class ScsArchiveDirectory extends ScsArchiveEntry implements DirectoryEntry {
  readonly type = 'directory';
  readonly subdirectories: readonly string[];
  readonly files: readonly string[];

  constructor(fd: number, metadata: EntryMetadata) {
    super(fd, metadata);

    const reader = new r.DecodeStream(this.read());
    const numStrings = reader.readBuffer(4).readUInt32LE();
    const stringLengths = reader.readBuffer(numStrings).values();

    const subdirectories: string[] = [];
    const files: string[] = [];
    for (const stringLength of stringLengths) {
      const str = reader.readBuffer(stringLength).toString();
      if (str.startsWith('/')) {
        subdirectories.push(str.substring(1));
      } else {
        files.push(str);
      }
    }
    this.subdirectories = subdirectories;
    this.files = files;
  }
}
