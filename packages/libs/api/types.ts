export interface JobLocation {
  city: {
    id: string; // city token
    name: string;
  };
  company: {
    id: string; // company token
    name: string;
  };
}

export interface Speed {
  value: number; // meters per second
  kph: number;
  mph: number;
}

/** partial port of https://tst.kniffen.dev/#/typedefs?id=telemetrydata */
export interface TruckSimTelemetry {
  navigation: {
    speedLimit: Speed;
  };
  truck: {
    position: { X: number; Z: number };
    speed: Speed;
    orientation: { heading: number };
  };
  job: { destination: JobLocation; source: JobLocation };
  game: { timestamp: { value: number }; scale: number };
}

export interface Telemetry {
  position: {
    X: number;
    Z: number;
  };
  heading: number;
  speed: Speed;
  source: JobLocation;
  destination: JobLocation;
  speedLimit: Speed;
  timestamp: {
    value: number; // these numbers look off, like bytes are swapped or something.
  };
  scale: number; // 0 or 3 or 20
}

export interface TelemetryServerToClientEvents {
  update: (t: Telemetry) => void;
}

export interface GameState {
  speedMph: number;
  position: [number, number];
  bearing: number;
  speedLimit: number;
  scale: number;
}

export interface NavigationServerToClientEvents {
  updatePosition: (t: GameState) => void;
}
