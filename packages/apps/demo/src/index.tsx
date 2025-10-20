import { CssBaseline, CssVarsProvider, extendTheme } from '@mui/joy';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from 'react-router-dom';
import Demo from './Demo';
import './index.css';
import RoutesDemo from './RoutesDemo';
import { eventMeta, SpecialEvent } from './SpecialEventControl';
import { SpecialEventMap } from './SpecialEventMap';
import StreetViewDemo from './StreetViewDemo';

const tileRootUrl = import.meta.env.VITE_TILE_ROOT_URL;
const pixelRootUrl = import.meta.env.VITE_PIXEL_ROOT_URL;

const specialEvent: 'halloween' | 'christmas' | undefined = 'halloween';

const router = createBrowserRouter(
  createRoutesFromElements(
    [
      <Route
        path="/"
        element={
          <Demo
            tileRootUrl={tileRootUrl}
            pixelRootUrl={pixelRootUrl}
            specialEvent={specialEvent}
          />
        }
      />,
      <Route
        path="routes"
        element={<RoutesDemo tileRootUrl={tileRootUrl} />}
      />,
      <Route
        path="street-view"
        element={
          <StreetViewDemo
            tileRootUrl={tileRootUrl}
            pixelRootUrl={pixelRootUrl}
          />
        }
      />,
    ].concat(
      Object.entries(eventMeta).map(([key, meta]) => (
        <Route
          path={meta.url}
          element={
            <SpecialEventMap
              tileRootUrl={tileRootUrl}
              specialEvent={key as SpecialEvent}
            />
          }
        />
      )),
    ),
  ),
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
