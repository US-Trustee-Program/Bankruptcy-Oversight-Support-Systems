# Office & Division Setup prototype: notes for developers

Ticket: [#3201](https://github.com/US-Trustee-Program/Bankruptcy-Oversight-Support-Systems/issues/3201) (CAMS-962). Branch: `CAMS-962-office-division-setup`.

The Office & Division Setup page is a front-end prototype. It runs on sample data in the browser and saves nothing. The items below are things found while building it that reach beyond this page.

---

## 1. Pagination shows a page number twice when there are exactly 5 pages

**Component:** `user-interface/src/lib/components/uswds/Pagination.tsx` (shared; used by Case Search results, the Trustees list, trustee case lists, bank and software trustee lists, and this page).

**What happens:** any table with exactly 5 pages shows a duplicate page button.
- On pages 1–4 the buttons read `1 2 3 4 5 5`.
- On page 5 they read `1 1 2 3 4 5`.

Tables with 1–4 or 6+ pages are not affected.

**Cause:** with 5 pages, two branches of the render both draw the same page:
- The "first pages" branch draws page 5 (`lastPage > 4`), and the "always draw the last page" line draws page 5 again.
- The "last pages" branch draws `lastPage - 4`, which is page 1, and the "always draw page 1" line already drew it.

**Fix (made on this branch):** both conditions now require more than 5 pages (`lastPage > 5`). New tests in `Pagination.test.tsx` check every page of tables with 1 to 8 pages and assert that each page number appears once, plus page 1, the last page and the current page. All 52 Pagination tests and the tests for every screen that uses Pagination pass.

**Ask:** please review the fix as a change to the shared component. It applies everywhere Pagination is used, not just this page.

---

## 2. Typing into a multi-select dropdown that already has selections

**Component:** `user-interface/src/lib/components/combobox/ComboBox.tsx` (shared).

**What happens:** when a multi-select ComboBox has selections, its input shows a summary like "2 chapters". If the user clicks into the field and then types, the typed text is added to the summary ("2 chapters13"), so nothing matches. Typing without clicking first works, because the first keystroke starts a fresh search.

**Where you can see it today:** the Chapter filter on the Trustees list.

**On this branch:** not fixed in the shared component. The Edit Divisions modal works around it by using the ComboBox as a single-select "add one" picker that clears after each pick, with the chosen divisions shown as pills below.

---

## 3. Shared changes made on this branch

- **Pagination** fix, above.
- **Admin side nav on phones:** at 640px and below, the Admin side nav now stacks above the content instead of beside it, matching the trustee detail screen. This is in `admin/AdminScreen.scss` (all Admin pages) and `admin/banks/BankDetail.scss` (bank detail pages).
- **New `TabNav` component** at `user-interface/src/lib/components/cams/TabNav/`. It is a row of tabs built on React Router `NavLink` (each tab is its own URL). The selected tab is base-darkest with a 4px bar under the label; hover shows a primary-blue bar. It is meant to be reused by the Permissions page (CAMS Users / Change History). It is not yet in the team's UI component catalog, which lives in the `ustp-cams-fdp` plugin.

---

## 4. Office mapping data to clean up

The prototype loads the current office mapping (`USTP_OFFICE_NAME_MAP` in `backend/lib/adapters/gateways/dxtr/dxtr.constants.ts`) joined to the court division test data (`COURT_DIVISIONS` in `common/src/cams/test-utilities/courts.mock.ts`).

- **Placeholder offices** that appear as real offices: `X`, `XXX` and `IV` (Region 3) and `Test Division` (Region 8). The divisions they oversee have the same placeholder names. Other placeholder entries in the mapping: `Automation`, `Office 0 - AO-DC`, `Office 3 - Baker`, `Office 5 - Elgin`.
- **A division named "(do not select) Parkersburg"** (Southern District of West Virginia, overseen by Charleston).
- **27 mapping entries point to division codes that are not in the court division test data**, so they don't appear on the page. Examples: Fort Lauderdale, West Palm Beach, "Gulfport-6 Divisional Office", "Hammond Division". Production DXTR may differ from the test data.

---

## 5. Local test run note

On this machine, a full `npx vitest run` in `user-interface` shows failures in unrelated files such as `TrusteePublicContactForm.test.tsx` and `CaseNoteFormModal.test.tsx`. The same failures happen with this branch's changes removed, so they are not caused by this work.
