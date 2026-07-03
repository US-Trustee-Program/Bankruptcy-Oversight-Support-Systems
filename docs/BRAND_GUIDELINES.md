# CAMS Brand Guidelines

This document provides clear guidelines for implementing UI components, styling, and content in the CAMS (Case Assignment & Management System) application. These guidelines ensure consistency across the application and help LLM assistants make appropriate styling decisions.

## Application Context

**CAMS (Bankruptcy Oversight Support Systems)** is an internal web application used by USTP (US Trustee Program) staff:
- **Users**: Trial attorneys, office managers, paralegals, auditors, IT administrators
- **Purpose**: Manage bankruptcy cases, staff assignments, court dockets, and user access
- **Environment**: Desktop-first responsive application for federal employees on government-issued workstations
- **Minimum viewport**: 1024px wide, adapts to various desktop screen sizes

**Design System Foundation**: CAMS utilizes the U.S. Web Design System (USWDS) 3.13.0 for UI components, guidance, and code with some exceptions documented below.

---

## Core UX Principles

These interaction principles apply to every screen and component in CAMS. They are binding design constraints, not optional guidelines.

### 1. Escapability
Users must be able to back out of what they're doing without following through. Every modal, form, and multi-step flow must have a cancel or back-out path that returns the user to their prior state without side effects. A user who starts an action by mistake should never be trapped into completing it.

**Implementation**:
- Every modal has Cancel button + Escape key support
- Clicking outside modal cancels action
- Multi-step forms have Back/Cancel at each step

### 2. Recognition Over Recall
Users should not have to remember or type names, codes, or IDs from memory. When selecting users, offices, roles, or cases, the interface must offer search-and-select (autocomplete or filtered list) rather than free-text entry.

**Implementation**:
- Use ComboBox/autocomplete for user selection
- Use dropdowns for role/office selection with plain English labels
- Show "New York Southern District" not "USTP_CAMS_Region_02_Office_New_York"

### 3. Visibility of System State
After any action (assignment created, role removed, order verified), the user must see immediate confirmation that the action succeeded. Failed actions must show a clear error explaining what went wrong and what to do next. Buttons must not do nothing silently.

**Implementation**:
- Success/error alerts at top of page after every action
- Loading indicators during async operations
- Disabled buttons show loading state during submission

### 4. Clarity of Scope
Every screen that shows assignments, cases, or user details must make it unambiguous which user, which office, and which role is being viewed or modified. Labels use plain English, not internal codes.

**Implementation**:
- Clear page headings with context (e.g., "Permissions for John Smith")
- Breadcrumbs when navigating hierarchies
- Plain language labels throughout

### 5. Appropriate Access by Role
The UI must not offer actions to users who lack permission to take them. Controls for disallowed actions are hidden or visibly disabled—not silently failing after submission.

**Implementation**:
- Check user roles before rendering admin links
- Hide/disable controls for actions user can't perform
- Always validate permissions on backend

---

## Color System

CAMS uses the U.S. Web Design System (USWDS) 3.13.0 as its foundation. All colors follow USWDS accessibility standards.

### Primary Interactive Colors (Actually Used)

- **Primary Blue**: `#005ea2`
  - Main brand color for primary CTAs, links, interactive elements
  - Used in: Links (theme.scss), filters, buttons

- **Primary Dark**: `#1a4480`
  - Link hover states, active/selected filter text
  - Used in: Link hovers, active filter states

- **Navy**: `#162e51`
  - Header component background
  - Used in: Main application header

- **Blue Accent**: `#207bc0`
  - User menu dropdown item backgrounds
  - DEVELOPMENT environment banner background

### Brand/Accent Colors (Actually Used)

- **Gold**: `#ffbe2e`
  - USTP brand gold
  - Used in: Header icons, table header borders

- **Yellow-20**: `#e6c74c`
  - Search result highlighting in Court Docket panel
  - Note: Uses CSS Custom Highlight API (browser support limited)

- **Banner Gold**: `#ffd700`
  - TEST environment banner background

### Semantic/Status Colors (Actually Used)

- **Success**: Uses USWDS `usa-alert--success`
  - Background: `#ecf3ec` (green-cool-5)
  - Left border: `#00a91c` (green-cool-40v)
  - Text: `#1b1b1b` (default body text — applied because background is light)
  - `#ecf3ec` also used as Tag component background

- **Error**: Uses USWDS `usa-alert--error`
  - Background: `#f4e3db` (red-warm-10)
  - Left border: `#d54309` (red-warm-50v)
  - Text: `#1b1b1b` (default body text — applied because background is light)
  - Note: `#b50909` and hover `#8b0a0a` are used separately for remove/delete button text in the Permissions admin panel

- **Warning**: Uses USWDS `usa-alert--warning`
  - Background: `#faf3d1` (yellow-5)
  - Left border: `#ffbe2e` (gold-20v — same as CAMS brand gold `$gold`)
  - Text: `#1b1b1b` (default body text — applied because background is light)
  - `#faf3d1` also used as Notes panel search result highlight background

- **Info**: Uses USWDS `usa-alert--info`
  - Background: `#e7f6f8` (cyan-5)
  - Left border: `#00bde3` (cyan-30v)
  - Text: `#1b1b1b` (default body text — applied because background is light)

### Text Colors (Actually Used)

- **Primary Text (Ink)**: `#1b1b1b`
  - Body text, default content
  - Used in: Borders in trustees, verification components

- **Eagle (Dark Text)**: `#2e2e2a`
  - Used in: `$tableHeaderBackground` variable in `_tables.scss` (defined but that variable is never imported or applied), and `.App-header` background in `App.scss` (Create React App boilerplate, not the actual CAMS header)
  - Note: Effectively unused in the live CAMS UI


- **Disabled Text**: `#454545`
  - Placeholder text, disabled input text

- **Muted Controls**: `#565c65`
  - Used in: Rich text editor controls

### Background Colors (Actually Used)

- **White**: `#ffffff` - Page background, cards, panels
- **Light Gray**: `#f0f0f0`
  - RichTextEditor toolbar button hover and active states
  - Case Detail Header border when in sticky/fixed position (see issue #6 — sticky header not currently working; feature may be removed)
- **Near-White**: `#fefefe`
  - Case Detail Header background when in sticky/fixed position (see issue #6 — sticky header not currently working; feature may be removed)
- **Disabled Input**: `#c9c9c9` - Disabled ComboBox background (e.g., "New Court" field in Data Verification → Transfers while validation is processing)

### Border & Divider Colors (Actually Used)

- **Light Gray**: `#ddd`
  - `CaseDetailHeader.scss` box shadow on sticky header (non-functioning — see issue #6)
  - `BankruptcySoftware.scss` list item border (dead code — see issue #4)
  - `Table.scss` cell border inside `small-table` mixin (mixin defined but never included anywhere — see issue #17)
  - Note: Effectively unused in the live CAMS UI

- **Black**: `#000000`
  - Note item dividers (Case Notes and Trustee Notes panels)
  - Loading spinner text
  - TEST environment banner text
  - Search result highlight text (Court Docket)
  - Pagination button background
  - Skip to main content link text
  - Note: `3px solid black` table row borders appear in `Table.scss` but are inside the unused `small-table` mixin (see issue #17)

### Component-Specific Colors

**Rich Text Editor** (hardcoded in component):
- Toolbar Background: `#e9ecef`
- Active Button Background: `#71767a` (with white text)
- Hover State: `#f0f0f0`
- Link Color: `#005ea6`
- Muted Controls: `#565c65`

### Additional Grays in Use

- **`#565c65`** - ComboBox section divider color; RichTextEditor muted control text
- **`#5c5c5c`** - ToggleButton inactive state background
- **`#0050d8`** - ToggleButton active state background (My Cases, ComboBox, RichTextEditor)
- **`#949494`** - ComboBox selected item border color
- **`#b0b0b0`** - ComboBox list item hover background
- **`#c6c6c6`** - Mobile responsive table row borders (via `$tableBorder` in App.scss)
- **`#c6cace`** - ComboBox separator between input and expand button
- **`#d0d0d0`** - ComboBox selected item background
- **`#e0e0e0`** - RichTextEditor toolbar bottom border
- **`#e9ecef`** - RichTextEditor toolbar background

---

## Available But Unused Colors

These colors are defined in `styles/abstracts/_colors.scss` but not currently used:

- `$secondary-darker` (`#8b0a03`) - similar to but not identical to actual hover state `#8b0a0a`
- `$warning-text` (`#990000`)
- `$warning-light` (`#ffffca`) - USWDS provides warning colors instead

---

## Color Usage Guidelines

- **USWDS First**: Always use USWDS alert components (`usa-alert--success`, `usa-alert--error`, `usa-alert--warning`, `usa-alert--info`) for semantic messaging
- **Accessibility**: Maintain WCAG 2.1 AA contrast ratios (4.5:1 for normal text, 3:1 for large text)
- **Consistency**: Primary blue (`#005ea2`) is the main interactive color - use for all clickable elements
- **Semantic Purpose**: Only use semantic colors (success green, error red) for their intended purpose
- **Variables Preferred**: When available, use SCSS color variables from `_colors.scss` rather than hardcoding hex values

---

## Complete Color Audit

This section provides a complete technical breakdown of all colors in the CAMS codebase.

### Colors from SCSS Variables (_colors.scss)

**Actually Used:**
1. `$primary` (`#005ea2`) - Links in theme.scss
2. `$primary-dark` (`#1a4480`) - Link hover states, active filters
3. `$navy` (`#162e51`) - Header background
4. `$gold` (`#ffbe2e`) - Header icons, table borders
5. `$eagle` (`#2e2e2a`) - App background, table headers
6. `$ink` (`#1b1b1b`) - Borders in trustees and verification
7. `$success` (`#ecf3ec`) - Tag component
8. `$yellow-20` (`#e6c74c`) - Court Docket search highlighting
9. `$secondary-dark` (`#b50909`) - Verification, permissions
10. `$disabledInputText` (`#454545`) - Disabled input text
11. `$disabledInputBackground` (`#c9c9c9`) - Disabled input backgrounds

**Defined But Never Used:**
- `$secondary-darker` (`#8b0a03`)
- `$warning-text` (`#990000`)
- `$warning-light` (`#ffffca`)
- `$tableBodyBackgroundOddRows` (`#f6f6f6`) - defined in `_tables.scss` but never applied anywhere

### All Hardcoded Hex Colors Found

**Blues:**
- `#005ea2` - Primary blue (also SCSS variable)
- `#005ea6` - RichTextEditor links (slightly different)
- `#1a4480` - Primary dark (also SCSS variable)
- `#162e51` - Navy (also SCSS variable)
- `#207bc0` - User menu dropdown, dev banner
- `#0050d8` - ToggleButton active state background (My Cases screen, ComboBox, RichTextEditor)

**Blacks & Darkest Grays:**
- `#1b1b1b` - Ink (also SCSS variable)
- `#2e2e2a` - Eagle (also SCSS variable)

**Medium-Dark Grays:**
- `#454545` - Disabled text (also SCSS variable)
- `#565c65` - RichTextEditor muted controls
- `#5c5c5c` - Additional gray shade
- `#71767a` - RichTextEditor active button

**Medium Grays:**
- `#757575` - Secondary text, helper text
- `#949494` - Additional gray shade
- `#b0b0b0` - Additional gray shade

**Light Grays:**
- `#c6c6c6` - Additional gray shade
- `#c6cace` - Additional gray shade
- `#c9c9c9` - Disabled input background (also SCSS variable)
- `#d0d0d0` - Additional gray shade
- `#ddd` - Table borders (3-digit hex)
- `#e0e0e0` - Additional gray shade

**Very Light Grays:**
- `#e9ecef` - RichTextEditor toolbar
- `#f0f0f0` - Alternate backgrounds, hover states
- `#f6f6f6` - Additional light gray
- `#f9f9f9` - Light background for cards
- `#fefefe` - Near-white for headers

**Whites:**
- `#ffffff` - White backgrounds

**Reds (Error/Danger):**
- `#b50909` - Error red (also SCSS variable)
- `#8b0a0a` - Error hover state (NOT the same as `$secondary-darker #8b0a03`)
- `#8b0a03` - Defined in SCSS but unused

**Yellows/Golds:**
- `#ffbe2e` - Gold (also SCSS variable)
- `#e6c74c` - Yellow-20 (also SCSS variable)
- `#ffd700` - Banner gold for TEST environment
- `#ffffca` - Defined in SCSS but unused

**Greens:**
- `#ecf3ec` - Success green (also SCSS variable)

**Other:**
- `#61dafb` - React logo cyan (App.scss, likely not relevant)
- `#990000` - Defined in SCSS but unused

### USWDS Theme Colors (Not in colors.scss)

These come directly from USWDS:
- `$theme-color-warning-lighter` (`#faf3d1`) - Warning alerts, Notes search highlighting
- USWDS alert colors via `usa-alert--success`, `usa-alert--error`, `usa-alert--warning`, `usa-alert--info`
- `$theme-color-secondary-dark` - Used in Notes component for remove button hover

### Implementation Notes

- **Variable vs Hardcoded**: Many colors appear both as SCSS variables AND hardcoded in different files
- **Gray Proliferation**: Many gray shades are hardcoded rather than standardized via variables
- **USWDS Reliance**: CAMS relies heavily on USWDS for semantic alert colors
- **Component-Specific**: Rich Text Editor has its own hardcoded color palette
- **Hover States**: Error hover uses `#8b0a0a` (hardcoded), not the defined `$secondary-darker` (`#8b0a03`)

---

## Typography

### Text Casing Rules
CAMS follows specific casing conventions throughout the application:

- **Headers (H1, H2, H3, etc.)**: Title Case for all headers
  - **Exception**: Use Sentence case for headers in page-level success/alert/error messages
- **Field Labels**: Sentence case (e.g., "Case number", "Debtor name")
  - **Exception**: Use Title Case for document type and document titles
- **Buttons**: Title Case (e.g., "Save Changes", "Cancel", "Submit Order")
- **Body Copy**: Sentence case for all body text content
- **Table Headers**: Title Case
- **Navigation Items**: Title Case
- **Input Placeholders**: Sentence case
- **Error Messages**: Sentence case, clear verb phrases
  - Short directives/imperatives: No period (e.g., "Enter state", "Select trial city")
  - Full sentences or multi-sentence messages: Use periods (e.g., "Unable to save changes. Please try again.")

### Heading Hierarchy
- **H1**: Page titles only (one per page)
  - Font size: `2.5rem` (40px)
  - Font weight: Not explicitly set in theme.scss — inherits browser default (`700`)
  - Line height: Not set — inherited
  - Margin: `1rem 0`
  - Usage: Main page heading, use `.screen-heading` wrapper when inline with actions

- **H2**: Major section headers
  - Font size: `2rem` (32px)
  - Font weight: Not explicitly set in theme.scss — inherits browser default (`700`)
  - Line height: Not set — inherited
  - Margin: `margin-top: 0; margin-bottom: 1rem`

- **H3**: Subsection headers within major sections
  - Font size: `1.375rem` (22px)
  - Font weight: `700`
  - Line height: `1.5`
  - Margin: `0`
  - Usage: Card titles, panel headers

- **H4**: Minor headers, card subtitles
  - Font size: `1rem` (16px)
  - Font weight: `700`
  - Line height: Not set — inherited
  - Margin: `margin-block-start: 0; margin-block-end: 0` (note: uses `margin-block` instead of `margin` unlike other headings)
  - Usage: Alert headings (`usa-alert__heading`), form section headers

- **H5**: Small headers
  - Font size: `0.9375rem` (15px)
  - Font weight: `700`
  - Line height: Not set — inherited
  - Margin: `0`

- **H6**: Smallest headers (rarely used)
  - Font size: `0.8125rem` (13px)
  - Font weight: `700`
  - Line height: Not set — inherited
  - Margin: `0`

### Font Families
- **Body/UI Font**: Source Sans Pro (primary), with fallbacks
  ```
  'Source Sans Pro', 'Source Sans Pro Web', 'Helvetica Neue',
  'Helvetica', 'Roboto', 'Arial', sans-serif
  ```
  - Applied globally via the `*` selector in `theme.scss`, which overrides all USWDS component fonts

- **Display/Header Font (Logo/Title)**: Source Serif Pro
  ```
  'Source Serif Pro', Georgia, 'Times New Roman', serif
  ```
  - Used only in `.cams-logo-and-title .site-title` (the application header)

- **Monospace (Code)**:
  ```
  source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace
  ```

### A Note on Merriweather
USWDS 3.x sets **Merriweather** as its default serif/heading font (`$theme-font-type-serif`), which is applied to components like cards by default. CAMS does **not** use Merriweather. The global `* { font-family: 'Source Sans Pro'... }` rule in `theme.scss` overrides it on all elements throughout the application. If you're wondering why Merriweather isn't visible anywhere in CAMS despite USWDS loading it — this is why.

### Font Weights
- **Bold (700)**: All headings (H1-H6), emphasis
- **Regular (400)**: Body text, default for all content
- Note: CAMS does not use semibold (600) or light (300) weights

---

## Spacing Standards

CAMS uses two distinct spacing systems depending on context. Do not conflate them.

### System 1: Rem-Based Spacing (SCSS files)
Used in `.scss` component files. Values are in `rem` units.

| Value | Pixels | Used for |
|---|---|---|
| `0.25rem` | 4px | Tight grouping, icon button padding |
| `0.5rem` | 8px | Icon button padding in headings |
| `1rem` | 16px | Heading margins, standard element spacing |
| `1.5rem` | 24px | Section spacing, card padding |
| `2rem` | 32px | Large section breaks |
| `3rem` | 48px | Page-level section spacing |

**Actual values from theme.scss:**
- H1: `margin: 1rem 0`
- H2: `margin-top: 0; margin-bottom: 1rem`
- H3-H6: `margin: 0`
- Icon button in H1: `padding-left: 0.5rem`
- Icon button in H3: `padding-left: 0.25rem`
- Screen heading (H1 inline with actions): `margin-right: 1rem`

### System 2: USWDS Spacing Utility Classes (JSX/TSX files)
Used as className strings in component files. **1 USWDS unit = 8px** (not 1rem).

| Class | Pixels | Rem equivalent |
|---|---|---|
| `margin-*-0` | 0px | 0 |
| `margin-*-1` | 8px | 0.5rem |
| `margin-*-2` | 16px | 1rem |
| `margin-*-3` | 24px | 1.5rem |
| `margin-*-4` | 32px | 2rem |
| `margin-*-5` | 40px | 2.5rem |

**Units actually used in CAMS** (in order of frequency): `0`, `1`, `2`, `3`, `4`, `5`

**Examples from codebase:**
- `margin-bottom-0` — headings in trustees screen
- `margin-top-0` — form fields
- `margin-right-1` — inline element spacing
- `margin-top-4` — grid row spacing in forms
- `margin-top-5` — button groups in forms
- `padding-y-4` — vertical padding in modals

### What to Use Where
- **In `.scss` files**: Use rem values
- **In `.tsx`/`.jsx` files**: Use USWDS utility classes (`margin-top-2`, etc.)
- **Avoid**: Hardcoding pixel values in either context

### Note on Table Spacing Variables
`$tableCellPadding` (10px), `$tableBorderRadius` (5px), and `$tableBorderCollapse` (collapse) are defined in `_tables.scss` but **never used** anywhere in the application.

---

## Component Patterns

All components live in `user-interface/src/lib/components/`. They are divided into:
- `uswds/` — Wrappers around USWDS components
- `cams/` — Custom CAMS-specific components
- Root level — General-purpose components

### Components in Active Use

| Component | Location | Usage |
|---|---|---|
| `Alert` | `uswds/Alert` | Success, error, warning, info messages |
| `Button` | `uswds/Button` | All button types |
| `Modal` | `uswds/modal/Modal` | Dialogs and confirmation modals |
| `Input` | `uswds/Input` | Text input fields |
| `ComboBox` | `combobox/ComboBox` | Searchable dropdowns, multi-select |
| `Icon` | `uswds/Icon` | SVG icons from USWDS sprite |
| `Card` | `uswds/Card` | Content cards |
| `Table` | `uswds/Table` | Responsive HTML tables |
| `GlobalAlert` | `cams/GlobalAlert` | App-level alert messaging |
| `CaseNumber` | `CaseNumber` | Formatted case number display |
| `CamsTable` | `cams/CamsTable` | Custom ARIA-compliant responsive table |
| `IconLabel` | `cams/IconLabel` | Icon + text label combination |
| `Header` | `Header` | Application header/navigation |
| `Accordion` | `uswds/Accordion` | Collapsible content sections |
| `Pagination` | `uswds/Pagination` | Page navigation |
| `DocumentTitle` | `cams/DocumentTitle` | Sets browser page title |
| `MainContent` | `cams/MainContent` | Main content area wrapper |
| `ButtonGroup` | `uswds/ButtonGroup` | Groups of related buttons |
| `SubmitCancelButtonGroup` | `uswds/modal/SubmitCancelButtonGroup` | Standard modal footer buttons |
| `OpenModalButton` | `uswds/modal/OpenModalButton` | Button that triggers a modal |
| `Notes` | `cams/Notes` | Case notes panel |
| `LoadingIndicator` | `LoadingIndicator` | Inline loading state |
| `LoadingSpinner` | `LoadingSpinner` | Full loading spinner |
| `FormattedContact` | `cams/FormattedContact` | Formatted contact info display |
| `CommsLink` | `cams/CommsLink` | Phone/email communication links |
| `Radio` | `uswds/Radio` | Radio button input |
| `RadioGroup` | `uswds/RadioGroup` | Group of radio buttons |
| `NewTabLink` | `cams/NewTabLink` | Link that opens in new tab |
| `PhoneNumberInput` | `PhoneNumberInput` | Phone number formatted input |
| `DatePicker` | `uswds/DatePicker` | Date picker input |
| `ZipCodeInput` | `ZipCodeInput` | Zip code formatted input |
| `UsStatesComboBox` | `combobox/UsStatesComboBox` | Pre-built US states dropdown |
| `RichTextEditor` | `cams/RichTextEditor` | Rich text editing for notes |
| `PillBox` | `PillBox` | Container for Pill items |
| `CaseNumberInput` | `CaseNumberInput` | Case number formatted input |
| `BackLink` | `cams/BackLink` | Back navigation link |
| `ScreenInfoButton` | `cams/ScreenInfoButton` | Info button for screen context |
| `FormRequirementsNotice` | `uswds/FormRequirementsNotice` | "Required fields" notice |
| `Checkbox` | `uswds/Checkbox` | Checkbox input |
| `RemovalModal` | `uswds/modal/RemovalModal` | Confirmation modal for removals |
| `RawSvgIcon` | `cams/RawSvgIcon` | Custom SVG icons (non-USWDS) |
| `SessionTimeoutWarningModal` | `cams/SessionTimeoutWarningModal` | Session expiry warning |
| `PaginationButton` | `uswds/PaginationButton` | Individual pagination button |
| `Tag` | `uswds/Tag` | Status/label tags |
| `ToggleButton` | `cams/ToggleButton` | Active/inactive toggle button |
| `SkipToMainContentLink` | `cams/SkipToMainContentLink` | Accessibility skip link |
| `IconButton` | `IconButton` | Unstyled button with icon (prefer over manual composition) |
| `CopyButton` | `cams/CopyButton` | Copy to clipboard button (uses IconButton) |
| `DocketEntryDocumentList` | `DocketEntryDocumentList` | List of docket entry documents |
| `DateRangePicker` | `uswds/DateRangePicker` | Date range selection |
| `PrivacyActFooter` | `uswds/PrivacyActFooter` | Required privacy act footer |
| `GoHome` | `GoHome` | Navigate to home page |
| `NotFound` | `NotFound` | 404 not found page |
| `Stop` | `Stop` | Access denied/stop page |
| `NavigationTracker` | `NavigationTracker` | Tracks navigation state |
| `PrerenderedHtml` | `cams/PrerenderedHtml` | Renders pre-formatted HTML content |
| `ScrollToTopButton` | `ScrollToTopButton` | Scrolls page to top |
| `ClosedCasesHintMessage` | `cams/ClosedCasesHintMessage` | Hint message for closed cases |
| `SessionTimeoutManager` | `cams/SessionTimeoutManager` | Manages session timeout logic |
| `NoteItem` | `cams/NoteItem` | Individual note display |
| `Pill` | `Pill` | Individual pill/tag item |
| `MonthDayRangeSelector` | `uswds/MonthDayRangeSelector` | Month/day range input |
| `LegacyFormattedContact` | `cams/LegacyFormattedContact` | Legacy contact formatter |
| `DropdownMenu` | `cams/DropdownMenu` | Dropdown menu component |

### Components Available But Not Currently in Use

| Component | Location | Notes |
|---|---|---|
| `TextArea` | `uswds/TextArea` | USWDS textarea wrapper — codebase uses raw `<textarea>` instead |

---

### Buttons

All buttons use USWDS button components with the base class `usa-button`.

#### Button Hierarchy
- **Primary Button** (Default): Main action on the page (e.g., "Save Changes", "Submit Order", "Verify")
  - Class: `usa-button` (no modifier)
  - Style: Solid fill with primary blue background
  - Usage: Limit to 1-2 per view for the most important action

- **Secondary Button**: Alternative or cancel actions (e.g., "Cancel", "Go Back")
  - Class: `usa-button usa-button--secondary`
  - Style: Lighter fill, less prominent than primary
  - Usage: Supporting actions that are less critical than primary

- **Outline Button**: Secondary actions that need clear boundaries (e.g., "Edit", "View Details")
  - Class: `usa-button usa-button--outline`
  - Style: Transparent background with colored border
  - Usage: Actions in button groups or where visual separation is needed


- **Unstyled Button**: Icon buttons, inline actions, minimal chrome (e.g., close buttons, info icons)
  - Class: `usa-button usa-button--unstyled`
  - Style: No background, border, or padding - looks like plain text/icon
  - Usage: Non-prominent actions, icon-only buttons in headers

- **IconButton**: Dedicated component for unstyled buttons with a single icon
  - Component: `IconButton` in `lib/components/IconButton.tsx`
  - Wraps `Button` with `UswdsButtonStyle.Unstyled` and an `Icon` inside
  - Props: All standard button props + `icon` (string name from USWDS sprite)
  - Example: `<IconButton icon="close" aria-label="Close panel" />`
  - **Prefer `IconButton` over manually composing an unstyled button + icon** — it is the canonical pattern
  - Note: Much of the codebase currently composes unstyled buttons with icons directly rather than using `IconButton` — new code should use `IconButton`
  - Also serves as the base for `CopyButton` (`lib/components/cams/CopyButton.tsx`)


#### Button Groups
- **Standard Group**: Multiple related actions side-by-side
  - Class: `usa-button-group`

#### Button Text
- **Casing**: Title Case for all button text
- **Action verbs**: Use clear, specific verbs
  - "Save Changes" (not just "Save" when saving edits)
  - "Submit Order" (not just "Submit")
  - "Cancel" (for canceling an operation)
  - "Go Back" (for navigation)
  - "Verify" (not "Approve")
- **Length**: Keep button text concise (typically 1-3 words)
- **Accessibility**: Icon-only buttons must include `aria-label` or `title` attribute

#### Button Styles Available But Not Currently Used
- **Accent Cool**: `usa-button usa-button--accent-cool` — defined in `UswdsButtonStyle` but never used in the app
- **Accent Warm**: `usa-button usa-button--accent-warm` — defined in `UswdsButtonStyle` but never used in the app
- **Base**: `usa-button usa-button--base` — defined in `UswdsButtonStyle` but never used in the app
- **Inverse**: `usa-button usa-button--outline usa-button--inverse` — defined in `UswdsButtonStyle` but never used in the app
- **Segmented Button Group**: `usa-button-group usa-button-group--segmented` — defined in `ButtonGroup` component but never used in the app
- Note: `Warm` and `Cool` colors are used in the **Tag** component (`bg-accent-cool`, `bg-accent-warm-dark`) but not in buttons

#### Button States - Visibility of System State
- **During submission**:
  - Disable the submit button (`disabled` attribute) OR
  - Show loading indicator (spinner icon or text like "Saving...")
  - Prevents double-submission
  - Provides visual feedback that action is in progress
- **After success**: Re-enable button and show success message at top of page
- **After error**: Re-enable button and show error message at top of page
- **Never fail silently**: Button clicks must always provide feedback

### Forms

CAMS uses USWDS form components with custom validation and accessibility enhancements.

#### Field Labels
- **Position**: Above field (USWDS standard)
- **Casing**: Sentence case (e.g., "Case number", "Debtor name")
- **Required fields**: Use HTML5 `required` attribute; visual indicators handled by USWDS/browser
- **Optional fields**: Leave unmarked (no "(optional)" text needed)
- **Association**: Labels use `htmlFor` to associate with input `id`

#### Help Text / Hints
- **Component**: Use `ariaDescription` prop on Input component
- **Position**: Between label and input field
- **Class**: `usa-hint`
- **Style**: Smaller font, muted/gray text
- **Usage**: Brief context, format examples, or instructions
- **Accessibility**: Automatically linked via `aria-describedby`

#### Input States
- **Default**: Standard USWDS input styling (`usa-input`)
- **Focus**: Blue outline ring (USWDS focus state)
- **Error**:
  - Class: `usa-input-group--error` on wrapper
  - Attribute: `aria-invalid="true"` on input
  - Visual: Red border/styling per USWDS
  - Message: Error text appears below input (see Error Messages below)
- **Disabled**:
  - Attribute: `disabled` on input
  - Background: `#c9c9c9` (gray)
  - Text: `#454545` (muted gray)
  - Cursor: `not-allowed`
- **Valid**: No special styling (CAMS doesn't use green checkmarks for valid fields)

#### Error Messages (Field-Level)
- **Position**: Directly below the input field with error
- **Class**: `usa-input__error-message` (custom CAMS class — not the USWDS standard `usa-error-message`, though it follows USWDS naming conventions)
- **ID Pattern**: `{fieldId}-input__error-message`
- **Accessibility**: Linked via `aria-errormessage` attribute
- **Color**: `#b50909` (CAMS `$secondary-dark`) — appears when `errorMessage` prop is set
- **Tone**: Clear, actionable directions in sentence case
- **Format**:
  - Short directives (1 phrase, imperative): No period — "Enter state", "Select trial city"
  - Full sentences or multi-sentence messages: Use periods — "Unable to save. Please try again."
- **Examples**:
  - "Enter state"
  - "Select trial city"
  - "Case number must be in format XX-XXXXX"
- **Live Region**: Input component includes polite live region that announces validation state changes ("Invalid: [message]" or "Valid")

#### Optional Input Features
- **Clear Button**: Pass `includeClearButton={true}` to add an 'X' button that clears the field
  - Shows only when field has value and is not disabled
  - Uses unstyled button with close icon
  - Includes `aria-label="clear text input"` on the button so screen readers announce its purpose (the icon alone is not sufficient)
- **Prefix Icon**: Pass `icon="icon-name"` to show an icon inside the input (e.g., a search icon)
  - The icon is decorative — it has `aria-hidden="true"` so screen readers skip it, since the input label already describes the field's purpose

#### Form Groups
- **Wrapper Class**: `usa-form-group`
- **Structure**: Label → Hint → Input → Error Message

#### Form Interaction Patterns - Recognition Over Recall

**Search and Select Over Free-Text Entry**
- **User/name selection**: Use autocomplete or filtered list, not free-text entry requiring exact match
- **Role selection**: Present dropdown/select list of assignable roles, not free-text field
- **Office selection**: Use dropdown/select with plain English office names (e.g., "New York Southern District"), not code entry
- **Pattern**: When users need to select from a known set of options, show them the options - don't make them remember and type exact values

**Autocomplete/ComboBox Usage**
- For selecting from large lists (users, offices, cases)
- Shows suggestions as user types
- Handles partial matches
- Component: ComboBox in `lib/components/uswds/ComboBox`

### Tables

CAMS uses both USWDS tables and custom `CamsTable` component with responsive design.

#### Table Headers
- **Text casing**: Title Case
- **Alignment**: Left-aligned by default; right-alignment used for specific columns where it aids layout (e.g., document number column in Court Docket)
- **Font weight**: Bold (700) - typically in `<thead>` elements
- **Sorting**: Show sort indicators when column is sortable
- **Mobile**: Hidden on small screens (handled by responsive mixin)

#### Table Structure
- **USWDS Tables**: Standard HTML `<table>` with USWDS classes
- **CamsTable Component**: Custom responsive table using `role="table"`
  - Class: `cams-table cams-table--responsive`
  - Must include either `caption` or `aria-label` for accessibility
  - Caption uses `cams-table__caption` class

#### Table Rows
- **Alternating rows**: Not used in CAMS — all table rows have a white background (note: `$tableBodyBackgroundOddRows` and `$tableBodyBackgroundEvenRows` are defined in `_tables.scss` but never applied — see issue #2)
- **Borders**:
  - **USWDS `usa-table`**: Applies `1px solid #1b1b1b` (ink) border to all `th` and `td` elements by default — this is what creates the horizontal lines between rows on desktop
  - **CamsTable**: Uses `1px solid #1b1b1b` (ink) as a bottom border under the header row when in flex-row layout, via `cams-table-flex-row` mixin (Search results, Staff Assignment, Bankruptcy Software admin)
- **Hover state**: No specific hover background defined (relies on USWDS defaults if used)
- **Row actions**: Typically positioned at end of row (rightmost column)

#### Mobile/Responsive Behavior
CamsTable uses two mixins from `_cams-table-mixins.scss` to handle responsive layout:

- **`cams-table-stacked`**: Switches to vertical block layout on small screens
  - Hides header row (visually hidden, not removed for accessibility)
  - Each cell becomes full-width block
  - Shows column labels via `data-cell` attribute using `::before` pseudo-element
  - Row borders come from USWDS defaults (`1px solid #1b1b1b`)

- **`cams-table-flex-row`**: Enables horizontal flex-row column layout on larger screens
  - Shows header row
  - `1px solid #1b1b1b` border under the header row
  - Cells display in a flex row with gaps

Note: A separate `small-table` mixin exists in `Table.scss` with `3px solid black` row borders but is never included anywhere — see issue #17.

#### Empty States
- Message: Context-specific messages (e.g., "No cases found", "No orders to verify")
- Include: Optional action button or link to add first item when appropriate

### Modals & Dialogs

CAMS modals follow USWDS modal patterns with specific interaction requirements.

#### Modal Structure
- **Title**: H2 or H3 level heading
- **Close button**: X button in top-right corner AND Cancel button in footer
- **Actions**: Footer with primary/submit action on the left, Cancel button to the right of it (rendered as unstyled button, default label "Go back")
- **Backdrop**: Dimmed background overlay

#### Modal Behavior - Escapability
- **Cancel button**: Every modal must have a visible Cancel button that exits without saving
- **Escape key**: Pressing Escape dismisses the modal and returns to prior state without saving
- **Click outside**: Clicking the backdrop (outside modal) cancels the action and closes modal
- **No side effects**: Canceling a modal must not persist any changes or leave partial data
- **Multi-step forms**: Must have "Cancel" or "Back" control at each step

#### Confirmation for Destructive Actions
- **When required**: Before deactivating assignments, removing roles, deleting data
- **Pattern**: Show confirmation modal/dialog explaining what will happen
- **Clear messaging**: State what is being deleted/removed and if it's reversible
- **Explicit action**: Require explicit "Confirm" or "Delete" button press (not just "OK")

---

## Feedback & Messaging

All alerts in CAMS use the same `Alert` component (`lib/components/uswds/Alert`) with a `UswdsAlertStyle` value (success, error, warning, info). There is no separate "success message" vs "alert" component — the distinction is purely the style and whether a `title` prop is passed.

### Alert Layout Patterns

**Pattern 1 — Title + Message (two lines)**
- Pass both `title` and `message` props
- Renders a bold H4 heading (`usa-alert__heading`) above the body text
- Use when context needs explanation or there is a heading + detail (e.g., "No cases found" + "Try adjusting your search filters")
- Title: Sentence case
- Examples: Search/My Cases empty states, Case Reload status, Data Verification empty states

**Pattern 2 — Message only (single line)**
- Pass only `message` prop (or `title=""`)
- Renders body text only, no heading
- Use for simple confirmations or errors that need no further explanation
- Examples: `globalAlert.success("Changes saved.")`, form save errors, notes alerts

### Placement & Behavior
- **Position**: Top of screen, under the page header
- **Scroll behavior**: User is scrolled back to top when alert appears
- **Dismiss behavior**:
  - **Manual dismiss** (`timeout={0}`): Most screens — notes, audit history, case detail, modals
  - **Auto-dismiss after 8 seconds** (`timeOut: 8`): Data Verification screens (transfers, trustee matching), GlobalAlert convenience methods (`globalAlert.error()`, `.success()`, etc.)
  - **Exception**: Validation errors disappear automatically once the user corrects the issue and re-submits

### Alert Types

**Success** (`usa-alert--success`)
- Use for: Confirmed actions, saved changes, completed operations
- Short directives/imperatives: No period (e.g., "Changes saved")
- Full sentences or multi-sentence messages: Use periods (e.g., "Unable to save changes. Please try again.")
- Example single line: "Changes saved."
- Example two-line: Title: "Case assigned" / Message: "You can view it in your case list."

**Error** (`usa-alert--error`)
- Use for: Failed operations, server errors, action could not complete
- Style: Clear verb phrases directing what the user needs to do
- **Periods**: No period for short directives ("Enter state"); use periods for full sentences ("Unable to save changes. Please try again.")
- Example single line: "Unable to save changes."
- Example two-line: Title: "Search results not available" / Message: "Please try again later."

**Validation Errors** (field-level, not an alert banner)
- Format: Inline below the field using `usa-input__error-message`
- Auto-dismiss: Yes — disappear after the user corrects the issue and re-submits
- Style: Clear, actionable direction — no period for short imperatives (e.g., "Enter state", "Select trial city")

**Warning** (`usa-alert--warning`)
- Use for: Non-blocking cautions, draft states, informational warnings
- Example: Title: "Draft Notes Available" / Message: "You have unsaved draft notes."

**Info** (`usa-alert--info`)
- Use for: Helpful context, feature states, non-critical notifications
- Example two-line: Title: "Disabled" / Message: "This feature is currently disabled."

### Loading States

There are two loading components in CAMS — use based on context:

**`LoadingSpinner`** (`lib/components/LoadingSpinner.tsx`)
- Custom inline SVG spinning circle — not a USWDS component
- Optional `caption` text displayed below the spinner
- Accepts `height` prop to control container size
- Has `role="status"` and `aria-live="polite"` for screen reader announcements
- Use for: Full page loads, major section loads, form submission in progress
- Example: `<LoadingSpinner caption="Saving changes..." />`

**`LoadingIndicator`** (`lib/components/LoadingIndicator.tsx`)
- Renders a plain `<p>` tag with "Loading..." text — no icon, no animation
- Minimal and lightweight
- Use for: Inline content areas, list items, table rows while data loads
- Example: Used inside docket entry lists while entries are fetching

---

## Layout & Navigation

### Required Page Elements
Every authenticated screen in CAMS must include:

- **Header Component**: `<Header />` component at top of page
  - Contains CAMS/USTP wordmark or logo
  - Navigation links appropriate to user's role
  - Present on every authenticated screen including admin pages

- **Privacy Act Footer**: Required on every authenticated screen
  - Legal/compliance requirement for government applications

- **Browser Page Title**: Must include "CAMS" in the `<title>` tag
  - Helps users identify the application in browser tabs

### Route Structure
- **Admin features**: All administrative features (user management, permissions, etc.) should be under `/admin/*` routes
- **Consistency**: Maintain consistent URL patterns with existing features

### Role-Based UI - Appropriate Access by Role

**Principle**: Don't show users actions they can't perform.

- **Navigation visibility**: Admin navigation links visible only to users with IT SuperUser or SuperUser roles
- **Action availability**: Controls for actions user lacks permission for should be:
  - **Hidden** (preferred - remove from DOM entirely), OR
  - **Visibly disabled** with explanation (when hiding would be confusing)
  - **Never**: Silently failing after user attempts the action

-

**Implementation**: Check user roles on the frontend before rendering controls, and always validate permissions on the backend before executing actions.

---

## Content Voice & Tone

CAMS is an internal USTP application. While we use plain language throughout the system, some terminology may still reflect legal or USTP-specific concepts. Error messages, alerts, and instructions should use clear, straightforward language so users can easily understand what is happening.

### Writing Style
- **Style Guide**: Generally follows AP style
- **Contractions**: Use contractions whenever possible to sound more natural and approachable
- **Commas**: Always use serial/Oxford commas
- **Tone**: Professional but clear and direct. Avoid overly formal or legalistic language in UI copy.

---

## Terminology & Preferred Language

### Core Case Terminology
- **Case Number** (not "Case ID")
- *
- **Case Filed Date** or **Case Filed** (not "Filing Date" or "Petition Date")
- **Order Filed Date** or **Order Filed** (not "Order Date") - Court orders are also filed, so "filed date" alone is ambiguous
- **Staff Assignment** (not "Case Assignment") - We assign staff to a case, not cases to staff. This reinforces that many staff can be assigned to one case.

### Actions & Operations
- **Verify** (not "Approve")
- Use "number" spelled out or "No" as abbreviation (not "#" symbol)

### Data Verification & Court Documents
- **Case Events**: Consolidations and transfers collectively. They live in the Data Verification portion of the application. All Case Events come from court orders, but not all court orders result in Case Events.
- **Court Docket**: Composed of **Court Docket Entries** or **Docket Entries**
  - Each has a **Docket Entry Number**
  - Some docket entries have **Documents** under them
  - Each document has a **Document Number**

### Person Names
- **Display Format**: First, Middle, Last, Suffix order (e.g., "John Q. Public Jr.")
- Some instances may require other labeling methods depending on context

---

## Data Formatting

### Dates
- **Standard Format**: MM/DD/YYYY (e.g., "06/29/2026")
-
- **Document Title Exception**: When date is part of a concatenated document title, use MM-DD-YYYY format
- **Field Labeling**: Dates do not need to be explicitly labeled as "date" - it should be clear from context that a value is a date
- Examples:
  - "Case Filed: 06/29/2026" (label doesn't say "Case Filed Date")
  - "Order Filed: 01/15/2025"

### Time
- **Format**: h:mm am/pm ET (e.g., "3:45 pm ET")
- Always include timezone (ET for Eastern Time)
- Use lowercase "am" and "pm"
- Use 12-hour time format

### Currency
- **Format**: Always display dollar amounts with two decimal places (e.g., "$60.00", "$1,234.56")
- Include dollar sign and comma separators for thousands

### Numbers
- Spell out "number" or use "No" as abbreviation
- Do not use "#" symbol for number

---

## Accessibility Requirements

CAMS follows USWDS accessibility standards and WCAG 2.1 AA compliance.

### Color Contrast
- **Body text**: Must meet WCAG 2.1 AA standard (4.5:1 contrast ratio minimum)
- **Large text (18pt+)**: 3:1 contrast ratio minimum
- **Interactive elements**: Buttons and links must have 4.5:1 contrast ratio for text
- **USWDS colors**: All USWDS semantic colors (success, error, warning, info) are pre-tested for accessibility

### Focus Indicators
- **Keyboard focus**: Visible focus ring on all interactive elements
  - USWDS provides `.usa-focus` class for consistent focus styling
  - Never remove focus indicators with `outline: none` unless providing an equivalent visible alternative
- **Focus management**: When showing modals/alerts, ensure focus moves appropriately
- **Tab order**: Maintain logical tab order through interactive elements

### ARIA Patterns

#### Form Fields

**Labels**
- Use `<label htmlFor={id}>` associated with `id` on the input — this is the standard and most robust approach
- `htmlFor` must point to the **interactive element**, not a hidden element
- `aria-labelledby` can be used in addition but `htmlFor`/`id` should always be present

**Hints / Help Text**
- Render hint with a unique `id`
- Add that `id` to `aria-describedby` on the input
- `aria-describedby` can chain multiple IDs (space-separated) for hint + other descriptions

**Error Messages — Standard Pattern (follow DatePicker's approach)**

The most broadly compatible pattern for WCAG 2.1 AA compliance combines three mechanisms:
1. **`aria-invalid="true"`** on the input when an error is present
2. **Error element ID included in `aria-describedby`** — so the error is re-read when user tabs back to the field
3. **`aria-live="polite"` on the error element** — so the error is announced when it appears

```tsx
<input
  aria-invalid={hasError ? "true" : undefined}
  aria-describedby={hasError ? `${id}-hint ${id}-error` : `${id}-hint`}
/>
<div id={`${id}-error`} aria-live="polite">
  {errorMessage}
</div>
```

Note on `aria-errormessage`: The ARIA spec defines `aria-errormessage` for this purpose, but browser/AT support is still inconsistent as of 2025. **Do not rely on `aria-errormessage` alone** — always include the error ID in `aria-describedby` as well.

**Required Fields**
- Always set the HTML5 `required` attribute on the input element
- Also set `aria-required="true"` for explicit AT communication (some AT handle `required` natively; `aria-required` is belt-and-suspenders)
- Visual required indicator (asterisk) must be in actual text content or a visually-hidden span — **CSS `::after` pseudo-content is not reliably exposed to screen readers**
- Example: `<span className="usa-sr-only">(required)</span>` appended to the label

**Current State of CAMS Components (as of audit)**

| Component | Labels | Hint→describedby | Error→describedby | aria-live on error | aria-invalid | aria-required | Required visual (AT) |
|---|---|---|---|---|---|---|---|
| `Input` | ✓ | ✓ | ✗ | ✓ (custom live region) | ✓ | ✗ | ✗ (CSS only) |
| `ComboBox` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | Partial (* in label) |
| `Radio` | ✗ (points to hidden input) | N/A | N/A | N/A | N/A | ✗ | ✗ |
| `RadioGroup` | ✓ fieldset/legend | N/A | N/A | N/A | N/A | Partial | Partial (unreliable) |
| `Checkbox` | ✓ content | N/A | N/A | N/A | ✗ | ✗ | ✗ |
| `TextArea` | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ (empty span — bug) |
| `DatePicker` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| `DateRangePicker` | ✓ (via DatePicker) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |

**`DatePicker` is the most complete implementation** and should be used as the reference pattern for other components. Several components have known gaps — see issues #19–#25.

#### Buttons
- **Icon-only buttons**: Must include `aria-label` or `title` attribute
  - Example: `<Button aria-label="clear text input">`
  - Prefer `aria-label` that names the specific field: `aria-label="clear case number input"`
- **Button state**: Use `disabled` attribute (not `aria-disabled`) for truly disabled buttons

#### Live Regions
- **Form validation**: Use `aria-live="polite"` on the error message element itself (DatePicker pattern) — more reliable than a separate live region div
- **Alerts**: Use appropriate `role` on alert components:
  - `role="alert"` with `aria-live="assertive"` for errors (USWDS default for `usa-alert--error`)
  - `role="status"` with `aria-live="polite"` for success/info/warning
- **Live region text**: Only update on genuine state changes to avoid over-announcement
- **`aria-atomic="true"`**: Use on live regions that should be read in full when updated

#### Tables

CAMS uses two table approaches:

**USWDS `Table` component** (`lib/components/uswds/Table`): Semantic HTML (`<table>/<thead>/<tbody>/<tr>/<th>/<td>`) with native `scope` on `<th>` elements. Most robustly supported across AT, but cannot support the flex-column responsive layout.

**`CamsTable` component** (`lib/components/cams/CamsTable`): Full ARIA role pattern using `<div>` elements. Required for the flex-column responsive layout. The correct and complete role hierarchy is:
```
role="table"
  role="rowgroup"  (header — CamsTableHeader)
    role="row"
      role="columnheader"  (CamsTableHeaderCell)
  role="rowgroup"  (body — CamsTableBody)
    role="row"  (CamsTableRow)
      role="cell"  (CamsTableCell)
```

**Labeling — required for all tables**
- Every `CamsTable` must have either `caption` or `aria-label` prop (enforced by TypeScript)
- Do not pass both `aria-label` and `caption` — `aria-labelledby` (from caption) will override `aria-label`. Use one or the other.
- When `caption` is provided: rendered as a visible `<div>` and associated via `aria-labelledby`
- When `aria-label` is provided: passed directly to the `role="table"` div

**`data-cell` attribute — required for responsive layout**
- Every `CamsTableCell` in a multi-column table **must** have a `data-cell` attribute
- In mobile/stacked view, the header is visually hidden and `data-cell` provides the only visible column label via CSS `::before` pseudo-element
- Without `data-cell`, column context is completely lost in stacked layout — WCAG 1.3.1 failure
- For action columns with no meaningful label, use `data-cell=""` (empty string suppresses the label)
- Example: `<CamsTableCell data-cell="Case number">091-23-12345</CamsTableCell>`

**Known gaps in CamsTable (see issues #27–#29)**
- No `role="rowheader"` support — cannot identify row-scoping cells
- No `aria-sort` support on `CamsTableHeaderCell` — blocks accessible sort
- Several existing tables are missing `data-cell` attributes

#### Landmarks

**Current CAMS landmark structure (per authenticated page):**
```
<header role="banner">         ← Header.tsx (role="banner" is redundant — <header> implies it)
  <section aria-label="Official website...">  ← Banner.tsx
  <nav aria-label="Main menu"> ← Header nav (role="navigation" is redundant — <nav> implies it)
<main id="main" role="main">   ← MainContent.tsx (role="main" is redundant — <main> implies it)
<footer>                       ← PrivacyActFooter.tsx → role="contentinfo"
```

**Rules for new development:**
- `<main>`: One per page, always via `<MainContent>` wrapper
- `<nav>`: Always include `aria-label` when more than one `<nav>` exists on a page
- `<header>` and `<footer>`: Do NOT add `role="banner"` or `role="contentinfo"` — they are implicit on top-level elements. These explicit roles are redundant and create noise.
- `<section>`: Only use when the section has a meaningful name. Add `aria-label` or `aria-labelledby` to make it a navigable `role="region"` landmark. Otherwise use `<div>` for purely structural grouping.
- `<header>` nested inside another `<header>`: Not allowed — use `<div>` instead
- `<header role="banner">` inside `<main>`: Not allowed — banner must be top-level


### Screen Reader Considerations

#### Decorative Icons
- Always use the `Icon` component (`lib/components/uswds/Icon`) rather than raw `<svg>` elements — it handles `aria-hidden` and `focusable` correctly via its `decorative` prop
- **Decorative icons** (default, `decorative={true}`): `aria-hidden="true"`, no `role`, `focusable={false}`
- **Meaningful icons** (`decorative={false}`): `role="img"`, `aria-label="{name} icon"`, `focusable={false}`
- **Icon inside a button**: If the button has its own `aria-label`, the icon should be decorative (`aria-hidden="true"`). The button's `aria-label` is the accessible name — the icon adds nothing
- **Icon-only buttons**: Must have `aria-label` on the **button**, not just on the icon — the `IconButton` component does not enforce this via the type system, so callers must supply it
- **`focusable={false}`**: Required to prevent legacy browsers (IE/Edge) from focusing SVGs via keyboard. Always set on decorative SVGs.
- Do not add `aria-label` to an SVG without also adding `role="img"` — `aria-label` alone on an SVG is not reliably announced by all screen readers

#### Visually Hidden Text
- **Canonical class**: Use `.usa-sr-only` (USWDS ships this class) — do not use `.screen-reader-only` for new code
- The visually-hidden pattern uses the WCAG-approved clipping technique: `position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap` — this keeps content in the DOM and accessible to screen readers
- **Never use `display: none` or `visibility: hidden`** to hide content that should still be accessible to screen readers — both remove it from the accessibility tree entirely
- `visibility: hidden` is appropriate only when the content should be hidden from both sighted users and screen readers

#### Live Regions and aria-atomic
- **Use dedicated hidden live regions** for announcements — do not place `aria-live` on large visible containers or on `<main>`
  - Correct: `<div role="status" aria-live="polite" aria-atomic="true" className="usa-sr-only">` with text content updated when state changes
  - Wrong: `<main aria-live="polite">` — will announce every DOM mutation across the entire page
  - Wrong: `<div aria-live="polite">` wrapping an entire results section — will announce hundreds of rows
- **Live regions must exist in the DOM before content is injected** — dynamically created live regions may not be recognized. Use persistent containers whose text content changes.
- **`aria-live="polite"` vs `"assertive"`**:
  - `"polite"`: Waits for the user to finish their current action — use for most updates (form validation, result counts, status changes)
  - `"assertive"`: Interrupts immediately — use only for genuinely urgent errors that require immediate attention. Overuse causes noise and frustration.
- **`role="alert"`** carries an implicit `aria-live="assertive"` — do not add both. Use `role="alert"` for urgent errors only, not for informational messages like "No results found" (use `role="status"` instead)
- **`role="status"`** carries an implicit `aria-live="polite"` — use for non-urgent state updates
- **`aria-atomic="true"`**: Add to live regions where the full message should be read as one unit (most announcement regions). Default is `false` which means only the changed portion is announced — usually not what you want for short messages
- **`aria-atomic` is meaningless on non-live elements** — do not add it to `aria-live="off"` containers

---

## Icons

### Icon Library
CAMS uses **USWDS Icon Sprites** (`sprite.svg`)
- Icons are loaded from `/assets/styles/img/sprite.svg#[icon-name]`
- Uses SVG `<use>` pattern for performance and consistency
- Component: `Icon` component in `lib/components/uswds/Icon.tsx`

### Icon Component Usage
```tsx
<Icon name="icon-name" />
<Icon name="close" tooltip="Close this panel" decorative={false} />
```

#### Icon Props
- **name** (required): String name of icon from sprite (e.g., "close", "info", "warning")
- **tooltip**: Optional tooltip text (rendered as `<title>` element)
- **className**: Additional CSS classes
- **focusable**: Boolean, default `false` - whether icon can receive keyboard focus
- **decorative**: Boolean, default `true` - whether icon is decorative only

### Accessibility
- **Decorative icons** (default):
  - `aria-hidden="true"`
  - No `role` attribute
  - `focusable={false}`
  - Use when icon accompanies text or is purely visual

- **Non-decorative icons** (`decorative={false}`):
  - `role="img"`
  - `aria-label="{name} icon"` or use `tooltip` for better description
  - Use when icon conveys meaning on its own

### Icon Usage Patterns
- **With text**: Icon typically appears to the left of text in buttons and labels
- **Icon-only buttons**: Must use `aria-label` on the button itself (not just the icon)
- **Consistency**: Use the same icon for the same action throughout the application
  - Example: "close" icon for dismissing/closing modals and alerts
  - Example: "info" for informational tooltips

### Common USWDS Icons
- **close**: Dismiss buttons, clear inputs
- **info**: Information tooltips, help text
- **warning**: Warning messages
- **error**: Error states
- **check_circle**: Success states, completed items
- **search**: Search input prefix
- **content_copy**: Copy to clipboard (used by `CopyButton`)
- **arrow_upward** / **arrow_downward**: Sort direction indicators
- Additional icons available in USWDS sprite.svg

### Custom Icons (non-USWDS)

Custom icons are defined in `lib/components/cams/RawSvgIcon.tsx` as inline SVG components. These are used exclusively in case detail headers to identify case types in consolidation groups.

| Component | Usage | Accessibility | Notes |
|---|---|---|---|
| `LeadCaseIcon` | Lead case in a consolidation | `<title>` element provides accessible name | Uses `currentColor` |
| `MemberCaseIcon` | Member case in a consolidation | `<title>` element provides accessible name | Uses `currentColor` |
| `TransferredCaseIcon` | Transferred case | `<title>` element provides accessible name | **Hardcodes `#005EA2` and `white`** — cannot be recolored via CSS (see issue #43) |
| `GavelIcon` | Judge name label in case detail header | `aria-label` without `role="img"` — see issue #39 | Font Awesome Free v7.0.0 |

**Custom icon accessibility pattern**:
- Use `<title>` as the first child of the SVG for the accessible name — this is the correct SVG accessibility pattern
- Do not use `aria-label` on an SVG without also adding `role="img"`
- Use `currentColor` for fill so the icon inherits text color from its parent and responds to CSS color changes

---

## Animation & Transitions

### Transition Timing
- Standard duration: [200ms / 300ms]
- Easing: [ease-in-out / cubic-bezier()]

### When to Animate
- Page transitions: [Yes/No]
- Modal open/close: [Fade in / Slide down / etc.]
- Hover states: [Smooth color transitions]
- Loading states: [Spinner animation / Pulse / etc.]



---

## Notes for LLM Assistants

When implementing features in CAMS:

### Component Discovery
1. **Check existing components first**: Use the ui-component-catalog skill to see what's already built
2. **USWDS first**: Look for USWDS components before building custom ones
3. **Existing CAMS components**: Check `user-interface/src/lib/components/` for:
   - `uswds/` - USWDS wrapper components (Button, Input, Alert, Icon, etc.)
   - `cams/` - Custom CAMS components (CamsTable, RichTextEditor, etc.)

### Implementation Guidelines
1. **Default to established patterns**: Unless explicitly asked to create something new, match existing UI patterns
2. **Consistency over novelty**: CAMS values consistency - match what exists even if you think there's a "better" way
3. **Text casing**:
   - Remember: **Title Case** for headers (except in alert messages), buttons, table headers
   - **Sentence case** for labels, body text, error messages
4. **Terminology precision**: Use exact CAMS terms (see Terminology section):
   - "Case Number" not "Case ID"
   - "Staff Assignment" not "Case Assignment"
   - "Verify" not "Approve"
   - "Case Filed Date" not "Filing Date" or "Petition Date"
5. **Error messages**:
   - Clear verb phrases in sentence case
   - Short directives: no period (e.g., "Enter state", "Select trial city")
   - Full sentences: use periods (e.g., "Unable to save changes. Please try again.")
6. **Dates**: Always format as MM/DD/YYYY (or MM/DD/YY when space-constrained)
7. **Currency**: Always show two decimal places ($60.00)
8. **Success/Error alerts**:
   - Position at top of page under header
   - Scroll user to top
   - Include both summary and next steps
   - Use sentence case for headers (exception to Title Case rule)

### When to Ask
- If a guideline doesn't cover your situation, ask rather than assuming


### Domain Context
- **Bankruptcy cases have legal implications**: Be precise with terminology
- **USTP is the client**: United States Trustee Program (internal application)
- **Users are legal professionals**: They know bankruptcy terminology, but UI should still be clear
- **Data accuracy matters**: Field labels and values must be precise and unambiguous

### Accessibility is Not Optional
- All interactive elements must be keyboard accessible
- All form fields must have proper labels and ARIA attributes
- All images and icons must have appropriate alt text or aria-labels
- Color alone cannot convey information
- Focus indicators must always be visible

---

## Document Maintenance

**Last Updated**: 07/02/2026
**Owner**: DOJ CAMS Team
**Feedback**: Submit a pull request with proposed changes — the team will review and discuss before merging
