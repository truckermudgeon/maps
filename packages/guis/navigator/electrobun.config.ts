import type { ElectrobunConfig } from 'electrobun';

export default {
  app: {
    name: 'TruckSim Navigator',
    identifier: 'com.truckermudgeon.navigator-client',
    version: '0.2.0',
  },
  build: {
    // Vite builds to dist/, we copy from there
    copy: {
      'dist/index.html': 'views/mainview/index.html',
      'dist/assets': 'views/mainview/assets',
    },
    bun: {
      define: {
        'process.env.NODE_ENV': JSON.stringify(
          process.env.NODE_ENV ?? 'development',
        ),
      },
    },
    mac: {
      bundleCEF: false,
      entitlements: {
        // This entitlement is required for Electrobun apps with a hardened runtime (required for notarization) to run on macos
        'com.apple.security.cs.allow-jit': true,
        // Required for bun runtime to work with dynamic code execution and JIT compilation when signed
        'com.apple.security.cs.allow-unsigned-executable-memory': true,
        //'com.apple.security.cs.disable-library-validation': true,
      },
    },
    linux: {
      bundleCEF: false,
      icon: 'icon.iconset/icon_256x256.png',
    },
    win: {
      bundleCEF: false,
      icon: 'icon.iconset/icon_256x256.png',
    },
  },
} satisfies ElectrobunConfig;
