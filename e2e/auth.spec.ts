import { test, expect } from '@playwright/test';

test.describe('TechScreen Pro — E2E Authentication & Workspace Flow', () => {
  test('1. renders login page with authentication controls and zero console errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto('/');

    // Verify brand title and login elements
    await expect(page.getByRole('heading', { name: 'TECHSCREEN PRO' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In to Workspace/i })).toBeVisible();

    // Verify demo credential helper cards
    await expect(page.locator('text=recruiter@acme.com')).toBeVisible();
    await expect(page.locator('text=admin@techscreen.com')).toBeVisible();

    // No uncaught JavaScript errors or render crashes
    expect(pageErrors).toEqual([]);
  });

  test('2. rejects invalid credentials with clear user error', async ({ page }) => {
    await page.goto('/');

    await page.locator('input[type="email"]').fill('recruiter@acme.com');
    await page.locator('input[type="password"]').fill('WrongPassword@999');
    await page.getByRole('button', { name: /Sign In to Workspace/i }).click();

    // Error message appears
    await expect(page.locator('text=Invalid email or password')).toBeVisible({ timeout: 5000 });
  });

  test('3. logs in recruiter, transitions to workspace, and renders sidebar and dashboard without crashing', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto('/');

    // Log in with recruiter credentials
    await page.locator('input[type="email"]').fill('recruiter@acme.com');
    await page.locator('input[type="password"]').fill('Recruiter@123456');
    await page.getByRole('button', { name: /Sign In to Workspace/i }).click();

    // Verify successful login into recruiter workspace
    await expect(page.locator('text=Sarah Jenkins')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('aside').getByText('RECRUITER', { exact: true })).toBeVisible();
    await expect(page.locator('aside').getByText('TECHSCREEN')).toBeVisible();

    // Verify sidebar navigation items
    await expect(page.getByRole('button', { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Candidates/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Jobs/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Assessments/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Analytics/i })).toBeVisible();

    // Verify main content area rendered
    await expect(page.locator('text=Total Applicants')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Invite Candidate')).toBeVisible();

    // Assert zero render crashes
    expect(pageErrors).toEqual([]);
  });

  test('4. successfully signs out and returns to login gate', async ({ page }) => {
    await page.goto('/');

    // Quick login
    await page.locator('input[type="email"]').fill('recruiter@acme.com');
    await page.locator('input[type="password"]').fill('Recruiter@123456');
    await page.getByRole('button', { name: /Sign In to Workspace/i }).click();

    await expect(page.locator('text=Sarah Jenkins')).toBeVisible({ timeout: 10000 });

    // Click Sign Out button in sidebar
    const logoutBtn = page.locator('button[title="Sign Out"]');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Returned to login gate
    await expect(page.getByRole('button', { name: /Sign In to Workspace/i })).toBeVisible({ timeout: 5000 });
  });
});
