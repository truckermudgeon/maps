import type { StyleSpecification } from 'maplibre-gl';
export { BaseMapStyle } from './BaseMapStyle';
export { ContoursStyle } from './Contours';
export {
  GameMapStyle,
  MapIcon,
  allIcons,
  baseTextLayout,
  textVariableAnchor,
} from './GameMapStyle';
export {
  SceneryTownSource,
  StateCode,
  sceneryTownsUrl,
} from './SceneryTownSource';

export const defaultMapStyle: StyleSpecification = {
  version: 8,
  // can't specify relative urls
  // https://github.com/maplibre/maplibre-gl-js/issues/182
  //sprite: 'http://localhost:5173/sprites',
  sprite: 'https://truckermudgeon.github.io/sprites',
  // free font glyphs, required when adding text-fields.
  // https://github.com/openmaptiles/fonts
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  // sources and layers are empty because they're declared as child
  // components below.
  sources: {},
  layers: [],
};
