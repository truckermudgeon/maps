import '@fontsource/inter';
import { CssBaseline, CssVarsProvider } from '@mui/joy';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const container = document.getElementById('root')!;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <CssVarsProvider>
      <CssBaseline />
      Hello, world
    </CssVarsProvider>
  </React.StrictMode>,
);
