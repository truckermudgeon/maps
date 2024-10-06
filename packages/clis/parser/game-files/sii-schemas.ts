import type { JSONSchemaType } from 'ajv';
import Ajv from 'ajv';

export const ajv = new Ajv();
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

const NumberTupleSchema: JSONSchemaType<[number, number]> = {
  type: 'array',
  items: [{ type: 'number' }, { type: 'number' }],
  minItems: 2,
  maxItems: 2,
};
const NumberTripleSchema: JSONSchemaType<[number, number, number]> = {
  type: 'array',
  items: [{ type: 'number' }, { type: 'number' }, { type: 'number' }],
  minItems: 3,
  maxItems: 3,
};
const NumberQuadrupleSchema: JSONSchemaType<[number, number, number, number]> =
  {
    type: 'array',
    items: [
      { type: 'number' },
      { type: 'number' },
      { type: 'number' },
      { type: 'number' },
    ],
    minItems: 4,
    maxItems: 4,
  };
const StringArraySchema: JSONSchemaType<string[]> = {
  type: 'array',
  items: { type: 'string' },
  minItems: 1,
};
const LocaleTokenSchema: JSONSchemaType<string> = {
  type: 'string',
  pattern: '^@@.+@@$',
};
const TokenStringSchema: JSONSchemaType<string> = {
  type: 'string',
  pattern: '^[0-9a-z_]{1,12}$',
};

export interface RouteSii {
  routeData: Record<
    string,
    {
      fromCity: string;
      toCity: string;
    }
  >;
}
export const RouteSiiSchema: JSONSchemaType<RouteSii> = {
  type: 'object',
  properties: {
    routeData: {
      type: 'object',
      patternProperties: {
        '^\\.route_data\\.[a-z][a-z]{1,12}': {
          type: 'object',
          properties: {
            fromCity: { type: 'string' },
            toCity: { type: 'string' },
          },
          required: ['fromCity', 'toCity'],
        },
      },
      required: [],
      minProperties: 1,
    },
  },
  required: ['routeData'],
};

export interface AchievementsSii {
  achievementVisitCityData: Record<
    string,
    {
      cities: string[];
      achievementName: string;
    }
  >;
  achievementDelivery: Record<
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
  achievementDeliveryCompany: Record<
    string,
    {
      companyName: string;
      // if either `cityName` or `countryName` is present, then the other is
      // absent. note that they can both be absent.
      cityName?: string;
      countryName?: string;
    }
  >;
  //  achievementDeliveryPointCountry: Record<
  //    string,
  //    {
  //      role: string;
  //      countryName: string;
  //    }
  //  >;
  achievementEachCompanyData: Record<
    string,
    {
      // only one of `targets` or `sources` are expected to be present
      targets?: string[];
      sources?: string[];
      achievementName: string;
    }
  >;
  achievementTriggerData: Record<
    string,
    {
      triggerParam: string;
      target: number;
      achievementName: string;
    }
  >;
  achievementOversizeRoutesData: Record<
    string,
    {
      achievementName: string;
    }
  >;
  achievementDeliverCargoData: Record<
    string,
    {
      targets: string[];
      achievementName: string;
    }
  >;
  achievementFerryData: Record<
    string,
    {
      endpointA: string;
      endpointB: string;
      achievementName: string;
    }
  >;
  achievementEachDeliveryPoint: Record<
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
}
export const AchievementsSiiSchema: JSONSchemaType<AchievementsSii> = {
  type: 'object',
  properties: {
    achievementVisitCityData: {
      type: 'object',
      patternProperties: {
        '^\\.achievement\\.[a-z][a-z]_visit_cit': {
          type: 'object',
          properties: {
            cities: StringArraySchema,
            achievementName: { type: 'string' },
          },
          required: ['cities', 'achievementName'],
        },
      },
      required: [],
      minProperties: 1,
    },
    achievementDelivery: {
      type: 'object',
      patternProperties: {
        '^\\.achievement\\.[0-9a-z_]{1,12}': {
          type: 'object',
          properties: {
            condition: {
              type: 'string',
              pattern: '^\\.[0-9a-z_]{1,12}\\.condition$',
            },
            target: { type: 'integer' },
            achievementName: { type: 'string' },
          },
          required: ['condition', 'achievementName'],
        },
      },
      required: [],
      minProperties: 1,
    },
    achievementDeliveryCompany: {
      type: 'object',
      patternProperties: {
        '^\\.achievement\\.[0-9a-z_]{1,12}': {
          type: 'object',
          properties: {
            companyName: TokenStringSchema,
            cityName: { ...TokenStringSchema, nullable: true },
            countryName: { ...TokenStringSchema, nullable: true },
          },
          required: ['companyName'],
        },
      },
      required: [],
      minProperties: 1,
    },
    //    achievementDeliveryPointCountry: {
    //      type: 'object',
    //      patternProperties: {
    //        '^\\.achievement\\.[0-9a-z_]{1,12}': {
    //          type: 'object',
    //          properties: {
    //            role: { type: 'string' },
    //            countryName: TokenStringSchema,
    //          },
    //          required: ['role', 'countryName'],
    //        },
    //      },
    //      required: [],
    //      minProperties: 1,
    //    },
    achievementEachCompanyData: {
      type: 'object',
      patternProperties: {
        '^\\.achievement\\.[0-9a-z_]{1,12}': {
          type: 'object',
          properties: {
            targets: { ...StringArraySchema, nullable: true },
            sources: { ...StringArraySchema, nullable: true },
            achievementName: { type: 'string' },
          },
          required: ['achievementName'],
        },
      },
      required: [],
      minProperties: 1,
    },
    achievementTriggerData: {
      type: 'object',
      patternProperties: {
        '^\\.achievement\\.[0-9a-z_]{1,12}': {
          type: 'object',
          properties: {
            triggerParam: { type: 'string' },
            target: { type: 'integer' },
            achievementName: { type: 'string' },
          },
          required: ['triggerParam', 'target', 'achievementName'],
        },
      },
      required: [],
      minProperties: 1,
    },
    achievementOversizeRoutesData: {
      type: 'object',
      patternProperties: {
        '^\\.achievement\\.[0-9a-z_]{1,12}': {
          type: 'object',
          properties: {
            achievementName: { type: 'string' },
          },
          required: ['achievementName'],
        },
      },
      required: [],
      minProperties: 1,
      maxProperties: 1,
    },
    achievementDeliverCargoData: {
      type: 'object',
      patternProperties: {
        '^\\.achievement\\.[0-9a-z_]{1,12}': {
          type: 'object',
          properties: {
            targets: StringArraySchema,
            achievementName: { type: 'string' },
          },
          required: ['targets', 'achievementName'],
        },
      },
      required: [],
      minProperties: 1,
    },
    achievementFerryData: {
      type: 'object',
      patternProperties: {
        '^\\.achievement\\.[0-9a-z_]{1,12}': {
          type: 'object',
          properties: {
            endpointA: TokenStringSchema,
            endpointB: TokenStringSchema,
            achievementName: { type: 'string' },
          },
          required: ['endpointA', 'endpointB', 'achievementName'],
        },
      },
      required: [],
      minProperties: 1,
    },
    achievementEachDeliveryPoint: {
      type: 'object',
      patternProperties: {
        '^\\.achievement\\.[0-9a-z_]{1,12}': {
          type: 'object',
          properties: {
            sources: StringArraySchema,
            targets: StringArraySchema,
            achievementName: { type: 'string' },
          },
          required: ['sources', 'targets', 'achievementName'],
        },
      },
      required: [],
      minProperties: 1,
    },
  },
  required: [
    'achievementVisitCityData',
    'achievementDelivery',
    'achievementDeliveryCompany',
    // 'achievementDeliveryPointCountry',
    'achievementEachCompanyData',
    'achievementTriggerData',
    'achievementOversizeRoutesData',
    'achievementDeliverCargoData',
    'achievementFerryData',
  ],
};

/** Only one of `effect` or `material` are expected to be present. */
export interface IconMat {
  effect?: {
    'ui.rfx'?: { texture: { texture: { source: string } } };
    'ui.sdf.rfx'?: {
      texture: { texture: { source: string } };
      aux: [number, number, number, number][]; // will always have 5 quads
    };
  };
  material?: { ui: { texture: string } };
}
export const IconMatSchema: JSONSchemaType<IconMat> = {
  type: 'object',
  properties: {
    effect: {
      type: 'object',
      nullable: true,
      properties: {
        'ui.rfx': {
          type: 'object',
          nullable: true,
          properties: {
            texture: {
              type: 'object',
              properties: {
                texture: {
                  type: 'object',
                  properties: { source: { type: 'string' } },
                  required: ['source'],
                },
              },
              required: ['texture'],
            },
          },
          required: ['texture'],
        },
        'ui.sdf.rfx': {
          type: 'object',
          nullable: true,
          properties: {
            texture: {
              type: 'object',
              properties: {
                texture: {
                  type: 'object',
                  properties: { source: { type: 'string' } },
                  required: ['source'],
                },
              },
              required: ['texture'],
            },
            aux: {
              type: 'array',
              items: NumberQuadrupleSchema,
              minItems: 5,
              maxItems: 5,
            },
          },
          required: ['texture', 'aux'],
        },
      },
      required: [],
    },
    material: {
      type: 'object',
      nullable: true,
      properties: {
        ui: {
          type: 'object',
          properties: { texture: { type: 'string' } },
          required: ['texture'],
        },
      },
      required: ['ui'],
    },
  },
  required: [],
};

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
export const LocalizationSiiSchema: JSONSchemaType<LocalizationSii> = {
  type: 'object',
  properties: {
    localizationDb: {
      type: 'object',
      properties: {
        '.localization': {
          type: 'object',
          properties: {
            key: StringArraySchema,
            val: StringArraySchema,
          },
          required: [],
        },
      },
      required: ['.localization'],
    },
  },
  required: ['localizationDb'],
};

export interface FerrySii {
  ferryData: Record<
    string,
    {
      ferryName: string;
      ferryNameLocalized?: string;
    }
  >;
}
export const FerrySiiSchema: JSONSchemaType<FerrySii> = {
  type: 'object',
  properties: {
    ferryData: {
      type: 'object',
      patternProperties: {
        '^ferry\\..*$': {
          type: 'object',
          properties: {
            ferryName: { type: 'string' },
            ferryNameLocalized: { ...LocaleTokenSchema, nullable: true },
          },
          required: ['ferryName'],
        },
      },
      required: [],
      minProperties: 1,
      maxProperties: 1,
    },
  },
  required: ['ferryData'],
};

export interface CompanySii {
  companyPermanent: Record<string, { name: string }>;
}
export const CompanySiiSchema: JSONSchemaType<CompanySii> = {
  type: 'object',
  properties: {
    companyPermanent: {
      type: 'object',
      patternProperties: {
        '^company\\.permanent\\..*$': {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
      },
      required: [],
      minProperties: 1,
      maxProperties: 1,
    },
  },
  required: ['companyPermanent'],
};

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
export const CountrySiiSchema: JSONSchemaType<CountrySii> = {
  type: 'object',
  properties: {
    countryData: {
      type: 'object',
      nullable: true,
      patternProperties: {
        '^country\\.data\\..*$': {
          type: 'object',
          properties: {
            name: { type: 'string' },
            nameLocalized: LocaleTokenSchema,
            countryCode: { type: 'string' },
            countryId: { type: 'integer' },
            pos: NumberTripleSchema,
          },
          required: [
            'name',
            'nameLocalized',
            'countryCode',
            'countryId',
            'pos',
          ],
        },
      },
      required: [],
      maxProperties: 1,
    },
  },
  required: [],
};

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
export const CitySiiSchema: JSONSchemaType<CitySii> = {
  type: 'object',
  properties: {
    cityData: {
      type: 'object',
      nullable: true,
      patternProperties: {
        '^city\\..*$': {
          type: 'object',
          properties: {
            cityName: { type: 'string' },
            cityNameLocalized: LocaleTokenSchema,
            country: { type: 'string' },
            population: { type: 'integer', nullable: true },
          },
          required: ['cityName', 'cityNameLocalized', 'country'],
        },
      },
      required: [],
      maxProperties: 1,
    },
  },
  required: [],
};

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
export const ViewpointsSiiSchema: JSONSchemaType<ViewpointsSii> = {
  type: 'object',
  properties: {
    photoAlbumItem: {
      type: 'object',
      patternProperties: {
        '^album\\.viewpoints\\..*$': {
          type: 'object',
          properties: {
            name: LocaleTokenSchema,
            dlcId: { type: 'string' },
            objectsUid: {
              type: 'array',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
              items: { dataType: 'bigint' } as any,
              maxItems: 1,
            },
          },
          required: ['name', 'dlcId', 'objectsUid'],
        },
      },
      required: [],
    },
    photoAlbumGroup: {
      type: 'object',
      patternProperties: {
        '^album\\.viewpoints\\..*$': {
          type: 'object',
          properties: {
            name: LocaleTokenSchema,
            items: StringArraySchema,
          },
          required: ['name', 'items'],
        },
      },
      required: [],
    },
  },
  required: ['photoAlbumItem', 'photoAlbumGroup'],
};

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
export const FerryConnectionSiiSchema: JSONSchemaType<FerryConnectionSii> = {
  type: 'object',
  properties: {
    ferryConnection: {
      type: 'object',
      patternProperties: {
        '^conn\\..*$': {
          type: 'object',
          properties: {
            price: { type: 'number' },
            time: { type: 'number' },
            distance: { type: 'number' },
            connectionPositions: {
              type: 'array',
              nullable: true,
              items: NumberTripleSchema,
            },
            connectionDirections: {
              type: 'array',
              nullable: true,
              items: NumberTripleSchema,
            },
          },
          required: ['price', 'time', 'distance'],
        },
      },
      required: [],
      minProperties: 1,
      maxProperties: 1,
    },
  },
  required: ['ferryConnection'],
};

export interface PrefabSii {
  prefabModel?: Record<string, { prefabDesc: string; modelDesc: string }>;
}
export const PrefabSiiSchema: JSONSchemaType<PrefabSii> = {
  type: 'object',
  properties: {
    prefabModel: {
      type: 'object',
      nullable: true,
      patternProperties: {
        '^prefab\\..*$': {
          type: 'object',
          properties: {
            prefabDesc: { type: 'string' },
            modelDesc: { type: 'string' },
          },
          required: ['prefabDesc', 'modelDesc'],
        },
      },
      required: [],
    },
  },
};

export interface ModelSii {
  modelDef?: Record<string, { modelDesc?: string; vegetationModel?: string }>;
}
export const ModelSiiSchema: JSONSchemaType<ModelSii> = {
  type: 'object',
  properties: {
    modelDef: {
      type: 'object',
      nullable: true,
      patternProperties: {
        '^model\\..*$': {
          type: 'object',
          properties: {
            modelDesc: { type: 'string', nullable: true },
            vegetationModel: { type: 'string', nullable: true },
          },
        },
      },
      required: [],
    },
  },
};

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
export const RoadLookSiiSchema: JSONSchemaType<RoadLookSii> = {
  type: 'object',
  properties: {
    roadLook: {
      type: 'object',
      nullable: true,
      patternProperties: {
        '^road\\..*$': {
          type: 'object',
          properties: {
            name: { type: 'string' },
            lanesLeft: { ...StringArraySchema, nullable: true },
            lanesRight: { ...StringArraySchema, nullable: true },
            roadSizeLeft: { type: 'number', nullable: true },
            roadSizeRight: { type: 'number', nullable: true },
            roadOffset: { type: 'number', nullable: true },
            centerLineLeftOffset: { type: 'number', nullable: true },
            centerLineRightOffset: { type: 'number', nullable: true },
            shoulderSpaceLeft: { type: 'number', nullable: true },
            shoulderSpaceRight: { type: 'number', nullable: true },
            laneOffsetsLeft: {
              type: 'array',
              nullable: true,
              items: NumberTupleSchema,
            },
            laneOffsetsRight: {
              type: 'array',
              nullable: true,
              items: NumberTupleSchema,
            },
          },
          required: ['name'],
        },
      },
      required: [],
    },
  },
};

export interface CityCompanySii {
  companyDef: Record<string, { city: string }>;
}
export const CityCompanySiiSchema: JSONSchemaType<CityCompanySii> = {
  type: 'object',
  properties: {
    companyDef: {
      type: 'object',
      patternProperties: {
        '^\\..*$': {
          type: 'object',
          properties: {
            city: { type: 'string' },
          },
          required: ['city'],
        },
      },
      required: [],
    },
  },
  required: ['companyDef'],
};

export interface CargoSii {
  cargoDef: Record<string, { cargo: string }>;
}
export const CargoSiiSchema: JSONSchemaType<CargoSii> = {
  type: 'object',
  properties: {
    cargoDef: {
      type: 'object',
      patternProperties: {
        '^\\..*$': {
          type: 'object',
          properties: {
            // Note: more information (like l18n strings) for `cargo.foo` can be found in defs/cargo/foo.sui.
            cargo: { type: 'string', pattern: '^cargo\\.' },
          },
          required: ['cargo'],
        },
      },
      required: [],
      minProperties: 1,
      maxProperties: 1,
    },
  },
  required: ['cargoDef'],
};
