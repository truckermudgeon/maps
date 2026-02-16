import { throttle } from '@truckermudgeon/base/throttle';
import type { MappedDataForKeys } from '@truckermudgeon/generator/mapped-data';
import { type MapDataKeys } from '@truckermudgeon/generator/mapped-data';
import { EventEmitter } from 'events';
import type { TruckSimTelemetry } from '../../types';
import type { GraphAndMapData } from '../lookup-data';
import type { TelemetryEventEmitter } from '../session-actor';
import { toThemeMode } from './game-state';

export const detectThemeMapDataKeys = ['countries'] satisfies MapDataKeys;

export type ThemeModeEventEmitter = EventEmitter<{
  update: ['light' | 'dark'];
}>;

export function detectThemeModeEvents(opts: {
  telemetryEventEmitter: TelemetryEventEmitter;
  graphAndMapData: GraphAndMapData<
    MappedDataForKeys<typeof detectThemeMapDataKeys>
  >;
}): {
  readThemeMode: () => 'light' | 'dark';
  themeModeEventEmitter: Omit<ThemeModeEventEmitter, 'emit'>;
} {
  const { telemetryEventEmitter, graphAndMapData } = opts;
  const themeModeEventEmitter: ThemeModeEventEmitter = new EventEmitter();

  let currentMode: 'light' | 'dark' = 'light';
  const readThemeMode = () => currentMode;

  telemetryEventEmitter.on(
    'telemetry',
    throttle((telemetry: TruckSimTelemetry) => {
      if (telemetry.game.paused) {
        return;
      }

      const newMode = toThemeMode(
        telemetry,
        graphAndMapData.tsMapData.countries,
        graphAndMapData.graphNodeRTree,
      );
      if (newMode !== currentMode) {
        themeModeEventEmitter.emit('update', newMode);
        currentMode = newMode;
      }
    }, 5_000),
  );

  return {
    readThemeMode,
    themeModeEventEmitter,
  };
}
