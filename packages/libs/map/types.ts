import type { GeoJSON } from 'geojson';
import type {
  ItemType,
  MapAreaColor,
  MapOverlayType,
  SpawnPointType,
} from './constants';

export type { MapAreaColor } from './constants';

// Parsing types

export type Node = Readonly<{
  uid: bigint;
  x: number;
  y: number;
  z: number;
  // rotation about game's y-axis (not map y-axis), aka yaw.
  rotation: number;
  rotationQuat: [number, number, number, number];
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
  truckSpeedLimits: SpeedLimits;
}>;
export type SpeedLimits = Partial<
  Record<
    LaneSpeedClass,
    {
      limit: number;
      urbanLimit: number;
      maxLimit: number;
    }
  >
>;

export type LaneSpeedClass =
  | 'localRoad'
  | 'dividedRoad'
  | 'freeway'
  | 'expressway'
  | 'motorway'
  | 'slowRoad';

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
  nodeUid: bigint;
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
  nodeUid: bigint;
  x: number;
  y: number;
  connections: FerryConnection[];
}>;

export type MileageTarget = Readonly<{
  token: string;
  editorName: string;
  defaultName: string;
  nameVariants: string[];
  distanceOffset: number;
  nodeUid?: bigint;
  x?: number; // easting
  y?: number; // southing
  searchRadius?: number;
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

// Be sure to update `isLabeledPoi` helper function when changing `LabeledPoi::type`.
export type LabeledPoi = BasePoi &
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

export type Achievement = Readonly<
  | {
      type: 'visitCityData';
      cities: readonly string[];
    }
  | {
      type: 'delivery';
      delivery:
        | {
            type: 'company';
            companies: readonly Readonly<{
              company: string;
              locationType: 'city' | 'country';
              locationToken: string;
            }>[];
          }
        | {
            type: 'city';
            cities: readonly Readonly<{
              cityToken: string;
            }>[];
          };
    }
  | {
      type: 'eachCompanyData' | 'deliverCargoData';
      role: 'source' | 'target';
      companies: readonly Readonly<{
        company: string;
        city: string;
      }>[];
    }
  | {
      type: 'triggerData';
      param: string;
      count: number;
    }
  | {
      type: 'ferryData';
      endpointA: string;
      endpointB: string;
    }
  | {
      type: 'ferryDataByType';
      ferryType: 'ferry' | 'train';
    }
  | {
      type: 'eachDeliveryPoint';
      sources: string[]; // e.g., .id_snake_riv.kennewick.lewiston.source
      targets: string[];
    }
  | {
      type: 'oversizeRoutesData';
    }
  | {
      type: 'deliveryLogData';
      locations: (
        | {
            type: 'company';
            company: string;
            city: string;
          }
        | {
            type: 'city';
            city: string;
          }
      )[];
      // TODO: map cargo achievements (treat as start point) only if `locations`
      //  is empty. Need to parse oversize_offer_data.sii for ST achievements.
      cargos: string[];
    }
  | {
      type: 'compareData';
      achievementName: string;
    }
  | {
      type: 'visitPrefabData';
      prefab: string;
    }
>;

export interface Route {
  fromCity: string;
  toCity: string;
}

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
    color: MapAreaColor;
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

export type TrajectoryItem = BaseItem &
  Readonly<{
    type: ItemType.TrajectoryItem;
    nodeUids: readonly bigint[];
    checkpoints: readonly Readonly<{
      route: string;
      checkpoint: string;
    }>[];
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
    dlcGuard: number;
    flags: number;
    tags: readonly string[];
    nodeUid: bigint;
    actionStringParams: readonly string[];
  }>;

export type Trigger = BaseItem &
  Readonly<{
    type: ItemType.Trigger;
    dlcGuard: number;
    // [action token, params] tuples
    actions: [string, readonly string[]][];
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
  | Curve
  | TrajectoryItem;

export type RoadLook = Readonly<{
  lanesLeft: readonly string[];
  lanesRight: readonly string[];
  offset?: number;
  laneOffset?: number;
  shoulderSpaceLeft?: number;
  shoulderSpaceRight?: number;
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
  color: MapAreaColor;
  roadOver: boolean;
};
export type MapPoint = RoadMapPoint | PolygonMapPoint;
interface NavCurve {
  // From https://modding.scssoft.com/wiki/Games/ETS2/Modding_guides/1.30#Prefabs:
  // Index of a navigational node which should be used if navigation starts from that AI curve or 0xffffffff if there is none.
  // Basically it is a reverse mapping to the curve_indices from nodes.
  navNodeIndex: number;
  start: {
    x: number;
    y: number;
    z: number;
    rotation: number;
    rotationQuat: [number, number, number, number];
  };
  end: {
    x: number;
    y: number;
    z: number;
    rotation: number;
    rotationQuat: [number, number, number, number];
  };
  nextLines: number[];
  prevLines: number[];
}
export interface PrefabDescription {
  // prefab's entry/exit points
  nodes: {
    x: number;
    y: number;
    z: number;
    rotation: number;
    rotationDir: [number, number, number];
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
  navCurves: NavCurve[];
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

export interface MapData extends DefData {
  nodes: Node[];
  elevation: [number, number, number][];
  roads: Road[];
  ferries: Ferry[];
  prefabs: Prefab[];
  companies: CompanyItem[];
  models: Model[];
  mapAreas: MapArea[];
  pois: Poi[];
  dividers: (Building | Curve)[];
  trajectories: TrajectoryItem[];
  triggers: Trigger[];
  cutscenes: Cutscene[];
  cities: City[];
}

export interface DefData {
  countries: Country[];
  companyDefs: Company[];
  roadLooks: WithToken<RoadLook>[];
  prefabDescriptions: WithToken<PrefabDescription>[];
  modelDescriptions: WithToken<ModelDescription>[];
  achievements: WithToken<Achievement>[];
  routes: WithToken<Route>[];
  mileageTargets: MileageTarget[];
}

// GeoJSON

export type DebugFeature = GeoJSON.Feature<
  | GeoJSON.Polygon
  | GeoJSON.LineString
  | GeoJSON.MultiLineString
  | GeoJSON.Point,
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

export type ContourFeature = GeoJSON.Feature<
  GeoJSON.MultiPolygon,
  { elevation: number }
>;

export type AchievementFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.Point,
  { name: string; dlcGuard: number }
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
  | ContourFeature
  | AchievementFeature
  | DebugFeature;

// loosely based on keys and speed_class values in def/world/traffic_lane.sii
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
  shoulderSpaceLeft?: number;
  shoulderSpaceRight?: number;
}

export interface FerryProperties {
  type: 'ferry' | 'train';
  name: string;
}

export interface PrefabProperties {
  type: 'prefab';
  dlcGuard: number;
  zIndex: number;
  color: MapAreaColor;
}

export interface MapAreaProperties {
  type: 'mapArea';
  dlcGuard: number;
  zIndex: number;
  color: MapAreaColor;
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
  poiName?: string; // POI label, if available
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
  /** True if this Neighbor's edge represents a ferry route. */
  // TODO combine this with isOneLaneRoad into an enum
  readonly isFerry?: true;
  /**
   * The direction one must travel in _after_ reaching this Neighbor's node.
   * Not the direction of this Neighbor's edge.
   */
  readonly direction: 'forward' | 'backward';
  /** The dlcGuard associated with this Neighbor's node. */
  readonly dlcGuard: number;
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
  /** dlcGuard */
  g: number;
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
