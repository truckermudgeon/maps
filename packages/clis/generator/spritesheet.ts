import type { Poi } from '@truckermudgeon/parser';
import fs from 'fs';
import path from 'path';
import Spritesmith from 'spritesmith';
import { logger } from './logger';

interface SpriteLocation {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelRatio: number;
}

export async function createSpritesheet(
  pois: readonly Poi[],
  inputDir: string,
  resourcesDir: string,
) {
  // Notes:
  //   'dot.png' is a manually-created 20x20 off-white dot outlined in off-black
  //   'dotdot.png' is the above, but with a dot in the middle.
  const resourcesPaths = [
    path.join(resourcesDir, 'dot.png'),
    path.join(resourcesDir, 'dotdot.png'),
  ];
  const poiPngPaths = [...new Set(pois.map(o => o.icon))].map(name =>
    path.join(inputDir, 'icons', name + '.png'),
  );
  const allPngs = [...resourcesPaths, ...poiPngPaths];
  const missingPngs = allPngs.filter(p => !fs.existsSync(p));
  if (missingPngs.length) {
    logger.error('missing png files', missingPngs);
    throw new Error();
  }

  logger.info('sprites', allPngs.length);
  return new Promise<{
    image: Buffer;
    coordinates: Record<string, SpriteLocation>;
  }>(resolve => {
    Spritesmith.run(
      { src: allPngs },
      (_, { image, coordinates: coordsRaw, properties }) => {
        logger.info('spritesheet size:', properties);
        const coordinates = Object.entries(coordsRaw).reduce<
          Record<string, SpriteLocation>
        >((acc, [key, loc]) => {
          acc[path.parse(key).name] = { ...loc, pixelRatio: 2 };
          return acc;
        }, {});
        resolve({ image, coordinates });
      },
    );
  });
}
