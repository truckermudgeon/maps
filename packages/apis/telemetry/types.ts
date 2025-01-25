interface JobLocation {
  city: {
    id: string; // city token
    name: string;
  };
  company: {
    id: string; // company token
    name: string;
  };
}

interface Speed {
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
