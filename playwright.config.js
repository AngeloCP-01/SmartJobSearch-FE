import { defineConfig, devices } from '@playwright/test';

// Smoke-test the deployed app by default; override for local/preview runs:
//   E2E_BASE_URL=http://localhost:5173 npm run test:e2e
const baseURL = process.env.E2E_BASE_URL || 'https://jobtrail-hq.vercel.app';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000, // generous — the free-tier API can cold-start
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
