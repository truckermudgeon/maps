import {
  Divider,
  LinearProgress,
  Modal,
  ModalClose,
  ModalDialog,
  Stack,
} from '@mui/joy';
import { navigatorUrl } from '@truckermudgeon/navigator-client/constants';
import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import { memo, useState } from 'react';
import type { BunRPC } from '../bun/types';
import type { TerminalAppState } from './app-store';
import { AppStore } from './app-store';
import { ConnectionStatsPage } from './ConnectionStatsPage';
import { ConnectionStatus } from './ConnectionStatus';
import { ErrorPage } from './ErrorPage';
import { Help } from './Help';
import { HelpButton } from './HelpButton';
import { LatencyStatus } from './LatencyStatus';
import { ModeSelector } from './ModeSelector';
import { PairingCode } from './PairingCode';
import { QrCode } from './QrCode';
import { TitleBar } from './TitleBar';

const App = memo((props: { rpc: BunRPC }) => {
  console.log('render App');
  const [store] = useState(() => new AppStore(props.rpc));
  // this cleanup invalidates the store used in the observers below :(
  // gotta figure out the right way to do this.
  // useEffect(() => () => store.dispose(), [store]);

  const _Modal = observer(() => {
    return (
      <Modal
        open={store.showHelp}
        onClose={action(() => (store.showHelp = false))}
      >
        <ModalDialog layout={'fullscreen'}>
          <ModalClose sx={{ mr: 1, zIndex: 9999 }} />
          <Help onLinkClick={page => props.rpc.request.openBrowser({ page })} />
        </ModalDialog>
      </Modal>
    );
  });
  const _ConnectionStatus = observer(() => {
    const { iconColor, text, tooltip } = store.status;
    return (
      <ConnectionStatus iconColor={iconColor} text={text} tooltip={tooltip} />
    );
  });
  const _LatencyStatus = observer(() => {
    const { fiveSecondMs, sixtySecondMs } = store.latency;
    return (
      <LatencyStatus
        fiveSecondMs={fiveSecondMs}
        sixtySecondMs={sixtySecondMs}
      />
    );
  });
  const CurrentPage = observer(() => {
    if (store.isTerminal) {
      return (
        <ErrorPage
          state={store.appState as TerminalAppState}
          text={store.status.tooltip}
        />
      );
    } else if (store.mode == 'code' && store.pairingCode != null) {
      return (
        <>
          <PairingCode
            reconnected={store.reconnected}
            pairingCode={store.pairingCode}
            navigatorUrl={navigatorUrl}
            onNavigatorUrlClick={() =>
              props.rpc.request.openBrowser({ page: 'navigator' })
            }
          />
          <Divider orientation={'vertical'} />
          <QrCode pairingCode={store.pairingCode} navigatorUrl={navigatorUrl} />
        </>
      );
    } else if (store.mode === 'timeline') {
      return (
        <ConnectionStatsPage
          connectedAt={store.connectedAt}
          lifetimeDeltas={store.lifetimeDeltas}
          deltas={store.deltas.slice(0)}
        />
      );
    } else {
      return (
        <Stack sx={{ p: 4, flex: 1 }}>
          <LinearProgress color="neutral" size="lg" />
        </Stack>
      );
    }
  });
  const _TitleBar = observer(() => {
    const _ModeSelector =
      store.isTerminal || store.pairingCode == null
        ? () => <div />
        : () => (
            <ModeSelector onSetMode={action(mode => (store.mode = mode))} />
          );
    const _HelpButton = () => (
      <HelpButton onClick={action(() => (store.showHelp = true))} />
    );
    return <TitleBar ModeSelector={_ModeSelector} HelpButton={_HelpButton} />;
  });

  return (
    <>
      <Stack
        sx={{
          height: '100vh',
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        <_TitleBar />
        <Stack
          direction={'row'}
          alignItems={'center'}
          justifyContent={'center'}
          gap={2}
          sx={{
            p: 2,
            pt: 1,
            flexGrow: 1,
          }}
        >
          <CurrentPage />
        </Stack>
        <Divider />
        <Stack
          direction={'row'}
          alignItems={'center'}
          justifyContent={'space-between'}
          sx={{
            px: 2,
            height: '3em',
            backgroundColor: 'background.level1',
          }}
        >
          <_ConnectionStatus />
          <_LatencyStatus />
        </Stack>
      </Stack>
      <_Modal />
    </>
  );
});

export default App;
