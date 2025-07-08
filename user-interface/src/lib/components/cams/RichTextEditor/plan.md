# RichTextEditor Enhancement Plan

## Implementation Rules

1. Always follow TDD, YAGNI, KISS, and self-documenting code using well defined names.
2. Always ask questions if there are unclear requirements or multiple implementation options.
3. Write implementation according to the concept of vertical slices — each implementation should allow the end user to accomplish a small task in the browser.
4. Implementation steps for each feature:
   - Read plan.md
   - Write unit tests
   - Implement code
   - Ensure tests pass
   - Prompt for manual testing
   - Wait for further instructions
   - Update plan.md checklists to mark completion
   - Start next step or goal

## Overview

This plan outlines the enhancements to be made to the RichTextEditor.tsx component to support showing active formatting states in the toolbar buttons. Currently, the editor allows for text formatting (bold, italic, underline) and list creation (ordered and unordered), but there's no visual indication in the toolbar of which formatting is currently active at the cursor position or for selected text.

## Current Functionality

- Rich text formatting: bold, italic, underline
- List creation: ordered and unordered lists
- Formatting can be applied via keyboard shortcuts or toolbar buttons
- Formatting can span within text blocks and overlap across different text nodes

## Enhancement Goals

1. [ ] Create functionality to determine the formatting state at the current cursor position or for selected text
2. [ ] Update toolbar UI to reflect the active formatting states
3. [ ] Handle mixed formatting states appropriately

## Step 1: Format Detection Function

Create a function that determines the formatting state at the current cursor position or for selected text:

```typescript
/**
 * Determines the formatting state at the current cursor position or for selected text
 * @returns An object containing boolean values for each formatting type
 */
function getFormatState(): FormatState {
  // Implementation details here
  // Should return something like: { bold: boolean, italic: boolean, underline: boolean, orderedList: boolean, unorderedList: boolean }
}
```

### Requirements

- The function should detect if text is bold, italic, underlined, or part of a list
- It should handle both cursor positions (no selection) and text selections
- It should work with the existing data structure of the editor

## Step 2: Handle Mixed Formatting

Enhance the format detection function to handle mixed formatting across a selection:

- If a selection contains text with inconsistent formatting (e.g., partially bold), that format should be considered "inactive"
- Only formats that apply to the entire selection should be considered "active"
- For cursor positions (no selection), determine the format based on either:
  - The formatting that would be applied to new text typed at that position, or
  - The formatting of the character immediately before the cursor

### Implementation Considerations

- We need to traverse the DOM structure or internal representation of the formatted text
- We need to compare formatting across the entire selection
- Edge cases to handle: empty selections, selections spanning multiple formatting nodes, etc.

## Step 3: Update UI Based on Format State

Modify the toolbar buttons to reflect the active formatting:

- Add active/inactive states to formatting buttons
- Update button states whenever the selection or cursor position changes
- Ensure UI stays in sync with the actual formatting

## Implementation Checklist

1. [ ] Examine the current implementation of RichTextEditor.tsx to understand its internal representation of formatted text
2. [ ] Implement the format detection function (getFormatState)
   - [ ] Write unit tests
   - [ ] Implement the function
   - [ ] Ensure tests pass
   - [ ] Manual testing
3. [ ] Add logic to handle mixed formatting states
   - [ ] Write unit tests
   - [ ] Implement the functionality
   - [ ] Ensure tests pass
   - [ ] Manual testing
4. [ ] Update toolbar UI components to consume and display the format state
   - [ ] Write unit tests
   - [ ] Implement the UI updates
   - [ ] Ensure tests pass
   - [ ] Manual testing
5. [ ] Add event listeners for cursor movement and selection changes to update the formatting state
   - [ ] Write unit tests
   - [ ] Implement the event listeners
   - [ ] Ensure tests pass
   - [ ] Manual testing
6. [ ] Test with various selection scenarios to ensure accurate reporting of format states

## Technical Considerations

- Performance: Format detection should be efficient, especially for large text selections
- Reactivity: Format state should update immediately when selection changes
- Browser compatibility: Ensure consistent behavior across browsers

## Progress Tracking

### Current Step

- Working on: Examining the current implementation of RichTextEditor.tsx

### Completed Work

- None yet

### Key Findings

- None yet

### Questions / Decisions

- None yet
