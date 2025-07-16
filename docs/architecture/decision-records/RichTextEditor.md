# Rich Text Editor

## Context

Users require the ability to add simple formatting to case notes. Currently case notes are free form text only without formatting. The requested formatting includes bold, italic and underlined text. They also request the ability to add hyperlinks to the note body. Stretch goals include ordered and unordered lists.

The existing plain text input solution does not meet the evolving needs of users who need to create more structured and readable case notes with basic formatting capabilities.

## Decision

We evaluated multiple rich text editor solutions including Quill, TipTap, Slate, and an AI-assisted custom written solution. We decided on TipTap due to its headless architecture which enabled us to integrate a mature editor with our own UI implementation faster than the custom written solution using AI agents.

TipTap's headless approach aligns well with our existing frontend architecture and allows us to maintain consistency with our USWDS-compliant design system while leveraging a mature and well-maintained rich text editing engine.

## Status

Accepted

## Consequences

The adoption of TipTap provides several benefits:

- **Faster Implementation**: The headless architecture allowed for quicker integration compared to building a custom solution
- **UI Consistency**: Ability to maintain our USWDS-compliant design system while using a mature editing engine
- **Future Extensibility**: TipTap includes mature features we did not initially enable, providing options for future enhancement should users require additional functionality
- **Maintenance**: Leveraging a well-maintained open-source solution reduces the long-term maintenance burden compared to a custom implementation

Potential considerations include:
- **Bundle Size**: Adding TipTap will increase the frontend bundle size
- **Learning Curve**: Development team will need to become familiar with TipTap's API and extension system
- **Dependency Management**: Ongoing need to keep TipTap updated and monitor for security issues
