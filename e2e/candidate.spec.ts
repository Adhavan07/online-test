import { test, expect } from '@playwright/test';

test.describe('TechScreen Pro — Candidate Assessment Portal', () => {
  test('1. renders candidate portal for valid assessment token', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // Navigate to valid candidate token route
    await page.goto('/assessment/cand-45oejqhul-mtsfqyqq');

    // Candidate simulator bar and assessment container render
    await expect(page.locator('text=Candidate Simulator')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Return to Recruiter Workspace')).toBeVisible();

    // No fatal render crashes
    expect(pageErrors).toEqual([]);
  });

  test('2. can toggle between simulated candidates and return to recruiter workspace', async ({ page }) => {
    await page.goto('/assessment/cand-45oejqhul-mtsfqyqq');

    await expect(page.locator('text=Candidate Simulator')).toBeVisible({ timeout: 10000 });

    // Click Return to Recruiter Workspace
    await page.getByRole('button', { name: /Return to Recruiter Workspace/i }).click();

    // Successfully returned to recruiter workspace gate
    await expect(page.getByRole('heading', { name: 'TECHSCREEN PRO' })).toBeVisible({ timeout: 5000 });
  });
});
