import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    include: [
      '{app,components,lib,test}/**/*.{test,spec}.{ts,tsx}',
      'middleware.{test,spec}.{ts,tsx}',
    ],
    // Enables @testing-library/react's auto-cleanup after each test.
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
