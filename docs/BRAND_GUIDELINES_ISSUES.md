# Brand Guidelines & UI Issues to Address

This document tracks issues discovered during brand guidelines documentation that need team
attention.

## Issues

### 1. Court Docket Search Highlighting Not Working

**Status**: Needs Investigation **Priority**: Medium **Description**: The search highlighting
feature in the Court Docket panel is not displaying highlights when searching for text, even in
Chrome (which should support the CSS Custom Highlight API).

**Technical Details**:

- Feature uses CSS Custom Highlight API (`CSS.highlights`)
- Color defined: `#e6c74c` (yellow-20)
- Code location: `user-interface/src/case-detail/panels/CaseDetailCourtDocket.tsx`
- Requires minimum 3 characters to trigger
- Implementation exists but may not be functioning correctly

**Next Steps**:

- Verify browser support in latest Chrome
- Test if `CSS.highlights` API is available
- Debug `handleHighlight()` function in `lib/utils/highlight-api.ts`
- Consider alternative highlighting approach if API is unreliable

---

### 2. Dead Code — Unused Color Variables and Boilerplate Styles

**Status**: Cleanup Needed **Priority**: Low **Description**: Several color definitions and style
rules exist in the codebase that are never applied to the live UI.

**Dead Code Locations**:

- `user-interface/src/App.scss` — `.App-header` uses `colors.$eagle` (`#2e2e2a`) but this is Create
  React App boilerplate, not the CAMS header. The whole `.App-header` block can likely be removed.
- `user-interface/src/styles/abstracts/_tables.scss` — Defines the following variables, none of
  which are used anywhere (except `$tableBorder` which is used in `App.scss`):
  - `$tableHeaderBackground: colors.$eagle` — unused
  - `$tableHeaderBorderColor: colors.$gold` — unused
  - `$tableHeaderForeground: white` — unused
  - `$tableCellPadding: 10px` — unused
  - `$tableBorderRadius: 5px` — unused
  - `$tableBorderCollapse: collapse` — unused
  - `$tableBodyBackgroundOddRows: #f6f6f6` — unused
  - `$tableBodyBackgroundEvenRows: white` — unused
  - Decision needed: either wire these up consistently across all tables, or remove them
- `user-interface/src/styles/abstracts/_colors.scss` — Two variables defined but never used:
  - `$warning-text` (`#990000`)
  - `$warning-light` (`#ffffca`)
  - Note: `$secondary-darker` (`#8b0a03`) is also currently unused here, but should be wired up
    rather than removed — see issue #9

**Next Steps**:

- Remove `.App-header` block from `App.scss` if it is confirmed to be CRA boilerplate
- Remove `_tables.scss` variables or wire them up if they were intended to be used
- Remove unused color variables from `_colors.scss`

---

### 3. Inconsistent ComboBox Placeholder Text Color in Trustee Search Modal

**Status**: Cleanup Needed **Priority**: Low **Description**: The Trustee Search Modal applies a
one-off gray (`#757575`) to the ComboBox selection label when nothing is selected, making it look
like placeholder text. No other ComboBox in the application does this — they all inherit the default
body text color (`#1b1b1b`).

**Technical Details**:

- Code location: `user-interface/src/data-verification/trustee-verification/TrusteeSearchModal.scss`
- Selector: `[id^='trustee-search-combobox-']:not(:has(.clear-all-button)) .selection-label`
- The base `ComboBox.scss` has no color set on `.selection-label`, so all other instances use
  `#1b1b1b`

**Next Steps**:

- Decide if gray placeholder treatment is desirable for empty ComboBox fields across the app
- If yes, move the style into `ComboBox.scss` so it applies consistently everywhere
- If no, remove the override from `TrusteeSearchModal.scss`

---

### 4. Dead CSS — `.software-list` Class Never Applied

**Status**: Cleanup Needed **Priority**: Low **Description**: The `.software-list` CSS class is
defined in `BankruptcySoftware.scss` with card-style list item styling, but the class is never
referenced in any component template. The software list on the Bankruptcy Software admin page
renders as plain white rows instead.

**Technical Details**:

- Code location: `user-interface/src/admin/bankruptcy-software/BankruptcySoftware.scss` (line 134)
- Unused styles include: `background-color: #f9f9f9`, `border: 1px solid #ddd`, `border-radius: 4px`
- Also includes `color: #333` on `span` elements inside the list items (another hardcoded color that
  would only apply if the class were used)

**Next Steps**:

- Remove the `.software-list` block from `BankruptcySoftware.scss`, or
- Apply the class in the component if the card-style treatment was intentional

---

### 5. Dead CSS — `.trustee-data-row.selected` Class Never Applied

**Status**: Cleanup Needed **Priority**: Low **Description**: The `.trustee-data-row.selected` CSS
rule is defined in `TrusteeMatchVerificationAccordion.scss` with a `#f0f0f0` background, but the
`selected` class is never applied to any `.trustee-data-row` element in the component.

**Technical Details**:

- Code location:
  `user-interface/src/data-verification/trustee-verification/TrusteeMatchVerificationAccordion.scss`
  (line 139)

**Next Steps**:

- Determine if row selection was a planned feature that was never implemented
- If not needed, remove the `.trustee-data-row.selected` rule from the SCSS

---

### 6. Sticky Case Detail Header Not Working

**Status**: Needs Investigation **Priority**: Medium **Description**: The case detail page has a
sticky/fixed header that is supposed to lock to the top of the screen when the user scrolls down far
enough that the case title scrolls out of view. This is not currently working.

**Technical Details**:

- Code location: `user-interface/src/case-detail/panels/CaseDetailHeader.tsx`
- Hook: `useFixedPosition` in `user-interface/src/lib/hooks/UseFixedPosition.ts`
- Likely cause: `appEl` and `camsHeader` are queried via `document.querySelector` at component
  render time (lines 49-50), before the DOM may be fully ready. If either is `null`, the scroll
  event listener is never attached (line 146 guards on both values being truthy)
- The scroll listener is attached to `.App` div (not the browser window), which has
  `overflow-y: auto`

**Design Decision Needed**:

- Before fixing, **confirm with users whether a sticky header is actually desired**
- If users don't find value in it, consider removing the feature entirely rather than investing time
  in a fix
- If keeping it, move `appEl` and `camsHeader` queries inside the `useEffect` to ensure the DOM is
  ready when the listener is attached

---

### 7. RichTextEditor Link Color Nearly Identical to $primary But Hardcoded Differently

**Status**: Cleanup Needed **Priority**: Low **Description**: The RichTextEditor hardcodes `#005ea6`
for link color, which is almost identical to `$primary` (`#005ea2`) but slightly different. This is
almost certainly unintentional and should use the `$primary` variable instead.

**Technical Details**:

- Code location: `user-interface/src/lib/components/cams/RichTextEditor/RichTextEditor.scss`
- Hardcoded: `#005ea6`
- Should be: `colors.$primary` (`#005ea2`)

**Next Steps**:

- Replace `#005ea6` with `colors.$primary` in RichTextEditor.scss

---

### 8. ToggleButton Colors Not in Color Variables

**Status**: Cleanup Needed **Priority**: Low **Description**: The ToggleButton component hardcodes
its active and inactive state colors without referencing `_colors.scss`. These should be added as
named variables so they can be referenced consistently.

**Technical Details**:

- Code location: `user-interface/src/lib/components/cams/ToggleButton/ToggleButton.scss`
- Active state: `#0050d8` (hardcoded)
- Inactive state: `#5c5c5c` (hardcoded)

**Next Steps**:

- Add `$toggle-active` and `$toggle-inactive` (or similar) to `_colors.scss`
- Update `ToggleButton.scss` to reference the new variables

---

### 9. Error Hover Color Inconsistency — Hardcoded Value Differs from Defined Variable

**Status**: Decision Made — Cleanup Needed **Priority**: Low **Description**: The error/delete
button hover state uses `#8b0a0a` hardcoded in `Permissions.scss`, while `$secondary-darker`
(`#8b0a03`) exists in `_colors.scss` seemingly for this exact purpose. The two values are slightly
different. Confirmed: `$secondary-darker` (`#8b0a03`) matches USWDS's `red-70v` token exactly — it
is the spec-correct value and should be used in place of the hardcoded `#8b0a0a`.

**Technical Details**:

- Hardcoded in: `user-interface/src/admin/permissions/Permissions.scss`
- Hardcoded value: `#8b0a0a`
- Correct value: `$secondary-darker` (`#8b0a03`) in `_colors.scss` — verified to equal USWDS
  `red-70v`

**Next Steps**:

- Replace the hardcoded `#8b0a0a` in `Permissions.scss` with `colors.$secondary-darker`
- Update `BRAND_GUIDELINES.md` once the code change lands to remove references to `#8b0a0a` as the
  actual hover color

---

### 10. ComboBox Has Its Own Private Hardcoded Color Palette

**Status**: Cleanup Needed **Priority**: Medium **Description**: The ComboBox component defines all
of its colors as local hardcoded variables at the top of its SCSS file with no connection to the
global `_colors.scss` or USWDS tokens. This makes the component visually inconsistent with the rest
of the app and impossible to retheme centrally.

**Technical Details**:

- Code location: `user-interface/src/lib/components/combobox/ComboBox.scss`
- Hardcoded values: `#c6cace` (separator), `#565c65` (section separator), `#949494` (selected
  border), `#d0d0d0` (selected background), `#b0b0b0` (hover background)

**Next Steps**:

- Map each color to the nearest USWDS token or existing `_colors.scss` variable
- Add any new variables to `_colors.scss` that don't already exist

---

### 11. RichTextEditor Has Its Own Private Hardcoded Color Palette

**Status**: Cleanup Needed **Priority**: Medium **Description**: Similar to the ComboBox, the
RichTextEditor hardcodes all of its colors with no connection to the global color system.

**Technical Details**:

- Code location: `user-interface/src/lib/components/cams/RichTextEditor/RichTextEditor.scss`
- Hardcoded values: `#e9ecef` (toolbar background), `#71767a` (active button), `#f0f0f0` (hover),
  `#565c65` (muted controls), `#005ea6` (links — see issue #7)

**Next Steps**:

- Map each color to the nearest USWDS token or existing `_colors.scss` variable
- Address link color separately per issue #7

---

### 12. Gray Proliferation — No Standardized Gray Scale

**Status**: Cleanup Needed **Priority**: Medium **Description**: There are 9+ gray shades hardcoded
across components with no system or naming convention. This makes it difficult to maintain visual
consistency and means small variations creep in over time.

**Hardcoded grays found across the codebase**: `#5c5c5c`, `#565c65`, `#71767a`, `#949494`,
`#b0b0b0`, `#c6c6c6`, `#c6cace`, `#d0d0d0`, `#e0e0e0`, `#e9ecef`, `#f0f0f0`

**Next Steps**:

- Define a standardized gray scale in `_colors.scss` (e.g., `$gray-dark`, `$gray-medium`,
  `$gray-light`, etc.) or map to USWDS gray tokens
- Audit components and replace hardcoded values with variables
- Consider using USWDS gray tokens directly where applicable
- Specific consolidation candidate: `#c6c6c6` (mobile responsive table row borders) and `#c6cace`
  (ComboBox separator) are visually near-identical — consider merging to a single gray rather than
  keeping both

---

### 13. Heading Styles Inconsistent in theme.scss

**Status**: Cleanup Needed **Priority**: Low **Description**: The heading styles in `theme.scss` are
inconsistent across H1-H6 in three ways:

1. **H1 and H2 have no explicit `font-weight`** — H3 through H6 all explicitly set
   `font-weight: 700`, but H1 and H2 rely on browser defaults. This works in practice but is fragile
   — a CSS reset or USWDS update could change it.

2. **Only H3 has `line-height` defined** — `line-height: 1.5` is set on H3 only. All other headings
   inherit their line-height, which may vary by browser or USWDS base styles.

3. **H4 uses `margin-block-start/end` instead of `margin`** — All other headings use `margin: 0` or
   `margin` shorthand, but H4 uses the logical property
   `margin-block-start: 0; margin-block-end: 0`. Should be standardized.

**Technical Details**:

- Code location: `user-interface/src/styles/theme.scss`

**Next Steps**:

- Add explicit `font-weight: 700` to H1 and H2
- Decide on a standard `line-height` for all headings and apply consistently
- Replace H4 `margin-block-start/end` with `margin: 0` to match other headings

---

### 14. Inconsistent Icon Button Pattern — IconButton Component Underused

**Status**: Cleanup Needed **Priority**: Low **Description**: A dedicated `IconButton` component
exists as the canonical pattern for unstyled buttons with icons, but the vast majority of the
codebase bypasses it and manually composes `UswdsButtonStyle.Unstyled` + `Icon` directly. This leads
to inconsistency and means any future changes to the icon button pattern would need to be applied in
many places.

**Technical Details**:

- Canonical component: `user-interface/src/lib/components/IconButton.tsx`
- Currently only used directly by: `lib/components/cams/CopyButton.tsx`
- Files that manually compose unstyled button + icon instead (partial list):
  - `data-verification/consolidation/ConsolidationOrderAccordionView.tsx`
  - `data-verification/transfer/PendingTransferOrder.tsx`
  - `trustees/forms/*.tsx` (multiple files)
  - `trustees/panels/*.tsx` (multiple files)
  - `admin/permissions/Permissions.tsx`
  - `lib/components/combobox/ComboBox.tsx`
  - `lib/components/uswds/Input.tsx`
  - `lib/components/uswds/modal/Modal.tsx`
  - `lib/components/cams/NoteItem/NoteItem.tsx`
  - And many more

**Next Steps**:

- Refactor existing manual unstyled button + icon compositions to use `IconButton`
- Enforce `IconButton` as the standard in code reviews going forward

---

### 15. TextArea Component Unused — Raw HTML Used Instead

**Status**: Cleanup Needed **Priority**: Low **Description**: A `TextArea` USWDS wrapper component
exists but is never imported anywhere. The codebase uses a raw `<textarea>` HTML element directly
instead, bypassing the component and any styling/accessibility enhancements it provides.

**Technical Details**:

- Unused component: `user-interface/src/lib/components/uswds/TextArea.tsx`
- Files using raw `<textarea>` instead:
  - `data-verification/transfer/TransferConfirmationModal.tsx`
  - `data-verification/consolidation/ConsolidationOrderModal.tsx`

**Next Steps**:

- Replace raw `<textarea>` usages with the `TextArea` component, or
- If the component adds no value over a raw `<textarea>` with USWDS classes, remove it

---

### 16. Accent Cool and Accent Warm Button Styles Defined But Never Used

**Status**: Cleanup Needed **Priority**: Low **Description**: `UswdsButtonStyle.Cool`
(`usa-button--accent-cool`) and `UswdsButtonStyle.Warm` (`usa-button--accent-warm`) are defined as
enum values in the Button component but are never used anywhere in the application.
`UswdsButtonStyle.Base` is also unused.

**Technical Details**:

- Code location: `user-interface/src/lib/components/uswds/Button.tsx`
- Unused enum values: `Cool`, `Warm`, `Base`
- Note: Accent warm/cool colors ARE used in the `Tag` component (`bg-accent-cool`,
  `bg-accent-warm-dark`) — this is a separate thing from the button styles

**Next Steps**:

- Remove unused enum values from `UswdsButtonStyle` if there are no plans to use them, or
- Document when they should be used if they are intentionally reserved for future use

---

### 17. Dead CSS — `small-table` Mixin Defined But Never Included

**Status**: Cleanup Needed **Priority**: Low **Description**: The `small-table` mixin is defined in
`Table.scss` with responsive table styles (collapsing rows to vertical cards, cell borders, bold
label pseudo-elements), but it is never included or called anywhere in the application. None of its
styles are applied.

**Technical Details**:

- Code location: `user-interface/src/lib/components/uswds/Table.scss`
- Mixin includes: `1px solid #ddd` cell borders, `3px solid black` row borders, `::before`
  pseudo-element labels via `data-cell` attribute

**Next Steps**:

- If responsive table behavior is desired, include the mixin in the appropriate component SCSS files
- If not needed, remove the mixin from `Table.scss`

---

### 18. Modal Cancel Button Default Label Should Be "Cancel" Not "Go Back"

**Status**: Change Needed **Priority**: Low **Description**: The `SubmitCancelButtonGroup` component
defaults the cancel button label to "Go back" when no label is provided. Per brand guidelines, the
preferred term for canceling an operation is "Cancel".

**Technical Details**:

- Code location: `user-interface/src/lib/components/uswds/modal/SubmitCancelButtonGroup.tsx`
  (line 74)
- Current default: `'Go back'`
- Should be: `'Cancel'`

**Next Steps**:

- Change the default label from `'Go back'` to `'Cancel'` in `SubmitCancelButtonGroup.tsx`
- Audit existing modals to check if any are relying on the default label and update them accordingly

---

### 19. (Critical) ComboBox Errors Are Invisible to Screen Readers

**Status**: Accessibility Bug **Priority**: High **Description**: When a ComboBox has a validation
error, there is no mechanism to communicate it to screen reader users. No `aria-invalid`, no
`aria-errormessage`, no error ID in `aria-describedby`, no live region. A screen reader user has no
way to know the field is invalid.

**Technical Details**:

- Code location: `user-interface/src/lib/components/combobox/ComboBox.tsx`
- Missing: `aria-invalid` on input, error ID in `aria-describedby`, `aria-live` on error element

**Next Steps**:

- Add `aria-invalid="true"` when `errorMessage` is present
- Add error element ID to `aria-describedby`
- Add `aria-live="polite"` to the error div
- Follow the DatePicker pattern as reference

---

### 20. (Critical) ComboBox Hint Text Not Announced to Screen Readers

**Status**: Accessibility Bug **Priority**: High **Description**: The `ariaDescription` hint element
in ComboBox has an ID but it is never referenced in `aria-describedby` on the input. Hint text is
completely inaccessible to screen readers.

**Technical Details**:

- Code location: `user-interface/src/lib/components/combobox/ComboBox.tsx`
- Hint element ID `{comboBoxId}-hint` exists but is not wired to `aria-describedby`

**Next Steps**:

- Add `{comboBoxId}-hint` to the input's `aria-describedby` when `ariaDescription` is present

---

### 21. (Critical) ComboBox Options Missing aria-selected

**Status**: Accessibility Bug **Priority**: High **Description**: `role="option"` items in the
ComboBox list are missing the required `aria-selected` attribute. The codebase uses a
text-in-`aria-label` workaround (appending ", selected" or ", not selected") which is inconsistent
across AT. The eslint-disable comment `jsx-a11y/role-has-required-aria-props` confirms the team is
aware.

**Technical Details**:

- Code location: `user-interface/src/lib/components/combobox/ComboBox.tsx`
- `aria-selected` is required by ARIA spec for `role="option"`

**Next Steps**:

- Add `aria-selected={isSelected}` to each `role="option"` list item
- Remove the ", selected" / ", not selected" text from `aria-label`
- Remove the eslint-disable comment

---

### 22. (Critical) Radio Label Not Associated With Interactive Element

**Status**: Accessibility Bug **Priority**: High **Description**: The `<label htmlFor>` in the Radio
component points to the hidden native `input[type="radio"]` (which has `tabIndex={-1}`), not the
interactive `role="radio"` button that receives focus. The programmatic label association is broken
for screen readers.

**Technical Details**:

- Code location: `user-interface/src/lib/components/uswds/Radio.tsx`
- The button gets its accessible name from its text content (works coincidentally) but has no formal
  label association

**Next Steps**:

- Add `aria-labelledby` or `aria-label` to the button element pointing to the label text
- Add `aria-hidden="true"` to the native input to prevent double-announcement

---

### 23. (Significant) Input and TextArea Error Not in aria-describedby

**Status**: Accessibility Bug **Priority**: Medium **Description**: Input and TextArea use
`aria-errormessage` to point to their error elements, but do not include the error ID in
`aria-describedby`. `aria-errormessage` has inconsistent AT support. When a user tabs back to an
invalid field, the error text is not re-read. The DatePicker pattern (error ID in
`aria-describedby` + `aria-live` on error element) is more robust.

**Technical Details**:

- Code location: `user-interface/src/lib/components/uswds/Input.tsx`,
  `user-interface/src/lib/components/uswds/TextArea.tsx`

**Next Steps**:

- Add error element ID to `aria-describedby` when `errorMessage` is present (in addition to or
  replacing `aria-errormessage`)
- Add `aria-live="polite"` to the error div in TextArea (Input already has a custom live region)

---

### 24. (Significant) TextArea Required Span Is Empty — Bug

**Status**: Bug **Priority**: Medium **Description**: The TextArea component renders
`<span className="required-form-field" />` when `required` is true, but the span has no content. No
asterisk is shown visually and nothing is communicated to screen readers. Compare with ComboBox
which correctly renders `<span className="required-form-field">*</span>`.

**Technical Details**:

- Code location: `user-interface/src/lib/components/uswds/TextArea.tsx` (line 91)

**Next Steps**:

- Change `<span className="required-form-field" />` to
  `<span className="required-form-field">*</span>`
- Consider adding screen-reader-accessible text alongside it

---

### 25. (Significant) Required Fields Not Accessible to Screen Readers Across All Components

**Status**: Accessibility Gap **Priority**: Medium **Description**: CSS `::after` pseudo-content
(used in Input, RadioGroup) is not reliably exposed to screen readers. `aria-required` is not set on
any component. The RadioGroup uses `aria-label` on `<legend>` to communicate "Required" but
`aria-label` on `<legend>` is not spec-supported. No component uses accessible text like
"(required)" in the label.

**Affects**: Input, TextArea, DatePicker, RadioGroup, Checkbox **WCAG**: SC 1.3.1 and 3.3.2

**Next Steps**:

- Add `aria-required="true"` to all form input elements when `required` is true
- Replace or supplement CSS `::after` asterisk with text content accessible to AT
- Consider standardizing on appending a visually-hidden "(required)" span to labels, or including it
  in the label text

---

### 26. (Minor) RadioGroup Uses role="radiogroup" on a Native fieldset

**Status**: Cleanup **Priority**: Low **Description**: `role="radiogroup"` is applied to a
`<fieldset>` element in RadioGroup. `<fieldset>` already has an implicit `role="group"`. Overriding
to `role="radiogroup"` on a native element is unnecessary and can cause inconsistent AT behavior.

**Technical Details**:

- Code location: `user-interface/src/lib/components/uswds/RadioGroup.tsx`

**Next Steps**:

- Remove `role="radiogroup"` from the `<fieldset>` and rely on its native semantics, or
- Replace `<fieldset>` with a `<div role="radiogroup" aria-labelledby="...">` if the native fieldset
  styling is undesirable

---

### 27. (High) Permissions Table Missing data-cell Attributes

**Status**: Accessibility Bug **Priority**: High **Description**: The Permissions admin table is a
5-column table (Name, Offices, Roles, Expiration Date, Actions) with no `data-cell` attributes on
any `CamsTableCell`. In mobile/stacked layout, all column context is lost — screen reader users and
small-screen users cannot determine which column a cell belongs to. This is a WCAG 1.3.1 failure and
is on the active `permission-management-in-cams` branch.

**Technical Details**:

- Code location: `user-interface/src/admin/permissions/Permissions.tsx` (lines 155-184)
- All `CamsTableCell` elements lack `data-cell` attribute

**Next Steps**:

- Add appropriate `data-cell` values to every `CamsTableCell` in this table
- Use `data-cell=""` for the Actions column (no meaningful column label needed)

---

### 28. (Medium) Banks Table and Single-Column Admin Tables Missing data-cell Attributes

**Status**: Accessibility Bug **Priority**: Medium **Description**: Several tables are missing
`data-cell` attributes on data cells. In mobile/stacked layout, column context is lost. Affects
multi-column tables most severely.

**Files missing data-cell**:

- `user-interface/src/admin/banks/Banks.tsx` — 2-column table, no `data-cell`
- `user-interface/src/admin/bankruptcy-software/BankruptcySoftware.tsx` — single-column, no
  `data-cell`
- `user-interface/src/admin/bankruptcy-software/BankruptcySoftwareDetailTrustees.tsx` —
  single-column, no `data-cell`
- `user-interface/src/admin/bankruptcy-software/SoftwareBankTrustees.tsx` — single-column, no
  `data-cell`
- `user-interface/src/admin/banks/BankDetailTrustees.tsx` — single-column, no `data-cell`

**Next Steps**:

- Add `data-cell` attributes to all `CamsTableCell` elements in these tables

---

### 29. (Low) CamsTableHeaderCell Missing aria-sort and role="rowheader" Support

**Status**: Design Gap **Priority**: Low **Description**: Two accessibility patterns are missing
from `CamsTableHeaderCell`:

1. No `aria-sort` attribute support — if sort is ever added to CamsTable, sort direction cannot be
   communicated to screen readers
2. No `role="rowheader"` variant — tables cannot identify row-scoping header cells

**Technical Details**:

- Code location: `user-interface/src/lib/components/cams/CamsTable/CamsTableHeaderCell.tsx`

**Next Steps**:

- Add optional `aria-sort` prop to `CamsTableHeaderCell` for future sort support
- Consider adding a `CamsTableRowHeaderCell` component or a `variant="rowheader"` prop

---

### 30. (Low) Redundant aria-label and caption on CaseDetailTrusteePanel Table

**Status**: Cleanup **Priority**: Low **Description**: `CaseDetailTrusteePanel.tsx` passes both
`aria-label="Past Trustees"` and `caption="Past Trustees"` to the same `CamsTable`. When both are
present, `aria-labelledby` (from the caption) takes precedence and the `aria-label` is ignored. The
redundancy is harmless but should be cleaned up.

**Technical Details**:

- Code location: `user-interface/src/case-detail/panels/CaseDetailTrusteePanel.tsx`

**Next Steps**:

- Remove the `aria-label` prop and keep only `caption`, or remove `caption` and keep only
  `aria-label`

---

### 31. (High) Nested <header> Inside <header> in Banner.tsx

**Status**: Accessibility Bug **Priority**: High **Description**: `Banner.tsx` renders a `<header>`
element inside a `<section>` which is itself inside the `<header role="banner">` in `Header.tsx`.
This creates a nested `<header>` inside `<header>`, which is invalid HTML and will confuse assistive
technology landmark trees. Screen readers may expose two "banner" regions or behave inconsistently.

**Technical Details**:

- `Header.tsx` (line 96): `<header role="banner" className="cams-header">`
- `Banner.tsx` (line 17): `<header className={envHeaderClassName}>` (nested inside the above)

**Next Steps**:

- Change the inner `<header>` in `Banner.tsx` to a `<div>` since it is purely presentational

---

### 32. (High) BlankPage.tsx Renders <header role="banner"> Inside <main>

**Status**: Accessibility Bug **Priority**: High **Description**: `BlankPage.tsx` renders `<Banner>`
and `<header role="banner">` inside `<MainContent>` (which renders `<main>`). A banner landmark must
be top-level — placing it inside `<main>` creates invalid landmark nesting and an incorrect
accessibility tree.

**Technical Details**:

- Code location: `user-interface/src/login/BlankPage.tsx`
- `<MainContent>` wraps both `<Banner>` and `<header role="banner">`, making them children of
  `<main>`

**Next Steps**:

- Move `<Banner>` and the header outside of `<MainContent>` in `BlankPage.tsx`

---

### 33. (Medium) Redundant role Attributes on Semantic HTML Landmarks

**Status**: Cleanup Needed **Priority**: Medium **Description**: Several components add explicit
ARIA roles to semantic HTML elements that already carry those roles implicitly. This is redundant
and adds noise to the accessibility tree.

**Technical Details**:

- `role="banner"` on `<header>` — implicit; redundant in: `Header.tsx`, `BlankPage.tsx`
- `role="navigation"` on `<nav>` — implicit; redundant in: `Header.tsx`, `CaseDetailNavigation.tsx`,
  `TrusteeDetailNavigation.tsx`, `AdminScreenNavigation.tsx`
- `role="main"` on `<main>` — implicit; redundant in: `MainContent.tsx`

**Next Steps**:

- Remove the redundant `role` attributes from all of the above

---

### 34. (Medium) Skip Link Anchor Has Empty id="" Attribute

**Status**: Bug **Priority**: Medium **Description**: `SkipToMainContentLink.tsx` sets
`id={props.id ?? ''}` — when no `id` prop is passed (the default case), the rendered anchor has
`id=""`. Empty string IDs are invalid HTML (IDs must be non-empty if present).

**Technical Details**:

- Code location:
  `user-interface/src/lib/components/cams/SkipToMainContentLink/SkipToMainContentLink.tsx` (line 9)
- `Banner.tsx` does not pass an `id` prop, so every page has `<a id="" href="#main">`

**Next Steps**:

- Change default from `id=""` to omitting the attribute entirely: `id={props.id || undefined}`

---

### 35. (Low) Unlabeled <section> Elements Should Be <div>

**Status**: Cleanup Needed **Priority**: Low **Description**: Several `<section>` elements are used
for purely structural grouping without an `aria-label` or `aria-labelledby`. An unlabeled
`<section>` does not expose a landmark role and is semantically equivalent to a `<div>`. Using
`<section>` without a label implies semantic intent that isn't there and creates maintenance
confusion.

**Files with unlabeled structural sections:**

- `data-verification/DataVerificationScreen.tsx`: `<section className="order-list-container">`
- `data-verification/TransferOrderAccordion.tsx`
- `data-verification/consolidation/ConsolidationOrderAccordionView.tsx` (multiple)
- `data-verification/consolidation/AddCaseModal.tsx`
- `trustees/panels/TrusteeDetailProfile.tsx` (x3)
- `staff-assignment/filters/StaffAssignmentFilterView.tsx`

**Next Steps**:

- Replace unlabeled `<section>` elements with `<div>` unless they should be navigable landmarks — in
  which case add `aria-label`

---

### 36. (High) aria-live="polite" on <main> Announces All DOM Mutations

**Status**: Accessibility Bug **Priority**: High **Description**: `MainContent.tsx` sets
`aria-live="polite"` on the `<main>` element. This makes the entire main content area a live region,
meaning any DOM mutation (route changes, re-renders, lazy-loaded chunks) will be announced to screen
readers. This creates excessive noise and can break screen reader virtual cursor navigation.

**Technical Details**:

- Code location: `user-interface/src/lib/components/cams/MainContent/MainContent.tsx` (line 8)
- `<main id="main" role="main" aria-live="polite">`

**Next Steps**:

- Remove `aria-live="polite"` from `<main>`
- Add targeted live regions to specific components that need announcement (most already have them)

---

### 37. (High) SearchScreen Live Region Wraps Entire Results Panel

**Status**: Accessibility Bug **Priority**: High **Description**: `SearchScreen.tsx` places
`role="status" aria-live="polite"` on the entire results panel div. When results render, the entire
content — potentially hundreds of table rows — would be announced. Should use a small dedicated
count region ("14 results found") instead.

**Technical Details**:

- Code location: `user-interface/src/search-results/SearchResults.tsx` or
  `user-interface/src/search/SearchScreen.tsx`

**Next Steps**:

- Remove `aria-live` from the results panel wrapper
- Add a dedicated hidden live region that announces only a result count

---

### 38. (High) role="alert" Used for Informational Messages in SearchScreen

**Status**: Accessibility Bug **Priority**: High **Description**: Several `<Alert>` components in
`SearchScreen.tsx` use `role="alert"` for informational/status messages like "Enter search terms"
and "No cases found". `role="alert"` implies `aria-live="assertive"` and is reserved for urgent
errors. These should use `role="status"` instead.

**Technical Details**:

- Code location: `user-interface/src/search/SearchScreen.tsx` (lines 537, 553, 571, 584, 602)

**Next Steps**:

- Change `role="alert"` to `role="status"` on info-level and empty-state alerts in SearchScreen

---

### 39. (Medium) RawSvgIcon.tsx GavelIcon Has aria-label Without role="img"

**Status**: Accessibility Bug **Priority**: Medium **Description**: `GavelIcon` (and similar icons
in `RawSvgIcon.tsx`) has `aria-label` on the SVG element without `role="img"`. `aria-label` on an
SVG without `role="img"` is not reliably announced by all screen readers. Either add `role="img"` to
make it meaningful, or add `aria-hidden="true"` if it is decorative.

**Technical Details**:

- Code location: `user-interface/src/lib/components/cams/RawSvgIcon.tsx`
- Same issue in `user-interface/src/lib/components/cams/RichTextEditor/RichTextIcon.tsx`

**Next Steps**:

- If the icon conveys meaning on its own: add `role="img"` alongside `aria-label`
- If it is used alongside visible text (decorative): replace `aria-label` with `aria-hidden="true"`

---

### 40. (Medium) Two Competing Visually-Hidden CSS Classes

**Status**: Cleanup Needed **Priority**: Medium **Description**: Two class names implement the same
WCAG visually-hidden pattern: `.usa-sr-only` (USWDS) and `.screen-reader-only` (custom CAMS). Both
work correctly but the inconsistency creates maintenance overhead. New code should use
`.usa-sr-only`.

**Files using `.screen-reader-only`** (should migrate to `.usa-sr-only`):

- `user-interface/src/trustees/filters/TrusteeDistrictFilterView.tsx`
- `user-interface/src/lib/components/uswds/DateRangePicker.tsx`
- `user-interface/src/admin/bankruptcy-software/BankruptcySoftware.tsx`
- `user-interface/src/admin/permissions/Permissions.tsx`
- `user-interface/src/admin/banks/Banks.tsx`

**Next Steps**:

- Migrate all `.screen-reader-only` usages to `.usa-sr-only`
- Remove `.screen-reader-only` definition from `App.scss`

---

### 41. (Low) DatePicker Error div Missing aria-atomic="true"

**Status**: Cleanup Needed **Priority**: Low **Description**: The error div in `DatePicker.tsx` has
`aria-live="polite"` but no `aria-atomic="true"`. Without `aria-atomic`, only the changed portion of
the element is announced rather than the full error message. Should match the pattern used by other
live regions in the app.

**Technical Details**:

- Code location: `user-interface/src/lib/components/uswds/DatePicker.tsx`

**Next Steps**:

- Add `aria-atomic="true"` to the error div

---

### 42. (Low) aria-atomic="false" on Non-Live Elements — Noise

**Status**: Cleanup Needed **Priority**: Low **Description**: Several elements carry
`aria-atomic="false"` on `aria-live="off"` containers. `aria-atomic` has no meaning on non-live
elements and is just attribute noise.

**Files**:

- `user-interface/src/trustees/TrusteesList.tsx` (lines 481, 491)
- `user-interface/src/lib/components/combobox/ComboBox.tsx`
- `user-interface/src/lib/components/PillBox.tsx`

**Next Steps**:

- Remove `aria-atomic="false"` from non-live elements

---

### 43. (Low) TransferredCaseIcon Hardcodes Colors Instead of Using currentColor

**Status**: Cleanup Needed **Priority**: Low **Description**: `TransferredCaseIcon` in
`RawSvgIcon.tsx` hardcodes `fill="#005EA2"` and `fill="white"` on its paths. Unlike `LeadCaseIcon`
and `MemberCaseIcon` which use `currentColor`, `TransferredCaseIcon` cannot be recolored via CSS.
This makes it inflexible and inconsistent with the other custom icons.

**Technical Details**:

- Code location: `user-interface/src/lib/components/cams/RawSvgIcon.tsx` (lines 72, 76, 79, 83)
- Hardcoded: `fill="#005EA2"` (primary blue) and `fill="#FEFFFF"` / `fill="white"` (near-white for
  arrow paths)

**Next Steps**:

- Replace hardcoded fill colors with `currentColor` and CSS classes, or
- If the two-color treatment is intentional (blue document + white arrows), document that explicitly
  and ensure the contrast meets WCAG AA requirements

---

### 44. Inconsistent Browser Tab Title Personalization on Detail Screens

**Status**: Cleanup Needed **Priority**: Low **Description**: The `DocumentTitle` component
(`lib/components/cams/DocumentTitle`) enforces a fixed format
(`{name} | U.S. Trustee Program - Case Management System (CAMS)`) across all 10 call sites, but the
`name` values passed are inconsistent in whether they personalize to the specific record being
viewed. Most screens pass a static name (e.g., "Case Detail"), while a couple of detail screens
build a dynamic, record-specific name instead (e.g., `` `Trustees Using ${bankName}` ``).
`CaseDetailScreen` does not include the case number/name in its tab title despite being
case-specific.

**Technical Details**:

- Static titles: `AdminScreen.tsx` ("Administration"), `TrusteeDetailScreen.tsx` ("Trustee Detail"),
  `DataVerificationScreen.tsx` ("Data Verification"), `TrusteesScreen.tsx` ("Trustees"),
  `SearchScreen.tsx` ("Case Search"), `MyCasesScreen.tsx` ("My Cases"),
  `StaffAssignmentScreenView.tsx` ("Staff Assignment"), `CaseDetailScreen.tsx` ("Case Detail")
- Dynamic titles: `BankruptcySoftwareDetail.tsx` (`software.name`), `SoftwareBankTrustees.tsx`
  (`` `Trustees Using ${bankName}` ``)

**Next Steps**:

- Decide whether detail screens should personalize the browser tab title with the record identifier
  (e.g., case number) for easier tab discovery when multiple tabs are open
- If yes, update `CaseDetailScreen.tsx` and similar detail screens to pass a record-specific `name`
  to `DocumentTitle`

---

### 45. Disabled UI Element Styling Is Not Standardized

**Status**: Cleanup Needed **Priority**: Low **Description**: Disabled-state styling is implemented
three different ways across components, with no shared convention.

**Technical Details**:

- `ComboBox.scss` — uses the standardized `colors.$disabledInputText` /
  `colors.$disabledInputBackground` variables (`#454545` / `#c9c9c9`) on `.combo-box-input:disabled`
  and `.input-container.disabled`
- `RichTextEditor.scss` — hardcodes its own disabled colors
  (`background-color: #f0f0f0; color: #565c65;` on `&.disabled`), not using the
  `$disabledInputText`/`$disabledInputBackground` variables at all; `#f0f0f0` and `#565c65` are also
  used elsewhere in the app for unrelated purposes (hover states, muted controls), so reusing them
  here for "disabled" overloads their meaning
- `DatePicker.scss` — uses a third approach entirely:
  `&:disabled { cursor: not-allowed; opacity: 0.5; }` with no explicit background/text color, just
  dimming via opacity

**Next Steps**:

- Decide on one standard treatment for disabled UI elements (variable-based colors vs. opacity
  dimming)
- Update `RichTextEditor.scss` and `DatePicker.scss` to follow the chosen standard, using
  `$disabledInputText`/`$disabledInputBackground` (or renamed/generalized equivalents) rather than
  component-local hardcoded values

---

### 46. Replace 3-Digit Hex Shorthand `#ddd` with Full `#dddddd`

**Status**: Cleanup Needed **Priority**: Low **Description**: `#ddd` (3-digit hex shorthand for
`#dddddd`) is used in three places in the codebase. For clarity and to avoid ambiguity with visually
similar grays (`#d0d0d0`, `#d6d6d6`), it should be written out in full as `#dddddd`.

**Technical Details**:

- `user-interface/src/admin/bankruptcy-software/BankruptcySoftware.scss` (line 142) —
  `border: 1px solid #ddd;` (dead code — see issue #4)
- `user-interface/src/lib/components/uswds/Table.scss` (line 19) — `border-bottom: 1px solid #ddd;`
  (inside unused `small-table` mixin — see issue #17)
- `user-interface/src/case-detail/panels/CaseDetailHeader.scss` (line 46) —
  `box-shadow: 0px 1px 5px #ddd;` (non-functioning sticky header — see issue #6)

**Next Steps**:

- Replace `#ddd` with `#dddddd` in all three files above
- Update `BRAND_GUIDELINES.md` to reflect `#dddddd` once the code change lands

---

### 47. Verify USWDS SCSS Color Variables Are Properly Imported Before Redefining Them

**Status**: Needs Investigation **Priority**: Medium **Description**: CAMS defines its own custom
variables in `_colors.scss`/`theme.scss` for several colors that already exist as USWDS theme tokens
(e.g., `$theme-color-warning-lighter`, `$theme-color-secondary-dark`). This duplication may have
originated from early trouble getting USWDS SCSS color variables to import/resolve correctly. If
USWDS variables are in fact properly imported and usable throughout the app, the redundant custom
variables could be removed in favor of referencing USWDS directly.

**Technical Details**:

- Custom variables shadowing USWDS tokens are defined in
  `user-interface/src/styles/abstracts/_colors.scss` and `user-interface/src/styles/theme.scss`
- USWDS theme tokens referenced directly (not via `_colors.scss`) include
  `$theme-color-warning-lighter` (`#faf3d1`) and `$theme-color-secondary-dark`

**Next Steps**:

- Verify that USWDS SCSS color variables import correctly and are usable wherever needed in the
  codebase
- If imports work reliably, evaluate removing redundant custom color variables in favor of the USWDS
  originals
- If imports are unreliable, document why (e.g., load order, `@use`/`@forward` scoping) so future
  contributors understand why custom redefinitions exist

---

## Add New Issues Below
