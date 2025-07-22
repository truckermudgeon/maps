import fs from 'fs';
import type { GeoJSON } from 'geojson';
import path from 'path';
import type { Argv, BuilderArguments } from 'yargs';
import { logger } from '../logger';
import { writeGeojsonFile } from '../write-geojson-file';
import { resourcesDir, untildify } from './path-helpers';

import type { LabelMeta } from '@truckermudgeon/map/types';
import type { TargetLabel } from '../geo-json/extra-labels';
import { LabelProducer } from '../geo-json/extra-labels';

export const command = 'extra-labels';
export const describe =
  'Generates map labels GeoJSON from parser output and optional metadata';

const metaDefaults = ['usa-labels-meta.json'] as const;
const outFile = command;

export const builder = (yargs: Argv) =>
  yargs
    .parserConfiguration({
      'boolean-negation': false,
    })
    .option('map', {
      alias: 'm',
      describe:
        'Source map region. Specify multiple map regions with multiple -m arguments.',
      choices: ['usa', 'europe'] as const,
      array: true,
      default: ['usa'] as ('usa' | 'europe')[],
      defaultDescription: 'usa',
    })
    .option('meta', {
      alias: 't',
      describe: 'Paths to metadata (currently must be JSON files).',
      type: 'string',
      array: true,
      coerce: array => (array as string[]).map(p => untildify(p)),
      defaultDescription: metaDefaults.map(d => '.../resources/' + d).join(' '),
    })
    .option('no-meta', {
      describe: 'Do not use default metadata.',
      type: 'boolean',
      conflicts: 'meta',
    })
    .option('inputDir', {
      alias: 'i',
      describe: 'Path to dir containing parser-generated JSON files.',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .option('outputDir', {
      alias: 'o',
      describe: `Path to dir ${outFile}.geojson should be written to. If not given, a dry run will be performed.`,
      type: 'string',
      coerce: untildify,
    })
    .option('all', {
      alias: 'a',
      describe:
        'Write out all labels as GeoJSON, not just valid ones. Useful for manual checks when updating metadata.',
      type: 'boolean',
      default: false,
    })
    .option('json', {
      alias: 'j',
      describe: `Instead of GeoJSON, write out ${outFile}.json with metadata for all targets. Default metadata will not be used. Useful for manual checks when updating metadata.`,
      type: 'boolean',
      default: false,
    })
    .option('token', {
      describe: 'Dump debug info for a mileage target token.',
      type: 'string',
    })
    .check(args => {
      if (args.outputDir != null && !fs.existsSync(args.outputDir)) {
        fs.mkdirSync(args.outputDir, { recursive: true });
      }
      return true;
    });

export function handler(args: BuilderArguments<typeof builder>) {
  const metaPaths: string[] = args.meta ?? [];

  // Metadata default paths
  if (metaPaths.length === 0 && !args['no-meta'] && !args.json) {
    const metaDefaultsExisting = metaDefaults
      .map(d => path.resolve(resourcesDir, d))
      .filter(p => fs.existsSync(p));
    metaPaths.push(...metaDefaultsExisting);

    if (metaDefaults.length === metaDefaultsExisting.length) {
      logger.debug(
        `Argument "meta" not given; using ${metaDefaults.join(' and ')}`,
      );
    } else {
      logger.warn(
        `Argument "meta" not given and ${metaDefaults.join(' or ')} missing in resources`,
      );
    }
  }

  const metas = metaPaths.flatMap(p => LabelProducer.readMetas(p));
  const labels = args.map.flatMap(region => {
    const mappedData = LabelProducer.readMapData(args.inputDir, region);
    const producer = new LabelProducer(mappedData, metas);
    logger.info(
      // Count labels where isInRegion() is either true or undefined
      metas.filter(m => producer.dataProvider.isInRegion(m) !== false).length,
      `metadata records for ${region} read from resources dir`,
    );
    return producer.makeLabels();
  });
  logger.log('consolidated map labels:', labels.length);

  if (args.token != null) {
    const label = labels.find(l => l.meta.token === args.token);
    if (label) {
      // The label might not be a TargetLabel. But this works for debug output.
      const targetLabel = label as TargetLabel;
      const debug = {
        target: targetLabel.target,
        analysis: targetLabel.analysis,
        result: targetLabel.meta,
      };
      logger.log(JSON.stringify(debug, null, 2));
      logger.success(`wrote debug output for mileage target "${args.token}"`);
    } else {
      logger.error(`mileage target token "${args.token}" not found`);
    }
    return;
  }

  if (args.outputDir == null) {
    logger.fail('argument "outputDir" not given; dry run only');
    return;
  }

  let file;
  if (args.json) {
    file = path.join(args.outputDir, `${outFile}.json`);

    // For raw metadata output, apply the consistent sort order:
    // https://github.com/nautofon/ats-towns/blob/main/label-metadata.md#serialization
    const json = labels
      .map(l => l.meta)
      .sort((a, b) => cmp(a.text ?? '', b.text ?? ''))
      .sort((a, b) => cmpLabelFineTuning(a, b))
      .sort((a, b) => cmp(a.country ?? '~', b.country ?? '~'));
    fs.writeFileSync(file, JSON.stringify(json, null, 2));
  } else {
    file = path.join(args.outputDir, `${outFile}.geojson`);

    // For GeoJSON output, skip labels not considered "valid", which are those
    // with certain attributes missing or with a `kind` attribute of "unnamed".
    // Optionally (with --all), output everything we have coordinates for.
    const json: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: labels
        .filter(l => (args.all ? l.meta.easting && l.meta.southing : l.isValid))
        .map(l => l.toGeoJsonFeature()),
    };
    logger.log(
      `${args.all ? 'all' : 'valid'} GeoJSON map label features:`,
      json.features.length,
    );
    writeGeojsonFile(file, json);
  }

  logger.success(`done: wrote ${file}`);
}

function cmpLabelFineTuning(a: LabelMeta, b: LabelMeta): number {
  return a.country && b.country
    ? ((a.kind ?? '') === 'unnamed') === ((b.kind ?? '') === 'unnamed')
      ? 0
      : // Within each country section, gather `kind`: 'unnamed' at the bottom
        (a.kind ?? '') === 'unnamed'
        ? 1
        : -1
    : // Gather records without country code at the bottom
      a.country
      ? -1
      : b.country
        ? 1
        : // Compare records without country code by token
          cmp(a.token ?? '~', b.token ?? '~');
}

function cmp(a: string, b: string): number {
  return a > b ? 1 : a < b ? -1 : 0;
}
