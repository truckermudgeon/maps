import type { DataDrivenPropertyValueSpecification } from '@maplibre/maplibre-gl-style-spec';
import { Preconditions } from '@truckermudgeon/base/precon';
import type {
  AtsSelectableDlc,
  Ets2SelectableDlc,
} from '@truckermudgeon/map/constants';
import {
  AtsSelectableDlcs,
  Ets2SelectableDlcs,
  MapColor,
  toAtsDlcGuards,
} from '@truckermudgeon/map/constants';
import type {
  FacilityIcon,
  NonFacilityPoi,
  RoadType,
} from '@truckermudgeon/map/types';
import type {
  ExpressionSpecification,
  LineLayerSpecification,
  PaddingSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl';
import { Layer, Source } from 'react-map-gl/maplibre';
import type { Mode } from './colors';
import { modeColors } from './colors';
import { addPmTilesProtocol } from './pmtiles';

export const enum MapIcon {
  FuelStation,
  Toll,
  Parking,
  RecruitmentAgency,
  Service,
  TruckDealer,
  Port,
  Train,
  Viewpoint,
  PhotoSight,
  AgricultureCheck,
  BorderCheck,
  Garage,
  WeighStation,
  // The following aren't POIs; they're just icons
  // useful for map legend rendering.
  CityNames,
  Company,
  RoadNumber,
}
export const allIcons: ReadonlySet<MapIcon> = new Set<MapIcon>(
  Array.from({ length: 17 }, (_, i) => i as MapIcon),
);

export type GameMapStyleProps = {
  /** Defaults to all MapIcons */
  visibleIcons?: ReadonlySet<MapIcon>;
  /** Defaults to true */
  enableIconAutoHide?: boolean;
  /** Defaults to 'light' */
  mode?: Mode;
} & (
  | {
      game: 'ats';
      /** Defaults to all Selectable DLCs */
      dlcs?: ReadonlySet<AtsSelectableDlc>;
    }
  | {
      game: 'ets2';
      /** Defaults to all Selectable DLCs */
      dlcs?: ReadonlySet<Ets2SelectableDlc>;
    }
);

export const GameMapStyle = (props: GameMapStyleProps) => {
  const {
    game,
    visibleIcons = allIcons,
    enableIconAutoHide = true,
    mode = 'light',
  } = props;
  const dlcGuardFilter =
    game === 'ats'
      ? createDlcGuardFilter(game, props.dlcs ?? AtsSelectableDlcs)
      : createDlcGuardFilter(game, props.dlcs ?? Ets2SelectableDlcs);
  const colors = modeColors[mode];
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
          dlcGuardFilter,
        ]}
        layout={{
          'fill-sort-key': ['get', 'zIndex'],
        }}
        paint={{
          'fill-color': mapAreaColor(mode),
          'fill-outline-color': [
            'case',
            ['==', ['get', 'color'], MapColor.Road],
            colors.mapAreaOutline,
            mapAreaColor(mode),
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
          dlcGuardFilter,
        ]}
        layout={{
          'fill-sort-key': ['get', 'zIndex'],
        }}
        paint={{
          'fill-color': mapAreaColor(mode),
        }}
      />
      <FootprintsSource game={game} mode={mode} color={colors.footprint} />
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
          dlcGuardFilter,
        ]}
        paint={{
          'line-color': colors.hiddenRoad,
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
          dlcGuardFilter,
        ]}
        layout={roadLineLayout}
        paint={{
          'line-color': roadCaseColor(mode),
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
          dlcGuardFilter,
        ]}
        layout={roadLineLayout}
        paint={{
          // set opacity to 0.5 to see line string start/end points.
          //'line-opacity': 0.5,
          'line-color': roadColor(mode),
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
          'line-color': colors.ferryLine,
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
          'line-color': colors.trainLine,
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
          'line-color': colors.trainLine,
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
          'line-color': colors.trainLine,
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
          'text-halo-color': colors.ferryHalo,
          'text-color': colors.ferryLabel,
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
          'text-halo-color': colors.trainHalo,
          'text-color': colors.trainLabel,
        }}
      />
      {visibleIcons.has(MapIcon.Company) && (
        <Layer
          id={game + 'company-icons'}
          source-layer={game}
          type={'symbol'}
          minzoom={enableIconAutoHide ? 8 : 0}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'type'], 'poi'],
            ['==', ['get', 'poiType'], 'company'],
            dlcGuardFilter,
          ]}
          layout={iconLayout(enableIconAutoHide, 1, 1.25, 3.5)}
        />
      )}
      {game === 'ets2' && visibleIcons.has(MapIcon.RoadNumber) && (
        <Layer
          id={'euro-road-overlays'}
          source-layer={game}
          minzoom={enableIconAutoHide ? 4.5 : 0}
          type={'symbol'}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'type'], 'poi'],
            ['==', ['get', 'poiType'], 'road'],
            ['!', ['in', ['get', 'sprite'], ['literal', allRoadFacilityIcons]]],
          ]}
          layout={iconLayout(
            enableIconAutoHide,
            0.4 * 1.25,
            0.75 * 1.25,
            1.25 * 1.25,
          )}
        />
      )}
      {game === 'ats' && visibleIcons.has(MapIcon.RoadNumber) && (
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
            dlcGuardFilter,
          ]}
          layout={iconLayout(enableIconAutoHide, 0.4, 0.75, 1.25)}
        />
      )}
      {game === 'ats' && visibleIcons.has(MapIcon.RoadNumber) && (
        <Layer
          id={game + 'road-us-route-overlays'}
          source-layer={game}
          type={'symbol'}
          minzoom={enableIconAutoHide ? 5 : 0}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'type'], 'poi'],
            ['==', ['get', 'poiType'], 'road'],
            ['==', ['index-of', 'us', ['get', 'sprite']], 0],
            dlcGuardFilter,
          ]}
          layout={iconLayout(enableIconAutoHide, 0.4, 0.75, 1.25)}
        />
      )}
      {game === 'ats' && visibleIcons.has(MapIcon.RoadNumber) && (
        <Layer
          id={game + 'road-state-route-overlays'}
          source-layer={game}
          type={'symbol'}
          minzoom={enableIconAutoHide ? 6 : 0}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'type'], 'poi'],
            ['==', ['get', 'poiType'], 'road'],
            dlcGuardFilter,
            [
              '!',
              [
                'any',
                ['==', ['index-of', 'is', ['get', 'sprite']], 0],
                ['==', ['index-of', 'us', ['get', 'sprite']], 0],
                ['in', ['get', 'sprite'], ['literal', allRoadFacilityIcons]],
              ],
            ],
          ]}
          layout={iconLayout(enableIconAutoHide, 0.4, 0.75, 1.25)}
        />
      )}
      {visibleIcons.has(MapIcon.CityNames) && (
        <Layer
          id={game + 'city-labels-small'}
          source-layer={game}
          type={'symbol'}
          minzoom={enableIconAutoHide ? 6 : 0}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'type'], 'city'],
            ['>', ['get', 'scaleRank'], 6],
            dlcGuardFilter,
          ]}
          layout={{
            ...baseTextLayout,
            'text-field': '{name}',
            'text-allow-overlap': !enableIconAutoHide,
            'text-variable-anchor': textVariableAnchor,
            'text-size': 12,
            'icon-image': cityIconImage,
            'icon-allow-overlap': !enableIconAutoHide,
            'icon-size': 0.6,
          }}
          paint={colors.baseTextPaint}
        />
      )}
      {visibleIcons.has(MapIcon.CityNames) && (
        <Layer
          id={game + 'city-labels-medium'}
          source-layer={game}
          type={'symbol'}
          minzoom={enableIconAutoHide ? 5 : 0}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'type'], 'city'],
            ['<=', ['get', 'scaleRank'], 6],
            ['>', ['get', 'scaleRank'], 3],
            dlcGuardFilter,
          ]}
          layout={{
            ...baseTextLayout,
            'text-field': '{name}',
            'text-allow-overlap': !enableIconAutoHide,
            'text-variable-anchor': textVariableAnchor,
            'text-size': 13,
            'icon-image': cityIconImage,
            'icon-allow-overlap': !enableIconAutoHide,
            'icon-size': 0.6,
          }}
          paint={colors.baseTextPaint}
        />
      )}
      {visibleIcons.has(MapIcon.CityNames) && (
        <Layer
          id={game + 'city-labels-big'}
          source-layer={game}
          type={'symbol'}
          minzoom={enableIconAutoHide ? 4 : 0}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'type'], 'city'],
            ['<=', ['get', 'scaleRank'], 3],
            dlcGuardFilter,
          ]}
          layout={{
            ...baseTextLayout,
            'text-field': '{name}',
            'text-allow-overlap': !enableIconAutoHide,
            'text-variable-anchor': textVariableAnchor,
            'text-size': 14,
            'icon-image': cityIconImage,
            'icon-allow-overlap': !enableIconAutoHide,
            'icon-size': 0.8,
          }}
          paint={colors.baseTextPaint}
        />
      )}
      {game === 'ets2' && visibleIcons.has(MapIcon.CityNames) && (
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
          paint={colors.baseTextPaint}
        />
      )}
      {hasPois(visibleIcons) && (
        <Layer
          id={game + 'poi-icons'}
          source-layer={game}
          type={'symbol'}
          minzoom={enableIconAutoHide ? 7 : 0}
          filter={[
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'type'], 'poi'],
            createPoiFilter(visibleIcons),
            dlcGuardFilter,
          ]}
          layout={iconLayout(enableIconAutoHide, 0.6, 1.25, 2.5, {
            vertical: 2,
            horizontal: 2,
          })}
        />
      )}
    </Source>
  );
};

const FootprintsSource = ({
  game,
  color,
  mode,
}: {
  game: 'ats' | 'ets2';
  color: string;
  mode: Mode;
}) => (
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
        'fill-color': color,
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
        'fill-extrusion-color': color,
        'fill-extrusion-height': [
          'interpolate',
          ['exponential', 1.5],
          ['zoom'],
          9,
          ['*', 10, ['get', 'height']],
          13,
          ['*', 20, ['get', 'height']],
        ],
        'fill-extrusion-opacity': mode === 'light' ? 0.33 : 0.67,
      }}
    />
  </Source>
);

function iconLayout(
  enableIconAutoHide: boolean,
  level4Scale: number,
  level9Scale: number,
  level13Scale: number,
  padding: { vertical: number; horizontal: number } = {
    vertical: 10,
    horizontal: 30,
  },
) {
  const iconPadding: DataDrivenPropertyValueSpecification<PaddingSpecification> =
    ['literal', [padding.vertical, padding.horizontal]];
  const iconSize: DataDrivenPropertyValueSpecification<number> = [
    'interpolate',
    ['exponential', 1.5],
    ['zoom'],
    4,
    level4Scale,
    9,
    level9Scale,
    13,
    level13Scale,
  ];
  return {
    'icon-image': '{sprite}',
    'icon-allow-overlap': !enableIconAutoHide,
    'icon-padding': iconPadding,
    'icon-size': iconSize,
  };
}

const cityIconImage: ExpressionSpecification = [
  'step',
  ['zoom'],
  ['case', ['==', ['get', 'capital'], 2], 'dotdot', 'dot'],
  8,
  '',
];

const mapIcons = [
  MapIcon.PhotoSight,
  MapIcon.Viewpoint,
  MapIcon.Port,
  MapIcon.Train,
  MapIcon.Parking,
  MapIcon.FuelStation,
  MapIcon.Service,
  MapIcon.TruckDealer,
  MapIcon.Garage,
  MapIcon.RecruitmentAgency,
  MapIcon.WeighStation,
  MapIcon.Toll,
  MapIcon.AgricultureCheck,
  MapIcon.BorderCheck,
];

type RoadFacilityIcon = 'weigh_ico' | 'toll_ico' | 'agri_check' | 'border_ico';
const allRoadFacilityIcons: readonly RoadFacilityIcon[] = [
  'weigh_ico',
  'toll_ico',
  'agri_check',
  'border_ico',
];

function hasPois(icons: ReadonlySet<MapIcon>): boolean {
  return mapIcons.some(icon => icons.has(icon));
}

function createPoiFilter(
  visibleIcons: ReadonlySet<MapIcon>,
): ExpressionSpecification {
  Preconditions.checkArgument(hasPois(visibleIcons));

  const nonFacilityPois: NonFacilityPoi[] = [];
  if (visibleIcons.has(MapIcon.PhotoSight)) {
    nonFacilityPois.push('landmark');
  }
  if (visibleIcons.has(MapIcon.Viewpoint)) {
    nonFacilityPois.push('viewpoint');
  }
  if (visibleIcons.has(MapIcon.Port)) {
    nonFacilityPois.push('ferry');
  }
  if (visibleIcons.has(MapIcon.Train)) {
    nonFacilityPois.push('train');
  }

  const facilityPois: FacilityIcon[] = [];
  if (visibleIcons.has(MapIcon.FuelStation)) {
    facilityPois.push('gas_ico');
  }
  if (visibleIcons.has(MapIcon.Service)) {
    facilityPois.push('service_ico');
  }
  if (visibleIcons.has(MapIcon.WeighStation)) {
    facilityPois.push('weigh_station_ico');
  }
  if (visibleIcons.has(MapIcon.TruckDealer)) {
    facilityPois.push('dealer_ico');
  }
  if (visibleIcons.has(MapIcon.Garage)) {
    facilityPois.push('garage_large_ico');
  }
  if (visibleIcons.has(MapIcon.RecruitmentAgency)) {
    facilityPois.push('recruitment_ico');
  }
  if (visibleIcons.has(MapIcon.Parking)) {
    facilityPois.push('parking_ico');
  }

  const roadFacilityPois: RoadFacilityIcon[] = [];
  if (visibleIcons.has(MapIcon.WeighStation)) {
    roadFacilityPois.push('weigh_ico');
  }
  if (visibleIcons.has(MapIcon.Toll)) {
    roadFacilityPois.push('toll_ico');
  }
  if (visibleIcons.has(MapIcon.AgricultureCheck)) {
    roadFacilityPois.push('agri_check');
  }
  if (visibleIcons.has(MapIcon.BorderCheck)) {
    roadFacilityPois.push('border_ico');
  }

  const nonFacilityPredicate: ExpressionSpecification | false =
    nonFacilityPois.length > 0
      ? ['in', ['get', 'poiType'], ['literal', nonFacilityPois]]
      : false;
  const facilityPredicate: ExpressionSpecification | false =
    facilityPois.length > 0
      ? [
          'all',
          ['==', ['get', 'poiType'], 'facility'],
          ['in', ['get', 'sprite'], ['literal', facilityPois]],
        ]
      : false;
  const roadFacilityPredicate: ExpressionSpecification | false =
    roadFacilityPois.length > 0
      ? [
          'all',
          ['==', ['get', 'poiType'], 'road'],
          ['in', ['get', 'sprite'], ['literal', roadFacilityPois]],
        ]
      : false;

  return [
    'any',
    nonFacilityPredicate,
    facilityPredicate,
    roadFacilityPredicate,
  ];
}

function createDlcGuardFilter(
  game: 'ats',
  selectedDlcs: ReadonlySet<AtsSelectableDlc>,
): ExpressionSpecification;
function createDlcGuardFilter(
  game: 'ets2',
  selectedDlcs: ReadonlySet<Ets2SelectableDlc>,
): ExpressionSpecification;
function createDlcGuardFilter(
  game: 'ats' | 'ets2',
  selectedDlcs: ReadonlySet<unknown>,
): ExpressionSpecification {
  if (game !== 'ats') {
    return ['boolean', true];
  }

  const dlcGuards = toAtsDlcGuards(
    selectedDlcs as ReadonlySet<AtsSelectableDlc>,
  );
  return ['in', ['get', 'dlcGuard'], ['literal', [...dlcGuards]]];
}

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
type RoadColors = Record<RoadType, [string, string]>;
const roadColors: { [k in Mode]: RoadColors } = {
  light: {
    freeway: ['#fde293', '#f8c248'],
    divided: ['#ffffff', '#dddddd'],
    no_vehicles: ['#aaaaaa', '#888888'],
    local: ['#f1f3f4', '#dddddd'],
    train: ['#ff0000', '#f8c248'],
    tram: ['#00ff00', '#f8c248'],
    unknown: ['#f0f', '#f0f'],
  },
  dark: {
    freeway: ['#95813e', '#372f21'],
    divided: ['#3c4043', '#4c5043'],
    no_vehicles: ['#606166', '#888888'],
    local: ['#606166', '#333'],
    train: ['#ff0000', '#f8c248'],
    tram: ['#00ff00', '#f8c248'],
    unknown: ['#f0f', '#f0f'],
  },
};

const mapColors: { [k in Mode]: Record<MapColor, string> } = {
  light: {
    [0]: 'hsl(200, 8%, 92%)', // road
    [1]: 'hsl(38, 59%, 76%)', // light
    [2]: 'hsl(38, 64%, 58%)', // dark
    [3]: 'hsl(92, 31%, 70%)', // green
  },
  dark: {
    [0]: 'hsl(200, 2%, 36%)', // road
    [1]: 'hsl(38, 25%, 35%)', // light
    [2]: 'hsl(38, 25%, 25%)', // dark
    [3]: 'hsl(143, 20%, 25%)', // green
  },
};

// The dynamically-generated ExpressionSpecifications below require an array
// with at least 5 items, but Object.entries(...).flatMap() returns an array
// with unknown length.
// Define some hardcoded tuples to workaround this.
type Array4<T> = [T, T, T, T];
type Array7<T> = [T, T, T, T, T, T, T];

const roadColor = (mode: 'light' | 'dark'): ExpressionSpecification => [
  'match',
  ['get', 'roadType'],
  ...(Object.entries(roadColors[mode]).flatMap(([roadType, [primaryColor]]) => [
    roadType,
    primaryColor,
  ]) as Array7<string>),
  '#f0f', //fallback
];
const roadCaseColor = (mode: 'light' | 'dark'): ExpressionSpecification => [
  'match',
  ['get', 'roadType'],
  ...(Object.entries(roadColors[mode]).flatMap(
    ([roadType, [_, casingColor]]) => [roadType, casingColor],
  ) as Array7<string>),
  '#b0b', // fallback
];
const mapAreaColor = (mode: 'light' | 'dark'): ExpressionSpecification => [
  'match',
  ['get', 'color'],
  ...(Object.entries(mapColors[mode]).flatMap(([colorEnum, color]) => [
    Number(colorEnum),
    color,
  ]) as Array4<string>),
  '#b0b', // fallback
];
