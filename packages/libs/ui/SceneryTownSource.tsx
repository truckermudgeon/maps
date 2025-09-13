import type { ExpressionSpecification } from 'maplibre-gl';
import { Layer, Source } from 'react-map-gl/maplibre';
import { baseTextLayout, textVariableAnchor } from './GameMapStyle';
import type { Mode } from './colors';
import { modeColors } from './colors';

export const atsSceneryTownsUrl = `/extra-labels.geojson`;
export const ets2SceneryTownsUrl = `/ets2-villages.geojson`;

export const enum StateCode {
  AR = 'AR',
  AZ = 'AZ',
  CA = 'CA',
  CO = 'CO',
  IA = 'IA',
  ID = 'ID',
  KS = 'KS',
  MO = 'MO',
  MT = 'MT',
  NE = 'NE',
  NM = 'NM',
  NV = 'NV',
  OK = 'OK',
  OR = 'OR',
  TX = 'TX',
  UT = 'UT',
  WA = 'WA',
  WY = 'WY',
}
const states: Record<StateCode, void> = {
  [StateCode.AR]: undefined,
  [StateCode.AZ]: undefined,
  [StateCode.CA]: undefined,
  [StateCode.CO]: undefined,
  [StateCode.IA]: undefined,
  [StateCode.ID]: undefined,
  [StateCode.KS]: undefined,
  [StateCode.MO]: undefined,
  [StateCode.MT]: undefined,
  [StateCode.NE]: undefined,
  [StateCode.NM]: undefined,
  [StateCode.NV]: undefined,
  [StateCode.OK]: undefined,
  [StateCode.OR]: undefined,
  [StateCode.TX]: undefined,
  [StateCode.UT]: undefined,
  [StateCode.WA]: undefined,
  [StateCode.WY]: undefined,
};
const allStates: ReadonlySet<StateCode> = new Set(
  Object.keys(states) as StateCode[],
);

type SceneryTownSourceProps = (
  | {
      game: 'ats';
      enabledStates?: Set<StateCode>; // defaults to full set
    }
  | {
      game: 'ets2';
    }
) & {
  enableAutoHide?: boolean; // defaults to true
  mode?: Mode; // defaults to 'light'
};
export const SceneryTownSource = (props: SceneryTownSourceProps) => {
  const { game, enableAutoHide = true, mode = 'light' } = props;
  const dataUrl = game === 'ats' ? atsSceneryTownsUrl : ets2SceneryTownsUrl;
  const filter: ExpressionSpecification =
    game === 'ats'
      ? [
          'all',
          // specify `true` as a fallback so we don't skip labels with undefined `show`
          ['boolean', ['get', 'show'], true],
          [
            'in',
            ['slice', ['get', 'country'], -2],
            ['literal', [...(props.enabledStates ?? allStates)]],
          ],
        ]
      : ['boolean', true];
  const colors = modeColors[mode];
  return (
    <Source id={`${game}-scenery-towns`} type={'geojson'} data={dataUrl}>
      <Layer
        id={`${game}-scenery-towns`}
        type={'symbol'}
        minzoom={enableAutoHide ? 7 : 0}
        filter={filter}
        layout={{
          ...baseTextLayout,
          'text-field': game === 'ats' ? '{text}' : '{name}',
          'text-allow-overlap': !enableAutoHide,
          'text-variable-anchor': textVariableAnchor,
          'text-size': 10.5,
        }}
        paint={colors.primaryTextPaint}
      />
    </Source>
  );
};
