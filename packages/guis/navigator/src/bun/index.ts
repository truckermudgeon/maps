import type {
  ApplicationMenuItemConfig,
  WindowOptionsType,
} from 'electrobun/bun';
import {
  ApplicationMenu,
  BrowserView,
  BrowserWindow,
  Updater,
  Utils,
} from 'electrobun/bun';
import { BrowserPageUrls } from './constants';
import { startTelemetryClient } from './telemetry-client';
import type { TelemetryGuiRPC } from './types';

const DEV_SERVER_PORT = 5174;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
  // Check if Vite dev server is running for HMR
  const channel = await Updater.localInfo.channel();
  if (channel === 'dev') {
    try {
      await fetch(DEV_SERVER_URL, { method: 'HEAD' });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log(
        "Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
      );
    }
  }
  return 'views://mainview/index.html';
}

let telemetryClientStarted = false;

const rpc = BrowserView.defineRPC<TelemetryGuiRPC>({
  maxRequestTime: 0,
  handlers: {
    requests: {
      startTelemetryClient: async () => {
        if (telemetryClientStarted) {
          return;
        }
        if (process.platform === 'win32') {
          // for some reason, Windows doesn't show the app's footer on initial
          // display, even when the browser window is constructed with a larger
          // `frame.height`. forcing a window resize seems to fix things.
          mainWindow.setSize(
            browserWindowOptions.frame.width,
            browserWindowOptions.frame.height + 60,
          );
        }
        telemetryClientStarted = true;
        await startTelemetryClient(rpc);
      },
      openBrowser: ({ page }) => {
        Utils.openExternal(BrowserPageUrls[page]);
      },
    },
  },
});

const browserWindowOptions = {
  title: 'TruckSim Navigator',
  url: await getMainViewUrl(),
  styleMask: {
    Resizable: false,
  },
  titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  frame: {
    width: 640,
    height: 440,
    x: 200,
    y: 200,
  },
  rpc,
} as const satisfies Partial<WindowOptionsType<typeof rpc>>;

const applicationMenu: ApplicationMenuItemConfig[] = [];
switch (process.platform) {
  case 'darwin':
    applicationMenu.push({
      submenu: [
        // { label: 'Hide TruckSim Navigator', role: 'hide' },
        // { role: 'hideOthers' },
        // { role: 'showAll' },
        // { type: 'separator' },
        { label: 'Quit TruckSim Navigator', role: 'quit', accelerator: 'q' },
      ],
    });
    break;
  case 'win32':
  default:
    applicationMenu.push({
      label: 'File',
      submenu: [{ label: 'Exit', role: 'quit' }],
    });
    break;
}

// must be called _immediately before_ `BrowserWindow` ctor below.
// see https://github.com/blackboardsh/electrobun/issues/136#issuecomment-3993930745
ApplicationMenu.setApplicationMenu(applicationMenu);

const mainWindow = new BrowserWindow(browserWindowOptions);

// Quit the app when the main window is closed
mainWindow.on('close', () => {
  Utils.quit();
});

console.log('TruckSim Navigator Client (GUI) started.');
