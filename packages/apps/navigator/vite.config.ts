import eslint from '@nabla/vite-plugin-eslint';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
      copyPublicDir: false,
    },
    server: {
      open: true,
    },
    plugins: [
      react(),
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
      setupFiles: ['./vitest.setup.ts'],
    },
  };
});
