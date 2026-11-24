import eslint from '@nabla/vite-plugin-eslint';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
    },
    server: {
      open: true,
    },
    plugins: [react(), eslint()],
    test: {
      globals: true,
      environment: 'jsdom',
      reporters: ['verbose'],
    },
  };
});
