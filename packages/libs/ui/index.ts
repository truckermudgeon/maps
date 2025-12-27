import type { StyleSpecification } from 'maplibre-gl';
export { BaseMapStyle } from './BaseMapStyle';
export { modeColors } from './colors';
export { ContoursStyle } from './Contours';
export {
  atsIcons,
  baseTextLayout,
  ets2Icons,
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

const baseMapStyle: StyleSpecification = {
  version: 8,
  // free font glyphs, required when adding text-fields.
  // https://github.com/openmaptiles/fonts
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  // sources and layers are empty because they're declared as children
  // of consuming `MapGl` components.
  sources: {},
  layers: [],
};

const styleSpecificationProxyHandler: ProxyHandler<StyleSpecification> = {
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
};

export const defaultMapStyle = new Proxy<StyleSpecification>(
  {
    ...baseMapStyle,
    sprite: '/sprites',
  },
  styleSpecificationProxyHandler,
);

export const halloweenMapStyle = new Proxy<StyleSpecification>(
  {
    ...baseMapStyle,
    sprite: '/halloween-sprites',
  },
  styleSpecificationProxyHandler,
);

export const christmasMapStyle = new Proxy<StyleSpecification>(
  {
    ...baseMapStyle,
    sprite: '/christmas-sprites',
  },
  styleSpecificationProxyHandler,
);
