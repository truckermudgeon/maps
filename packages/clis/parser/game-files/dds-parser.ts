import { decompressDXT5 } from 'dxtn';
import { PNG } from 'pngjs';
import * as r from 'restructure';
import { logger } from '../logger';

// https://learn.microsoft.com/en-us/windows/win32/direct3ddds/dx-graphics-dds-pguide
const DdsHeader = new r.Struct({
  size: r.uint32le,
  flags: r.uint32le,
  height: r.uint32le,
  width: r.uint32le,
  pitchOrLinearSize: r.uint32le,
  depth: r.uint32le,
  mipMapCount: r.uint32le,
  reserved1: new r.Array(r.uint32le, 11),
  ddsPixelFormat: new r.Struct({
    size: r.uint32le,
    flags: r.uint32le,
    fourCc: new r.String(4),
    rgbBitCount: r.uint32le,
    rBitMask: r.uint32le,
    gBitMask: r.uint32le,
    bBitMask: r.uint32le,
    aBitMask: r.uint32le,
  }),
  caps: r.uint32le,
  caps2: r.uint32le,
  caps3: r.uint32le,
  caps4: r.uint32le,
  reserved2: r.uint32le,
});

export function parseDds(buffer: Buffer): Buffer {
  const magic = buffer.toString('utf8', 0, 4);
  if (magic !== 'DDS ') {
    logger.error("doesn't look like a .dds file");
    throw new Error();
  }
  const header = DdsHeader.fromBuffer(buffer.slice(4, 128));
  if (header.size !== 124) {
    logger.error('invalid .dds file length', header.size);
    throw new Error();
  }

  const data = buffer.slice(128);
  const png = new PNG({
    width: header.width,
    height: header.height,
  });

  if (header.ddsPixelFormat.fourCc === '\x00\x00\x00\x00') {
    // a zero fourcc code indicates uncompressed BGRA data.
    // swap B and R because `png.data` expects RGBA data.
    for (let i = 0; i < data.length; i += 4) {
      const b = data[i];
      data[i] = data[i + 2]; // b = r
      data[i + 2] = b; // r = b
    }

    png.data = data;
  } else if (header.ddsPixelFormat.fourCc === 'DXT5') {
    png.data = decompressDXT5(
      header.width,
      header.height,
      // not sure why i have to do this. extra/dummy/misread data?
      data.slice(0, header.pitchOrLinearSize),
    ) as Buffer;
  } else {
    logger.error('unsupported pixel format', header.ddsPixelFormat.fourCc);
    throw new Error();
  }
  return PNG.sync.write(png);
}
