// Module-level so repeat callers don't request a second sentinel while
// the first is still active.
let wakeLock: WakeLockSentinel | undefined;

export function requestWakeLock(): void {
  if (wakeLock != null && !wakeLock.released) {
    console.log('already have a wakelock');
    return;
  }
  void (async () => {
    try {
      console.log('requesting wake lock');
      wakeLock = await navigator.wakeLock.request();
      console.log('wake lock released?:', wakeLock.released);
    } catch (err) {
      if (err instanceof Error) {
        console.error(`error requesting wakelock: ${err.name}, ${err.message}`);
      } else {
        console.error('unknown error requesting wakelock:', err);
      }
    }
  })();
}

/**
 * Clears the local pairing credentials and reloads the page. SessionGate
 * decides what to render based on a useState that's initialized from
 * localStorage at mount, so reloading is what restarts the flow at the
 * pairing form.
 */
export function clearCredentialsAndReload(): void {
  console.log('clearing viewer credentials and reloading');
  localStorage.removeItem('viewerId');
  localStorage.removeItem('telemetryId');
  window.location.reload();
}
