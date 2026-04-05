import { EventEmitter } from 'events';
import type { TelemetryEventEmitter } from '../session-actor';

export type MapEventEmitter = EventEmitter<{
  /**
   * Emitted when the map changes, e.g., when the game for which telemetry is
   * received changes.
   */
  update: ['usa' | 'europe'];
}>;

export function detectMapEvents(opts: {
  telemetryEventEmitter: TelemetryEventEmitter;
}): {
  readMapState: () => 'usa' | 'europe';
  mapEventEmitter: MapEventEmitter;
} {
  const { telemetryEventEmitter } = opts;
  const mapEventEmitter: MapEventEmitter = new EventEmitter();

  let mapState: 'usa' | 'europe' = 'usa';
  const readMapState = () => mapState;

  telemetryEventEmitter.on('telemetry', function detectMapEvents(telemetry) {
    const newMap = telemetry.game.game.name === 'ats' ? 'usa' : 'europe';
    if (mapState !== newMap) {
      mapState = newMap;
      mapEventEmitter.emit('update', newMap);
    }
  });

  return {
    readMapState,
    mapEventEmitter,
  };
}
