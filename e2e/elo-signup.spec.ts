import { expect, test } from '@playwright/test';

test.describe('ELO signup flow', () => {
  test('allows eligible ELO user to continue into multi-step signup', async ({ page }) => {
    await page.route('**/functions/v1/elo-membership-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'premium' }),
      });
    });

    await page.goto('/signup/elo');

    await expect(
      page.getByLabel('What email did you use for your ELO membership?'),
    ).toBeVisible();

    await page.getByLabel('What email did you use for your ELO membership?').fill('eligible@example.com');
    await page.getByRole('button', { name: 'Check eligibility first' }).click();

    await expect(page.getByText('Elo membership status: Yes')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('Step 1 of 3')).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveValue('eligible@example.com');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  });

  test('allows free ELO users to continue with a free trial path', async ({ page }) => {
    await page.route('**/functions/v1/elo-membership-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'free' }),
      });
    });

    await page.goto('/signup/elo');

    await page.getByLabel('What email did you use for your ELO membership?').fill('free@example.com');
    await page.getByRole('button', { name: 'Check eligibility first' }).click();

    await expect(page.getByText('You have access to a 14 day free trial!')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Step 1 of 3')).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveValue('free@example.com');
  });
});
