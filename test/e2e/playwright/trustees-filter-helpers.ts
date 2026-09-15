import { Page, expect } from '@playwright/test';

/** Navigates to the Trustees list and waits for the table to render. */
export async function gotoTrusteesList(page: Page) {
  await page.goto('/trustees');
  await expect(page.getByTestId('trustees-table')).toBeVisible({ timeout: 60000 });
}

/**
 * Expands the "Filters" accordion and waits for the District (Division) combobox to
 * render. That combobox stays unmounted until Api2.getCourts() resolves and default
 * divisions are computed, so this is a reliable "filters are ready" signal -- unlike
 * waiting for a `/courts` network response, which never fires when the request is
 * served from the app's own localStorage-backed cache (e.g. after an earlier
 * navigation in the same test already triggered it).
 *
 * Uses the element `id` (not `data-testid`) for every ComboBox expand/toggle button in
 * this file: the shared uswds Button component ignores a caller-supplied `data-testid`
 * and always renders its own `button-${id}` instead, so `getByTestId(`${id}-expand`)`
 * never matches anything for these buttons.
 */
export async function openTrusteeFilters(page: Page) {
  await page.getByTestId('accordion-button-district-filter').click();
  await expect(page.locator('#new-district-division-expand')).toBeVisible({ timeout: 60000 });
}

/**
 * Removes every removable filter pill (i.e. every selected District/Division and Chapter).
 * The District (Division) filter defaults to the logged-in user's own office divisions, and
 * any trustee appointment outside that scope -- or a trustee with no appointments at all -- is
 * otherwise hidden. Clearing all pills disables district filtering entirely.
 */
export async function clearDivisionAndChapterFilters(page: Page) {
  const removablePills = page.locator('#filter-pills button:not(.not-removable)');

  while (true) {
    const count = await removablePills.count();
    if (count === 0) break;
    await removablePills.first().click();
  }
}

/** Switches the Status filter from the default "Active" to "All". */
export async function setStatusFilterToAll(page: Page) {
  await page.locator('#status-combobox-expand').click();
  await page.getByTestId('status-combobox-option-item-0').click();
}

const CHAPTER_OPTION_INDEX: Record<string, number> = {
  '7': 0,
  '11': 1,
  '11-subchapter-v': 2,
  '12': 3,
  '13': 4,
};

/** Selects a single chapter in the Chapter filter (chapter-combobox). */
export async function filterByChapter(page: Page, chapter: keyof typeof CHAPTER_OPTION_INDEX) {
  await page.locator('#chapter-combobox-expand').click();
  await page.getByTestId(`chapter-combobox-option-item-${CHAPTER_OPTION_INDEX[chapter]}`).click();
}

/**
 * Selects a single division in the District (Division) filter by typing enough of its
 * "<court name> (<division name>)" label to narrow the national option list to one match.
 */
export async function filterByDivision(page: Page, labelFilterText: string) {
  await page.locator('#new-district-division-expand').click();
  await page.locator('#new-district-division-combo-box-input').fill(labelFilterText);
  await page
    .locator('#new-district-division [data-testid^="new-district-division-option-item-"]')
    .first()
    .click();
}
