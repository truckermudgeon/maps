import { observer } from 'mobx-react-lite';
import { WaitingForTelemetry as WaitingForTelemetryComponent } from '../components/WaitingForTelemetry';
import { useAppController } from '../services/context';
import { useSessionStore } from '../stores/hooks/use-session';

export const WaitingForTelemetry = observer(() => {
  const session = useSessionStore();
  const controller = useAppController();
  const status = session.telemetryStatus;
  if (!session.isAuthenticated) {
    // assume some other component will show "waiting to load" UI
    return <></>;
  }
  if (status === 'live') {
    return <></>;
  }
  return (
    <WaitingForTelemetryComponent
      state={status}
      onRePair={() => controller.forceRePair()}
    />
  );
});
