# General Requirements for UI Components

## SCSS Name Spacing

SCSS file have a tendency to bleed across various components in the App if not properly name-spaced
to the coponent they are intended to modify. Don’t use element types, i.e. TABLE or UL or SPAN or
worse DIV as the top level qualifier in a scss file. Start the scss file with an element with a
specific class name or id name.
