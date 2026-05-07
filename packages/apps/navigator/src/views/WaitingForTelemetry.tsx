import { observer } from 'mobx-react-lite';
import {
  WaitingForTelemetry as WaitingForTelemetryComponent,
  type WaitingForTelemetryState,
} from '../components/WaitingForTelemetry';
import { useAppController } from '../services/context';
import { useSessionStore } from '../stores/hooks/use-session';

export const WaitingForTelemetry = observer(() => {
  const session = useSessionStore();
  const controller = useAppController();
  if (!session.isAuthenticated) {
    // assume some other component will show "waiting to load" UI
    return <></>;
  }
  // TODO show "Loading map..." UI if map hasn't loaded yet, instead of
  //  showing "Waiting for telemetry..." UI.
  if (session.hasReceivedFirstTelemetry && !session.bindingStale) {
    return <></>;
  }
  const state: WaitingForTelemetryState = !session.hasReceivedFirstTelemetry
    ? session.bindingStale
      ? 'orphaned'
      : 'awaiting'
    : 'lost';
  return (
    <WaitingForTelemetryComponent
      state={state}
      onRePair={() => controller.forceRePair()}
    />
  );
});
