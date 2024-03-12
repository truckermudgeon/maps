import { Layer, Source } from 'react-map-gl/maplibre';
import {
  baseTextLayout,
  baseTextPaint,
  textVariableAnchor,
} from './GameMapStyle';

export const sceneryTownsUrl = `https://raw.githubusercontent.com/nautofon/ats-towns/kansas/all-towns.geojson`;

export const SceneryTownSource = () => (
  <Source id={`scenery-towns`} type={'geojson'} data={sceneryTownsUrl}>
    <Layer
      id={`scenery-towns`}
      type={'symbol'}
      minzoom={7}
      layout={{
        ...baseTextLayout,
        'text-field': '{name}',
        'text-variable-anchor': textVariableAnchor,
        'text-size': 10.5,
      }}
      paint={baseTextPaint}
    />
  </Source>
);
