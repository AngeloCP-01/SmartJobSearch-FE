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

  // Wait for the "Saved" indicator
  await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10_000 });

  // Reload the page and verify content persists
  await page.reload();
  await expect(page.getByText('Hello from Playwright')).toBeVisible();
});
