import { Layer, Source } from 'react-map-gl/maplibre';
import {
  baseTextLayout,
  baseTextPaint,
  textVariableAnchor,
} from './GameMapStyle';

export const sceneryTownsUrl = `https://raw.githubusercontent.com/nautofon/ats-towns/kansas/all-towns.geojson`;

export const SceneryTownSource = (
  props: { enableAutoHide?: boolean } = { enableAutoHide: true },
) => (
  <Source id={`scenery-towns`} type={'geojson'} data={sceneryTownsUrl}>
    <Layer
      id={`scenery-towns`}
      type={'symbol'}
      minzoom={props.enableAutoHide ? 7 : 0}
      layout={{
        ...baseTextLayout,
        'text-field': '{name}',
        'text-allow-overlap': !props.enableAutoHide,
        'text-variable-anchor': textVariableAnchor,
        'text-size': 10.5,
      }}
      paint={baseTextPaint}
    />
  </Source>
);
