import type { JSONSchemaType } from 'ajv';

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
const StringArraySchema: JSONSchemaType<string[]> = {
  type: 'array',
  items: { type: 'string' },
  minItems: 1,
};

interface FerryConnection {
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
export const FerryConnectionSchema: JSONSchemaType<FerryConnection> = {
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
