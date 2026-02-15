import NearMeIcon from '@mui/icons-material/NearMe';
import ReportIcon from '@mui/icons-material/Report';
import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  Input,
  Link,
  Stack,
  Typography,
} from '@mui/joy';
import React, { memo, useEffect, useRef, useState } from 'react';
import OtpInput from 'react-otp-input';
import type { AppClient } from '../controllers/types';
import './SessionGate.css';

type Status = 'authorizing' | 'loggedOut' | 'loggedIn';

const CODE_LENGTH = 4;

export const SessionGate = (props: {
  appClient: Pick<AppClient, 'redeemCode' | 'reconnect'>;
  readyToLoadStore: { readyToLoad: boolean };
  App: React.NamedExoticComponent;
}) => {
  const { appClient, App, readyToLoadStore } = props;
  const [status, setStatus] = useState<Status>('authorizing');
  const containerRef = useRef<HTMLDivElement | null>(null);

  console.log('render SessionGate');

  useEffect(() => {
    const checkAuth = async () => {
      const maybeViewerId = localStorage.getItem('viewerId');
      if (!maybeViewerId) {
        console.log('no viewer id');
        setStatus('loggedOut');
      } else {
        console.log('attempting reconnect');
        const success = await appClient.reconnect.mutate({
          viewerId: maybeViewerId,
        });
        if (!success) {
          console.log('reconnect failed; falling back to pairing flow');
          setStatus('loggedOut');
        } else {
          setStatus('loggedIn');
          readyToLoadStore.readyToLoad = true;
        }
      }
    };
    void checkAuth();
  }, []);

  const onLoggedIn = () => {
    setStatus('loggedIn');
    readyToLoadStore.readyToLoad = true;
  };

  return (
    <>
      <App />
      {status !== 'loggedIn' && (
        <Stack
          position={'absolute'}
          top={0}
          left={0}
          zIndex={9999}
          justifyContent={'center'}
          alignItems={'center'}
          width={'100%'}
          height={'100vh'}
          bgcolor={'#0008'}
        >
          <Card
            ref={containerRef}
            size={'lg'}
            sx={{ boxShadow: 'lg', overflow: 'hidden' }}
          >
            <Header />
            <Divider />
            {status === 'authorizing' ? (
              <Typography display={'flex'} justifyContent={'center'}>
                <CircularProgress
                  variant="solid"
                  size={'sm'}
                  color={'neutral'}
                  sx={{ mr: 1 }}
                />
                Connecting...
              </Typography>
            ) : (
              <CardContent>
                <Form appClient={appClient} onLoggedIn={onLoggedIn} />
              </CardContent>
            )}
          </Card>
        </Stack>
      )}
    </>
  );
};

const Header = memo(() => {
  return (
    <>
      {' '}
      <Typography
        className={'caveat-alpha-label'}
        level={'h2'}
        textAlign={'end'}
        sx={{
          position: 'absolute',
          right: '1em',
          transform: 'rotate(-10deg) translate(0.65em, 1em)',
          color: '#e00',
        }}
      >
        pre-alpha
      </Typography>
      <Typography
        level={'h1'}
        alignSelf={'center'}
        startDecorator={
          <IconButton
            color={'primary'}
            variant={'solid'}
            style={{ pointerEvents: 'none' }}
          >
            <NearMeIcon />
          </IconButton>
        }
      >
        TruckSim&nbsp;Navigator
      </Typography>
    </>
  );
});

const Form = memo(
  (props: {
    appClient: Pick<AppClient, 'redeemCode' | 'reconnect'>;
    onLoggedIn: () => void;
  }) => {
    const { appClient } = props;
    const [error, setError] = useState<string | null>(null);
    const [code, setCode] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
      const url = new URL(window.location.href);
      if (url.searchParams.has('pair')) {
        const otp = url.searchParams
          .get('pair')!
          .toLowerCase()
          .replaceAll(/[^a-z]/gi, '');

        // don't want to save the URL with the query param in history; if user
        // visits navigator, they should be able to bookmark the query-less
        // version of the URL.
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );

        if (otp.length === CODE_LENGTH) {
          console.log('using code from query param', otp);
          setCode(otp);
        }
      }
    }, []);

    function onChange(otp: string) {
      otp = otp.replaceAll(/[^a-z]/gi, '');
      setCode(otp.toLowerCase());
    }

    function onPaste(e: React.ClipboardEvent) {
      const pasted = e.clipboardData.getData('text').toLowerCase().trim();
      if (pasted.length !== CODE_LENGTH) {
        return;
      }

      setCode(pasted);
      void redeemCode(pasted);
    }

    async function redeemCode(code: string) {
      console.log('redeem code', code);
      if (submitting) {
        return;
      }

      setError(null);
      setSubmitting(true);

      try {
        const res = await appClient.redeemCode.mutate({ code });
        localStorage.setItem('viewerId', res.viewerId);
        localStorage.setItem('telemetryId', res.telemetryId);
        console.log('code redeemed');
        props.onLoggedIn();
      } catch (err) {
        console.log('error after submitting code');
        setError(err instanceof Error ? err.message : 'Login failed');
        setCode('');
      } finally {
        setSubmitting(false);
      }
    }

    return (
      <Stack textAlign={'center'} gap={'1em'}>
        <Typography>
          Enter your{' '}
          <Link underline={'always'} href={'/whats-a-pairing-code.html'}>
            pairing code
          </Link>
        </Typography>

        <form
          method={'dialog'}
          onSubmit={() => void redeemCode(code)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1em',
          }}
        >
          <OtpInput
            containerStyle={{ justifyContent: 'center' }}
            value={code}
            numInputs={CODE_LENGTH}
            onPaste={onPaste}
            renderInput={(props, index) => (
              <Input
                slotProps={{ input: { ...props } }}
                autoFocus={index === 0}
                disabled={submitting}
                data-lpignore="true"
                data-1p-ignore="true"
                sx={{
                  width: '2em',
                  height: '2em',
                  margin: 1,
                  fontSize: '2em',
                  fontFamily: 'monospace',
                }}
              />
            )}
            onChange={onChange}
          />

          {error && (
            <Alert color={'danger'} startDecorator={<ReportIcon />}>
              {error}
            </Alert>
          )}

          <CardActions sx={{ p: 0 }}>
            <Button
              component={'a'}
              href={'https://truckermudgeon.github.io'}
              variant="outlined"
              color="neutral"
              disabled={submitting}
              sx={{ flexBasis: '50%' }}
            >
              Back
            </Button>
            <Button
              type={'submit'}
              disabled={submitting || code.length !== CODE_LENGTH}
              sx={{ flexBasis: '50%' }}
              startDecorator={
                submitting ? (
                  <CircularProgress
                    variant="solid"
                    color={'neutral'}
                    sx={{ opacity: 0.5 }}
                  />
                ) : null
              }
            >
              {submitting ? 'Checking…' : 'Continue'}
            </Button>
          </CardActions>
        </form>
      </Stack>
    );
  },
);
