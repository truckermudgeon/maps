import type { GeoJSON } from 'geojson';
import type {
  ItemType,
  MapColor,
  MapOverlayType,
  SpawnPointType,
} from './constants';

export type { MapColor } from './constants';

// Parsing types

export type Node = Readonly<{
  uid: bigint;
  x: number;
  y: number;
  rotation: number;
  forwardItemUid: bigint;
  backwardItemUid: bigint;
  sectorX: number;
  sectorY: number;
  forwardCountryId: number;
  backwardCountryId: number;
}>;

export type City = Readonly<{
  token: string;
  name: string;
  nameLocalized: string | undefined;
  countryToken: string;
  population: number;
  x: number;
  y: number;
  areas: readonly CityArea[];
}>;

// Note: game .sii files contain interesting things, like
// timezone data, fuel price, and mass limits
export type Country = Readonly<{
  token: string;
  name: string;
  nameLocalized: string | undefined;
  id: number;
  x: number;
  y: number;
  code: string;
}>;

export type Company = Readonly<{
  token: string;
  name: string;
  cityTokens: string[];
  cargoInTokens: string[];
  cargoOutTokens: string[];
}>;

export type FerryConnection = Readonly<{
  token: string;
  name: string;
  nameLocalized: string | undefined;
  x: number;
  y: number;
  price: number;
  time: number;
  distance: number;
  intermediatePoints: {
    x: number;
    y: number;
    rotation: number;
  }[];
}>;

export type Ferry = Readonly<{
  token: string;
  train: boolean;
  name: string;
  nameLocalized: string | undefined;
  x: number;
  y: number;
  connections: FerryConnection[];
}>;

type BasePoi = Readonly<{
  x: number;
  y: number;
  sectorX: number;
  sectorY: number;
  icon: string;
}>;

export type NonFacilityPoi =
  | 'company'
  | 'landmark'
  | 'viewpoint'
  | 'ferry'
  | 'train';

type LabeledPoi = BasePoi &
  Readonly<
    | {
        type: Exclude<NonFacilityPoi, 'landmark'>;
        label: string;
      }
    | {
        type: 'landmark';
        label: string;
        dlcGuard: number;
        nodeUid: bigint;
      }
  >;

export type FacilityIcon =
  | 'parking_ico'
  | 'gas_ico'
  | 'service_ico'
  | 'weigh_station_ico'
  | 'dealer_ico'
  | 'garage_large_ico'
  | 'recruitment_ico';

type UnlabeledPoi = BasePoi &
  Readonly<
    | {
        // label can be derived from icon token
        type: 'road';
        dlcGuard: number;
        nodeUid: bigint;
      }
    | {
        type: 'facility';
        icon: Exclude<FacilityIcon, 'parking_ico'>;
        prefabUid: bigint;
        prefabPath: string;
      }
    | {
        type: 'facility';
        icon: 'parking_ico';
        fromItemType: 'trigger' | 'mapOverlay' | 'prefab';
        itemNodeUids: readonly bigint[];
        dlcGuard: number;
      }
  >;

export type Poi = LabeledPoi | UnlabeledPoi;

export type BaseItem = Readonly<{
  uid: bigint;
  type: ItemType;
  x: number;
  y: number;
  sectorX: number;
  sectorY: number;
}>;

export type Road = BaseItem &
  Readonly<{
    type: ItemType.Road;
    dlcGuard: number;
    hidden?: true;
    roadLookToken: string;
    startNodeUid: bigint;
    endNodeUid: bigint;
    length: number;
    maybeDivided?: boolean;
  }>;

export type Prefab = BaseItem &
  Readonly<{
    type: ItemType.Prefab;
    dlcGuard: number;
    hidden?: true;
    token: string;
    nodeUids: readonly bigint[];
    originNodeIndex: number;
  }>;

export type MapArea = BaseItem &
  Readonly<{
    type: ItemType.MapArea;
    dlcGuard: number;
    drawOver?: true;
    nodeUids: readonly bigint[];
    color: MapColor;
  }>;

export type CityArea = BaseItem &
  Readonly<{
    type: ItemType.City;
    token: string;
    hidden: boolean;
    width: number;
    height: number;
  }>;

export type MapOverlay = BaseItem &
  Readonly<{
    type: ItemType.MapOverlay;
    dlcGuard: number;
    overlayType: MapOverlayType;
    token: string;
    nodeUid: bigint;
  }>;

export type Building = BaseItem &
  Readonly<{
    type: ItemType.Building;
    scheme: string;
    startNodeUid: bigint;
    endNodeUid: bigint;
  }>;

export type Curve = BaseItem &
  Readonly<{
    type: ItemType.Curve;
    model: string;
    look: string;
    numBuildings: number;
    startNodeUid: bigint;
    endNodeUid: bigint;
  }>;

export type FerryItem = BaseItem &
  Readonly<{
    type: ItemType.Ferry;
    token: string;
    train: boolean;
    prefabUid: bigint;
    nodeUid: bigint;
  }>;

export type CompanyItem = BaseItem &
  Readonly<{
    type: ItemType.Company;
    token: string;
    cityToken: string;
    prefabUid: bigint;
    nodeUid: bigint;
  }>;

export type Cutscene = BaseItem &
  Readonly<{
    type: ItemType.Cutscene;
    flags: number;
    tags: readonly string[];
    nodeUid: bigint;
  }>;

export type Trigger = BaseItem &
  Readonly<{
    type: ItemType.Trigger;
    dlcGuard: number;
    actionTokens: readonly string[];
    nodeUids: readonly bigint[];
  }>;

export type Model = BaseItem &
  Readonly<{
    type: ItemType.Model;
    token: string;
    nodeUid: bigint;
    scale: { x: number; y: number; z: number };
  }>;

export type Terrain = BaseItem &
  Readonly<{
    type: ItemType.Terrain;
    startNodeUid: bigint;
    endNodeUid: bigint;
    length: number;
  }>;

export type Item =
  | Road
  | Prefab
  | MapArea
  | CityArea
  | MapOverlay
  | FerryItem
  | CompanyItem
  | Cutscene
  | Trigger
  | Model
  | Terrain
  | Building
  | Curve;

export type RoadLook = Readonly<{
  lanesLeft: readonly string[];
  lanesRight: readonly string[];
  offset?: number;
  laneOffset?: number;
}>;

interface BaseMapPoint {
  x: number;
  y: number;
  neighbors: number[];
}
export type RoadMapPoint = BaseMapPoint & {
  type: 'road';
  lanesLeft: number | 'auto';
  lanesRight: number | 'auto';
  offset: number;
  navNode: {
    node0: boolean;
    node1: boolean;
    node2: boolean;
    node3: boolean;
    node4: boolean;
    node5: boolean;
    node6: boolean;
    nodeCustom: boolean;
  };
  navFlags: {
    isStart: boolean;
    isBase: boolean;
    isExit: boolean;
  };
};
export type PolygonMapPoint = BaseMapPoint & {
  type: 'polygon';
  color: MapColor;
  roadOver: boolean;
};
export type MapPoint = RoadMapPoint | PolygonMapPoint;
export interface PrefabDescription {
  // prefab's entry/exit points
  nodes: {
    x: number;
    y: number;
    rotation: number;
    // indices into `navCurves`
    inputLanes: number[];
    // indices into `navCurves`
    outputLanes: number[];
  }[];
  mapPoints: MapPoint[];
  spawnPoints: {
    x: number;
    y: number;
    type: SpawnPointType;
  }[];
  triggerPoints: {
    x: number;
    y: number;
    action: string;
  }[];
  navCurves: {
    // From https://modding.scssoft.com/wiki/Games/ETS2/Modding_guides/1.30#Prefabs:
    // Index of a navigational node which should be used if navigation starts from that AI curve or 0xffffffff if there is none.
    // Basically it is a reverse mapping to the curve_indices from nodes.
    navNodeIndex: number;
    start: { x: number; y: number; rotation: number };
    end: { x: number; y: number; rotation: number };
    nextLines: number[];
    prevLines: number[];
  }[];
  navNodes: {
    type: 'physical' | 'ai';
    // if type is physical: the index of the normal node (see nodes array) this navNode ends at.
    // if type is ai: the index of the AI curve this navNode ends at.
    endIndex: number;
    connections: {
      targetNavNodeIndex: number;
      curveIndices: number[];
    }[];
  }[];
}

export interface ModelDescription {
  center: { x: number; y: number };
  start: { x: number; y: number };
  end: { x: number; y: number };
  height: number;
}

export type WithToken<T> = T & { token: string };

export interface MapData {
  nodes: Node[];
  roads: Road[];
  ferries: Ferry[];
  prefabs: Prefab[];
  companies: CompanyItem[];
  models: Model[];
  mapAreas: MapArea[];
  pois: Poi[];
  dividers: (Building | Curve)[];
  countries: Country[];
  cities: City[];
  companyDefs: Company[];
  roadLooks: WithToken<RoadLook>[];
  prefabDescriptions: WithToken<PrefabDescription>[];
  modelDescriptions: WithToken<ModelDescription>[];
}

// GeoJSON

export type DebugFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.LineString | GeoJSON.Point,
  DebugProperties
>;

export type RoadFeature = GeoJSON.Feature<
  GeoJSON.LineString,
  RoadLookProperties & {
    dlcGuard: number;
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

export type MapAreaFeature = GeoJSON.Feature<
  GeoJSON.Polygon,
  MapAreaProperties
> & { id: string };

export type CityFeature = GeoJSON.Feature<GeoJSON.Point, CityProperties>;

export type CountryFeature = GeoJSON.Feature<GeoJSON.Point, CountryProperties>;

export type PoiFeature = GeoJSON.Feature<GeoJSON.Point, PoiProperties>;

export type FootprintFeature = GeoJSON.Feature<
  GeoJSON.Polygon,
  FootprintProperties
>;

export type AtsMapGeoJsonFeature =
  | MapAreaFeature
  | PrefabFeature
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
  dlcGuard: number;
  zIndex: number;
  color: MapColor;
}

export interface MapAreaProperties {
  type: 'mapArea';
  dlcGuard: number;
  zIndex: number;
  color: MapColor;
}

export interface DebugProperties {
  type: 'debug';
  [k: string]: string;
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
  dlcGuard?: number; // For dlc-guarded POIs, like road icons
}

export type ScopedCityFeature = GeoJSON.Feature<
  GeoJSON.Point,
  { type: 'city'; map: 'usa' | 'europe'; countryCode: string; name: string }
>;

export type ScopedCountryFeature = GeoJSON.Feature<
  GeoJSON.Point,
  { type: 'country'; map: 'usa' | 'europe'; code: string; name: string }
>;

// Routing

/**
 * A Neighbor contains information about an edge and the vertex (or node) it leads to in a directed graph.
 * For example, a simple two-node graph contains one Neighbor, represented by the box in the diagram below.
 *
 * ```
 *           ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
 *       .─. │                       .─. │
 *      ( A ) ─────────────────────▶( B )│
 *       `─' │                       `─' │
 *           └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
 * ```
 */
export interface Neighbor {
  /** The id of this Neighbor's node (not of the origin node). */
  readonly nodeId: string; // hex form of a bigint
  /** The distance between the origin node and this Neighbor's node. */
  readonly distance: number;
  /** True if this Neighbor's edge represents a one-lane road. */
  readonly isOneLaneRoad?: true;
  /**
   * The direction one must travel in _after_ reaching this Neighbor's node.
   * Not the direction of this Neighbor's edge.
   */
  readonly direction: 'forward' | 'backward';
}

/**
 * Information about an origin Node's neighbors.
 */
export type Neighbors = Readonly<{
  /** Neighbors that can be reached whilst traveling in the forward direction. */
  forward: readonly Neighbor[];
  /** Neighbors that can be reached whilst traveling in the backward direction. */
  backward: readonly Neighbor[];
}>;

// Routing Demo
// Hacky, minimal versions of types needed for the fully-clientside "routes" demo page.

export interface DemoNeighbor {
  /** nodeId */
  n: string;
  /** distance */
  l: number;
  /** isOneLaneRoad */
  o?: true;
  /** direction */
  d: 'f' | 'b';
}

export interface DemoNeighbors {
  f?: DemoNeighbor[];
  b?: DemoNeighbor[];
}

export interface DemoCompany {
  /** node uid */
  n: string;
  /** token */
  t: string;
  /** cityToken */
  c: string;
}

export interface DemoCompanyDef {
  /** token */
  t: string;
  /** tokens of eligible destination companies */
  d: string[];
}

export interface DemoRoutesData {
  demoGraph: [string, DemoNeighbors][];
  demoNodes: [string, [number, number]][];
  demoCompanies: DemoCompany[];
  demoCompanyDefs: DemoCompanyDef[];
}
