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
