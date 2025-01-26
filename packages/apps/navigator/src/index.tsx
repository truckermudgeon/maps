import '@fontsource/inter';
import { CssBaseline, CssVarsProvider } from '@mui/joy';
import {
  THEME_ID as MATERIAL_THEME_ID,
  Experimental_CssVarsProvider as MaterialCssVarsProvider,
  experimental_extendTheme as materialExtendTheme,
} from '@mui/material/styles';
import { createTRPCProxyClient, createWSClient, wsLink } from '@trpc/client';
import type { AppRouter } from '@truckermudgeon/navigation';
import * as mobx from 'mobx';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { createApp } from './create-app';
import { fakeAppClient } from './fake-app-client';
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

const appClient = window.location.search.includes('fake')
  ? fakeAppClient
  : createTRPCProxyClient<AppRouter>({
      links: [
        wsLink({
          client: createWSClient({
            //url: 'ws://192.168.0.219:3000',
            url: 'ws://localhost:3000',
          }),
        }),
      ],
    });

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
