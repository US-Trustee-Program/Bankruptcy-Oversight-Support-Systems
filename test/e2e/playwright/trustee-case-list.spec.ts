import { expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';
import {
  CASE_LIST_PAGINATED_TRUSTEE_ID,
  CASE_LIST_EMPTY_TRUSTEE_ID,
} from '../scripts/lib/trustee-fixture-data';

const timeoutOption = { timeout: 60000 };

test.describe('Trustee Case List panel', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test('should paginate a trustee case list once results exceed one page', async ({ page }) => {
    await page.goto(`/trustees/${CASE_LIST_PAGINATED_TRUSTEE_ID}`);
    await expect(page.getByTestId('trustee-detail-screen')).toBeVisible(timeoutOption);

    await page.getByTestId('trustee-case-list-nav-link').click();
    const caseList = page.getByTestId('trustee-case-list');
    await expect(caseList).toBeVisible(timeoutOption);

    const table = page.getByTestId('trustee-case-list-table');
    await expect(table).toBeVisible(timeoutOption);
    const rows = table.locator('.cams-table__row');
    await expect(rows).toHaveCount(25);

    await page.getByTestId('pagination-button-next-results').click();
    await expect(rows).toHaveCount(5);

    await page.getByTestId('pagination-button-previous-results').click();
    await expect(rows).toHaveCount(25);
  });

  test('should show an empty state for a trustee with no case appointments', async ({ page }) => {
    await page.goto(`/trustees/${CASE_LIST_EMPTY_TRUSTEE_ID}`);
    await expect(page.getByTestId('trustee-detail-screen')).toBeVisible(timeoutOption);

    await page.getByTestId('trustee-case-list-nav-link').click();
    const caseList = page.getByTestId('trustee-case-list');
    await expect(caseList).toBeVisible(timeoutOption);

    await expect(caseList.getByTestId('alert-container')).toBeVisible(timeoutOption);
    await expect(page.getByTestId('trustee-case-list-table')).not.toBeAttached();
  });
});
