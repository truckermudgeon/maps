import { assert, assertExists } from '@truckermudgeon/base/assert';
import { Preconditions } from '@truckermudgeon/base/precon';
import { isLaneSpeedClass } from '@truckermudgeon/map/constants';
import type {
  Achievement,
  City,
  Company,
  Country,
  Ferry,
  FerryConnection,
  LaneSpeedClass,
  MileageTarget,
  ModelDescription,
  PrefabDescription,
  RoadLook,
  Route,
  SpeedLimits,
} from '@truckermudgeon/map/types';
import type { JSONSchemaType } from 'ajv';
import { logger } from '../logger';
import { convertSiiToJson } from './convert-sii-to-json';
import { parseModelPmg } from './model-pmg-parser';
import { parsePrefabPpd } from './prefab-ppd-parser';
import type { Entries } from './scs-archive';
import { parseSii } from './sii-parser';
import type {
  AtsAchievementsSii,
  BaseAchievementsSii,
  CitySii,
  CompanySii,
  CountrySii,
  Ets2AchievementsSii,
  FerrySii,
  MileageTargetsSii,
  ModelSii,
  PrefabSii,
  RoadLookSii,
  RouteSii,
  SpeedLimitsSii,
} from './sii-schemas';
import {
  AtsAchievementsSiiSchema,
  CargoSiiSchema,
  CityCompanySiiSchema,
  CitySiiSchema,
  CompanySiiSchema,
  CountrySiiSchema,
  Ets2AchievementsSiiSchema,
  FerryConnectionSiiSchema,
  FerrySiiSchema,
  MileageTargetsSiiSchema,
  ModelSiiSchema,
  PrefabSiiSchema,
  RoadLookSiiSchema,
  RouteSiiSchema,
  SpeedLimitSiiSchema,
  ViewpointsSiiSchema,
} from './sii-schemas';
import { includeDirectiveCollector } from './sii-visitors';

export function parseDefFiles(entries: Entries, application: 'ats' | 'eut2') {
  logger.log(
    'parsing',
    application,
    'def, prefab .ppd, and model .pmg files...',
  );
  const def = Preconditions.checkExists(entries.directories.get('def'));

  const cities = new Map<
    string,
    Omit<City, 'x' | 'y' | 'areas' | 'companies'>
  >();
  const countries = new Map<string, Country>();
  const companies = new Map<string, Company>();
  const ferries = new Map<
    string,
    Omit<Ferry, 'nodeUid' | 'x' | 'y' | 'connections' | 'train'> & {
      connections: Omit<
        FerryConnection,
        'nodeUid' | 'x' | 'y' | 'name' | 'nameLocalized'
      >[];
    }
  >();

  const processAndAdd = <T extends object, U extends { token: string }>(
    path: string,
    schema: JSONSchemaType<T>,
    p: (t: T, e: Entries) => U | undefined,
    m: Map<string, U>,
  ) => {
    const t = convertSiiToJson(path, entries, schema);
    const u = p(t, entries);
    if (u) {
      m.set(u.token, u);
    }
  };

  for (const f of def.files) {
    if (!/^(city|country|company|ferry)\./.test(f) || !f.endsWith('.sii')) {
      continue;
    }
    if (/\b(?:x_land|x_choco|xmas2023)\b/.test(f)) {
      continue; // skip Winterland community event
    }
    const includePaths = parseIncludeOnlySii(`def/${f}`, entries);
    for (const path of includePaths) {
      if (f.startsWith('city.')) {
        processAndAdd(path, CitySiiSchema, processCityJson, cities);
      } else if (f.startsWith('country.')) {
        const partialCountry = processCountryJson(
          convertSiiToJson(path, entries, CountrySiiSchema),
        );
        if (partialCountry) {
          const truckSpeedLimits = processSpeedLimitJson(
            convertSiiToJson(
              path.replace('.sui', '/speed_limits.sii'),
              entries,
              SpeedLimitSiiSchema,
            ),
          );
          countries.set(partialCountry.token, {
            ...partialCountry,
            truckSpeedLimits,
          });
        }
      } else if (f.startsWith('company.')) {
        processAndAdd(path, CompanySiiSchema, processCompanyJson, companies);
      } else if (f.startsWith('ferry.')) {
        processAndAdd(path, FerrySiiSchema, processFerryJson, ferries);
      } else {
        throw new Error();
      }
    }
  }
  logger.info('parsed', cities.size, 'cities');
  logger.info('parsed', countries.size, 'states/countries');
  logger.info('parsed', companies.size, 'companies');
  logger.info('parsed', ferries.size, 'ferry/train terminals');

  const defCompany = Preconditions.checkExists(
    entries.directories.get('def/company'),
  );
  for (const token of defCompany.subdirectories) {
    if (companies.has(token)) {
      continue;
    }
    const companyDefaults = {
      token,
      // TODO truck dealers _do_ have city tokens, found within the `editor` subdirectories.
      cityTokens: [],
      cargoInTokens: [],
      cargoOutTokens: [],
    };
    if (token.startsWith('pt_trk_')) {
      companies.set(token, {
        ...companyDefaults,
        name: 'Peterbilt',
      });
    } else if (token.startsWith('kw_trk_')) {
      companies.set(token, {
        ...companyDefaults,
        name: 'Kenworth',
      });
    } else if (token.startsWith('ws_trk_')) {
      companies.set(token, {
        ...companyDefaults,
        name: 'Western Star',
      });
    } else {
      logger.warn(token, 'has no company info');
    }
  }

  const defWorld = Preconditions.checkExists(
    entries.directories.get('def/world'),
  );
  const prefabs = new Map<string, PrefabDescription & { path: string }>();
  const roadLooks = new Map<string, RoadLook>();
  const models = new Map<string, ModelDescription>();
  const vegetation = new Set<string>();
  for (const f of defWorld.files) {
    if (!/^(prefab|road_look|model)\./.test(f) || !f.endsWith('.sii')) {
      continue;
    }

    if (f.startsWith('prefab.')) {
      const json = convertSiiToJson(`def/world/${f}`, entries, PrefabSiiSchema);
      processPrefabJson(json, entries).forEach((v, k) => prefabs.set(k, v));
    } else if (f.startsWith('model')) {
      const json = convertSiiToJson(`def/world/${f}`, entries, ModelSiiSchema);
      const { buildings, vegetation: _vegetation } = processModelJson(
        json,
        entries,
      );
      buildings.forEach((v, k) => models.set(k, v));
      _vegetation.forEach(v => vegetation.add(v));
    } else if (f.startsWith('road_look.')) {
      const json = convertSiiToJson(
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
  logger.info('parsed', vegetation.size, 'vegetation models');

  const mileageTargets: Map<string, MileageTarget> = processMileageTargetJson(
    convertSiiToJson(
      'def/sign/mileage_targets.sii',
      entries,
      MileageTargetsSiiSchema,
    ),
  );
  logger.info('parsed', mileageTargets.size, 'mileage targets');

  const defPhotoAlbum = Preconditions.checkExists(
    entries.directories.get('def/photo_album'),
  );
  const viewpoints = new Map<bigint, string>(); // item.uid to l10n token
  let itemCount = 0;
  for (const f of defPhotoAlbum.files) {
    if (!/^(viewpoints|landmarks)\.sui$/.test(f)) {
      continue;
    }
    const json = convertSiiToJson(
      `def/photo_album/${f}`,
      entries,
      ViewpointsSiiSchema,
    );
    const items = json.photoAlbumItem;
    for (const val of Object.values(items)) {
      itemCount++;
      for (const uid of val.objectsUid) {
        const token = val.name.replace(/(^@@)|(@@$)/g, '');
        viewpoints.set(uid, token);
      }
    }
  }
  logger.info('parsed', itemCount, 'viewpoints and photo trophies');

  const achievements =
    application === 'ats'
      ? processAtsAchievementsJson(
          convertSiiToJson(
            'def/achievements.sii',
            entries,
            AtsAchievementsSiiSchema,
          ),
        )
      : processEts2AchievementsJson(
          convertSiiToJson(
            'def/achievements.sii',
            entries,
            Ets2AchievementsSiiSchema,
          ),
        );
  logger.info('parsed', achievements.size, 'achievements');

  let routes: Map<string, Route>;
  if (entries.files.get('def/route.sii')) {
    routes = processRouteJson(
      convertSiiToJson('def/route.sii', entries, RouteSiiSchema),
    );
  } else {
    // if `def/route.sii` doesn't exist, then the installation doesn't have the
    // Special Transport DLC.
    routes = new Map();
  }
  logger.info('parsed', routes.size, 'special transport routes');

  return {
    achievements,
    routes,
    cities,
    countries,
    companies,
    ferries,
    prefabs,
    roadLooks,
    models,
    vegetation,
    mileageTargets,
    viewpoints,
  };
}

function parseIncludeOnlySii(siiPath: string, entries: Entries): string[] {
  logger.debug('parsing', siiPath, 'for @include directives');
  const f = Preconditions.checkExists(entries.files.get(siiPath));
  const res = parseSii(f.read().toString());
  if (!res.ok) {
    logger.error('error parsing', siiPath);
    throw new Error();
  }

  return includeDirectiveCollector.collect(res.cst, 'def');
}

function processCityJson(obj: CitySii) {
  if (!obj.cityData) {
    return;
  }
  const entries = Object.entries(obj.cityData);
  if (entries.length !== 1) {
    throw new Error();
  }
  const [token, rawCity] = entries[0];
  return {
    token: token.split('.')[1],
    name: rawCity.cityName,
    nameLocalized: rawCity.cityNameLocalized,
    countryToken: rawCity.country,
    population: rawCity.population ?? 0,
  };
}

function processCountryJson(obj: CountrySii) {
  if (!obj.countryData) {
    return;
  }
  const entries = Object.entries(obj.countryData);
  if (entries.length !== 1) {
    throw new Error();
  }
  const [token, rawCountry] = entries[0];
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

function toLaneSpeedClass(str: string): LaneSpeedClass {
  const lsc = str.replace(/(_[a-z0-9])/g, g => g.substring(1).toUpperCase());
  assert(isLaneSpeedClass(lsc));
  return lsc as LaneSpeedClass;
}

function processSpeedLimitJson(obj: SpeedLimitsSii) {
  const { laneSpeedClass, limit, maxLimit, urbanLimit } =
    obj.countrySpeedLimit['.speed_limit.truck'];

  // HACK: extra validation that isn't expressed in schema
  assert(
    [limit, maxLimit, urbanLimit].every(
      array => array.length === laneSpeedClass.length,
    ),
  );

  return laneSpeedClass.reduce((obj, className, index) => {
    obj[toLaneSpeedClass(className)] = {
      limit: limit[index],
      maxLimit: maxLimit[index],
      urbanLimit: urbanLimit[index],
    };
    return obj;
  }, {} as SpeedLimits);
}

function processCompanyJson(obj: CompanySii, entries: Entries): Company {
  const objEntries = Object.entries(obj.companyPermanent);
  const [token, rawCompany] = objEntries[0];
  const companyToken = token.split('.')[2];
  const cityTokens: string[] = [];
  const cargoInTokens: string[] = [];
  const cargoOutTokens: string[] = [];
  const editorFolder = entries.directories.get(
    `def/company/${companyToken}/editor`,
  );
  if (editorFolder) {
    for (const f of editorFolder.files) {
      const city = convertSiiToJson(
        `def/company/${companyToken}/editor/${f}`,
        entries,
        CityCompanySiiSchema,
      );
      for (const [, entry] of Object.entries(city.companyDef)) {
        cityTokens.push(entry.city);
      }
    }
  }
  for (const direction of ['in', 'out']) {
    const directionFolder = entries.directories.get(
      `def/company/${companyToken}/${direction}`,
    );
    if (directionFolder) {
      const arr = direction === 'in' ? cargoInTokens : cargoOutTokens;
      for (const f of directionFolder.files) {
        const cargo = convertSiiToJson(
          `def/company/${companyToken}/${direction}/${f}`,
          entries,
          CargoSiiSchema,
        );
        for (const [, entry] of Object.entries(cargo.cargoDef)) {
          arr.push(entry.cargo);
        }
      }
    }
  }

  return {
    token: companyToken,
    name: rawCompany.name,
    cityTokens,
    cargoInTokens,
    cargoOutTokens,
  };
}

function processFerryJson(obj: FerrySii, entries: Entries) {
  const objEntries = Object.entries(obj.ferryData);
  const [tokenPath, rawFerry] = objEntries[0];
  const token = tokenPath.split('.')[1];
  const defFerryConnection = Preconditions.checkExists(
    entries.directories.get('def/ferry/connection'),
  );
  const connections: Omit<
    FerryConnection,
    'nodeUid' | 'x' | 'y' | 'name' | 'nameLocalized'
  >[] = [];

  // find matching connection file for `token`.
  // do this because file names don't always match up with ferry tokens (i'm looking at you, travemunde_p).
  // this is A LOT of repeated work.
  // TODO read every file in the def/ferry/connections folder once, then match things up based on tokens.
  for (const f of defFerryConnection.files) {
    const json = convertSiiToJson(
      `def/ferry/connection/${f}`,
      entries,
      FerryConnectionSiiSchema,
    );
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
): {
  buildings: Map<string, ModelDescription & { path: string }>;
  vegetation: Set<string>;
} {
  const modelDef = obj.modelDef;
  if (!modelDef) {
    return {
      buildings: new Map(),
      vegetation: new Set(),
    };
  }

  const vegetation = new Set<string>(
    Object.entries(modelDef)
      .filter(([, o]) => o.vegetationModel != null)
      .map(([key]) => key.split('.')[1]),
  );
  const modelTuples = Object.entries(modelDef).map(
    ([key, o]) =>
      [key.split('.')[1], o.modelDesc?.substring(1)] as [
        string,
        string | undefined,
      ],
  );
  const buildings = new Map<string, ModelDescription & { path: string }>();
  for (const [token, path] of modelTuples) {
    if (path == null) {
      continue;
    }

    if (!path.endsWith('.pmd')) {
      continue;
    }
    const isProbablyBuildingModel =
      /^model2?\/building\//.exec(path) ??
      /^model2?\/panorama\/.*building/.exec(path);
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
    buildings.set(token, { path, ...pmg });
  }
  return { buildings, vegetation };
}

function processRoadLookJson(obj: RoadLookSii): Map<string, RoadLook> {
  const roadLook = obj.roadLook;
  if (!roadLook) {
    return new Map();
  }

  return new Map<string, RoadLook>(
    Object.entries(roadLook).map(([key, o]) => {
      const {
        name,
        lanesLeft = [],
        lanesRight = [],
        laneOffsetsLeft = [],
        laneOffsetsRight = [],
        shoulderSpaceLeft,
        shoulderSpaceRight,
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
          name,
          lanesLeft,
          lanesRight,
          offset,
          laneOffset,
          shoulderSpaceLeft,
          shoulderSpaceRight,
        },
      ];
    }),
  );
}

function processBaseAchievementsJson(
  obj: BaseAchievementsSii,
): Map<string, Achievement> {
  const achievements = new Map<string, Achievement>();

  //
  // achievementVisitCityData
  //
  for (const a of Object.values(obj.achievementVisitCityData)) {
    achievements.set(a.achievementName, {
      type: 'visitCityData',
      cities: a.cities,
    });
  }

  //
  // achievementDeliveryLogData
  //
  for (const a of Object.values(obj.achievementDeliveryLogData)) {
    const {
      cargos = [],
      sourceCities = [],
      sourceCompanies = [],
      targetCities = [],
    } = a;
    const locations = [
      ...sourceCities.map(city => ({ type: 'city', city }) as const),
      ...targetCities.map(city => ({ type: 'city', city }) as const),
      ...sourceCompanies.map(companyAndCity => {
        const [company, city] = companyAndCity.split('.');
        return { type: 'company', company, city } as const;
      }),
    ];
    achievements.set(a.achievementName, {
      type: 'deliveryLogData',
      locations,
      cargos,
    });
  }

  //
  // achievementDeliveryCompany
  //
  const deliveryCompanyKeys = Object.keys(obj.achievementDeliveryCompany);
  for (const a of Object.values(obj.achievementDelivery)) {
    // e.g., ".nv_quarries", for the condition ".nv_quarries.condition"
    const condition = a.condition.split('.')[1];
    const keys = deliveryCompanyKeys.filter(c => c.startsWith(`.${condition}`));
    if (!keys.length) {
      // if there's no company info, then the achievement is probably something
      // cargo-related, like tx_cotton, or is city-based (e.g., ib_a_coruna).
      logger.warn(
        'ignoring delivery achievement (no matching companies)',
        a.achievementName,
        a.condition,
      );
      continue;
    }

    const companies: {
      company: string;
      locationType: 'city' | 'country';
      locationToken: string;
    }[] = [];
    for (const k of keys) {
      const dc = assertExists(obj.achievementDeliveryCompany[k]);
      if (dc.cityName == null && dc.countryName == null) {
        // "any matching company" condition, like ks_salt.
        // currently unsupported.
        continue;
      }
      assert(!!dc.cityName !== !!dc.countryName);
      const company = {
        company: dc.companyName,
        locationType: dc.cityName ? 'city' : 'country',
        locationToken: assertExists(dc.cityName ?? dc.countryName),
      } as const;
      // HACK "deep" comparison
      if (!companies.find(c => JSON.stringify(c) === JSON.stringify(company))) {
        companies.push(company);
      }
    }
    if (companies.length === 0) {
      continue;
    }

    achievements.set(a.achievementName, {
      type: 'delivery',
      delivery: {
        type: 'company',
        companies,
      },
    });
  }

  //
  // achievementEachCompanyData
  //
  for (const a of Object.values(obj.achievementEachCompanyData)) {
    const { sources, targets } = a;
    assert(!!sources !== !!targets);
    const companies = (sources ?? targets)!.map(s => {
      const [company, city] = s.split('.');
      return { company, city };
    });
    achievements.set(a.achievementName, {
      type: 'eachCompanyData',
      role: targets ? 'target' : 'source',
      companies,
    });
  }

  //
  // achievementTriggerData
  //
  for (const a of Object.values(obj.achievementTriggerData)) {
    achievements.set(a.achievementName, {
      type: 'triggerData',
      param: a.triggerParam,
      count: a.target,
    });
  }

  //
  // achievementDeliverCargoData
  //
  for (const a of Object.values(obj.achievementDeliverCargoData)) {
    const { targets } = a;
    const companies = targets.map(s => {
      const [company, city] = s.split('.');
      return { company, city };
    });
    achievements.set(a.achievementName, {
      type: 'deliverCargoData',
      role: 'target',
      companies,
    });
  }

  //
  // achievementEachDeliveryPoint
  //
  for (const a of Object.values(obj.achievementEachDeliveryPoint)) {
    achievements.set(a.achievementName, {
      type: 'eachDeliveryPoint',
      sources: a.sources,
      targets: a.targets,
    });
  }

  //
  // achievementOversizeRoutesData
  //
  for (const a of Object.values(obj.achievementOversizeRoutesData)) {
    achievements.set(a.achievementName, {
      type: 'oversizeRoutesData',
    });
  }

  return achievements;
}

function processAtsAchievementsJson(
  obj: AtsAchievementsSii,
): Map<string, Achievement> {
  const achievements = processBaseAchievementsJson(obj);

  //
  // achievementFerryData
  //
  for (const a of Object.values(obj.achievementFerryData)) {
    achievements.set(a.achievementName, {
      type: 'ferryData',
      endpointA: a.endpointA,
      endpointB: a.endpointB,
    });
  }

  return achievements;
}

function processEts2AchievementsJson(
  obj: Ets2AchievementsSii,
): Map<string, Achievement> {
  const achievements = processBaseAchievementsJson(obj);

  //
  // achievementFerryData
  //
  for (const a of Object.values(obj.achievementFerryData)) {
    achievements.set(a.achievementName, {
      type: 'ferryDataByType',
      ferryType: a.ferryType,
    });
  }

  //
  // achievementDeliveryPointCity
  //
  const deliveryCityKeys = Object.keys(obj.achievementDeliveryPointCity);
  for (const a of Object.values(obj.achievementDelivery)) {
    // e.g., ".ib_a_coruna", for the condition ".ib_a_coruna.condition"
    const condition = a.condition.split('.')[1];
    const keys = deliveryCityKeys.filter(c => c.startsWith(`.${condition}`));
    if (!keys.length) {
      // if there's no city info, then the achievement is probably something
      // cargo-related, like bw_ore_caravan.
      logger.warn(
        'ignoring delivery achievement (no matching cities)',
        a.achievementName,
      );
      continue;
    }

    const cities: { cityToken: string }[] = [];
    for (const k of keys) {
      const dc = assertExists(obj.achievementDeliveryPointCity[k]);
      cities.push({ cityToken: dc.cityName });
    }

    if (achievements.has(a.achievementName)) {
      // if the achievement already exists, then the achievement is probably
      // something like gr_olive, where the source companies/cities are arguably
      // more important than the destination cities.
      logger.warn(
        'ignoring delivery achievement (already exists)',
        a.achievementName,
      );
    } else {
      achievements.set(a.achievementName, {
        type: 'delivery',
        delivery: {
          type: 'city',
          cities,
        },
      });
    }
  }

  //
  // achievementCompareData
  //
  for (const a of Object.values(obj.achievementCompareData)) {
    achievements.set(a.achievementName, {
      type: 'compareData',
      achievementName: a.achievementName,
    });
  }

  //
  // achievementVisitPrefabData
  //
  for (const a of Object.values(obj.achievementVisitPrefabData)) {
    achievements.set(a.achievementName, {
      type: 'visitPrefabData',
      prefab: a.prefab,
    });
  }

  return achievements;
}

function processRouteJson(obj: RouteSii): Map<string, Route> {
  const routes = new Map<string, Route>();
  for (const [key, route] of Object.entries(obj.routeData)) {
    const routeKey = assertExists(key.split('.')[1]);
    routes.set(routeKey, route);
  }
  return routes;
}

function processMileageTargetJson(
  obj: MileageTargetsSii,
): Map<string, MileageTarget> {
  const mileageTargets = new Map<string, MileageTarget>();
  for (const [key, rawTarget] of Object.entries(obj.mileageTarget)) {
    const token = assertExists(key.split('.')[1]);
    let target: MileageTarget = {
      token: token,
      editorName: rawTarget.editorName,
      defaultName: rawTarget.defaultName,
      nameVariants: Array.isArray(rawTarget.names) ? rawTarget.names : [],
      distanceOffset: rawTarget.distanceOffset,
    };
    // Some mileage targets are specified with a position, which we can use
    // directly. For other mileage targets, a node uid is given, which we'll
    // have to try to resolve later using data from map sector files.
    if (rawTarget.position.every(v => v != null)) {
      // SCS coordinates: easting, up, southing
      const [x, , y] = rawTarget.position.map(v => Math.round(v * 100) / 100);
      target = { ...target, x, y };
    } else if (rawTarget.nodeUid != null) {
      target = { ...target, nodeUid: rawTarget.nodeUid };
    } else {
      // A total lack of position information is rare, but it can happen for
      // test data or unreleased DLC. Either way, nothing we can do about it.
      logger.debug('skipping mileage target (no position, nor uid)', token);
      continue;
    }
    if (rawTarget.searchRadius >= 0) {
      target = { ...target, searchRadius: rawTarget.searchRadius };
    }
    mileageTargets.set(token, target);
  }
  return mileageTargets;
}
