import { assert } from '@truckermudgeon/base/assert';
import type { Poi } from '@truckermudgeon/map/types';
import pack from 'bin-pack';
import fs from 'fs';
import type { JimpInstance } from 'jimp';
import { Jimp } from 'jimp';
import os from 'node:os';
import path from 'path';
import type { Argv, BuilderArguments } from 'yargs';
import { logger } from '../logger';
import { readMapData } from '../mapped-data';
import { maybeEnsureOutputDir, resourcesDir, untildify } from './path-helpers';

export const command = 'spritesheet';
export const describe =
  'Generates maplibre spritesheet files from map-parser JSON and PNG files';

export const builder = (yargs: Argv) =>
  yargs
    .option('map', {
      alias: 'm',
      describe:
        'Source map.\nSpecify multiple source maps with multiple -m arguments.',
      choices: ['usa', 'europe'] as const,
      default: ['usa'] as ('usa' | 'europe')[],
      defaultDescription: 'usa',
    })
    .option('inputDir', {
      alias: 'i',
      describe:
        'Path to dir containing {usa,europe}-poi.json files and icon directory',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .option('outputDir', {
      alias: 'o',
      describe:
        'Path to dir sprites(@2x).{json,png} files should be written to',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .option('dryRun', {
      describe: "Don't write out any files.",
      type: 'boolean',
      default: false,
    })
    .check(maybeEnsureOutputDir);

export async function handler(args: BuilderArguments<typeof builder>) {
  logger.log('creating overlays spritesheet...');
  const pois: Poi[] = [args.map].flat().flatMap(
    map =>
      readMapData(args.inputDir, map, {
        mapDataKeys: ['pois'],
      }).pois,
  );
  const { image, coordinates } = await createSpritesheet(
    pois,
    args.inputDir,
    resourcesDir,
  );
  if (!args.dryRun) {
    logger.log('writing sprites(@2x).{json,png}...');
    // TODO downscale png to make a proper 1x spritesheet.
    fs.writeFileSync(path.join(args.outputDir, 'sprites.png'), image);
    fs.writeFileSync(path.join(args.outputDir, 'sprites@2x.png'), image);
    fs.writeFileSync(
      path.join(args.outputDir, 'sprites.json'),
      JSON.stringify(coordinates, null, 2),
    );
    fs.writeFileSync(
      path.join(args.outputDir, 'sprites@2x.json'),
      JSON.stringify(coordinates, null, 2),
    );
  }
  logger.success('done.');
}

interface SpriteLocation {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelRatio: number;
}

async function createSpritesheet(
  pois: readonly Poi[],
  inputDir: string,
  resourcesDir: string,
): Promise<{
  image: Buffer;
  coordinates: Record<string, SpriteLocation>;
}> {
  // Notes:
  //   'dot.png' is a manually-created 20x20 off-white dot outlined in off-black
  //   'dotdot.png' is the above, but with a dot in the middle.
  const resourcesPaths = [
    path.join(resourcesDir, 'dot.png'),
    path.join(resourcesDir, 'dotdot.png'),
    path.join(resourcesDir, 'roadwork.png'),
    path.join(resourcesDir, 'railcrossing.png'),
    path.join(resourcesDir, 'triangle.png'),
    path.join(resourcesDir, 'stopsign.png'),
    path.join(resourcesDir, 'trafficlight.png'),
  ];
  const poiPngPaths = [...new Set(pois.map(o => o.icon))].map(name =>
    path.join(inputDir, 'icons', name + '.png'),
  );
  const origPngs = [...resourcesPaths, ...poiPngPaths];
  const missingPngs = origPngs.filter(p => !fs.existsSync(p));
  if (missingPngs.length) {
    logger.error('missing png files', missingPngs);
    throw new Error();
  }

  logger.log('preprocessing', origPngs.length, 'pngs...');
  const { allPngs, preprocessedPngs } = await preprocessPngs(origPngs);

  logger.log('arranging sprites...');
  const { width, height, items } = pack(allPngs);
  logger.info('spritesheet size:', { width, height });
  const sheet: JimpInstance = new Jimp({ width, height });
  const coordinates: Record<string, SpriteLocation> = {};
  for (const { x, y, width, height, item } of items) {
    const sprite = await Jimp.read(item.path);
    sheet.blit({ src: sprite, x, y });
    coordinates[path.parse(item.path).name] = {
      x,
      y,
      width,
      height,
      pixelRatio: 2,
    };
  }

  logger.log('cleaning up temporary sprites...');
  preprocessedPngs.forEach(png => fs.rmSync(png.path));

  return {
    image: await sheet.getBuffer('image/png'),
    coordinates,
  };
}

interface Png {
  path: string;
  width: number;
  height: number;
}

async function preprocessPngs(pngPaths: string[]): Promise<{
  allPngs: Png[];
  preprocessedPngs: Png[];
}> {
  const allPngs: Png[] = [];
  const preprocessedPngs: Png[] = [];

  const shrank = new Set<string>();
  const bordered = new Set<string>();
  await Promise.all(
    pngPaths.map(async pngPath => {
      const basename = path.basename(pngPath);
      const image: JimpInstance = (await Jimp.read(pngPath)) as JimpInstance;
      let modified = false;
      const probablyRoadShield =
        image.width === image.height && image.width >= 64;
      // probably an over-sized road shield, like the colorado ones.
      if (
        // make sure triangle.png isn't automatically bordered, because it's
        // only used for route-step arrow heads (and it's auto-bordered there).
        basename !== 'triangle.png' &&
        probablyRoadShield &&
        image.width > 64
      ) {
        image.resize({ w: 64 });
        shrank.add(basename.replace('.png', ''));
        modified = true;
      }
      if (probablyRoadShield && isProbablyWhiteFill(image.bitmap)) {
        addBorder(image);
        bordered.add(basename.replace('.png', ''));
        modified = true;
      }
      if (!modified) {
        const { width, height } = image;
        image.autocrop();
        if (width !== image.width || height !== image.height) {
          modified = true;
        }
      }

      if (modified) {
        const tmpFilePath = path.join(os.tmpdir(), basename);
        assert(tmpFilePath.endsWith('.png'));
        await image.write(tmpFilePath as `${string}.png`);
        const png = {
          path: tmpFilePath,
          width: image.width,
          height: image.height,
        };
        allPngs.push(png);
        preprocessedPngs.push(png);
      } else {
        allPngs.push({
          path: pngPath,
          width: image.width,
          height: image.height,
        });
      }
    }),
  );
  if (shrank.size) {
    logger.info(shrank.size, 'pngs shrank:', [...shrank].sort().join(' '));
  }
  if (bordered.size) {
    logger.info(
      bordered.size,
      'pngs bordered:',
      [...bordered].sort().join(' '),
    );
  }

  return {
    allPngs,
    preprocessedPngs,
  };
}

function isProbablyWhiteFill({
  data,
  width,
  height,
}: {
  data: Buffer;
  width: number;
  height: number;
}) {
  const bytesPerRow = width * 4;
  const midX = Math.round(width / 2) * 4;

  // extract the center vertical line of `bitmap`'s _non-transparent_ pixels.
  const verticalCenterLinePixels = [];
  for (let i = 0; i < height; i++) {
    const pixel = data.readUint32BE(i * bytesPerRow + midX);
    if ((pixel & 0xff) === 0xff) {
      verticalCenterLinePixels.push(pixel);
    }
  }
  // an image probably has a white fill if the 4 pixels at either end of the
  // vertical line are all white.
  return (
    verticalCenterLinePixels.slice(0, 4).every(pixel => pixel === 0xffffffff) ||
    verticalCenterLinePixels.slice(0, -4).every(pixel => pixel === 0xffffffff)
  );
}

function addBorder(image: JimpInstance) {
  const original = image.clone();
  const mask = image.clone();

  // create a black mask by blacking out all of `image`'s pixels...
  mask.scan(0, 0, mask.bitmap.width, mask.bitmap.height, (_x, _y, i) => {
    mask.bitmap.data[i] = 0x00;
    mask.bitmap.data[i + 1] = 0x00;
    mask.bitmap.data[i + 2] = 0x00;
  });
  // ...and "expand" it by blitting it in a one-pixel ring around its origin
  // (this yields better results than simply enlarging it by 1-2 pixels).
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      image.composite(mask, x, y);
    }
  }

  // slightly shrink the original image...
  original.resize({ w: image.width - 2, h: image.height - 2 });
  // ...and blit it on top of the mask.
  image.composite(original, 1, 1);
}
