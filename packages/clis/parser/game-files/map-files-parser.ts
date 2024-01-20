// TODO fix this file
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { assert, assertExists } from '@truckermudgeon/base/assert';
import { distance } from '@truckermudgeon/base/geom';
import { mapValues, putIfAbsent } from '@truckermudgeon/base/map';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import type { JSONSchemaType } from 'ajv';
import Ajv from 'ajv';
import * as cliProgress from 'cli-progress';
import path from 'path';
import { logger } from '../logger';
import { CombinedEntries } from './combined-entries';
import { parseDds } from './dds-parser';
import { parseModelPmg } from './model-pmg-parser';
import { parsePrefabPpd } from './prefab-ppd-parser';
import type { Entries, FileEntry } from './scs-archive';
import { ScsArchive } from './scs-archive';
import { parseSector } from './sector-parser';
import { parseSii } from './sii-parser';
import type { ModelSii, PrefabSii, RoadLookSii } from './sii-schemas';
import {
  CityCompanySiiSchema,
  FerryConnectionSchema,
  ModelSiiSchema,
  PrefabSiiSchema,
  RoadLookSiiSchema,
} from './sii-schemas';
import { includeDirectiveCollector, jsonConverter } from './sii-visitors';
import { toMapPosition } from './transformers';
import type {
  Building,
  City,
  CityArea,
  Company,
  CompanyItem,
  Country,
  Curve,
  Cutscene,
  Ferry,
  FerryConnection,
  FerryItem,
  Item,
  MapArea,
  MapData,
  MapOverlay,
  Model,
  ModelDescription,
  Node,
  Poi,
  Prefab,
  PrefabDescription,
  Road,
  RoadLook,
  Terrain,
  Trigger,
} from './types';
import { ItemType, MapOverlayType, SpawnPointType } from './types';

const ajv = new Ajv();

export function parseMapFiles(
  scsFilePaths: string[],
  includeDlc: boolean,
): {
  map: string;
  mapData: MapData;
  icons: Map<string, Buffer>;
} {
  const requiredFiles = new Set(['base.scs', 'def.scs', 'locale.scs']);
  const archives = scsFilePaths
    .filter(p => {
      const fn = path.basename(p);
      return requiredFiles.has(fn) || (includeDlc && fn.startsWith('dlc'));
    })
    .map(p => {
      logger.log('adding', path.basename(p));
      return new ScsArchive(p);
    });
  const entries = new CombinedEntries(archives);
  try {
    const icons = parseIconMatFiles(entries);
    const defData = parseDefFiles(entries);
    const l10n = assertExists(parseLocaleFiles(entries).get('en_us'));
    const sectorData = parseSectorFiles(entries);
    //const sectorData = { map: 'europe', sectors: new Map() };

    // do things like update city data with position info,
    // generate additional overlays from prefab info / company item info
    return postProcess(defData, sectorData, icons, l10n);
  } finally {
    archives.forEach(a => a.dispose());
  }
}

function parseDefFiles(entries: Entries) {
  logger.log('parsing def, prefab .ppd, and model .pmg files...');
  const def = Preconditions.checkExists(entries.directories.get('def'));

  const cities = new Map<
    string,
    Omit<City, 'x' | 'y' | 'areas' | 'companies'>
  >();
  const countries = new Map<string, Country>();
  const companies = new Map<string, Company>();
  const ferries = new Map<
    string,
    Omit<Ferry, 'x' | 'y' | 'connections' | 'train'> & {
      connections: Omit<
        FerryConnection,
        'x' | 'y' | 'name' | 'nameLocalized'
      >[];
    }
  >();
  for (const f of def.files) {
    if (!/^(city|country|company|ferry)\./.test(f) || !f.endsWith('.sii')) {
      continue;
    }
    parseIncludeOnlySii(`def/${f}`, entries, obj => {
      if (obj == null) {
        logger.warn('undefined obj parsed from', f);
        return;
      }
      if (Object.keys(obj).length === 0) {
        logger.warn('empty obj parsed from', f);
        return;
      }
      if (f.startsWith('city.')) {
        const c = processCityJson(obj);
        cities.set(c.token, c);
      } else if (f.startsWith('country.')) {
        const c = processCountryJson(obj);
        countries.set(c.token, c);
      } else if (f.startsWith('company.')) {
        const c = processCompanyJson(obj, entries);
        companies.set(c.token, c);
      } else if (f.startsWith('ferry')) {
        const f = processFerryJson(obj, entries);
        ferries.set(f.token, f);
      } else {
        throw new Error();
      }
    });
  }
  logger.info('parsed', cities.size, 'cities');
  logger.info('parsed', countries.size, 'states/countries');
  logger.info('parsed', companies.size, 'companies');
  logger.info('parsed', ferries.size, 'ferry/train terminals');

  const defCompany = Preconditions.checkExists(
    entries.directories.get('def/company'),
  );
  for (const d of defCompany.subdirectories) {
    if (!companies.has(d)) {
      if (d.startsWith('pt_trk_')) {
        companies.set(d, { token: d, name: 'Peterbilt', cityTokens: [] });
      } else if (d.startsWith('kw_trk_')) {
        companies.set(d, { token: d, name: 'Kenworth', cityTokens: [] });
      } else if (d.startsWith('ws_trk_')) {
        companies.set(d, { token: d, name: 'Western Star', cityTokens: [] });
      } else {
        logger.warn(d, 'has no company info');
      }
    }
  }

  const defWorld = Preconditions.checkExists(
    entries.directories.get('def/world'),
  );
  const prefabs = new Map<string, PrefabDescription>();
  const roadLooks = new Map<string, RoadLook>();
  const models = new Map<string, ModelDescription>();
  for (const f of defWorld.files) {
    if (!/^(prefab|road_look|model)\./.test(f) || !f.endsWith('.sii')) {
      continue;
    }

    if (f.startsWith('prefab.')) {
      const json = convertSiiToJson2(
        `def/world/${f}`,
        entries,
        PrefabSiiSchema,
      );
      processPrefabJson(json, entries).forEach((v, k) => prefabs.set(k, v));
    } else if (f.startsWith('model')) {
      const json = convertSiiToJson2(`def/world/${f}`, entries, ModelSiiSchema);
      processModelJson(json, entries).forEach((v, k) => models.set(k, v));
    } else if (f.startsWith('road_look.')) {
      const json = convertSiiToJson2(
        `def/world/${f}`,
        entries,
        RoadLookSiiSchema,
      );
      processRoadLookJson(json).forEach((v, k) => roadLooks.set(k, v));
    } else {
      throw new Error();
    }
  }
  logger.info('parsed', prefabs.size, 'prefab defs');
  logger.info('parsed', roadLooks.size, 'road looks');
  logger.info('parsed', models.size, 'building models');

  const defPhotoAlbum = Preconditions.checkExists(
    entries.directories.get('def/photo_album'),
  );
  const viewpoints = new Map<bigint, string>(); // item.uid to l10n token
  for (const f of defPhotoAlbum.files) {
    if (!/^viewpoints\.sui$/.test(f)) {
      continue;
    }
    const json = convertSiiToJson(`def/photo_album/${f}`, entries);
    if (Object.keys(json).length === 0) {
      logger.warn(`empty object parsed from def/photo_album/${f}`);
      continue;
    }
    const items = json['photoAlbumItem'];
    for (const [key, val] of Object.entries<any>(items)) {
      const keyTokens = key.split('.');
      if (keyTokens[0] !== 'album' || keyTokens[1] !== 'viewpoints') {
        continue;
      }
      const uid = assertExists(val.objectsUid[0]);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const token = assertExists(val.name).replace(/(^@@)|(@@$)/g, '');
      assert(typeof uid === 'bigint');
      assert(typeof token === 'string');
      viewpoints.set(uid, token);
    }
  }

  return {
    cities,
    countries,
    companies,
    ferries,
    prefabs,
    roadLooks,
    models,
    viewpoints,
  };
}

function convertSiiToJson2<T>(
  siiPath: string,
  entries: Entries,
  schema: JSONSchemaType<T>,
): T {
  logger.debug('converting', siiPath, 'to json object');
  const siiFile = Preconditions.checkExists(entries.files.get(siiPath));
  const buffer = siiFile.read();

  // Some .sii files (like locale files) may be 3nk-encrypted.
  let sii;
  const magic = buffer.toString('utf8', 0, 3);
  if (magic === '3nK') {
    // https://github.com/dariowouters/ts-map/blob/e73adad923f60bbbb637dd4642910d1a0b1154e3/TsMap/Helpers/MemoryHelper.cs#L109
    if (buffer.length < 5) {
      throw new Error();
    }
    let key = buffer.readUint8(5);
    for (let i = 6; i < buffer.length; i++) {
      buffer[i] = (((key << 2) ^ (key ^ 0xff)) << 3) ^ key ^ buffer[i];
      key++;
    }
    sii = buffer.toString('utf8', 6);
  } else {
    sii = buffer.toString();
  }

  const res = parseSii(sii);
  if (!res.ok) {
    logger.error('error parsing', siiPath);
    if (res.parseErrors.length) {
      const line = res.parseErrors[0].token.startLine!;
      const lines = sii.split('\n');
      logger.error(lines.slice(line - 1, line + 1).join('\n'));
      logger.error(res.parseErrors);
    } else {
      logger.error(res.lexErrors);
    }
    throw new Error();
  }

  const validate = ajv.compile(schema);
  const json = jsonConverter.convert(res.cst);
  if (validate(json)) {
    return json;
  }
  logger.error('error validating', siiPath);
  logger.error(ajv.errorsText(validate.errors));
  throw new Error();
}

function convertSiiToJson(
  siiPath: string,
  entries: Entries,
): Record<string, any> {
  logger.debug('converting', siiPath, 'to json object');
  const siiFile = Preconditions.checkExists(entries.files.get(siiPath));
  const buffer = siiFile.read();

  // Some .sii files (like locale files) may be 3nk-encrypted.
  let sii;
  const magic = buffer.toString('utf8', 0, 3);
  if (magic === '3nK') {
    // https://github.com/dariowouters/ts-map/blob/e73adad923f60bbbb637dd4642910d1a0b1154e3/TsMap/Helpers/MemoryHelper.cs#L109
    if (buffer.length < 5) {
      throw new Error();
    }
    let key = buffer.readUint8(5);
    for (let i = 6; i < buffer.length; i++) {
      buffer[i] = (((key << 2) ^ (key ^ 0xff)) << 3) ^ key ^ buffer[i];
      key++;
    }
    sii = buffer.toString('utf8', 6);
  } else {
    sii = buffer.toString();
  }

  const res = parseSii(sii);
  if (!res.ok) {
    logger.error('error parsing', siiPath);
    if (res.parseErrors.length) {
      const line = res.parseErrors[0].token.startLine!;
      const lines = sii.split('\n');
      logger.error(lines.slice(line - 1, line + 1).join('\n'));
      logger.error(res.parseErrors);
    } else {
      logger.error(res.lexErrors);
    }
    throw new Error();
  }
  return jsonConverter.convert(res.cst);
}

// TODO update convertSiiToJson to use ajv.
function toJson<T>(fileEntry: FileEntry, schema: JSONSchemaType<T>): T {
  const validate = ajv.compile(schema);
  const json = jsonConverter.convert(parseSii(fileEntry.read().toString()).cst);
  if (validate(json)) {
    return json;
  }
  throw new Error();
}

function parseIncludeOnlySii<T>(
  siiPath: string,
  entries: Entries,
  process: (sui: any) => T,
): T[] {
  logger.debug('parsing', siiPath, 'for @include directives');
  const f = Preconditions.checkExists(entries.files.get(siiPath));
  const res = parseSii(f.read().toString());
  if (!res.ok) {
    logger.error('error parsing', siiPath);
    throw new Error();
  }

  return includeDirectiveCollector
    .collect(res.cst, 'def')
    .map(p => process(convertSiiToJson(p, entries)));
}

function processSuiJson(obj: any, primaryKey: string): [string, any] {
  const data = Preconditions.checkExists(obj[primaryKey]);
  const entries = Object.entries(data);
  if (entries.length !== 1) {
    throw new Error();
  }
  return entries[0];
}

function processCityJson(obj: any) {
  const [token, rawCity] = processSuiJson(obj, 'cityData');
  return {
    token: token.split('.')[1],
    name: rawCity.cityName,
    nameLocalized: rawCity.cityNameLocalized,
    countryToken: rawCity.country,
    population: rawCity.population,
  };
}

function processCountryJson(obj: any) {
  const [token, rawCountry] = processSuiJson(obj, 'countryData');
  return {
    token: token.split('.')[2],
    name: rawCountry.name,
    nameLocalized: rawCountry.nameLocalized,
    id: rawCountry.countryId,
    x: rawCountry.pos[0],
    y: rawCountry.pos[2],
    code: rawCountry.countryCode,
  };
}

function processCompanyJson(obj: any, entries: Entries): Company {
  const [token, rawCompany] = processSuiJson(obj, 'companyPermanent');
  const companyToken = token.split('.')[2];
  const cityTokens = [];
  const editorFolder = entries.directories.get(
    `def/company/${companyToken}/editor`,
  );
  if (editorFolder) {
    for (const f of editorFolder.files) {
      const city = convertSiiToJson2(
        `def/company/${companyToken}/editor/${f}`,
        entries,
        CityCompanySiiSchema,
      );
      for (const [, entry] of Object.entries(city.companyDef)) {
        cityTokens.push(entry.city);
      }
    }
  }

  return {
    token: companyToken,
    name: rawCompany.name,
    cityTokens,
  };
}

function processFerryJson(obj: any, entries: Entries) {
  const [tokenPath, rawFerry] = processSuiJson(obj, 'ferryData');
  const token = tokenPath.split('.')[1];
  const defFerryConnection = Preconditions.checkExists(
    entries.directories.get('def/ferry/connection'),
  );
  const connections: Omit<
    FerryConnection,
    'x' | 'y' | 'name' | 'nameLocalized'
  >[] = [];

  // find matching connection file for `token`.
  // do this because file names don't always match up with ferry tokens (i'm looking at you, travemunde_p).
  // this is A LOT of repeated work.
  // TODO read every file in the def/ferry/connections folder once, then match things up based on tokens.
  for (const f of defFerryConnection.files) {
    const fileEntry = Preconditions.checkExists(
      entries.files.get(`def/ferry/connection/${f}`),
    );

    const json = toJson(fileEntry, FerryConnectionSchema);
    const ferryConnection = json.ferryConnection;
    const key = Object.keys(ferryConnection)[0];
    // key is expected to be in form: "conn.source_token.dest_token"
    const [, start, end] = key.split('.');
    if (start !== token) {
      continue;
    }

    const connection = ferryConnection[key];
    const { connectionPositions = [], connectionDirections = [] } = connection;
    if (connectionPositions.length !== connectionDirections.length) {
      logger.warn(`position/directions mismatch for ${f}. skipping.`);
      continue;
    }

    const intermediatePoints: { x: number; y: number; rotation: number }[] = [];
    for (let i = 0; i < connectionPositions.length; i++) {
      intermediatePoints.push({
        x: connectionPositions[i][0] / 256,
        y: connectionPositions[i][2] / 256,
        rotation: Math.atan2(
          connectionDirections[i][2],
          connectionDirections[i][0],
        ),
      });
    }

    connections.push({
      token: end,
      price: connection.price,
      time: connection.time,
      distance: connection.distance,
      intermediatePoints,
    });
  }

  return {
    token,
    name: rawFerry.ferryName,
    nameLocalized: rawFerry.ferryNameLocalized,
    connections,
  };
}

function processPrefabJson(
  obj: PrefabSii,
  entries: Entries,
): Map<string, PrefabDescription & { path: string }> {
  const prefabModel = obj.prefabModel;
  if (!prefabModel) {
    return new Map();
  }

  const prefabTuples = Object.entries(prefabModel).map(
    ([key, o]) =>
      [key.split('.')[1], o.prefabDesc.substring(1)] as [string, string],
  );
  const prefabs = new Map<string, PrefabDescription & { path: string }>();
  for (const [token, path] of prefabTuples) {
    const ppdFile = entries.files.get(path);
    if (!ppdFile) {
      logger.warn(`could not find prefab file for ${token}`);
      continue;
    }
    const ppd = parsePrefabPpd(ppdFile.read());
    if (ppd.mapPoints.some(p => p.type === 'polygon')) {
      // TODO figure out a way to get building footprint information for
      //  polygons in prefabs that look like buildings.

      // Looks like there are spawn/no-spawn variants of prefabs that
      // reference the same pmg. Strip out the "_spawn" suffix when searching
      // for the associated pmg.
      const pmgPath = path.replace(/(_spawn)?\.ppd$/, '.pmg');
      const pmgFile = entries.files.get(pmgPath);
      if (!pmgFile) {
        logger.warn(`could not find pmg file ${pmgPath} for ${token}`);
      } else {
        //const pmg = parseModelPmg(pmgFile.read());
        //if (pmg) {
        //  //console.log(path, pmg?.height);
        //}
      }
    }
    prefabs.set(token, {
      path,
      ...ppd,
    });
    //      console.log(path);
    //      toRoadSegmentsAndPolygons(prefabs.get(token)!);
  }
  return prefabs;
}

function processModelJson(
  obj: ModelSii,
  entries: Entries,
): Map<string, ModelDescription & { path: string }> {
  const modelDef = obj.modelDef;
  if (!modelDef) {
    return new Map();
  }

  const modelTuples = Object.entries(modelDef).map(
    ([key, o]) =>
      [key.split('.')[1], o.modelDesc?.substring(1)] as [
        string,
        string | undefined,
      ],
  );
  const models = new Map<string, ModelDescription & { path: string }>();
  for (const [token, path] of modelTuples) {
    if (path == null) {
      continue;
    }

    if (!path.endsWith('.pmd')) {
      continue;
    }
    const isProbablyBuildingModel =
      path.match(/^model2?\/building\//) ??
      path.match(/^model2?\/panorama\/.*building/);
    if (!isProbablyBuildingModel) {
      continue;
    }
    const pmgPath = path.replace(/\.pmd$/, '.pmg');
    const pmgFile = entries.files.get(pmgPath);
    if (!pmgFile) {
      // TODO parse PMD file
      logger.warn(`could not find pmg file ${pmgPath} for ${token}`);
      continue;
    }
    const pmg = parseModelPmg(pmgFile.read());
    models.set(token, { path, ...pmg });
  }
  return models;
}

function processRoadLookJson(obj: RoadLookSii): Map<string, RoadLook> {
  const roadLook = obj.roadLook;
  if (!roadLook) {
    return new Map();
  }

  return new Map<string, RoadLook>(
    Object.entries(roadLook).map(([key, o]) => {
      const {
        lanesLeft = [],
        lanesRight = [],
        laneOffsetsLeft = [],
        laneOffsetsRight = [],
      } = o;
      let offset = o.roadOffset;
      let laneOffset = undefined;
      if (offset === 0 && lanesLeft.length > 1 && lanesRight.length > 1) {
        // calculate an offset for two carriageways that may or may not have a
        // physical divider between them. this doesn't match the strict
        // definition of a Dual Carriageway (https://wiki.openstreetmap.org/wiki/Dual_carriageway),
        // but it leads to better-looking roads on the map because connections
        // with prefabs containing offset roads look better.
        // TODO consider keeping things strict, and:
        // - only setting a non-zero offset if the road has dirt or vegetation in
        //   its center/median area (in which case, there _is_ a physical barrier), _and_
        // - use nav curve data in prefabs as the source of truth for whether or not
        //   a prefab's roads are truly offset.
        // Or just continue to render two carriageways for non-physically divided carriageways,
        // and just set a really small offset (but slightly wider road, because of lane counts) to compensate.
        //offset = Math.max(
        //  0,
        //  ...laneOffsetsLeft.flat(),
        //  ...laneOffsetsRight.flat(),
        //);
        // TODO set a flag for further examination in gen phase.
        // looks like offset space can be reserved, and filled up with either
        // Terrain items or Building items that follow the same start/ends as roads?
        laneOffset = Math.max(
          0,
          ...laneOffsetsLeft.map(tuple => tuple[0]),
          ...laneOffsetsRight.map(tuple => tuple[0]),
        );
        offset = undefined;
      }
      return [
        // keys look like "road.foo"; we just want the "foo".
        key.split('.')[1],
        {
          // TODO add other fields from RoadLookSii; might let us better center road linestrings.
          lanesLeft,
          lanesRight,
          offset,
          laneOffset,
        },
      ];
    }),
  );
}

function parseSectorFiles(entries: Entries) {
  const mapDir = Preconditions.checkExists(entries.directories.get('map'));
  const mbds = mapDir.files.filter(f => f.endsWith('.mbd'));
  if (mbds.length !== 1) {
    throw new Error();
  }
  const map = mbds[0].replace(/\.mbd$/, '');
  const sectorRoot = Preconditions.checkExists(
    entries.directories.get(`map/${map}`),
  );
  logger.start(`parsing ${map} sector files...`);
  const start = Date.now();

  const baseFiles = sectorRoot.files.filter(
    f => f.endsWith('.base') || f.endsWith('.aux'),
  );
  const bar = new cliProgress.SingleBar(
    {
      format: `[{bar}] | {filename} | {value} of {total}`,
      stopOnComplete: true,
      clearOnComplete: true,
    },
    cliProgress.Presets.rect,
  );
  bar.start(baseFiles.length, 0);

  const sectors = new Map<string, { items: Item[]; nodes: Node[] }>();
  const sectorRegex = /^sec([+-]\d{4})([+-]\d{4})$/;
  for (const f of baseFiles) {
    const sectorKey = f.replace(/\.(base|aux)$/, '');
    if (!sectorRegex.test(sectorKey)) {
      throw new Error(`unexpected sector key "${sectorKey}"`);
    }
    const [, sectorX, sectorY] = Array.from(
      assertExists(sectorKey.match(sectorRegex)),
      parseFloat,
    );
    if (isNaN(sectorX) || isNaN(sectorY)) {
      throw new Error(`couldn't parse ${sectorX} or ${sectorY}`);
    }
    const { items, nodes } = putIfAbsent(
      sectorKey,
      { items: [], nodes: [] },
      sectors,
    );
    const baseFile = assertExists(entries.files.get(`map/${map}/${f}`));
    const sector = parseSector(baseFile.read());
    items.push(...sector.items.map(i => ({ ...i, sectorX, sectorY })));
    nodes.push(...sector.nodes.map(n => ({ ...n, sectorX, sectorY })));
    bar.increment({ filename: f });
  }
  logger.success(
    'parsed',
    baseFiles.length,
    'sector files in',
    (Date.now() - start) / 1000,
    'seconds',
  );

  return {
    map,
    sectors,
  };
}

function parseLocaleFiles(entries: Entries): Map<string, Map<string, string>> {
  logger.log('parsing locale files...');
  const l10nStrings = new Map<string, Map<string, string>>();

  const locale = Preconditions.checkExists(entries.directories.get('locale'));
  for (const subdir of locale.subdirectories) {
    const localeSubdir = Preconditions.checkExists(
      entries.directories.get(`locale/${subdir}`),
    );
    const localeMap = putIfAbsent(
      subdir,
      new Map<string, string>(),
      l10nStrings,
    );
    for (const f of localeSubdir.files) {
      if (f !== 'local.sii' && f !== 'local.override.sii') {
        continue;
      }
      const json = convertSiiToJson(`locale/${subdir}/${f}`, entries);
      const l10n = json['localizationDb']['.localization'];
      if (Object.keys(l10n).length === 0) {
        // Some l10n files are empty, e.g., ETS's locale/bg_bg/local.override.sii
        continue;
      }
      const { key, val } = l10n;
      assert(key.length === val.length);
      for (let i = 0; i < key.length; i++) {
        localeMap.set(key[i], val[i]);
      }
    }
  }

  logger.info(
    l10nStrings.size,
    'locales,',
    // assumes all locales have the same number of entries.
    l10nStrings.values().next().value.size,
    'strings each',
  );

  return l10nStrings;
}

function parseIconMatFiles(entries: Entries) {
  logger.log('parsing icon .mat files...');

  const endsWithMat = /\.mat$/g;
  const tobjPaths = new Map<string, string>();
  const readTobjPathsFromMatFiles = (
    dir: string,
    filenameFilter: (filename: string) => boolean = f => f.endsWith('.mat'),
    replaceAll: RegExp = endsWithMat,
  ) => {
    Preconditions.checkArgument(replaceAll.global);
    const dirEntry = Preconditions.checkExists(entries.directories.get(dir));
    for (const f of dirEntry.files) {
      if (!filenameFilter(f)) {
        continue;
      }
      const json = convertSiiToJson(`${dir}/${f}`, entries);
      if (Object.keys(json).length === 0) {
        continue;
      }
      if (json['effect']) {
        tobjPaths.set(
          f.replaceAll(replaceAll, ''),
          `${dir}/${json['effect']['ui.rfx'].texture.texture.source}`,
        );
      } else if (json['material']) {
        tobjPaths.set(
          f.replaceAll(replaceAll, ''),
          `${dir}/${json['material'].ui.texture}`,
        );
      } else {
        logger.warn(`unknown format for ${dir}/${f}`);
      }
    }
  };

  readTobjPathsFromMatFiles(
    'material/ui/map/road',
    f => f.startsWith('road_') && f.endsWith('.mat'),
    /^road_|\.mat$/g,
  );
  readTobjPathsFromMatFiles('material/ui/company/small');

  // hardcoded set of icon names that live in material/ui/map/
  const otherMatFiles = new Set(
    [
      'viewpoint', // for cutscenes (from ItemType.Cutscene)
      'photo_sight_captured', // for landmarks (from ItemType.MapOverlay, type Landmark)
      // facilities
      'parking_ico', // from ItemType.MapOverlay, type Parking; ItemType.Trigger; PrefabDescription TriggerPoints
      // from PrefabDescription SpawnPoints
      'gas_ico',
      'service_ico',
      'weigh_station_ico',
      'dealer_ico',
      'garage_large_ico',
      'recruitment_ico',
      // these 4 files can be combined to help trace state / country borders
      // 'map0',
      // 'map1',
      // 'map2',
      // 'map3',
    ].map(n => `${n}.mat`),
  );
  readTobjPathsFromMatFiles('material/ui/map', f => otherMatFiles.has(f));

  const pngs = new Map<string, Buffer>();
  for (const [key, tobjPath] of tobjPaths) {
    const f = entries.files.get(tobjPath);
    if (!f) {
      logger.warn('could not find', tobjPath);
      continue;
    }
    // parse .tobj file for the path to a .dds file.
    // .tobj files have a 48-byte header followed by a file path.
    const ddsPath = f.read().toString('utf8', 48).replaceAll(/^\//g, '');
    const dds = entries.files.get(ddsPath);
    if (!dds) {
      logger.warn('could not find', ddsPath);
      continue;
    }
    pngs.set(key, parseDds(dds.read()));
  }
  return pngs;
}

function postProcess(
  defData: ReturnType<typeof parseDefFiles>,
  { sectors, map }: ReturnType<typeof parseSectorFiles>,
  icons: ReturnType<typeof parseIconMatFiles>,
  l10n: Map<string, string>,
): { map: string; mapData: MapData; icons: Map<string, Buffer> } {
  // aggregate sectors data so we can do almost all post-processing in aggregate.
  const sectorData = {
    nodes: [] as Node[],
    items: [] as Item[],
  };
  for (const s of sectors.values()) {
    sectorData.nodes.push(...s.nodes);
    sectorData.items.push(...s.items);
  }

  logger.log('building node LUT...');
  // N.B.: build this Map manually and not by using the ctor with a
  // `sectorData.nodes.map` call, because the latter leads to OOM when parsing
  // a large (e.g., 7.5M) number of nodes.
  const nodesByUid = new Map<bigint, Node>();
  for (const n of sectorData.nodes) {
    nodesByUid.set(n.uid, n);
  }
  logger.success('built', sectorData.nodes.length, 'node LUT entries');

  const referencedNodeUids = new Set<bigint>();
  const cityAreas = new Map<string, CityArea[]>();
  const prefabs: Prefab[] = [];
  const models: Model[] = [];
  const prefabsByUid = new Map<bigint, Prefab>();
  const mapAreas: MapArea[] = [];
  const ferryItems = new Map<string, FerryItem>();
  const poifulItems: (
    | Prefab
    | MapOverlay
    | CompanyItem
    | FerryItem
    | Cutscene
    | Trigger
  )[] = [];

  logger.log("checking items' references...");
  const start = Date.now();
  for (const item of sectorData.items) {
    switch (item.type) {
      case ItemType.City:
        putIfAbsent(item.token, [], cityAreas).push(item);
        break;
      case ItemType.Road:
        checkReference(
          item.roadLookToken,
          defData.roadLooks,
          'roadLookToken',
          item,
        );
        checkReference(item.startNodeUid, nodesByUid, 'startNodeUid', item);
        checkReference(item.endNodeUid, nodesByUid, 'endNodeUid', item);
        referencedNodeUids.add(item.startNodeUid);
        referencedNodeUids.add(item.endNodeUid);
        break;
      case ItemType.Prefab:
        checkReference(item.token, defData.prefabs, 'prefab token', item);
        checkReference(item.nodeUids, nodesByUid, 'nodeUids', item);
        item.nodeUids.forEach(uid => referencedNodeUids.add(uid));
        prefabs.push(item);
        prefabsByUid.set(item.uid, item);
        poifulItems.push(item);
        break;
      case ItemType.MapArea:
        checkReference(item.nodeUids, nodesByUid, 'nodeUids', item);
        item.nodeUids.forEach(uid => referencedNodeUids.add(uid));
        mapAreas.push(item);
        break;
      case ItemType.MapOverlay:
        checkReference(item.nodeUid, nodesByUid, 'nodeUid', item);
        referencedNodeUids.add(item.nodeUid);
        poifulItems.push(item);
        break;
      case ItemType.Ferry:
        checkReference(item.nodeUid, nodesByUid, 'nodeUid', item);
        checkReference(item.token, defData.ferries, 'ferry token', item);
        if (defData.ferries.has(item.token)) {
          referencedNodeUids.add(item.nodeUid);
          ferryItems.set(item.token, item);
          poifulItems.push(item);
        }
        break;
      case ItemType.Company:
        checkReference(item.nodeUid, nodesByUid, 'nodeUid', item);
        checkReference(item.token, icons, 'company token', item);
        // disable this line when not processing every state; gets noisy otherwise.
        checkReference(item.cityToken, defData.cities, 'city token', item);
        referencedNodeUids.add(item.nodeUid);
        poifulItems.push(item);
        break;
      case ItemType.Cutscene:
        checkReference(item.nodeUid, nodesByUid, 'nodeUid', item);
        referencedNodeUids.add(item.nodeUid);
        poifulItems.push(item);
        break;
      case ItemType.Trigger:
        checkReference(item.nodeUids, nodesByUid, 'nodeUids', item);
        item.nodeUids.forEach(uid => referencedNodeUids.add(uid));
        poifulItems.push(item);
        break;
      case ItemType.Model:
        // sector parsing returns _all_ models, but
        // def parsing only cares about the ones it thinks are buildings.
        if (!defData.models.has(item.token)) {
          break;
        }
        checkReference(item.nodeUid, nodesByUid, 'startNodeUid', item);
        referencedNodeUids.add(item.nodeUid);
        models.push(item);
        break;
      case ItemType.Terrain:
      case ItemType.Building:
      case ItemType.Curve:
        // Terrains, Buildings, and Curves aren't returned in parsed output.
        // They're only used to flag Roads as possibly being divided.
        break;
      default:
        throw new UnreachableError(item);
    }
  }
  logger.success(
    'checked',
    sectorData.items.length,
    'items in',
    (Date.now() - start) / 1000,
    'seconds',
  );

  logger.log('scanning', poifulItems.length, 'items for points of interest...');
  const pois: Poi[] = [];
  // company items, keyed by company token
  const companyItems = new Map<string, CompanyItem[]>();
  for (const item of poifulItems) {
    switch (item.type) {
      case ItemType.Prefab: {
        const prefabDescription = assertExists(defData.prefabs.get(item.token));
        for (const sp of prefabDescription.spawnPoints) {
          const [x, y] = toMapPosition(
            [sp.x, sp.y],
            item,
            prefabDescription,
            nodesByUid,
          );
          switch (sp.type) {
            case SpawnPointType.GasPos:
              pois.push({ type: 'facility', x, y, icon: 'gas_ico' });
              break;
            case SpawnPointType.ServicePos:
              pois.push({ type: 'facility', x, y, icon: 'service_ico' });
              break;
            case SpawnPointType.WeightStationPos:
              pois.push({
                type: 'facility',
                x,
                y,
                icon: 'weigh_station_ico',
              });
              break;
            case SpawnPointType.TruckDealerPos:
              pois.push({ type: 'facility', x, y, icon: 'dealer_ico' });
              break;
            case SpawnPointType.BuyPos:
              pois.push({ type: 'facility', x, y, icon: 'garage_large_ico' });
              break;
            case SpawnPointType.RecruitmentPos:
              pois.push({ type: 'facility', x, y, icon: 'recruitment_ico' });
              break;
            default:
              // TODO exhaustive switch, warn on unknown type.
              break;
          }
        }
        for (const tp of prefabDescription.triggerPoints) {
          const [x, y] = toMapPosition(
            [tp.x, tp.y],
            item,
            prefabDescription,
            nodesByUid,
          );
          if (tp.action === 'hud_parking') {
            pois.push({ type: 'facility', x, y, icon: 'parking_ico' });
          }
        }
        break;
      }
      case ItemType.MapOverlay: {
        const { x, y } = item;
        switch (item.overlayType) {
          case MapOverlayType.Road:
            if (item.token === '') {
              // ignore
            } else if (!icons.has(item.token)) {
              logger.warn(
                `unknown road overlay token "${item.token}". skipping.`,
              );
            } else {
              pois.push({ type: 'road', x, y, icon: item.token });
            }
            break;
          case MapOverlayType.Parking:
            pois.push({ type: 'facility', x, y, icon: 'parking_ico' });
            break;
          case MapOverlayType.Landmark: {
            const label =
              // Note: tried to treat this similar to viewpoints by searching
              // for entries in def files and matching item.uids, but item.uids
              // didn't match what was in the def files.
              l10n.get(`landmark_${item.token}`) ?? item.token;
            pois.push({
              type: 'landmark',
              x,
              y,
              icon: 'photo_sight_captured',
              label,
            });
            break;
          }
        }
        break;
      }
      case ItemType.Company: {
        const prefabItem = prefabsByUid.get(item.prefabUid);
        if (!prefabItem) {
          logger.warn(
            'unknown prefab uid',
            item.prefabUid,
            'for company',
            item.token,
            `0x${item.uid.toString(16)}`,
          );
          break;
        }
        const prefabDescription = assertExists(
          defData.prefabs.get(prefabItem.token),
        );
        const companySpawnPos = prefabDescription.spawnPoints.find(
          p => p.type === SpawnPointType.CompanyPos,
        );
        if (companySpawnPos) {
          const [x, y] = toMapPosition(
            [companySpawnPos.x, companySpawnPos.y],
            prefabItem,
            prefabDescription,
            nodesByUid,
          );
          if (!icons.has(item.token)) {
            logger.warn(
              `unknown company overlay token "${item.token}". skipping.`,
            );
          } else {
            const companyName = defData.companies.get(item.token)?.name;
            if (companyName == null) {
              logger.warn('unknown company name for token', item.token);
            }
            pois.push({
              type: 'company',
              x,
              y,
              icon: item.token,
              label: companyName ?? item.token,
            });
            putIfAbsent(item.token, [], companyItems).push({
              ...item,
              x,
              y,
            });
          }
        } else {
          logger.warn(
            'no company spawn position for company',
            item.token,
            `0x${item.uid.toString(16)}`,
          );
        }
        break;
      }
      case ItemType.Ferry: {
        const { x, y } = assertExists(nodesByUid.get(item.nodeUid));
        const ferry = assertExists(defData.ferries.get(item.token))!;
        const label = ferry.nameLocalized
          ? assertExists(l10n.get(ferry.nameLocalized.replaceAll('@', '')))
          : ferry.name;
        pois.push({
          type: 'ferry',
          x,
          y,
          icon: item.train ? 'train_ico' : 'port_overlay',
          label,
        });
        break;
      }
      case ItemType.Cutscene: {
        // a less magical check might be to read actions.stringParams,
        // and check that items 0 and 1 are "create" and "viewpoint".
        if ((item.flags & 0x00_00_00_ff) !== 0) {
          break;
        }
        const labelToken = defData.viewpoints.get(item.uid);
        if (labelToken == null) {
          logger.warn('missing viewpoint info for item', item.uid.toString());
        }
        const label = l10n.get(labelToken ?? '') ?? item.tags.join(', ');
        pois.push({
          type: 'viewpoint',
          x: item.x,
          y: item.y,
          icon: 'viewpoint',
          label,
        });
        break;
      }
      case ItemType.Trigger:
        if (item.actionTokens.includes('hud_parking')) {
          const { x, y } = item;
          pois.push({ type: 'facility', x, y, icon: 'parking_ico' });
        }
        break;
      default:
        throw new UnreachableError(item);
    }
  }

  // Augment partial city info from defs with position info from sectors
  const citiesWithoutCompanies = new Map<string, Omit<City, 'companies'>>();
  for (const [token, partialCity] of defData.cities) {
    const areas = cityAreas.get(token);
    if (areas == null) {
      logger.warn(token, 'has no matching CityArea items. ignoring.');
      continue;
    }
    const nonHidden = areas.find(a => !a.hidden);
    if (!nonHidden) {
      logger.warn(token, 'has no "location" CityArea item. ignoring.');
      continue;
    }
    citiesWithoutCompanies.set(token, {
      ...partialCity,
      x: nonHidden.x,
      y: nonHidden.y,
      areas,
    });
  }

  // Link companies to cities
  const contains = (
    area: { x: number; y: number; width: number; height: number },
    p: { x: number; y: number },
    padding: number,
  ): boolean =>
    // prettier-ignore
    -padding + area.x <= p.x && p.x <= area.x + area.width + padding &&
    -padding + area.y <= p.y && p.y <= area.y + area.height + padding;
  const companiesByCity = new Map<string, CompanyItem[]>();
  // keys: company token+name; values: city token[]
  const unplacedCompanies = new Map<string, string[]>();
  for (const company of defData.companies.values()) {
    const thisCompanyPois = companyItems.get(company.token);
    if (!thisCompanyPois) {
      if (company.cityTokens.length) {
        logger.warn(
          'skipping city-linking for company',
          company.token,
          'with cityTokens',
          company.cityTokens,
        );
      }
      continue;
    }
    for (const cityToken of company.cityTokens) {
      const city = assertExists(citiesWithoutCompanies.get(cityToken));
      const item = thisCompanyPois.find(poi =>
        city.areas.find(area => contains(area, poi, 500)),
      );
      if (!item) {
        putIfAbsent(
          `${company.token} (${company.name})`,
          [],
          unplacedCompanies,
        ).push(cityToken);
      } else {
        putIfAbsent(cityToken, [], companiesByCity).push(item);
      }
    }
  }
  for (const [company, cities] of unplacedCompanies) {
    logger.warn(
      'could not find containing city areas for',
      company,
      'in cities',
      cities,
    );
  }

  const cities: Map<string, City> = mapValues(
    citiesWithoutCompanies,
    partialCity => {
      return {
        ...partialCity,
        companies: companiesByCity.get(partialCity.token) ?? [],
      };
    },
  );

  const withLocalizedName = <
    T extends { name: string; nameLocalized: string | undefined },
  >(
    o: T,
  ) => ({
    ...o,
    nameLocalized: undefined,
    name: o.nameLocalized
      ? // If it weren't for Winterland, we could assert that o.nameLocalized guarantees an entry in the l10n table.
        l10n.get(o.nameLocalized.replaceAll('@', '')) ?? o.name
      : o.name,
  });

  // Augment partial ferry info from defs with start/end position info
  const ferries: Ferry[] = [];
  for (const [token, partialFerry] of defData.ferries) {
    const { nodeUid, train } = assertExists(ferryItems.get(token));
    const { x, y } = assertExists(nodesByUid.get(nodeUid));

    const connections: FerryConnection[] = partialFerry.connections.map(
      partialConnection => {
        const { nodeUid } = assertExists(
          ferryItems.get(partialConnection.token),
        );
        const { x, y } = assertExists(nodesByUid.get(nodeUid));
        const { name, nameLocalized } = withLocalizedName(
          assertExists(defData.ferries.get(partialConnection.token)),
        );
        return {
          ...partialConnection,
          name,
          nameLocalized,
          x,
          y,
        };
      },
    );
    ferries.push(
      withLocalizedName({
        ...partialFerry,
        train,
        connections,
        x,
        y,
      }),
    );
  }

  // Flag roads as possibly having terrain splitting them.
  // For performance, do this per-sector.
  // TODO use quadtree to speed this up.
  const roads: Road[] = [];
  const threshold = 2;
  let splitCount = 0;
  logger.start(
    'scanning sectors for roads possibly split by terrains or buildings',
  );
  const bar = new cliProgress.SingleBar(
    {
      format: `[{bar}] | {key} | {value} of {total}`,
      stopOnComplete: true,
      clearOnComplete: true,
    },
    cliProgress.Presets.rect,
  );
  bar.start(sectors.size, 0);
  const dividers: (Building | Curve)[] = [];
  for (const [key, { items }] of sectors.entries()) {
    const sectorRoads: Road[] = [];
    const sectorDividers: (Terrain | Building | Curve)[] = [];
    for (const i of items) {
      if (i.type === ItemType.Road) {
        sectorRoads.push(i);
      } else if (i.type === ItemType.Terrain) {
        sectorDividers.push(i);
      } else if (i.type === ItemType.Building) {
        // HACK hardcoded checks for schemes that are known to be used as "center kerbs"
        if (i.scheme === 'scheme20') {
          sectorDividers.push(i);
        }
      } else if (i.type === ItemType.Curve) {
        // HACK hardcoded checks for models that are known to be used as "center kerbs".
        // TODO parse def file, check model_desc has a path that starts with 'model/road_island/'
        if (i.model === '0i03a' || i.model === '0i03b') {
          sectorDividers.push(i);
        }
      }
    }

    dividers.push(
      ...sectorDividers.filter(
        (d): d is Building | Curve => d.type !== ItemType.Terrain,
      ),
    );
    for (const d of dividers) {
      referencedNodeUids.add(d.startNodeUid);
      referencedNodeUids.add(d.endNodeUid);
    }

    for (const r of sectorRoads) {
      const rStart = assertExists(nodesByUid.get(r.startNodeUid));
      const rEnd = assertExists(nodesByUid.get(r.endNodeUid));
      const splitsRoad = (t: Terrain | Building | Curve) => {
        const tStart = assertExists(nodesByUid.get(t.startNodeUid));
        const tEnd = assertExists(nodesByUid.get(t.endNodeUid));
        return (
          (distance(rStart, tStart) < threshold &&
            distance(rEnd, tEnd) < threshold) ||
          (distance(rStart, tEnd) < threshold &&
            distance(rEnd, tStart) < threshold)
        );
      };
      if (sectorDividers.some(splitsRoad)) {
        roads.push({
          ...r,
          maybeDivided: true,
        });
        splitCount++;
      } else {
        roads.push(r);
      }
    }
    bar.increment({ key });
  }
  logger.success(
    splitCount,
    'roads possibly split by terrains, buildings, or curves',
  );

  return {
    map,
    mapData: {
      nodes: sectorData.nodes.filter(n => referencedNodeUids.has(n.uid)),
      roads,
      ferries,
      prefabs,
      models,
      mapAreas,
      pois,
      dividers,
      countries: valuesWithTokens(defData.countries).map(withLocalizedName),
      cities: valuesWithTokens(cities).map(withLocalizedName),
      roadLooks: valuesWithTokens(defData.roadLooks),
      prefabDescriptions: valuesWithTokens(defData.prefabs),
      modelDescriptions: valuesWithTokens(defData.models),
    },
    icons,
  };
}

function valuesWithTokens<V>(map: Map<string, V>): (V & { token: string })[] {
  return [...map.entries()].map(([token, v]) => ({ token, ...v }));
}

function checkReference<T>(
  ref: T | readonly T[],
  store: { has(ref: T): boolean },
  fieldName: string,
  item: Item,
) {
  let refs: readonly T[];
  if (Array.isArray(ref)) {
    refs = ref;
  } else {
    // casting `as T` because
    // https://github.com/microsoft/TypeScript/issues/17002
    refs = [ref as T];
  }

  for (const ref of refs) {
    if (!store.has(ref)) {
      logger.warn(
        `unknown ${fieldName}`,
        ref,
        `for item`,
        `0x${item.uid.toString(16)}.`,
      );
    }
  }
}
