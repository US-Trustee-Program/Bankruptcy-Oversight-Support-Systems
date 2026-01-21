# General Requirements for UI Components

## SCSS Name Spacing

SCSS files have a tendency to bleed across various components in the App if not properly name-spaced
to the coponent they are intended to modify. Don’t use element types, i.e. TABLE or UL or SPAN or
worse DIV as the top level qualifier in a scss file. Start the scss file with a specific class name
or id name that is assigned to the top level HTML element in the TSX of the component.

For example:

tsx file

```
import './good-css.scss';

function foo() {
  return {
    <DIV className="foo">
      <span>Some element</span>
    </DIV>
  }
}
```

Bad SCSS file

```
span {
  text-decoration: underline;
}
```

Good SCSS file

```
div.foo {
  span {
    text-decoration: underline;
  }
}
```

Using the bad SCSS file would then render all spans throughout the app with underlined text. Using
the name-spaced good version of the file would render only the span in the foo component as
underlined.

SCSS that is needed to cover all UI (the exception to the above), should be placed in App.scss or
index.css

## Heading Tags with Icon Buttons

When displaying icon buttons (edit, add, etc.) on the same line as heading tags (h1, h3), the buttons
must be placed **inside** the heading tag as a child element for proper vertical alignment.

### Correct Pattern

```tsx
<h3>
  Section Title
  <Button uswdsStyle={UswdsButtonStyle.Unstyled}>
    <IconLabel icon="edit" label="Edit" />
  </Button>
</h3>
```

### Incorrect Pattern

```tsx
<!-- ❌ DO NOT DO THIS -->
<div className="title-bar">
  <h3>Section Title</h3>
  <Button uswdsStyle={UswdsButtonStyle.Unstyled}>
    <IconLabel icon="edit" label="Edit" />
  </Button>
</div>
```

### Rationale

Placing the button inside the heading tag ensures proper vertical alignment between the text and icon
button without requiring additional CSS adjustments. This pattern is used consistently throughout the
application in:
- Trustee detail panels (Attorney, Paralegal, Auditor assignments)
- 341 Meeting information cards
- Other record detail cards with inline edit buttons
