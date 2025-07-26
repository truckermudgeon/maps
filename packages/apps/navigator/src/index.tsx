import '@fontsource/inter';
import { CssBaseline, CssVarsProvider } from '@mui/joy';
import {
  THEME_ID as MATERIAL_THEME_ID,
  Experimental_CssVarsProvider as MaterialCssVarsProvider,
  extendTheme as materialExtendTheme,
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

const params = new URLSearchParams(window.location.search);
const fake = params.has('fake');
const host = params.get('host') ?? 'localhost';
const port = params.get('port') ?? 62840;
const appClient = fake
  ? fakeAppClient
  : createTRPCProxyClient<AppRouter>({
      links: [
        wsLink({
          client: createWSClient({
            url: `ws://${host}:${port}`,
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
