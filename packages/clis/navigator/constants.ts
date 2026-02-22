//// @ts-expect-error use dot access instead of indexed access so bun compiles
//  with --define correctly.
export const NODE_ENV = process.env.NODE_ENV ?? 'development';
export const apiUrl =
  NODE_ENV === 'development'
    ? 'ws://localhost:62840/telemetry'
    : 'wss://api.truckermudgeon.com/telemetry';
export const healthUrl =
  NODE_ENV === 'development'
    ? 'http://localhost:62840/health'
    : 'https://api.truckermudgeon.com/health';
export const navigatorUrl =
  NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : 'https://navigator.truckermudgeon.com';
