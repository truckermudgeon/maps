import type { GeoJSON } from 'geojson';
import type { MapColor } from './prefab-transforms';

export type { MapColor } from './prefab-transforms';

export type DebugFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.LineString | GeoJSON.Point,
  DebugProperties
>;

export type RoadFeature = GeoJSON.Feature<
  GeoJSON.LineString,
  RoadLookProperties & {
    // an undefined startNodeUid is expected from roads converted from prefabs;
    // signifies that a prefab road isn't connected to a prefab entry/exit node.
    startNodeUid: string | undefined;
    endNodeUid: string | undefined;
  }
> & { id: string; symbol?: string };

export type FerryFeature = GeoJSON.Feature<GeoJSON.LineString, FerryProperties>;

export type PrefabFeature = GeoJSON.Feature<
  GeoJSON.Polygon,
  PrefabProperties
> & { id: string };

export type MapAreaFeature = PrefabFeature;

export type CityFeature = GeoJSON.Feature<GeoJSON.Point, CityProperties>;

export type CountryFeature = GeoJSON.Feature<GeoJSON.Point, CountryProperties>;

export type PoiFeature = GeoJSON.Feature<GeoJSON.Point, PoiProperties>;

export type FootprintFeature = GeoJSON.Feature<
  GeoJSON.Polygon,
  FootprintProperties
>;

export type AtsMapGeoJsonFeature =
  | MapAreaFeature
  | RoadFeature
  | FerryFeature
  | CityFeature
  | CountryFeature
  | PoiFeature
  | FootprintFeature
  | DebugFeature;

export type RoadType =
  | 'freeway'
  | 'divided'
  | 'local'
  | 'train'
  | 'tram'
  | 'no_vehicles'
  | 'unknown';

// RoadLookProperties is expected to contain primitive
// value types, only.
export interface RoadLookProperties {
  type: 'road';
  roadType: RoadType;
  leftLanes: number;
  rightLanes: number;
  hidden: boolean;
  laneOffset?: number;
}

export interface FerryProperties {
  type: 'ferry' | 'train';
  name: string;
}

export interface PrefabProperties {
  type: 'prefab';
  zIndex: number;
  color: MapColor;
}

export interface DebugProperties {
  type: 'debug';
}

export interface CityProperties {
  type: 'city';
  name: string;
  scaleRank: number;
  capital: 0 | 1 | 2;
}

export interface CountryProperties {
  type: 'country';
  name: string;
}

export interface FootprintProperties {
  type: 'footprint';
  height: number;
}

export interface PoiProperties {
  type: 'poi';
  sprite: string;
  poiType: string; // Overlay, Viewpoint, Company, etc.
  poiName?: string; // Company name, if poiType is Company
}

export type ScopedCityFeature = GeoJSON.Feature<
  GeoJSON.Point,
  { type: 'city'; map: 'usa' | 'europe'; countryCode: string; name: string }
>;

export type ScopedCountryFeature = GeoJSON.Feature<
  GeoJSON.Point,
  { type: 'country'; map: 'usa' | 'europe'; code: string; name: string }
>;
