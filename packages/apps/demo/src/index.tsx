import { CssBaseline, CssVarsProvider } from '@mui/joy';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
} from 'react-router-dom';
import Demo from './Demo';
import RoutesDemo from './RoutesDemo';
import './index.css';

const router = createBrowserRouter(
  createRoutesFromElements([
    <Route path="/" element={<Demo />} />,
    <Route path="routes" element={<RoutesDemo />} />,
  ]),
);

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <CssVarsProvider>
      <CssBaseline />
      <RouterProvider router={router} />
    </CssVarsProvider>
  </React.StrictMode>,
);
