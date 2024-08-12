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
