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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Cover all first-party app code under these dirs + the root middleware.
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'middleware.ts'],
      // Exclusions:
      //   - components/ui/**     → shadcn upstream primitives (own tests upstream)
      //   - app/layout.tsx       → server component, covered by the smoke E2E
      //   - app/page.tsx         → placeholder server component, covered by smoke
      //   - **/*.test.{ts,tsx}   → the tests themselves
      exclude: [
        'components/ui/**',
        'app/layout.tsx',
        'app/page.tsx',
        '**/*.{test,spec}.{ts,tsx}',
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
