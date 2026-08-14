import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// Upload source maps to Sentry so production stack traces show real file/line/
// function names. Active ONLY when SENTRY_AUTH_TOKEN is set (the Vercel prod
// build) — local dev/CI builds without the token are completely unaffected.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // The Sentry plugin must come AFTER all other plugins.
    ...(uploadSourceMaps
      ? [sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      })]
      : []),
  ],
  // Generate hidden source maps only when we're going to upload+delete them, so
  // browsers never download maps and the dist stays clean otherwise.
  build: { sourcemap: uploadSourceMaps ? 'hidden' : false },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: true,
    // Unit/component tests live under src/; e2e/ is Playwright-only.
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    // The suite's heaviest tests (drag-and-drop, multi-drawer flows) sit close
    // to Vitest's 5000ms default even in isolation, and running the full suite
    // spreads them across parallel workers that contend for the same CPU —
    // pushing some over the line. Measured flakes were always a timeout, never
    // a real assertion failure, and reproduced on untouched main too. Raising
    // the ceiling (rather than speeding up or rewriting the tests) removes the
    // false failures without changing what is being tested.
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
