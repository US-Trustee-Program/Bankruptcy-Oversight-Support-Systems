import { BrowserContext, expect, Page } from '@playwright/test';
import { getUrl } from './test-constants';

/**
 * Opens the first trustee profile from the trustees list in a new tab.
 * Returns the newly opened trustee profile page.
 */
export async function openFirstTrusteeProfileInNewTab(
  page: Page,
  context: BrowserContext,
): Promise<Page> {
  await page.goto(getUrl('/trustees'));
  await page.waitForSelector('[data-testid="trustees-table"]', { state: 'visible' });

  const trusteeProfileLink = page.locator('[data-testid^="trustee-link-"]').first();
  await expect(trusteeProfileLink).toBeVisible();

  const [newPage] = await Promise.all([context.waitForEvent('page'), trusteeProfileLink.click()]);
  await newPage.waitForLoadState();
  await expect(newPage.locator('.case-detail-header')).toBeVisible();

  return newPage;
}
