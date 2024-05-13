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

// The schemas and interfaces defined in this class are the bare minimum in order for map-files-parser.ts to work.
// They're incomplete and don't reflect the actual schema of a given .sii file.

// Using ajv to declare + validate schemas is probably overkill.
// It may be enough to just declare types and cast parsed JSON to those types, instead of
// actually validating them against an incomplete schema.

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
  modelDef?: Record<string, { modelDesc?: string }>;
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
