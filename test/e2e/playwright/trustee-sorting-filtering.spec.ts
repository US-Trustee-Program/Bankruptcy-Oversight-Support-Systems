import { expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';
import {
  gotoTrusteesList,
  openTrusteeFilters,
  clearDivisionAndChapterFilters,
  filterByChapter,
  filterByDivision,
} from './trustees-filter-helpers';
import {
  SORT_TRUSTEE_ID,
  COMP_NEEDLE_TRUSTEE_ID,
  SPLIT_TRUSTEE_ID,
} from '../scripts/lib/trustee-fixture-data';

const timeoutOption = { timeout: 60000 };

const NON_CONTINUATION_ROWS = '.trustees-list-row:not(.trustees-list-row--continuation)';

test.describe('Trustees list sorting, filtering, and pagination', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test('should sort a trustee appointments by state, region, chapter, then appointment type', async ({
    page,
  }) => {
    await gotoTrusteesList(page);
    await openTrusteeFilters(page);
    await clearDivisionAndChapterFilters(page);

    const trusteeLink = page.getByTestId(`trustee-link-${SORT_TRUSTEE_ID}`);
    await expect(trusteeLink).toBeVisible(timeoutOption);

    const group = trusteeLink.locator(
      'xpath=ancestor::div[contains(concat(" ", @class, " "), " trustee-group ")]',
    );
    const rows = group.locator('[role="row"]');
    await expect(rows).toHaveCount(6);

    const expectedOrder = [
      { district: 'Eastern District of California', chapter: '7', type: 'Off Panel' },
      { district: 'Eastern District of California', chapter: '7', type: 'Panel' },
      { district: 'Northern District of California', chapter: '11', type: 'Case by Case' },
      { district: 'District of Idaho', chapter: '12', type: 'Standing' },
      { district: 'Northern District of Iowa', chapter: '13', type: 'Case by Case' },
      { district: 'Southern District of Iowa', chapter: '13', type: 'Standing' },
    ];

    for (let i = 0; i < expectedOrder.length; i += 1) {
      const row = rows.nth(i);
      await expect(row.locator('[data-cell="District"]')).toHaveText(expectedOrder[i].district);
      await expect(row.locator('[data-cell="Chapter"]')).toHaveText(expectedOrder[i].chapter);
      await expect(row.locator('[data-cell="Type"]')).toHaveText(expectedOrder[i].type);
    }
  });

  test('should paginate the trustees list once results exceed one page', async ({ page }) => {
    await gotoTrusteesList(page);
    await openTrusteeFilters(page);
    await clearDivisionAndChapterFilters(page);

    const rows = page.locator(NON_CONTINUATION_ROWS);
    await expect(rows).toHaveCount(25);

    await page.getByTestId('pagination-button-next-results').click();
    await expect(rows).toHaveCount(5);

    await page.getByTestId('pagination-button-previous-results').click();
    await expect(rows).toHaveCount(25);
  });

  test('should filter the trustees list by chapter and district together', async ({ page }) => {
    await gotoTrusteesList(page);
    await openTrusteeFilters(page);
    await clearDivisionAndChapterFilters(page);

    await filterByChapter(page, '12');
    await filterByDivision(page, 'Western District of New York (Buffalo)');

    await expect(page.locator(NON_CONTINUATION_ROWS)).toHaveCount(1);
    await expect(page.getByTestId(`trustee-link-${COMP_NEEDLE_TRUSTEE_ID}`)).toBeVisible(
      timeoutOption,
    );
  });

  test('should exclude a trustee whose chapter and district matches are on different appointments (CAMS-846)', async ({
    page,
  }) => {
    await gotoTrusteesList(page);
    await openTrusteeFilters(page);
    await clearDivisionAndChapterFilters(page);

    await filterByChapter(page, '7');
    await filterByDivision(page, 'Southern District of New York (Manhattan)');

    // Sanity check: the filter combo genuinely matches other Chapter 7/Manhattan trustees,
    // proving the assertion below isn't just "everything is hidden".
    await expect(page.locator(NON_CONTINUATION_ROWS).first()).toBeVisible(timeoutOption);

    // "Split Trustee" has a Chapter 7 appointment in Sacramento and a Chapter 13 appointment
    // in Manhattan -- each satisfies one half of this filter, but not the same appointment.
    // Pre-fix, it appeared with blank columns; post-fix it must not appear at all.
    await expect(page.getByTestId(`trustee-link-${SPLIT_TRUSTEE_ID}`)).not.toBeAttached();
  });
});
