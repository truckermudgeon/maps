import type { SteamApp } from 'steam-locate';
import { findSteamAppSync } from 'steam-locate';

export function checkIsPluginInstalled(): void {
  let app: SteamApp;
  try {
    app = findSteamAppSync('270880');
  } catch (err) {
    console.error(
      'could not find Steam installation of American Truck Simulator:',
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  }
  if (!app.isInstalled) {
    console.error('American Truck Simulator not installed.');
    process.exit(1);
  }
  if (!app.installDir) {
    console.error('could not determine install dir.');
    process.exit(1);
  }
  // TODO ensure DLL is installed
}
