import type { DataDrivenPropertyValueSpecification } from '@maplibre/maplibre-gl-style-spec';
import { MapColor } from '@truckermudgeon/map/constants';
import type { RoadType } from '@truckermudgeon/map/types';
import type {
  ExpressionSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl';
import { Layer, Source } from 'react-map-gl/maplibre';
import { addPmTilesProtocol } from './pmtiles';

export const GameMapStyle = ({ game }: { game: 'ats' | 'ets2' }) => {
  addPmTilesProtocol();
  return (
    // N.B.: {ats,ets2}.pmtiles each have one layer named 'ats' or 'ets2'
    // (layer names are set when running tippecanoe).
    <Source id={game} type={'vector'} url={`pmtiles:///${game}.pmtiles`}>
      <Layer
        id={game + 'mapAreas'}
        source-layer={game}
        type={'fill'}
        filter={[
          'all',
          ['==', ['geometry-type'], 'Polygon'],
          ['==', ['get', 'type'], 'mapArea'],
        ]}
        layout={{
          'fill-sort-key': ['get', 'zIndex'],
        }}
        paint={{
          'fill-color': mapAreaColor,
          'fill-outline-color': [
            'case',
            ['==', ['get', 'color'], MapColor.Road],
            '#999a',
            mapAreaColor,
          ],
        }}
      />
      <Layer
        id={game + 'prefabs'}
        source-layer={game}
        type={'fill'}
        filter={[
          'all',
          ['==', ['geometry-type'], 'Polygon'],
          ['==', ['get', 'type'], 'prefab'],
        ]}
        layout={{
          'fill-sort-key': ['get', 'zIndex'],
        }}
        paint={{
          'fill-color': mapAreaColor,
        }}
      />
      <Source
        id={game + 'footprints'}
        type={'vector'}
        url={`pmtiles:///${game}-footprints.pmtiles`}
      >
        <Layer
          id={game + 'footprints'}
          source-layer={'footprints'}
          type={'fill'}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Polygon'],
            ['==', ['get', 'type'], 'footprint'],
          ]}
          paint={{
            'fill-color': '#e9e9e8',
            'fill-opacity': ['step', ['zoom'], 1, 9, 0.8],
          }}
        />
        <Layer
          id={game + 'extrusions'}
          minzoom={9}
          source-layer={'footprints'}
          type={'fill-extrusion'}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Polygon'],
            ['==', ['get', 'type'], 'footprint'],
          ]}
          paint={{
            'fill-extrusion-color': '#e9e9e8',
            'fill-extrusion-height': [
              'interpolate',
              ['exponential', 1.5],
              ['zoom'],
              9,
              ['*', 10, ['get', 'height']],
              13,
              ['*', 20, ['get', 'height']],
            ],
            'fill-extrusion-opacity': 0.33,
          }}
        />
      </Source>
      <Layer
        id={game + 'hidden-roads'}
        source-layer={game}
        type={'line'}
        minzoom={9}
        filter={[
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['==', ['get', 'type'], 'road'],
          ['==', ['get', 'hidden'], true],
        ]}
        paint={{
          'line-color': '#e9e9e8',
          'line-width': 1,
          'line-opacity': 0.7,
        }}
      />
      <Layer
        id={game + 'visible-roads-case'}
        source-layer={game}
        type={'line'}
        filter={[
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['==', ['get', 'type'], 'road'],
          ['!=', ['get', 'roadType'], 'train'],
          ['==', ['get', 'hidden'], false],
        ]}
        layout={roadLineLayout}
        paint={{
          'line-color': roadCaseColor,
          'line-gap-width': roadLineWidth,
          'line-width': [
            'interpolate',
            ['exponential', 1.5],
            ['zoom'],
            10,
            1,
            14,
            2,
            16,
            3,
          ],
        }}
      />
      <Layer
        id={game + 'visible-roads'}
        source-layer={game}
        type={'line'}
        filter={[
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['==', ['get', 'type'], 'road'],
          ['!=', ['get', 'roadType'], 'train'],
          ['==', ['get', 'hidden'], false],
        ]}
        layout={roadLineLayout}
        paint={{
          // set opacity to 0.5 to see line string start/end points.
          //'line-opacity': 0.5,
          'line-color': roadColor,
          'line-width': roadLineWidth,
        }}
      />
      <Layer
        id={game + 'ferries'}
        source-layer={game}
        type={'line'}
        filter={[
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['==', ['get', 'type'], 'ferry'],
        ]}
        paint={{
          'line-color': '#6c90ff88',
          'line-width': 1,
          'line-opacity': 0.8,
          'line-dasharray': [2, 2],
        }}
      />
      <Layer
        id={game + 'trains-a'}
        source-layer={game}
        type={'line'}
        filter={[
          'any',
          [
            'all',
            ['==', ['geometry-type'], 'LineString'],
            ['==', ['get', 'type'], 'train'],
          ],
          [
            'all',
            ['==', ['geometry-type'], 'LineString'],
            ['==', ['get', 'type'], 'road'],
            ['==', ['get', 'roadType'], 'train'],
            ['==', ['get', 'hidden'], false],
          ],
        ]}
        paint={{
          'line-color': '#aaa',
          'line-width': 2,
          'line-opacity': 0.8,
          'line-offset': [
            'interpolate',
            ['exponential', 1.5],
            ['zoom'],
            9,
            0,
            14,
            -6,
          ],
        }}
      />
      <Layer
        id={game + 'trains-b'}
        source-layer={game}
        type={'line'}
        filter={[
          'any',
          [
            'all',
            ['==', ['geometry-type'], 'LineString'],
            ['==', ['get', 'type'], 'train'],
          ],
          [
            'all',
            ['==', ['geometry-type'], 'LineString'],
            ['==', ['get', 'type'], 'road'],
            ['==', ['get', 'roadType'], 'train'],
            ['==', ['get', 'hidden'], false],
          ],
        ]}
        paint={{
          'line-color': '#aaa',
          'line-width': 2,
          'line-opacity': 0.8,
          'line-offset': [
            'interpolate',
            ['exponential', 1.5],
            ['zoom'],
            9,
            0,
            14,
            6,
          ],
        }}
      />
      <Layer
        id={game + 'train-hatch'}
        source-layer={game}
        type={'line'}
        filter={[
          'any',
          [
            'all',
            ['==', ['geometry-type'], 'LineString'],
            ['==', ['get', 'type'], 'train'],
          ],
          [
            'all',
            ['==', ['geometry-type'], 'LineString'],
            ['==', ['get', 'type'], 'road'],
            ['==', ['get', 'roadType'], 'train'],
            ['==', ['get', 'hidden'], false],
          ],
        ]}
        paint={{
          'line-color': '#aaa',
          'line-width': 10,
          'line-opacity': 0.8,
          'line-dasharray': [0.1, 1],
        }}
      />
      <Layer
        id={game + 'ferry-labels'}
        source-layer={game}
        minzoom={7.5}
        type={'symbol'}
        filter={[
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['==', ['get', 'type'], 'ferry'],
        ]}
        layout={{
          ...baseTextLayout,
          'symbol-placement': 'line-center',
          'text-field': '{name}',
          'text-size': 12,
        }}
        paint={{
          'text-halo-width': 2,
          'text-halo-color': '#eefc',
          'text-color': '#6c80ff',
        }}
      />
      <Layer
        id={game + 'train-labels'}
        source-layer={game}
        minzoom={7.5}
        type={'symbol'}
        filter={[
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['==', ['get', 'type'], 'train'],
        ]}
        layout={{
          ...baseTextLayout,
          'symbol-placement': 'line-center',
          'text-field': '{name}',
          'text-size': 12,
        }}
        paint={{
          'text-halo-width': 2,
          'text-halo-color': '#eefc',
          'text-color': '#555c',
        }}
      />
      <Layer
        id={game + 'company-icons'}
        source-layer={game}
        type={'symbol'}
        minzoom={8}
        filter={[
          'all',
          ['==', ['geometry-type'], 'Point'],
          ['==', ['get', 'type'], 'poi'],
          ['==', ['get', 'poiType'], 'company'],
        ]}
        layout={{
          'icon-image': '{sprite}',
          'icon-size': [
            'interpolate',
            ['exponential', 1.5],
            ['zoom'],
            9,
            1.25,
            13,
            3.5,
          ],
        }}
      />
      {game === 'ets2' && (
        <Layer
          id={'euro-road-overlays'}
          source-layer={game}
          minzoom={4.5}
          type={'symbol'}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'type'], 'poi'],
            ['==', ['get', 'poiType'], 'road'],
          ]}
          layout={{
            'icon-image': '{sprite}',
            'icon-padding': ['literal', [10, 30]],
            'icon-size': [
              'interpolate',
              ['exponential', 1.5],
              ['zoom'],
              4,
              0.4 * 1.25,
              9,
              0.75 * 1.25,
              13,
              1.25 * 1.25,
            ],
          }}
        />
      )}
      {game === 'ats' && (
        <Layer
          id={game + 'road-interstate-overlays'}
          source-layer={game}
          type={'symbol'}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'type'], 'poi'],
            ['==', ['get', 'poiType'], 'road'],
            ['==', ['index-of', 'is', ['get', 'sprite']], 0],
          ]}
          layout={{
            'icon-image': '{sprite}',
            'icon-padding': ['literal', [10, 30]],
            'icon-size': [
              'interpolate',
              ['exponential', 1.5],
              ['zoom'],
              4,
              0.4,
              9,
              0.75,
              13,
              1.25,
            ],
          }}
        />
      )}
      {game === 'ats' && (
        <Layer
          id={game + 'road-us-route-overlays'}
          source-layer={game}
          type={'symbol'}
          minzoom={5}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'type'], 'poi'],
            ['==', ['get', 'poiType'], 'road'],
            ['==', ['index-of', 'us', ['get', 'sprite']], 0],
          ]}
          layout={{
            'icon-image': '{sprite}',
            'icon-padding': ['literal', [10, 30]],
            'icon-size': [
              'interpolate',
              ['exponential', 1.5],
              ['zoom'],
              4,
              0.4,
              9,
              0.75,
              13,
              1.25,
            ],
          }}
        />
      )}
      {game === 'ats' && (
        <Layer
          id={game + 'road-state-route-overlays'}
          source-layer={game}
          type={'symbol'}
          minzoom={6}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'type'], 'poi'],
            ['==', ['get', 'poiType'], 'road'],
            [
              '!',
              [
                'any',
                ['==', ['index-of', 'is', ['get', 'sprite']], 0],
                ['==', ['index-of', 'us', ['get', 'sprite']], 0],
              ],
            ],
          ]}
          layout={{
            'icon-image': '{sprite}',
            'icon-padding': ['literal', [10, 30]],
            'icon-size': [
              'interpolate',
              ['exponential', 1.5],
              ['zoom'],
              4,
              0.4,
              9,
              0.75,
              13,
              1.25,
            ],
          }}
        />
      )}
      <Layer
        id={game + 'city-labels-small'}
        source-layer={game}
        type={'symbol'}
        minzoom={6}
        filter={[
          'all',
          ['==', ['geometry-type'], 'Point'],
          ['==', ['get', 'type'], 'city'],
          ['>', ['get', 'scaleRank'], 6],
        ]}
        layout={{
          ...baseTextLayout,
          'text-field': '{name}',
          'text-variable-anchor': textVariableAnchor,
          'text-size': 12,
          'icon-image': cityIconImage,
          'icon-size': 0.6,
        }}
        paint={baseTextPaint}
      />
      <Layer
        id={game + 'city-labels-medium'}
        source-layer={game}
        type={'symbol'}
        minzoom={5}
        filter={[
          'all',
          ['==', ['geometry-type'], 'Point'],
          ['==', ['get', 'type'], 'city'],
          ['<=', ['get', 'scaleRank'], 6],
          ['>', ['get', 'scaleRank'], 3],
        ]}
        layout={{
          ...baseTextLayout,
          'text-field': '{name}',
          'text-variable-anchor': textVariableAnchor,
          'text-size': 13,
          'icon-image': cityIconImage,
          'icon-size': 0.6,
        }}
        paint={baseTextPaint}
      />
      <Layer
        id={game + 'city-labels-big'}
        source-layer={game}
        type={'symbol'}
        minzoom={4}
        filter={[
          'all',
          ['==', ['geometry-type'], 'Point'],
          ['==', ['get', 'type'], 'city'],
          ['<=', ['get', 'scaleRank'], 3],
        ]}
        layout={{
          ...baseTextLayout,
          'text-field': '{name}',
          'text-variable-anchor': textVariableAnchor,
          'text-size': 14,
          'icon-image': cityIconImage,
          'icon-size': 0.8,
        }}
        paint={baseTextPaint}
      />
      {game === 'ets2' && (
        <Layer
          id={game + 'country-labels'}
          source-layer={game}
          type={'symbol'}
          minzoom={4}
          maxzoom={6.5}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'type'], 'country'],
          ]}
          layout={{
            ...baseTextLayout,
            'text-font': ['Klokantech Noto Sans Bold'],
            'text-field': '{name}',
            'text-variable-anchor': textVariableAnchor,
            'text-size': 14,
          }}
          paint={baseTextPaint}
        />
      )}
      <Layer
        id={game + 'poi-icons'}
        source-layer={game}
        type={'symbol'}
        minzoom={7}
        filter={[
          'all',
          ['==', ['geometry-type'], 'Point'],
          ['==', ['get', 'type'], 'poi'],
          [
            'in',
            ['get', 'poiType'],
            [
              'literal',
              ['landmark', 'viewpoint', 'facility', 'ferry', 'train'],
            ],
          ],
        ]}
        layout={{
          'icon-image': '{sprite}',
          'icon-size': [
            'interpolate',
            ['exponential', 1.5],
            ['zoom'],
            4,
            0.6,
            9,
            1.25,
            13,
            2.5,
          ],
        }}
      />
    </Source>
  );
};

const cityIconImage: ExpressionSpecification = [
  'step',
  ['zoom'],
  ['case', ['==', ['get', 'capital'], 2], 'dotdot', 'dot'],
  8,
  '',
];

export const textVariableAnchor: ExpressionSpecification = [
  'step',
  ['zoom'],
  ['literal', ['top', 'bottom', 'right', 'left']],
  7,
  ['literal', ['center']],
];

export const baseTextLayout: SymbolLayerSpecification['layout'] = {
  'text-radial-offset': 0.5,
  'text-justify': 'auto',
  'text-font': ['Klokantech Noto Sans Regular'],
};

export const baseTextPaint: SymbolLayerSpecification['paint'] = {
  'text-color': 'hsl(42, 10%, 14%)',
  'text-halo-width': 2,
  'text-halo-color': 'hsl(42, 10%, 100%)',
};

const roadLineLayout: LineLayerSpecification['layout'] = {
  'line-cap': 'round',
  'line-join': 'bevel',
};

const roadLineWidth: DataDrivenPropertyValueSpecification<number> = [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  // TODO: consider multiplying by 2.5 to get "thick" widths, and rendering
  // different lines for many-laned roads.
  3,
  0.8,
  14,
  30,
  16,
  150,
];

// Road types to [line, case] colors
const roadColors: Record<RoadType, [string, string]> = {
  freeway: ['#fde293', '#f8c248'],
  divided: ['#ffffff', '#dddddd'],
  no_vehicles: ['#aaaaaa', '#888888'],
  local: ['#f1f3f4', '#dddddd'],
  train: ['#ff0000', '#f8c248'],
  tram: ['#00ff00', '#f8c248'],
  unknown: ['#f0f', '#f0f'],
};

const mapColors: Record<MapColor, string> = {
  [0]: '#eaeced', // road
  [1]: '#e6cc9f', // light
  [2]: '#d8a54e', // dark
  [3]: '#b1ca9b', // green
};

// The dynamically-generated ExpressionSpecifications below require an array
// with at least 5 items, but Object.entries(...).flatMap() returns an array
// with unknown length.
// Define some hardcoded tuples to workaround this.
type Array4<T> = [T, T, T, T];
type Array7<T> = [T, T, T, T, T, T, T];

const roadColor: ExpressionSpecification = [
  'match',
  ['get', 'roadType'],
  ...(Object.entries(roadColors).flatMap(([roadType, [primaryColor]]) => [
    roadType,
    primaryColor,
  ]) as Array7<string>),
  '#f0f', //fallback
];
const roadCaseColor: ExpressionSpecification = [
  'match',
  ['get', 'roadType'],
  ...(Object.entries(roadColors).flatMap(([roadType, [_, casingColor]]) => [
    roadType,
    casingColor,
  ]) as Array7<string>),
  '#b0b', // fallback
];
const mapAreaColor: ExpressionSpecification = [
  'match',
  ['get', 'color'],
  ...(Object.entries(mapColors).flatMap(([colorEnum, color]) => [
    Number(colorEnum),
    color,
  ]) as Array4<string>),
  '#b0b', // fallback
];
