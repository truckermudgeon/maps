// Data types returned from parsing game files.
// Fields are declared as necessary.
//
// For a complete set of fields, see the "raw" types declared in
// sector-parser.ts, and examine the json returned from parsing .sii/.sui files
// with `convertSiiToJson`.

export type Node = Readonly<{
  uid: bigint;
  x: number;
  y: number;
  rotation: number;
  forwardItemUid: bigint;
  backwardItemUid: bigint;
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
  companies: readonly CompanyItem[];
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
  // cargoInTokens: string[] (look at company/<name>/in folder contents)
  // cargoOutTokens: string[] (look at company/<name>/out folder contents)
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
  icon: string;
}>;

type LabeledPoi = BasePoi &
  Readonly<{
    type: 'company' | 'landmark' | 'viewpoint' | 'ferry';
    label: string;
  }>;

type UnlabeledPoi = BasePoi &
  Readonly<{
    type: 'road' | 'facility';
    // label can be derived from icon token
  }>;

export type Poi = LabeledPoi | UnlabeledPoi;

// TODO move all enums and constants to a separate constants.ts file, so that this file can stay as a pure types-only file.
export enum MapColor {
  Road = 0,
  Light,
  Dark,
  Green,
}

export const MapColorUtils = {
  from: (n: number) => {
    switch (n) {
      case 0:
        return MapColor.Road;
      case 1:
        return MapColor.Light;
      case 2:
        return MapColor.Dark;
      case 3:
        return MapColor.Green;
      default:
        throw new Error('unknown MapColor: ' + n);
    }
  },
};

export type BaseItem = Readonly<{
  uid: bigint;
  type: ItemType;
  x: number;
  y: number;
}>;

export type Road = BaseItem &
  Readonly<{
    type: ItemType.Road;
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
    hidden?: true;
    token: string;
    nodeUids: readonly bigint[];
    originNodeIndex: number;
  }>;

export type MapArea = BaseItem &
  Readonly<{
    type: ItemType.MapArea;
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

export enum MapOverlayType {
  Road = 0,
  Parking = 1,
  Landmark = 4,
}

export const MapOverlayTypeUtils = {
  from: (n: number) => {
    switch (n) {
      case 0:
        return MapOverlayType.Road;
      case 1:
        return MapOverlayType.Parking;
      case 4:
        return MapOverlayType.Landmark;
      default:
        throw new Error('unknown MapOverlayType: ' + n);
    }
  },
};

export type RoadLook = Readonly<{
  lanesLeft: readonly string[];
  lanesRight: readonly string[];
  offset?: number;
  laneOffset?: number;
}>;

export enum ItemType {
  Terrain = 1,
  Building = 2,
  Road = 3,
  Prefab = 4,
  Model = 5,
  Company = 6,
  Service = 7,
  CutPlane = 8,
  Mover = 9,
  NoWeather = 11,
  City = 12,
  Hinge = 13,
  MapOverlay = 18,
  Ferry = 19,
  Sound = 21,
  Garage = 22,
  CameraPoint = 23,
  Trigger = 34,
  FuelPump = 35, // services
  Sign = 36, // sign
  BusStop = 37,
  TrafficRule = 38, // traffic_area
  BezierPatch = 39,
  Compound = 40,
  TrajectoryItem = 41,
  MapArea = 42,
  FarModel = 43,
  Curve = 44,
  CameraPath = 45,
  Cutscene = 46,
  Hookup = 47,
  VisibilityArea = 48,
  Gate = 49,
}

// values from https://github.com/SCSSoftware/BlenderTools/blob/master/addon/io_scs_tools/consts.py
export enum SpawnPointType {
  None = 0,
  TrailerPos = 1,
  UnloadEasyPos = 2,
  GasPos = 3,
  ServicePos = 4,
  TruckStopPos = 5,
  WeightStationPos = 6,
  TruckDealerPos = 7,
  Hotel = 8,
  Custom = 9,
  Parking = 10, // also shows parking in companies which don't work/show up in game
  Task = 11,
  MeetPos = 12,
  CompanyPos = 13,
  GaragePos = 14, // manage garage
  BuyPos = 15, // buy garage
  RecruitmentPos = 16,
  CameraPoint = 17,
  BusStation = 18,
  UnloadMediumPos = 19,
  UnloadHardPos = 20,
  UnloadRigidPos = 21,
  WeightCatPos = 22,
  CompanyUnloadPos = 23,
  TrailerSpawn = 24,
  LongTrailerPos = 25,
}

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
    inputLanes: number[];
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
  models: Model[];
  mapAreas: MapArea[];
  pois: Poi[];
  dividers: (Building | Curve)[];
  countries: Country[];
  cities: City[];
  roadLooks: WithToken<RoadLook>[];
  prefabDescriptions: WithToken<PrefabDescription>[];
  modelDescriptions: WithToken<ModelDescription>[];
}
