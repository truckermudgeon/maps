import '@fontsource/inter';
import { CssBaseline, CssVarsProvider } from '@mui/joy';
import {
  THEME_ID as MATERIAL_THEME_ID,
  Experimental_CssVarsProvider as MaterialCssVarsProvider,
  extendTheme as materialExtendTheme,
} from '@mui/material/styles';
import { createTRPCProxyClient, createWSClient, wsLink } from '@trpc/client';
import type { AppRouter } from '@truckermudgeon/navigation/types';
import * as mobx from 'mobx';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { createApp } from './create-app';
import './index.css';

// https://mobx.js.org/configuration.html#linting-options
mobx.configure({
  enforceActions: 'always',
  computedRequiresReaction: true,
  reactionRequiresObservable: true,
  observableRequiresReaction: true,
  disableErrorBoundaries: true,
});

// Mixing and matching Material with Joy for access to Material's Transitions.
const materialTheme = materialExtendTheme();
const container = document.getElementById('root')!;
const root = createRoot(container);

const appClient = createTRPCProxyClient<AppRouter>({
  links: [
    wsLink({
      client: createWSClient({
        url: import.meta.env.VITE_WS_URL,
        connectionParams: () => {
          const viewerId = localStorage.getItem('viewerId');
          return viewerId ? { viewerId } : null;
        },
        onOpen: () => {
          // set state. indicates that connection established, so if
          // there's an error, it's probably not because the server's down.
          console.log('opening...');
        },
        onError: err => console.error('ws client error', err),
        onClose: cause => console.error('socket closed', cause),
        // roughly tied to the rate of allowed upgrade requests.
        retryDelayMs: attemptIndex =>
          Math.min(Math.pow(2, attemptIndex + 1) * 1_000, 15_000),
        // TODO add onOpen/onClose events to power a computed "connection" status thingy.
        keepAlive: {
          enabled: true,
          intervalMs: 30_000,
          pongTimeoutMs: 5_000,
        },
      }),
    }),
  ],
}).app;

const { App } = createApp({
  appClient,
  transitionDurationMs: materialTheme.transitions.duration.standard,
});

root.render(
  <React.StrictMode>
    <MaterialCssVarsProvider theme={{ [MATERIAL_THEME_ID]: materialTheme }}>
      <CssVarsProvider>
        <CssBaseline />
        <App />
      </CssVarsProvider>
    </MaterialCssVarsProvider>
  </React.StrictMode>,
);
