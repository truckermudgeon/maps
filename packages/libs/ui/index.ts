import type { StyleSpecification } from 'maplibre-gl';
export { BaseMapStyle } from './BaseMapStyle';
export { ContoursStyle } from './Contours';
export {
  allIcons,
  baseTextLayout,
  GameMapStyle,
  MapIcon,
  textVariableAnchor,
  trafficMapIcons,
} from './GameMapStyle';
export {
  atsSceneryTownsUrl,
  ets2SceneryTownsUrl,
  SceneryTownSource,
  StateCode,
} from './SceneryTownSource';

export const defaultMapStyle = new Proxy<StyleSpecification>(
  {
    version: 8,
    sprite: '/sprites',
    // free font glyphs, required when adding text-fields.
    // https://github.com/openmaptiles/fonts
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    // sources and layers are empty because they're declared as child
    // components below.
    sources: {},
    layers: [],
  },
  {
    // Hacky workaround that allows us to specify a relative url for the
    // `sprite` property, which currently isn't supported (see
    // https://github.com/maplibre/maplibre-gl-js/issues/182).
    get(target, propertyKey, receiver) {
      if (
        propertyKey === 'sprite' &&
        typeof target.sprite == 'string' &&
        /^\/\w/.exec(target.sprite.toString())
      ) {
        return window.location.origin + target.sprite;
      }
      return Reflect.get(target, propertyKey, receiver) as unknown;
    },
  },
);
