import { test, expect } from '@playwright/test';

// Reusable helper to enter the demo (mirrors smoke.spec.js)
const tryDemo = async (page) => {
  await page.goto('/welcome');
  await page.getByRole('button', { name: /try the live demo/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
};

test('create, edit, and persist an authored document', async ({ page }) => {
  // Enter the demo
  await tryDemo(page);

  // Navigate to the editor creation page
  await page.goto('/editor');

  // Fill in the document title
  await page.getByLabel(/new document title/i).fill('E2E Résumé');

  // Create the document
  await page.getByRole('button', { name: /create document/i }).click();

  // Now on the editor page — verify the title is set
  await expect(page.getByLabel(/document title/i)).toHaveValue('E2E Résumé');

  // Click in the editor and type content
  await page.locator('.tiptap').click();
  await page.keyboard.type('Hello from Playwright');

  // Wait for "Saving…" to appear (debounce fires) and then disappear (save completes)
  // before reloading — avoids racing the 1200ms debounce with the reload.
  await expect(page.getByText(/saving…/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/saving…/i)).toBeHidden({ timeout: 10_000 });

  // Reload the page and verify content persists
  await page.reload();
  await expect(page.getByText('Hello from Playwright')).toBeVisible();

  // Tables + find/replace.
  await page.getByRole('button', { name: /insert table/i }).click();
  await expect(page.locator('.tiptap table')).toBeVisible();
  await page.getByRole('button', { name: /find and replace/i }).click();
  await page.getByLabel('Find').fill('Playwright');
  await expect(page.getByText(/1 of 1/i)).toBeVisible();

  // Typography + page layout persist across reload.
  await page.getByLabel('Page size').selectOption('A4');
  await expect(page.getByText(/saving…/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/saving…/i)).toBeHidden({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByLabel('Page size')).toHaveValue('A4');
});
