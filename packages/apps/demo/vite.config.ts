import react from '@vitejs/plugin-react';
import eslint from 'vite-plugin-eslint';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
      copyPublicDir: false,
    },
    server: {
      open: true,
    },
    plugins: [react(), viteTsconfigPaths(), eslint()],
    test: {
      globals: true,
      environment: 'jsdom',
      reporters: ['verbose'],
    },
  };
});
