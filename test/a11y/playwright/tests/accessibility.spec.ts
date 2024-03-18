import { AxeBuilder } from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

test.describe('Experiment with a11y tests', () => {
  test('First a11y test', async ({ page }) => {
    await page.goto('');

    const results = await new AxeBuilder({ page }).withTags('best-practice').analyze();
    expect(results.violations).toEqual([]);
  });

  test('Navigate to different page and use multiple tags', async ({ page }) => {
    await page.goto('/data-verification');
    // wait for list of orders to render
    await expect(page.getByText('Loading court orders...')).not.toBeVisible();

    expect(page.getByRole('heading', { name: 'Data Verification' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags('wcag22aa')
      // .withTags("best-practice")
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
