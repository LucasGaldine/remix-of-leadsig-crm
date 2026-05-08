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
    await expect(page.getByRole('button', { name: 'Continue to Sign Up' })).toBeVisible();

    await page.getByRole('button', { name: 'Continue to Sign Up' }).click();

    await expect(page.getByText('Step 1 of 3')).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveValue('eligible@example.com');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  });

  test('blocks ineligible ELO user at the gate', async ({ page }) => {
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

    await expect(page.getByText('Elo membership status: No')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Not Eligible' })).toBeVisible();
    await expect(
      page.getByText('No Elo membership found for this email, so LeadSig Growth signup is not available.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Not Eligible' }).click();
    await expect(page.getByText('Step 1 of 3')).not.toBeVisible();
  });
});
