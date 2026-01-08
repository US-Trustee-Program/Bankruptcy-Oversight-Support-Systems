# USWDS Component Showcase

A self-contained React application for testing and viewing all USWDS components used in the CAMS project.

## Features

This showcase app displays all USWDS components in one place, including:

- **Alert** - Success, warning, error, and info alerts
- **Accordion** - Expandable content sections
- **Banner** - Site-wide banner component
- **Button** - Various button styles and states
- **ButtonGroup** - Grouped button layouts
- **Card** - Content cards with header, body, and footer
- **Checkbox** - Form checkbox inputs
- **DatePicker** - Single date selection
- **DateRangePicker** - Date range selection
- **FormRequirementsNotice** - Form requirements information
- **Icon** - Icon components
- **Input** - Text input fields
- **Modal** - Modal dialogs
- **Pagination** - Paginated navigation
- **PrivacyActFooter** - Privacy act information footer
- **Radio** - Radio button inputs
- **RadioGroup** - Grouped radio buttons
- **Table** - Data tables
- **Tag** - Label tags
- **TextArea** - Multi-line text inputs

## Running the Showcase

From the project root, run:

```bash
npm run start:uswds:showcase
```

This will start the Vite dev server on port 3001 and automatically open the showcase in your browser.

Alternatively, from within the `test/uswds-showcase` directory:

```bash
npm run dev
```

## Building for Production

To build the showcase app:

```bash
npm run build
```

To preview the production build:

```bash
npm run preview
```

## Project Structure

```
test/uswds-showcase/
├── src/
│   ├── App.tsx          # Main showcase component
│   ├── App.css          # Showcase styling
│   └── main.tsx         # React entry point
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── vite.config.ts       # Vite bundler configuration
```

## Path Aliases

The showcase app uses path aliases to import components from the main user-interface workspace:

- `@/*` maps to `../../user-interface/src/*`

This allows direct importing of USWDS components without copying them into the showcase app.

## Development Notes

- Components are imported directly from the main CAMS user-interface workspace
- The app runs on port 3001 (different from the main app's port 3000)
- Hot module replacement (HMR) is enabled for fast development
- All USWDS styles are loaded from `@uswds/uswds` package
