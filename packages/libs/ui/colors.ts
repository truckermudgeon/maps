import type { SymbolLayerSpecification } from 'maplibre-gl';

const lightBaseTextPaint: SymbolLayerSpecification['paint'] = {
  'text-color': 'hsl(42, 10%, 14%)',
  'text-halo-width': 2,
  'text-halo-color': 'hsl(42, 10%, 100%)',
};

const darkBaseTextPaint: SymbolLayerSpecification['paint'] = {
  'text-color': 'hsl(42, 10%, 86%)',
  'text-halo-width': 2,
  'text-halo-color': 'hsl(42, 10%, 0%)',
};

export const modeColors = {
  ['light']: {
    // base
    water: '#b2cdfb',
    land: '#f8f8f8',
    stateBorder: '#aaa',
    countryBorder: '#ccc',
    // game
    baseTextPaint: lightBaseTextPaint,
  },
  ['dark']: {
    // base
    water: '#36415d',
    land: '#1a1a1a',
    stateBorder: '#555',
    countryBorder: '#333',
    // game
    baseTextPaint: darkBaseTextPaint,
  },
};
