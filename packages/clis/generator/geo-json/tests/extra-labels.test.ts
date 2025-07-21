import type { LabelMeta, MileageTarget } from '@truckermudgeon/map/types';
import fs from 'fs';
import type { GeoJSON } from 'geojson';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import yargs from 'yargs';
import * as extraLabels from '../../commands/extra-labels';
import { logger } from '../../logger';
import type { MappedData } from '../../mapped-data';
import type { Label } from '../extra-labels';
import { LabelProducer, TargetLabel } from '../extra-labels';
import * as fixtures from './extra-labels.fixtures';

type MyMappedData = Pick<MappedData, 'cities' | 'countries' | 'map'>;

const usa = {
  cities: fixtures.citiesAts,
  countries: fixtures.countriesAts,
  map: 'usa',
} as MyMappedData;

const europe = {
  cities: fixtures.citiesEts2,
  countries: fixtures.countriesEts2,
  map: 'europe',
} as MyMappedData;

function makeLabel(
  targets: Map<string, MileageTarget>,
  game: MyMappedData,
  metas?: LabelMeta[],
): Label {
  if (targets?.size !== 1 && !metas) {
    throw new Error(
      `makeLabel() needs a Map with exactly 1 MileageTarget, but got ${targets?.size}`,
    );
  }
  const gameData = { ...game, mileageTargets: targets };
  return new LabelProducer(gameData, metas).makeLabels()[0];
}

test('regular scenery town', () => {
  const meta = {
    token: 'ca_janesvill',
    text: 'Janesville',
    easting: -102591.2,
    southing: -19511.5,
    country: 'US-CA',
  };
  const { easting, southing, ...properties } = meta;

  const label = makeLabel(fixtures.ca_janesvill, usa);
  expect(label).toBeInstanceOf(TargetLabel);
  expect(label.meta).toEqual(meta);
  expect(label.isValid).toBeTruthy();

  const feature = label.toGeoJsonFeature();
  expect(feature.type).toBe('Feature');
  expect(feature.geometry.coordinates[0]).toBeCloseTo(-120.1, 1);
  expect(feature.geometry.coordinates[1]).toBeCloseTo(40.0, 1);
  expect(feature.properties).toMatchObject(properties);
});

test('large distance offset hidden by default', () => {
  const label = makeLabel(fixtures.ca_napa, usa);
  expect(label.meta).toMatchObject({
    token: 'ca_napa',
    text: 'Napa',
    access: false,
    show: false,
  });
  expect((label as TargetLabel).analysis.tooMuchDistance).toBeTruthy();
  expect(label.meta.kind).toBeUndefined();
  expect(label.isValid).toBeTruthy();
});

describe('target label text', () => {
  test('American abbreviation trailing', () => {
    const label = makeLabel(fixtures.wa_wallula, usa);
    expect(label.meta).toMatchObject({
      token: 'wa_wallula',
      text: 'Wallula Junction',
    });
    expect(label.meta.kind).toBeUndefined();
    expect(label.meta.show).toBeUndefined();
    expect(label.isValid).toBeTruthy();
  });

  test('American abbreviation leading', () => {
    const label = makeLabel(fixtures.mt_stregis, usa);
    expect(label.meta).toMatchObject({
      token: 'mt_stregis',
      text: 'Saint Regis',
    });
    expect(label.meta.kind).toBeUndefined();
    expect(label.meta.show).toBeUndefined();
    expect(label.isValid).toBeTruthy();
  });

  test('break tag, all lowercase w/ unicode', () => {
    const label = makeLabel(fixtures.ba_bihac_, europe);
    expect(label.meta).toMatchObject({
      token: 'ba_bihac_',
      text: 'Бихаћ',
      show: false,
    });
    expect(label.meta.kind).toBeUndefined();
    expect(label.isValid).toBeFalsy(); // country not in dataset
  });

  test('other tag, all uppercase', () => {
    const label = makeLabel(fixtures.fr_stquentin, europe);
    expect(label.meta).toMatchObject({
      token: 'fr_stquentin',
      text: 'St Quentin',
      show: false,
    });
    expect(label.meta.kind).toBeUndefined();
    expect(label.isValid).toBeFalsy(); // missing position
  });
});

describe('country', () => {
  test('American states', () => {
    const labelMT = makeLabel(fixtures.mt_stregis, usa);
    const labelWA = makeLabel(fixtures.wa_wallula, usa);
    expect(labelMT.meta).toMatchObject({
      token: 'mt_stregis',
      country: 'US-MT',
    });
    expect(labelWA.meta).toMatchObject({
      token: 'wa_wallula',
      country: 'US-WA',
    });
  });

  test('European countries', () => {
    const labelDSIT = makeLabel(fixtures.at_klagenf, europe);
    const labelISO = makeLabel(fixtures.cz_praha_, europe);
    const labelUK = makeLabel(fixtures.uk_bristol, europe);
    expect(labelDSIT.meta).toMatchObject({
      token: 'at_klagenf',
      country: 'AT',
    });
    expect(labelISO.meta).toMatchObject({
      token: 'cz_praha_',
      country: 'CZ',
    });
    expect(labelUK.meta).toMatchObject({
      token: 'uk_bristol',
      country: 'GB',
    });
  });

  test('unreleased DLC', () => {
    const labelAts = makeLabel(fixtures.unreleased_mo, usa);
    const labelEts2 = makeLabel(fixtures.unreleased_ru, europe);
    expect(labelAts.meta).toMatchObject({
      token: 'mo_nevada',
      text: 'Nevada',
      show: false,
    });
    expect(labelEts2.meta).toMatchObject({
      token: 'ru_luga',
      text: 'Луга',
      show: false,
    });
    expect(labelAts.meta.kind).toBeUndefined();
    expect(labelAts.meta.country).toBeUndefined();
    expect(labelAts.isValid).toBeFalsy();
    expect(labelEts2.meta.kind).toBeUndefined();
    expect(labelEts2.meta.country).toBeUndefined();
    expect(labelEts2.isValid).toBeFalsy();
  });
});

describe('marked city', () => {
  test('matched on default name', () => {
    const label = makeLabel(fixtures.ca_sanjose1, usa);
    expect(label.meta).toMatchObject({
      token: 'ca_sanjose1',
      text: 'San Jose',
      kind: 'city',
      city: 'san_jose',
      country: 'US-CA',
      show: false,
    });
    expect(label.isValid).toBeTruthy();
  });

  test('matched on variant name', () => {
    const label = makeLabel(fixtures.ar_ftsmith_, usa);
    expect(label.meta).toMatchObject({
      token: 'ar_ftsmith_',
      text: 'Fort Smith',
      kind: 'city',
      city: 'fort_smith',
      country: 'US-AR',
      show: false,
    });
    expect(label.isValid).toBeTruthy();
  });

  test('matched on all-uppercase name', () => {
    const label = makeLabel(fixtures.cz_praha_, europe);
    expect(label.meta).toMatchObject({
      token: 'cz_praha_',
      text: 'Praha',
      kind: 'city',
      city: 'prague',
      country: 'CZ',
      show: false,
    });
    expect(label.isValid).toBeTruthy();
  });

  test('matched on abbreviated name', () => {
    const label = makeLabel(fixtures.co_steamboat, usa);
    expect(label.meta).toMatchObject({
      token: 'co_steamboat',
      text: 'Steamboat Springs',
      kind: 'city',
      city: 'steamboat_sp',
      country: 'US-CO',
      show: false,
    });
    expect(label.isValid).toBeTruthy();
  });

  test('matched on ATS editor name', () => {
    const label = makeLabel(fixtures.co_colospgs, usa);
    expect(label.meta).toMatchObject({
      token: 'co_colospgs',
      text: 'Colorado Springs',
      kind: 'city',
      city: 'colorado_spr',
      country: 'US-CO',
      show: false,
    });
    expect(label.isValid).toBeTruthy();
  });

  test('matched on ETS2 editor name', () => {
    const label = makeLabel(fixtures.at_klagenf, europe);
    expect(label.meta).toMatchObject({
      token: 'at_klagenf',
      text: 'Klagenfurt am Wörthersee',
      kind: 'city',
      city: 'klagenfurt',
      country: 'AT',
      show: false,
    });
    expect(label.isValid).toBeTruthy();
  });

  test('no match across state lines', () => {
    // A city named "Sidney" does exist in `usa`, but it's the one in Montana.
    const label = makeLabel(fixtures.ne_sid, usa);
    expect(label.meta).toMatchObject({
      token: 'ne_sid',
      text: 'Sidney',
      country: 'US-NE',
    });
    expect(label.meta.kind).toBeUndefined();
    expect(label.meta.city).toBeUndefined();
    expect(label.meta.show).toBeUndefined();
    expect(label.isValid).toBeTruthy();
  });
});

describe('filter unnamed locations', () => {
  test('junction name with route number', () => {
    const label = makeLabel(fixtures.ca_us6x395, usa);
    expect(label.meta).toMatchObject({
      token: 'ca_us6x395',
      kind: 'unnamed',
      show: false,
      remark: 'Jct',
    });
    expect((label as TargetLabel).analysis).toMatchObject({
      excludeBorder: false,
      excludeJunction: true,
      excludeNumber: true,
      tooMuchDistance: false,
    });
    expect(label.isValid).toBeFalsy();
  });

  test('route number with city name', () => {
    const label = makeLabel(fixtures.mt_sidney200, usa);
    expect(label.meta).toMatchObject({
      token: 'mt_sidney200',
      kind: 'unnamed',
      city: 'sidney',
      show: false,
      remark: 'Sidney',
    });
    expect((label as TargetLabel).analysis).toMatchObject({
      excludeBorder: false,
      excludeJunction: false,
      excludeNumber: true,
      tooMuchDistance: true,
    });
    expect(label.isValid).toBeFalsy();
  });

  test('route number only', () => {
    const label = makeLabel(fixtures.wa_ritzvill2, usa);
    expect(label.meta).toMatchObject({
      token: 'wa_ritzvill2',
      kind: 'unnamed',
      show: false,
      remark: 'Ritzville',
    });
    expect((label as TargetLabel).analysis).toMatchObject({
      excludeBorder: false,
      excludeJunction: false,
      excludeNumber: true,
      tooMuchDistance: false,
    });
    expect(label.isValid).toBeFalsy();
  });

  test('state line', () => {
    const label = makeLabel(fixtures.ca_nv_sl_, usa);
    expect(label.meta).toMatchObject({
      token: 'ca_nv_sl_',
      kind: 'unnamed',
      show: false,
      remark: 'Nevada State Line;Topaz Lake',
    });
    expect((label as TargetLabel).analysis).toMatchObject({
      excludeBorder: true,
      excludeJunction: false,
      excludeNumber: false,
      tooMuchDistance: false,
    });
    expect(label.isValid).toBeFalsy();
  });

  test('country border', () => {
    const label = makeLabel(fixtures.pt_border_a3, europe);
    expect(label.meta).toMatchObject({
      token: 'pt_border_a3',
      show: false,
    });
    expect((label as TargetLabel).analysis).toMatchObject({
      excludeBorder: true,
      tooMuchDistance: false,
    });
    expect(label.isValid).toBeFalsy();
  });
});

describe('apply metadata', () => {
  test('adjust existing label', () => {
    const meta = {
      token: 'ca_janesvill',
      easting: -102400,
      southing: -19600,
      kind: 'town',
      show: true,
    };
    const label = makeLabel(fixtures.ca_janesvill, usa, [meta]);
    expect(label.meta).toEqual({
      text: 'Janesville', // text missing in metadata: use mileage target name
      country: 'US-CA',
      ...meta,
    });
    expect(label.isValid).toBeTruthy();
  });

  test('make existing label invalid', () => {
    const meta = {
      token: 'ca_janesvill',
      text: undefined, // text undefined in metadata: remove label attribute
    };
    const label = makeLabel(fixtures.ca_janesvill, usa, [meta]);
    expect(label.meta).toMatchObject(meta);
    expect(label.meta.show).toBeUndefined(); // show isn't in the metadata
    expect(label.isValid).toBeFalsy();
  });

  test('add new label', () => {
    const meta = {
      text: 'foo',
      easting: 123,
      southing: -45,
      country: 'US-MT',
    };
    const label = makeLabel(new Map(), usa, [meta]);
    expect(label.meta).toEqual(meta);
    expect(label.isValid).toBeTruthy();
  });

  test('add new label for invalid country', () => {
    const meta = {
      text: 'foo',
      easting: -6.7,
      southing: 8.9,
      country: 'LU',
      show: true,
    };
    const label = makeLabel(new Map(), europe, [meta]);
    expect(label.meta).toEqual(meta);
    expect(label.isValid).toBeFalsy(); // LU not in fixtures.countriesEts2
  });

  test('no new label for country in other region', () => {
    const label = makeLabel(new Map(), usa, [{ country: 'FR' }]);
    expect(label).toBeUndefined();
  });

  test('empty metadata table is no-op', () => {
    const label = makeLabel(fixtures.ca_janesvill, usa, []);
    expect(label.meta).toMatchObject({
      token: 'ca_janesvill',
    });
    expect(label.isValid).toBeTruthy();
  });
});

describe('error checks', () => {
  test('feature without coordinates dies', () => {
    const label = makeLabel(fixtures.az_ehrenberg, usa);
    expect(label.isValid).toBeFalsy();
    expect(() => label.toGeoJsonFeature()).toThrowError(/coordinates/);
  });

  test('warn for unknown token in meta', () => {
    const loggerWarn = vi.spyOn(logger, 'warn');
    const meta = {
      token: 'foobar',
      country: 'US-CO',
    };
    const label = makeLabel(new Map(), usa, [meta]);
    expect(label.meta).toEqual(meta);
    expect(loggerWarn).toHaveBeenCalledWith(
      "Can't assign metadata for target foobar unknown in usa",
    );
  });
});

describe('command-line interface', () => {
  let cli: yargs.Argv;
  let tmpDir: string;
  let metaInPath: string;
  let metaOutPath: string;
  let geojsonPath: string;

  const mileageTargets = [
    ...Array.from(fixtures.mt_stregis.values()),
    ...Array.from(fixtures.ca_napa.values()),
  ];
  const meta = {
    text: 'Away',
    easting: -76891,
    southing: 6147,
    country: 'US-CA',
    // readMapData() in mapped-data only provides game countries referenced by
    // game cities, so in order to add a new label here, we need to give it
    // a country code that matches one of the cities in fixtures.citiesAts.
  };

  beforeAll(() => {
    cli = yargs().command(extraLabels);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-maps-'));
    metaInPath = path.join(tmpDir, 'meta.json');
    metaOutPath = path.join(tmpDir, 'extra-labels.json');
    geojsonPath = path.join(tmpDir, 'extra-labels.geojson');

    fs.writeFileSync(
      path.join(tmpDir, 'usa-cities.json'),
      JSON.stringify(Array.from(fixtures.citiesAts.values())),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'usa-countries.json'),
      JSON.stringify(Array.from(fixtures.countriesAts.values())),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'usa-mileageTargets.json'),
      JSON.stringify(mileageTargets),
    );
    fs.writeFileSync(metaInPath, JSON.stringify([meta]));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  test('dry run on no output dir', () => {
    const loggerFail = vi.spyOn(logger, 'fail');
    cli.parseSync(`extra-labels --inputDir ${tmpDir}`);
    expect(loggerFail).toHaveBeenCalledWith(
      'argument "outputDir" not given; dry run only',
    );
    expect(fs.existsSync(metaOutPath)).toBeFalsy();
    expect(fs.existsSync(geojsonPath)).toBeFalsy();
    loggerFail.mockRestore();
  });

  test('metadata in, geojson out', () => {
    cli.parseSync(`extra-labels -i ${tmpDir} -o ${tmpDir} -t ${metaInPath}`);
    const geojson = JSON.parse(
      fs.readFileSync(geojsonPath, 'utf-8'),
    ) as GeoJSON.FeatureCollection<GeoJSON.Point, LabelMeta>;
    expect(geojson.features.length).toBe(3);
    expect(geojson.features[0].type).toBe('Feature');
    expect(geojson.features[0].geometry.coordinates[0]).toBeCloseTo(-114.6, 1);
    expect(geojson.features[0].geometry.coordinates[1]).toBeCloseTo(47.3, 1);
    expect(geojson.features[0].properties).toEqual({
      token: 'mt_stregis',
      text: 'Saint Regis',
      country: 'US-MT',
    });
    expect(geojson.features[1].properties.token).toEqual('ca_napa');
    expect(geojson.features[2].type).toBe('Feature');
    expect(geojson.features[2].geometry.coordinates[0]).toBeCloseTo(-113.1, 1);
    expect(geojson.features[2].geometry.coordinates[1]).toBeCloseTo(36.6, 1);
    expect(geojson.features[2].properties).toEqual({
      text: 'Away',
      country: 'US-CA',
    });
  });

  test('analysis out', () => {
    cli.parseSync(`extra-labels -i ${tmpDir} -o ${tmpDir} --json`);
    const metaRecords = JSON.parse(
      fs.readFileSync(metaOutPath, 'utf-8'),
    ) as LabelMeta[];
    expect(metaRecords.length).toBe(2);
    expect(metaRecords[0].token).toEqual('ca_napa');
    expect(metaRecords[1]).toEqual({
      token: 'mt_stregis',
      text: 'Saint Regis',
      easting: -71262.27,
      southing: -53983.75,
      country: 'US-MT',
    });
  });
});
