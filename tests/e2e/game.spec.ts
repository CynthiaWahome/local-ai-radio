import { test, expect } from '@playwright/test';

test('title screen loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('THE LAST BROADCAST');
});

test('tune in navigates to sound check', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("Tune in")');
  await expect(page.locator('h2')).toContainText('Sound check');
});

test('start begins game', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("Tune in")');
  await page.click('button:has-text("Start")');
  await expect(page.locator('text=Channel 00')).toBeVisible();
});

test('present question shows timer', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("Tune in")');
  await page.click('button:has-text("Start")');
  await page.click('button:has-text("Present question")');
  await expect(page.locator('text=Time:')).toBeVisible();
});
