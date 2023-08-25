# Frontend Design System

## Context

Contractually we are required to use USWDS. The ReactUSWDS Component Library, `react-uswds`, was
developed by the Trussworks team. The ReactUSWDS library provides a large set of components that we
had hoped would make the development of the CAMS system easier. Unfortunately we ran into several
issues with it which made it difficult to use. The components didn't provide enough flexibility in
some cases, and in other cases, provided too many individual non-functional components where one
would have been more useful and maintainable.

In order to comply with our OESA application development, and the need for us to write too many
adapters (where many components were involved). The components also didn't seem to handle CSS
classes well, where it was allowing one to add mutually exclusive CSS classes and not handling them
properly, was also an issue.

We looked at several alternatives and found issues with each, including Comet and the VA.gov Design
System. Comet looked very promissing, yet being that it was a brand new project, we had several
issues building and using it. Comet may be a project to watch for future use, as it also provides
some other useful non-USWDS components for reporting, etc.

At the time of our assesment, it seemed to make the most sense to create our own USWDS components,
as needed, starting with a modal.

## Decision

We made the decision to create our own Components as needed, which so far include some buttons and a
modal, which will comply with USWDS guidelines for accessibility, colors, screen readers, etc.
Colors and other styling related settings will obtain approval from DOJ when implementing.

## Status

Accepted

## Consequences

There was more work involved in getting USWDS setup and working initially. Creating components from
scratch will also require work, though it may not always require extra work.
