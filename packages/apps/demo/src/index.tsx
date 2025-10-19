import { CssBaseline, CssVarsProvider, extendTheme } from '@mui/joy';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
} from 'react-router-dom';
import Demo from './Demo';
import './index.css';
import RoutesDemo from './RoutesDemo';
import { SpecialEventMap } from './SpecialEventMap';
import StreetViewDemo from './StreetViewDemo';

const tileRootUrl = import.meta.env.VITE_TILE_ROOT_URL;
const pixelRootUrl = import.meta.env.VITE_PIXEL_ROOT_URL;

const router = createBrowserRouter(
  createRoutesFromElements([
    <Route
      path="/"
      element={
        <Demo
          tileRootUrl={tileRootUrl}
          pixelRootUrl={pixelRootUrl}
          specialEvent={'halloween'}
        />
      }
    />,
    <Route path="routes" element={<RoutesDemo tileRootUrl={tileRootUrl} />} />,
    <Route
      path="street-view"
      element={
        <StreetViewDemo tileRootUrl={tileRootUrl} pixelRootUrl={pixelRootUrl} />
      }
    />,
    <Route
      path="brackenreach"
      element={
        <SpecialEventMap tileRootUrl={tileRootUrl} specialEvent={'halloween'} />
      }
    />,
  ]),
);

const theme = extendTheme({
  components: {
    JoyIconButton: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--joy-palette-background-surface)',
        },
      },
    },
  },
});

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <CssVarsProvider
      defaultMode={'system'}
      modeStorageKey={'tm-mode'}
      theme={theme}
    >
      <CssBaseline />
      <RouterProvider router={router} />
    </CssVarsProvider>
  </React.StrictMode>,
);
