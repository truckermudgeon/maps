import type { JSONSchemaType } from 'ajv';
import Ajv from 'ajv';
import AjvKeywords from 'ajv-keywords';

export const ajv = new Ajv();
AjvKeywords(ajv, 'transform');

// Workaround for bigint support
// https://github.com/ajv-validator/ajv/issues/1116#issuecomment-664821182
ajv.addKeyword({
  keyword: 'dataType',
  validate: (schema: string, data: unknown) => {
    if (schema === 'bigint') {
      return typeof data === 'bigint';
    }
    return ajv.compile({ type: schema })(data);
  },
  errors: true,
});

// The schemas and interfaces defined in this class are the bare minimum in
// order for map-files-parser.ts to work. They're incomplete and don't reflect
// the actual schema of a given .sii or .mat file.

// Using ajv to declare + validate schemas is kinda overkill, but the approach:
// - catches a lot of incorrect assumptions earlier in the parser dev process
// - can reveal important changes to files that need to be taken into account,
//   like the changes in icon .mat files to support SDF files.

const integer: JSONSchemaType<number> = { type: 'integer' } as const;
const number: JSONSchemaType<number> = { type: 'number' } as const;
const string: JSONSchemaType<string> = { type: 'string' } as const;
const null_: JSONSchemaType<null> = { type: 'null', nullable: true } as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
const bigint: JSONSchemaType<bigint> = { dataType: 'bigint' } as any;

type Tuple<T, N extends number, R extends T[] = []> = R['length'] extends N
  ? R
  : Tuple<T, N, [T, ...R]>;

const constInteger = <T extends number>(n: T) =>
  ({
    type: 'integer',
    minimum: n,
    maximum: n,
  }) as JSONSchemaType<T>;
const arrayOf = <T>(
  items: T,
  size: { minItems?: number; maxItems?: number } = { minItems: 1 },
) =>
  ({
    type: 'array',
    items,
    ...size,
  }) as const;
const fixedLengthArray = <T, N extends number>(
  item: JSONSchemaType<T>,
  length: N,
): JSONSchemaType<Tuple<T, N>> =>
  ({
    ...arrayOf(item),
    minItems: length,
    maxItems: length,
  }) as unknown as JSONSchemaType<Tuple<T, N>>;
const stringEnum = <T extends string>(...values: readonly T[]) =>
  ({
    type: 'string',
    enum: values,
  }) as const;
const stringPattern = (regex: RegExp) =>
  ({
    type: 'string',
    pattern: regex.source,
  }) as const;
const nullable = <T extends object>(t: T) =>
  ({
    ...t,
    nullable: true,
  }) as const;
const object = <T extends object, U extends keyof T>(
  properties: T,
  // TODO figure out a way to remove the need for this argument. It should be
  //  calculate-able, based on non-nullable `properties`.
  required: U[] = Object.keys(properties) as U[],
) => {
  return {
    type: 'object',
    properties,
    required,
  } as const;
};
const patternRecord = <T extends object, U extends keyof T>(
  pattern: RegExp,
  properties: T,
  required: U[] = Object.keys(properties) as U[],
) =>
  ({
    type: 'object',
    patternProperties: {
      [pattern.source]: object(properties, required),
    },
    required: [],
    minProperties: 1,
    additionalProperties: false,
  }) as const;

const numberTuple = fixedLengthArray(number, 2);
const numberTriple = fixedLengthArray(number, 3);
const numberQuadruple = fixedLengthArray(number, 4);
const stringArray = arrayOf(string);
const localeToken = stringPattern(/^@@.+@@$/);
const token = {
  ...stringPattern(/^[0-9a-z_]{1,12}$/),
  // ETS2 has some country and city names (e.g. Hungary, Odense) as capitalized
  // tokens. Lowercase them so they're valid tokens.
  transform: ['toLowerCase'],
};

// Debug helpers to parse any file as .sii file, without caring about schema/typing.
export type AnySii = Record<string, unknown>;
export const AnySiiSchema: JSONSchemaType<AnySii> = object({});

export interface VersionSii {
  fsPackSet: Record<
    string,
    {
      application: 'ats' | 'eut2';
      version: string;
    }
  >;
}
export const VersionSiiSchema: JSONSchemaType<VersionSii> = object({
  fsPackSet: patternRecord(/^_nameless(\.[0-9a-z_]{1,12}){2}$/, {
    application: stringEnum('ats', 'eut2'),
    version: stringPattern(/^\d+(\.\d+){3}$/),
  }),
});

export interface RouteSii {
  routeData: Record<
    string,
    {
      fromCity: string;
      toCity: string;
    }
  >;
}
export const RouteSiiSchema: JSONSchemaType<RouteSii> = object({
  routeData: patternRecord(/^route_data\.[0-9a-z_]{1,12}$/, {
    fromCity: token,
    toCity: token,
  }),
});

export interface AchievementsSii {
  achievementVisitCityData?: Record<
    string,
    {
      cities?: string[];
      achievementName: string;
    }
  >;
  achievementDeliveryLogData?: Record<
    string,
    {
      // one of the following combinations of string[] fields:
      // { cargos, sourceCompanies }
      // { cargos }
      // { sourceCities, targetCities }
      // { sourceCompanies }
      // { sourceCities }
      sourceCompanies?: string[];
      cargos?: string[];
      sourceCities?: string[];
      targetCities?: string[];
      achievementName: string;
    }
  >;
  achievementDelivery?: Record<
    string,
    {
      // e.g., `.ca_country.condition` and `.unload_diff.condition`.
      // first token should:
      // - be a known achievement id
      // - exist in either:
      //   - achievementDeliveryCompany
      //     - in which case, mark the city + company name
      //   - achievementDeliveryAny (e.g., unload_diff)
      //     - in which case, don't mark a location because it's too much work
      condition: string;
      target: number;
      achievementName: string;
    }
  >;
  achievementDeliveryCompany?: Record<
    string,
    {
      companyName: string;
      // if either `cityName` or `countryName` is present, then the other is
      // absent. note that they can both be absent.
      cityName?: string;
      countryName?: string;
    }
  >;
  achievementEachCompanyData?: Record<
    string,
    {
      // only one of `targets` or `sources` are expected to be present
      targets?: string[];
      sources?: string[];
      achievementName: string;
    }
  >;
  achievementTriggerData?: Record<
    string,
    {
      triggerParam: string;
      target: number;
      achievementName: string;
    }
  >;
  achievementOversizeRoutesData?: Record<
    string,
    {
      achievementName: string;
    }
  >;
  achievementDeliverCargoData?: Record<
    string,
    {
      targets: string[];
      achievementName: string;
    }
  >;
  achievementEachDeliveryPoint?: Record<
    string,
    {
      // grab second tokens of strings in both arrays; the resulting set is a
      // set of city tokens that can be marked, e.g.:
      //
      //    sources: [ ".bw_pris_bije.bijelo_polje" ],
      //    targets: [ ".bw_pris_bije.pristina" ]
      //
      // and:
      //
      //    sources: [
      //      ".id_snake_riv.kennewick.lewiston.source",
      //      ".id_snake_riv.boise.twin_falls.source",
      //      ".id_snake_riv.twin_falls.pocatello.source",
      //      ".id_snake_riv.pocatello.idaho_falls.source"
      //    ],
      //    targets: [
      //      ".id_snake_riv.kennewick.lewiston.target",
      //      ".id_snake_riv.boise.twin_falls.target",
      //      ".id_snake_riv.twin_falls.pocatello.target",
      //      ".id_snake_riv.pocatello.idaho_falls.target"
      //    ]

      sources: string[];
      targets: string[];
      achievementName: string;
    }
  >;
  achievementFerryData?: Record<
    string,
    {
      achievementName: string;
      ferryType: 'all' | 'train' | 'ferry';
      endpointA?: string;
      endpointB?: string;
    }
  >;
  // referenced by achievementDelivery, e.g. ib_a_coruna
  achievementDeliveryPointCity?: Record<
    string,
    {
      role: 'source' | 'target';
      cityName: string;
    }
  >;
  achievementCompareData?: Record<
    string,
    {
      achievementName: string;
    }
  >;
  achievementVisitPrefabData?: Record<
    string,
    {
      prefab: string;
      achievementName: string;
    }
  >;
}

export const AchievementsSiiSchema: JSONSchemaType<AchievementsSii> = object(
  {
    achievementVisitCityData: nullable(
      patternRecord(
        /^\.achievement\.[a-z]{2}_visit_[a-z]{3}$/,
        {
          cities: nullable(stringArray), // Iowa pre-release data has missing `cities` field.
          achievementName: string,
        },
        ['achievementName'],
      ),
    ),
    achievementDeliveryLogData: nullable(
      patternRecord(
        /^\.achievement\.[0-9a-z_]{1,12}$/,
        {
          sourceCompanies: nullable(stringArray),
          cargos: nullable(stringArray),
          sourceCities: nullable(stringArray),
          targetCities: nullable(stringArray),
          achievementName: string,
        },
        ['achievementName'],
      ),
    ),
    achievementDelivery: nullable(
      patternRecord(/^\.achievement\.[0-9a-z_]{1,12}$/, {
        condition: stringPattern(/^\.[0-9a-z_]{1,12}\.condition$/),
        target: integer,
        achievementName: string,
      }),
    ),
    achievementDeliveryCompany: nullable(
      patternRecord(
        /^(\.[0-9a-z_]{1,12}){2,4}$/,
        {
          companyName: token,
          cityName: nullable(token),
          countryName: nullable(token),
        },
        ['companyName'],
      ),
    ),
    achievementEachCompanyData: nullable(
      patternRecord(
        /^\.achievement\.[0-9a-z_]{1,12}$/,
        {
          targets: nullable(stringArray),
          sources: nullable(stringArray),
          achievementName: string,
        },
        ['achievementName'],
      ),
    ),
    achievementTriggerData: nullable(
      patternRecord(/^\.achievement\.[0-9a-z_]{1,12}$/, {
        triggerParam: string,
        target: integer,
        achievementName: string,
      }),
    ),
    achievementOversizeRoutesData: nullable(
      patternRecord(/^\.achievement\.[0-9a-z_]{1,12}$/, {
        achievementName: string,
      }),
    ),
    achievementDeliverCargoData: nullable(
      patternRecord(/^\.achievement\.[0-9a-z_]{1,12}$/, {
        targets: stringArray,
        achievementName: string,
      }),
    ),
    achievementEachDeliveryPoint: nullable(
      patternRecord(/^\.achievement\.[0-9a-z_]{1,12}$/, {
        sources: stringArray,
        targets: stringArray,
        achievementName: string,
      }),
    ),
    achievementFerryData: nullable(
      patternRecord(
        /^\.achievement\.[0-9a-z_]{1,12}$/,
        {
          endpointA: nullable(token),
          endpointB: nullable(token),
          achievementName: string,
          ferryType: stringEnum('all', 'ferry', 'train'),
        },
        ['achievementName'],
      ),
    ),
    achievementDeliveryPointCity: nullable(
      patternRecord(/^(\.[0-9a-z_]{1,12}){3,4}$/, {
        role: stringEnum('source', 'target'),
        cityName: token,
      }),
    ),
    achievementCompareData: nullable(
      patternRecord(/^\.achievement\.[0-9a-z_]{1,12}$/, {
        achievementName: string,
      }),
    ),
    achievementVisitPrefabData: nullable(
      patternRecord(/^\.achievement\.[0-9a-z_]{1,12}$/, {
        prefab: token,
        achievementName: string,
      }),
    ),
  },
  [],
);

/** Only one of `effect` or `material` are expected to be present. */
export interface IconMat {
  effect?: {
    'ui.rfx'?: IconMatRfx;
    'ui.sdf.rfx'?: IconMatSdfRfx;
  };
  material?: { ui: { texture: string } };
}
// Break up the above into separate interfaces to workaround some typing issues.
interface IconMatRfx {
  texture: { texture: { source: string } };
}
interface IconMatSdfRfx {
  texture: { texture: { source: string } };
  aux: Tuple<Tuple<number, 4>, 5>;
}
const IconMatRfxSchema = object({
  texture: object({ texture: object({ source: string }) }),
});
const IconMatSdfRfxSchema = object({
  texture: object({ texture: object({ source: string }) }),
  aux: fixedLengthArray(numberQuadruple, 5),
});
export const IconMatSchema: JSONSchemaType<IconMat> = object(
  {
    effect: nullable(
      object(
        {
          'ui.rfx': nullable(IconMatRfxSchema),
          'ui.sdf.rfx': nullable(IconMatSdfRfxSchema),
        },
        [],
      ),
    ),
    material: nullable(object({ ui: object({ texture: string }) })),
  },
  [],
);

export interface LocalizationSii {
  localizationDb: {
    '.localization':
      | {
          key: string[];
          val: string[];
        }
      // Some l10n files are empty, e.g., ETS's locale/bg_bg/local.override.sii
      | Record<string, never>;
  };
}
export const LocalizationSiiSchema: JSONSchemaType<LocalizationSii> = object({
  localizationDb: object({
    '.localization': object(
      {
        key: stringArray,
        val: stringArray,
      },
      [],
    ),
  }),
});

export interface FerrySii {
  ferryData: Record<
    string,
    {
      ferryName: string;
      ferryNameLocalized?: string;
    }
  >;
}
export const FerrySiiSchema: JSONSchemaType<FerrySii> = object({
  ferryData: patternRecord(
    /^ferry\.[0-9a-z_]{1,12}$/,
    {
      ferryName: string,
      ferryNameLocalized: nullable(localeToken),
    },
    ['ferryName'],
  ),
});

export interface CompanySii {
  companyPermanent: Record<string, { name: string }>;
}
export const CompanySiiSchema: JSONSchemaType<CompanySii> = object({
  companyPermanent: patternRecord(/^company\.permanent\.[0-9a-z_]{1,12}$/, {
    name: string,
  }),
});

export interface CountrySii {
  countryData?: Record<
    string,
    {
      name: string;
      nameLocalized: string;
      countryCode: string;
      countryId: number;
      pos: [number, number, number];
    }
  >;
}
export const CountrySiiSchema: JSONSchemaType<CountrySii> = object(
  {
    countryData: nullable(
      patternRecord(/^country\.data\.[0-9a-z_]{1,12}$/, {
        name: string,
        nameLocalized: localeToken,
        countryCode: string,
        countryId: integer,
        pos: numberTriple,
      }),
    ),
  },
  [],
);

export interface CitySii {
  cityData?: Record<
    string,
    {
      cityName: string;
      cityNameLocalized: string;
      country: string;
      population?: number;
    }
  >;
}
export const CitySiiSchema: JSONSchemaType<CitySii> = object(
  {
    cityData: nullable(
      patternRecord(
        /^city\.[0-9a-z_]{1,12}$/,
        {
          cityName: string,
          cityNameLocalized: localeToken,
          country: token,
          population: nullable(integer),
        },
        ['cityName', 'cityNameLocalized', 'country'],
      ),
    ),
  },
  [],
);

export interface MileageTargetsSii {
  mileageTarget: Record<
    string,
    {
      editorName: string;
      defaultName: string;
      // The number zero as `names` signifies an empty array of strings.
      names: 0 | string[];
      distanceOffset: number;
      nodeUid?: bigint;
      position: [number, number, number] | [null, null, null];
      searchRadius: number;
    }
  >;
}
export const MileageTargetsSiiSchema: JSONSchemaType<MileageTargetsSii> =
  object(
    {
      mileageTarget: patternRecord(
        /^mileage\.[0-9a-z_]{1,12}$/,
        {
          editorName: string,
          defaultName: string,
          names: { anyOf: [constInteger(0), stringArray] },
          distanceOffset: number,
          // `nodeUid` is optional, but the `nullable` combinator can't be used
          // here because it's not compatible with the custom `bigint`
          // descriptor. instead, cast it to the type that `nullable` produces.
          nodeUid: bigint as typeof bigint & { nullable: true },
          position: {
            anyOf: [fixedLengthArray(number, 3), fixedLengthArray(null_, 3)],
          },
          searchRadius: number,
        },
        [
          'editorName',
          'defaultName',
          'names',
          'distanceOffset',
          'position',
          'searchRadius',
        ],
      ),
    },
    [],
  );

export interface ViewpointsSii {
  photoAlbumItem: Record<
    string,
    {
      name: string;
      dlcId: string;
      objectsUid: bigint[];
    }
  >;
  photoAlbumGroup: Record<
    string,
    {
      name: string;
      items: string[];
    }
  >;
}
export const ViewpointsSiiSchema: JSONSchemaType<ViewpointsSii> = object({
  photoAlbumItem: patternRecord(
    /^album\.(viewpoints|landmarks)\.[0-9a-z_]{1,12}$/,
    {
      name: localeToken,
      dlcId: token,
      objectsUid: arrayOf(bigint),
    },
  ),
  photoAlbumGroup: patternRecord(
    /^album\.(viewpoints|landmarks)\.[0-9a-z_]{1,12}$/,
    {
      name: localeToken,
      items: stringArray,
    },
  ),
});

interface FerryConnectionSii {
  ferryConnection: Record<
    string,
    {
      price: number;
      time: number;
      distance: number;
      connectionPositions?: [number, number, number][];
      connectionDirections?: [number, number, number][];
    }
  >;
}
export const FerryConnectionSiiSchema: JSONSchemaType<FerryConnectionSii> =
  object({
    ferryConnection: patternRecord(
      /^conn(\.[0-9a-z_]{1,12}){2}$/,
      {
        price: number,
        time: number,
        distance: number,
        connectionPositions: nullable(arrayOf(numberTriple)),
        connectionDirections: nullable(arrayOf(numberTriple)),
      },
      ['price', 'time', 'distance'],
    ),
  });

export interface PrefabSii {
  prefabModel?: Record<string, { prefabDesc: string; modelDesc: string }>;
}
export const PrefabSiiSchema: JSONSchemaType<PrefabSii> = object(
  {
    prefabModel: nullable(
      patternRecord(/^prefab\.[0-9a-z_]{1,12}$/, {
        prefabDesc: string,
        modelDesc: string,
      }),
    ),
  },
  [],
);

export interface ModelSii {
  modelDef?: Record<string, { modelDesc?: string; vegetationModel?: string }>;
}
export const ModelSiiSchema: JSONSchemaType<ModelSii> = object(
  {
    modelDef: nullable(
      patternRecord(
        /^model\.[0-9a-z_]{1,12}$/,
        {
          modelDesc: nullable(string),
          vegetationModel: nullable(string),
        },
        [],
      ),
    ),
  },
  [],
);

export interface RoadLookSii {
  roadLook?: Record<
    string,
    {
      name: string;
      lanesLeft?: string[];
      lanesRight?: string[];
      roadSizeLeft?: number;
      roadSizeRight?: number;
      roadOffset?: number;
      centerLineLeftOffset?: number;
      centerLineRightOffset?: number;
      shoulderSpaceLeft?: number;
      shoulderSpaceRight?: number;
      laneOffsetsLeft?: [number, number][];
      laneOffsetsRight?: [number, number][];
    }
  >;
}
// TODO do something with roadTemplateVariant (see road_look.template.sii)?
export const RoadLookSiiSchema: JSONSchemaType<RoadLookSii> = object(
  {
    roadLook: nullable(
      patternRecord(
        /^road\.[0-9a-z_]{1,12}$/,
        {
          name: string,
          lanesLeft: nullable(stringArray),
          lanesRight: nullable(stringArray),
          roadSizeLeft: nullable(number),
          roadSizeRight: nullable(number),
          roadOffset: nullable(number),
          centerLineLeftOffset: nullable(number),
          centerLineRightOffset: nullable(number),
          shoulderSpaceLeft: nullable(number),
          shoulderSpaceRight: nullable(number),
          laneOffsetsLeft: nullable(arrayOf(numberTuple)),
          laneOffsetsRight: nullable(arrayOf(numberTuple)),
        },
        ['name'],
      ),
    ),
  },
  [],
);

type AtsLaneSpeedClass = 'local_road' | 'divided_road' | 'freeway';
type Ets2LaneSpeedClass =
  | 'local_road'
  | 'expressway'
  | 'motorway'
  | 'slow_road';
type LaneSpeedClass = AtsLaneSpeedClass | Ets2LaneSpeedClass;
export interface SpeedLimitsSii {
  countrySpeedLimit: {
    '.speed_limit.truck': {
      // the following fields represent parallel arrays
      laneSpeedClass: LaneSpeedClass[];
      limit: number[];
      urbanLimit: number[];
      maxLimit: number[];
    };
  };
}
export const SpeedLimitSiiSchema: JSONSchemaType<SpeedLimitsSii> = object({
  countrySpeedLimit: object({
    ['.speed_limit.truck']: object({
      laneSpeedClass: arrayOf(
        stringEnum(
          'local_road',
          'divided_road',
          'freeway',
          'expressway',
          'motorway',
          'slow_road',
        ),
        // truck speed limits, at minimum, define:
        // - local_road
        // - divided_road (or expressway, in ETS2)
        // - freeway (or motorway, in ETS2)
        { minItems: 3 },
      ),
      limit: arrayOf(number),
      urbanLimit: arrayOf(number),
      maxLimit: arrayOf(number),
    }),
  }),
});

export interface CityCompanySii {
  companyDef: Record<string, { city: string }>;
}
export const CityCompanySiiSchema: JSONSchemaType<CityCompanySii> = object({
  companyDef: patternRecord(/^\.[0-9a-z_]{1,12}$/, {
    city: token,
  }),
});

export interface CargoSii {
  cargoDef: Record<string, { cargo: string }>;
}
export const CargoSiiSchema: JSONSchemaType<CargoSii> = object({
  cargoDef: patternRecord(/^\.[0-9a-z_]{1,12}$/, {
    // Note: more information (like l18n strings) for `cargo.foo` can be found in defs/cargo/foo.sui.
    cargo: stringPattern(/^cargo\.[0-9a-z_]{1,12}$/),
  }),
});
