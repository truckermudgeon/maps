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
    <RouterProvider router={router} />
  </React.StrictMode>,
);
