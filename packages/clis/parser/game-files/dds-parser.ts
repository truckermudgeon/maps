import { assert } from '@truckermudgeon/base/assert';
import { decompressDXT5 } from 'dxtn';
import { PNG } from 'pngjs';
import * as r from 'restructure';
import { logger } from '../logger';

// https://learn.microsoft.com/en-us/windows/win32/direct3ddds/dx-graphics-dds-pguide
export const DdsHeader = new r.Struct({
  size: r.uint32le,
  flags: r.uint32le,
  height: r.uint32le,
  width: r.uint32le,
  pitchOrLinearSize: r.uint32le,
  depth: r.uint32le,
  mipMapCount: r.uint32le,
  reserved1: new r.Reserved(r.uint32le, 11),
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
  reserved2: new r.Reserved(r.uint32le, 1),
});
assert(DdsHeader.size() === 124);

export function parseDds(
  buffer: Buffer,
  sdfData: number[][] | undefined,
): Buffer {
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

    // TODO consider taking advantage of SDF and generate 2x larger PNGs.
    if (sdfData) {
      // not sure what the 0-th index is... dimensions + padding?
      const [, rColor, gColor, bColor, aColor] = sdfData;
      const smoothness = 0.1;
      const calcColor = (dist: number, rgba: number[]) => {
        return rgba.map(c => {
          const smoothed =
            smoothstep(0.5 - smoothness, 0.5 + smoothness, dist / 255) * 255;
          const gammaCorrected = clamp(Math.pow(c, 1 / 2.2), 0, 1);
          return clamp(smoothed * gammaCorrected, 0, 255);
        });
      };
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        const [r1, g1, b1, a1] = calcColor(r, rColor);
        const [r2, g2, b2, a2] = calcColor(g, gColor);
        const [r3, g3, b3, a3] = calcColor(b, bColor);
        const [r4, g4, b4, a4] = calcColor(a, aColor);

        data[i] = clamp(r1 + r2 + r3 + r4, 0, 255);
        data[i + 1] = clamp(g1 + g2 + g3 + g4, 0, 255);
        data[i + 2] = clamp(b1 + b2 + b3 + b4, 0, 255);
        data[i + 3] = clamp(a1 + a2 + a3 + a4, 0, 255);
      }
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

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  x = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}
