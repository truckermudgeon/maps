import { assertExists } from '@truckermudgeon/base/assert';
import { mapValues } from '@truckermudgeon/base/map';
import type {
  City,
  Country,
  ScopedCityFeature,
  ScopedCountryFeature,
} from '@truckermudgeon/map/types';
import path from 'path';
import type { Argv, BuilderArguments } from 'yargs';
import { createNormalizeFeature } from '../geo-json/normalize';
import { createIsoA2Map } from '../geo-json/populated-places';
import { logger } from '../logger';
import { readMapData } from '../mapped-data';
import { writeGeojsonFile } from '../write-geojson-file';
import { maybeEnsureOutputDir, untildify } from './path-helpers';

export const command = 'cities';
export const describe = 'Generates cities.geojson from map-parser JSON files';

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
      describe: 'Path to dir containing source {usa,europe}-cities.json file',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .option('outputDir', {
      alias: 'o',
      describe: 'Path to dir cities.geojson should be written to',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .check(maybeEnsureOutputDir);

export function handler(args: BuilderArguments<typeof builder>) {
  logger.log('creating cities.geojson...');

  const countryIsoA2 = createIsoA2Map();
  const withIsoA2Code = (c: Country) => ({
    ...c,
    code: countryIsoA2.get(c.code),
  });

  const cityAndCountryFeatures = [args.map].flat().flatMap(map => {
    const { countries: _countries, cities } = readMapData(args.inputDir, map, {
      mapDataKeys: ['countries', 'cities'],
    });
    const countries = mapValues(_countries, c =>
      map === 'europe' ? withIsoA2Code(c) : c,
    );

    const cityFeatures = cities.values().map(city => {
      if (city.countryToken.toLowerCase() !== city.countryToken) {
        logger.warn(
          'country token',
          city.countryToken,
          'for city',
          city.name,
          "isn't completely lowercase",
        );
      }
      const country = countries.get(city.countryToken.toLowerCase());
      if (!country) {
        throw new Error(`no country found for token ${city.countryToken}`);
      }
      return toCityFeature(map, country.code, city);
    });
    const countryFeatures = countries
      .values()
      .map(country => toCountryFeature(map, country));

    const normalizeFeature = createNormalizeFeature(map, 4);
    return [...cityFeatures, ...countryFeatures].map(normalizeFeature);
  });

  writeGeojsonFile(path.join(args.outputDir, 'cities.geojson'), {
    type: 'FeatureCollection',
    features: cityAndCountryFeatures,
  });
  logger.info(
    cityAndCountryFeatures.filter(f => f.properties.type === 'city').length,
    'cities',
  );
  logger.info(
    cityAndCountryFeatures.filter(f => f.properties.type === 'country').length,
    'states/countries',
  );
  logger.success('done.');
}

function toCityFeature(
  map: 'usa' | 'europe',
  countryCode: string,
  city: City,
): ScopedCityFeature {
  const toCoords = (c: City) => {
    const cityArea = assertExists(c.areas.find(a => !a.hidden));
    return [c.x + cityArea.width / 2, c.y + cityArea.height / 2];
  };

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: toCoords(city),
    },
    properties: {
      type: 'city',
      map,
      countryCode,
      name: city.name,
    },
  };
}

function toCountryFeature(
  map: 'usa' | 'europe',
  country: Country,
): ScopedCountryFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [country.x, country.y],
    },
    properties: {
      type: 'country',
      map,
      code: country.code,
      name: country.name,
    },
  };
}
