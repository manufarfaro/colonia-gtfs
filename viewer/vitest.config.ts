import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  // vitest pipes .css imports through Vite's PostCSS pipeline, which
  // explodes on Tailwind v4's `@import "tailwindcss"` inside a test
  // harness. Tests never render styled output — disable the PostCSS
  // step so any `import './foo.css'` becomes a no-op.
  css: { postcss: { plugins: [] } },
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
      //   - components/ui/**                              → shadcn upstream primitives
      //   - components/od/OdAutocompleteInput.tsx         → calls the live Google Maps Places API; tests stub it
      //   - components/od/LegPolyline.tsx                 → calls google.maps.Polyline / Marker directly; tests stub it
      //   - components/line-schedule/VehicleMarker.tsx    → calls google.maps.Marker directly; tests stub it
      //   - components/line-schedule/LineStopMarker.tsx   → same — small stop dot per line color
      //   - components/line-schedule/LineRouteLayer.tsx   → orchestrates google.maps.Polyline + Marker primitives
      //   - components/od/OdItineraryVehicles.tsx         → composes VehicleMarker on the map; tests stub it
      //   - **/*.test.{ts,tsx}                            → the tests themselves
      exclude: [
        'components/ui/**',
        'components/od/OdAutocompleteInput.tsx',
        'components/od/LegPolyline.tsx',
        'components/od/OdItineraryVehicles.tsx',
        'components/od/TripEndpointMarkers.tsx',
        'components/line-schedule/VehicleMarker.tsx',
        'components/line-schedule/LineStopMarker.tsx',
        'components/line-schedule/LineRouteLayer.tsx',
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
