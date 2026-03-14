import { CssBaseline, CssVarsProvider, extendTheme } from '@mui/joy';
import {
  fromEts2CoordsToWgs84,
  fromWgs84ToEts2Coords,
} from '@truckermudgeon/map/projections';
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
import type { SpecialEvent } from './SpecialEventControl';
import { eventMeta } from './SpecialEventControl';
import { SpecialEventMap } from './SpecialEventMap';
import StreetViewDemo from './StreetViewDemo';

// Expose coordinate converters on window for browser console use
const debugWindow = window as unknown as Window & {
  fromEts2CoordsToWgs84: (
    x: number,
    y: number,
  ) => { x: number; y: number; lon: number; lat: number };
  fromWgs84ToEts2Coords: (
    lon: number,
    lat: number,
  ) => { lon: number; lat: number; x: number; y: number };
};
debugWindow.fromEts2CoordsToWgs84 = (x: number, y: number) => {
  const [lon, lat] = fromEts2CoordsToWgs84([x, y]);
  return { x, y, lon, lat };
};
debugWindow.fromWgs84ToEts2Coords = (lon: number, lat: number) => {
  const [x, y] = fromWgs84ToEts2Coords([lon, lat]);
  return { lon, lat, x, y };
};

const tileRootUrl = import.meta.env.VITE_TILE_ROOT_URL;
const pixelRootUrl = import.meta.env.VITE_PIXEL_ROOT_URL;

const specialEvent: 'halloween' | 'christmas' | undefined = undefined;

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
