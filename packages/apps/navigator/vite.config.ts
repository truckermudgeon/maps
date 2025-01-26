import react from '@vitejs/plugin-react';
import eslint from 'vite-plugin-eslint';
import { VitePWA } from 'vite-plugin-pwa';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
    },
    server: {
      open: true,
    },
    plugins: [
      react(),
      viteTsconfigPaths(),
      eslint(),
      VitePWA({
        disable: true,
        selfDestroying: true,
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true,
        },
      }),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      reporters: ['verbose'],
    },
  };
});
