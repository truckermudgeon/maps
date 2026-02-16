import type { Position } from '@truckermudgeon/base/geom';
import { fromAtsCoordsToWgs84 } from '@truckermudgeon/map/projections';
import { EventEmitter } from 'events';
import type { TrailerState } from '../../types';
import type { TelemetryEventEmitter } from '../session-actor';

interface TrailerStateWithGameCoords extends TrailerState {
  positionGameCoords: [x: number, y: number];
}

export type TrailerEventEmitter = EventEmitter<{
  update: [TrailerState | undefined];
}>;

export function detectTrailerEvents(opts: {
  telemetryEventEmitter: TelemetryEventEmitter;
}): {
  readTrailerState: () => TrailerState | undefined;
  trailerEventEmitter: Omit<TrailerEventEmitter, 'emit'>;
} {
  const { telemetryEventEmitter } = opts;
  const trailerEventEmitter: TrailerEventEmitter = new EventEmitter();

  let unattachedState: TrailerStateWithGameCoords | undefined;
  const readTrailerState = () => unattachedState;

  telemetryEventEmitter.on(
    'telemetry',
    function detectTrailerEvents(telemetry) {
      if (telemetry.game.paused) {
        return;
      }

      const newTrailer = telemetry.trailer;
      const newTrailerPos = [
        newTrailer.position.X,
        newTrailer.position.Z,
      ] as Position;

      // TODO simplify. maybe don't need newTrailerIsValid
      const newTrailerIsValid =
        newTrailerPos[0] !== 0 || newTrailerPos[1] !== 0;
      const becameAttached =
        newTrailerIsValid && newTrailer.attached && unattachedState != null;
      const becameUnattached =
        newTrailerIsValid &&
        !newTrailer.attached &&
        (unattachedState == null ||
          unattachedState.positionGameCoords[0] !== newTrailerPos[0] ||
          unattachedState.positionGameCoords[1] !== newTrailerPos[1]);
      if (!becameAttached && !becameUnattached) {
        return;
      }

      unattachedState = !newTrailer.attached
        ? {
            attached: false,
            position: fromAtsCoordsToWgs84(newTrailerPos),
            positionGameCoords: newTrailerPos,
          }
        : undefined;
      trailerEventEmitter.emit(
        'update',
        unattachedState
          ? {
              attached: unattachedState.attached,
              position: unattachedState.position,
            }
          : undefined,
      );
    },
  );

  return {
    readTrailerState,
    trailerEventEmitter,
  };
}
