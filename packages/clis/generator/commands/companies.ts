import { assertExists } from '@truckermudgeon/base/assert';
import { distance } from '@truckermudgeon/base/geom';
import type { CompanyFeature, CompanyItem } from '@truckermudgeon/map/types';
import * as turf from '@turf/helpers';
import type { Quadtree } from 'd3-quadtree';
import { quadtree } from 'd3-quadtree';
import path from 'path';
import type { Argv, BuilderArguments } from 'yargs';
import { dlcGuardMapDataKeys, normalizeDlcGuards } from '../dlc-guards';
import { createNormalizeFeature } from '../geo-json/normalize';
import { createIsoA2Map } from '../geo-json/populated-places';
import { logger } from '../logger';
import type { MappedDataForKeys } from '../mapped-data';
import { readMapData } from '../mapped-data';
import { writeGeojsonFile } from '../write-geojson-file';
import { maybeEnsureOutputDir, untildify } from './path-helpers';

export const command = 'companies';
export const describe =
  'Generates companies.geojson from map-parser JSON files';

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
      describe: 'Path to dir containing parser-generated JSON files',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .option('outputDir', {
      alias: 'o',
      describe: 'Path to dir companies.geojson should be written to',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .check(maybeEnsureOutputDir);

interface QtCompanyEntry {
  x: number;
  y: number;
  // company token
  icon: string;
  label: string;
}

export function handler(args: BuilderArguments<typeof builder>) {
  logger.log('creating companies.geojson...');

  // map of city,country,company tokens to names
  const tokenLut: Record<string, string> = {};
  const countryIsoA2 = createIsoA2Map();
  const companyFeatures = [args.map].flat().flatMap(map => {
    const { companies, pois, ...context } = normalizeDlcGuards(
      readMapData(args.inputDir, map, {
        mapDataKeys: [
          'companies',
          'pois',
          'cities',
          'countries',
          'prefabs',
          ...dlcGuardMapDataKeys,
        ],
      }),
    );

    const mapCountryCode = (code: string) =>
      map === 'europe' ? countryIsoA2.get(code) : code;

    for (const city of context.cities.values()) {
      tokenLut[city.token] = city.name;
    }
    for (const country of context.countries.values()) {
      tokenLut[mapCountryCode(country.code)] = country.name;
    }

    // a quadtree of company POIs, which is the source of truth for positional
    // information for rendering a CompanyItem's logo on a map.
    const companyQuadtree = quadtree<QtCompanyEntry>()
      .x(e => e.x)
      .y(e => e.y);
    for (const p of pois) {
      if (p.type === 'company') {
        companyQuadtree.add(p);
        tokenLut[p.icon] = p.label;
      }
    }

    const companyFeatures = companies
      .values()
      .filter(c => {
        if (!context.cities.has(c.cityToken)) {
          logger.warn('ignoring', c.token, 'in unknown city', c.cityToken);
          return false;
        }
        return true;
      })
      .map(c =>
        toCompanyFeature(c, { ...context, companyQuadtree, mapCountryCode }),
      )
      .toArray();

    const normalizeFeature = createNormalizeFeature(map, 4);
    return companyFeatures.map(normalizeFeature);
  });

  writeGeojsonFile(path.join(args.outputDir, 'companies.geojson'), {
    type: 'FeatureCollection',
    features: companyFeatures,
    properties: { tokenLut },
  });
  logger.info(
    companyFeatures.length,
    'depots',
    'for',
    new Set(companyFeatures.map(f => f.properties.token)).size,
    'companies',
  );
  logger.success('done.');
}

function toCompanyFeature(
  company: CompanyItem,
  context: MappedDataForKeys<['cities', 'countries', 'prefabs']> & {
    companyQuadtree: Quadtree<QtCompanyEntry>;
    mapCountryCode: (countryCode: string) => string;
  },
): CompanyFeature {
  const poi = assertExists(context.companyQuadtree.find(company.x, company.y));
  if (distance(poi, company) > 0) {
    logger.warn(
      'poi is at different location from company item',
      `0x${company.uid.toString(16)}`,
    );
  }

  const prefab = assertExists(context.prefabs.get(company.prefabUid));
  const city = assertExists(context.cities.get(company.cityToken));
  const country = assertExists(context.countries.get(city.countryToken));

  return turf.point([poi.x, poi.y], {
    map: context.map,
    token: poi.icon,
    countryCode: context.mapCountryCode(country.code),
    cityToken: city.token,
    dlcGuard: prefab.dlcGuard,
  });
}
