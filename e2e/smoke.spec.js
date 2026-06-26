import { test, expect } from '@playwright/test';

// End-to-end smoke tests against the deployed app (read-only — they explore the
// public demo account without mutating its data). Set E2E_BASE_URL to point
// them at a local/preview build instead.

const tryDemo = async (page) => {
  await page.goto('/welcome');
  await page.getByRole('button', { name: /try the live demo/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
};

test('landing page loads with a demo call-to-action', async ({ page }) => {
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: /run your job search/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /try the live demo/i }).first()).toBeVisible();
});

test('"Try the demo" opens a populated dashboard', async ({ page }) => {
  await tryDemo(page);
  await expect(page.getByText('Total applications')).toBeVisible();
  await expect(page.getByText('Upcoming interviews').first()).toBeVisible();
});

test('the applications board shows seeded applications', async ({ page }) => {
  await tryDemo(page);
  await page.goto('/applications');
  await expect(page.getByText('Senior Full Stack Engineer').first()).toBeVisible();
});

test('the AI résumé analysis page is reachable with past reports', async ({ page }) => {
  await tryDemo(page);
  await page.goto('/analysis');
  await expect(page.getByRole('heading', { name: /Résumé Analysis/i })).toBeVisible();
  await expect(page.getByText(/ATS \d+/).first()).toBeVisible();
});
