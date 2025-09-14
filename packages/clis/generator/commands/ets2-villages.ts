import fs from 'fs';
import type { GeoJSON } from 'geojson';
import path from 'path';
import type { Argv, BuilderArguments } from 'yargs';
import { createNormalizeFeature } from '../geo-json/normalize';
import { getCitiesByCountryIsoA2 } from '../geo-json/populated-places';
import { logger } from '../logger';
import { writeGeojsonFile } from '../write-geojson-file';
import { maybeEnsureOutputDir, resourcesDir, untildify } from './path-helpers';

export const command = 'ets2-villages';
export const describe =
  "Generates ets2-villages.geojson from krmarci's CSV file";

export const builder = (yargs: Argv) =>
  yargs
    .option('outputDir', {
      alias: 'o',
      describe: 'Path to dir ets2-villages.geojson should be written to',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .check(maybeEnsureOutputDir);

export function parseEts2VillagesCsv() {
  const validCountryCodes = new Set(getCitiesByCountryIsoA2().keys());
  const villagesCsvLines = fs
    .readFileSync(path.join(resourcesDir, 'villages-in-ets2.csv'), 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '');

  // sanity check
  // name;countryCode;xCoord;yCoord;zCoord;notes
  const headers = villagesCsvLines[0].split(';');
  if (
    headers[0] !== 'name' ||
    headers[1] !== 'countryCode' ||
    headers[2] !== 'xCoord' ||
    headers[4] !== 'zCoord' ||
    headers[5] !== 'notes'
  ) {
    throw new Error('unexpected headers in villages CSV file');
  }

  let ignoreCount = 0;
  const villages: { x: number; y: number; state: string; name: string }[] = [];
  for (const line of villagesCsvLines.slice(1)) {
    const [name, countryCode, x, , y, notes] = line
      .split(';')
      .map(col => col.trim());
    if (!validCountryCodes.has(countryCode)) {
      logger.warn(
        'ignoring',
        name,
        'because of unknown country code',
        countryCode,
      );
      ignoreCount++;
      continue;
    }
    switch (notes) {
      case 'HoR':
        // skipping heart of russia villages until DLC is released
        ignoreCount++;
        continue;
      case 'inaccessible':
      case '':
        // safe to ignore
        break;
      default:
        logger.warn('ignoring note:', notes);
        break;
    }
    villages.push({
      x: parseFloat(x),
      y: parseFloat(y),
      state: countryCode,
      name,
    });
  }

  return { villages, ignoreCount };
}

export function handler(args: BuilderArguments<typeof builder>) {
  logger.log('creating ets2-villages.geojson...');
  const normalizeFeature = createNormalizeFeature('europe', 4);

  const { villages, ignoreCount } = parseEts2VillagesCsv();

  const points: GeoJSON.Feature<
    GeoJSON.Point,
    { state: string; name: string }
  >[] = villages.map(v => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [v.x, v.y],
    },
    properties: {
      state: v.state,
      name: v.name,
    },
  }));

  const featureCollection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: points.map(f => normalizeFeature(f)),
  };
  writeGeojsonFile(
    path.join(args.outputDir, 'ets2-villages.geojson'),
    featureCollection,
  );
  logger.info(featureCollection.features.length, 'villages written');
  logger.info(ignoreCount, 'villages ignored');
  logger.success('done.');
}
