import type { JSONSchemaType } from 'ajv';

// This is probably overkill.
// It may be enough to just declare types and cast parsed JSON to those types, instead of
// actually validating them against an incomplete schema.

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

const NumberTripleSchema: JSONSchemaType<[number, number, number]> = {
  type: 'array',
  items: [{ type: 'number' }, { type: 'number' }, { type: 'number' }],
  minItems: 3,
  maxItems: 3,
};

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

interface ModelSii {
  modelDef?: Record<string, { modelDesc: string }>;
}
const ModelSiiSchema: JSONSchemaType<ModelSii> = {
  type: 'object',
  properties: {
    modelDef: {
      type: 'object',
      nullable: true,
      patternProperties: {
        '^model\\..*$': {
          type: 'object',
          properties: {
            modelDesc: { type: 'string' },
          },
          required: ['modelDesc'],
        },
      },
      required: [],
    },
  },
};
