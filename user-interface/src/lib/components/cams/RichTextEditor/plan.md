# RichTextEditor Enhancement Plan

## Implementation Rules

1. Always follow TDD, YAGNI, KISS, DRY, and self-documenting code using well defined names.
2. Always ask questions if there are unclear requirements or multiple implementation options.
3. Write implementation according to the concept of vertical slices — each implementation should allow the end user to accomplish a small task in the browser.
4. Each vertical slice must be completed fully and tested before moving to the next slice.
5. After each vertical slice is completed, prompt the human for manual testing and explicit approval.
6. Only proceed to the next slice after receiving an explicit "continue" from the human.
7. Implementation steps for each slice:
   - Read plan.md to understand the current slice goal
   - Write unit tests for the slice
   - Do not ever use 'any' type.  Do not cast to 'any'.
   - Only use 'unknown' type if absolutely necessary.
   - Implement code for the slice
   - Ensure tests pass
   - Tests should use vitest framework
   - Prompt for manual testing
   - Update plan.md to reflect progress
   - Wait for explicit "continue" response before starting the next slice

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

## Vertical Slices

### Slice 1: Bold Format Detection at Cursor Position

- Create FormatDetectionService with initial implementation for bold format detection
- Implement getFormatState() that returns only bold state for cursor position
- Add unit tests for this functionality
- Update Editor.ts to use this service
- Document progress and prompt for manual testing and approval

### Slice 2: Italic Format Detection at Cursor Position

- Extend FormatDetectionService to detect italic formatting
- Update unit tests for this functionality
- Update Editor.ts as needed
- Document progress and prompt for manual testing and approval

### Slice 3: Underline Format Detection at Cursor Position

- Extend FormatDetectionService to detect underline formatting
- Update unit tests for this functionality
- Update Editor.ts as needed
- Document progress and prompt for manual testing and approval

### Slice 4: List Format Detection at Cursor Position

- Extend FormatDetectionService to detect ordered and unordered lists
- Update unit tests for this functionality
- Update Editor.ts as needed
- Document progress and prompt for manual testing and approval

### Slice 5: Format Detection for Text Selection

- Extend FormatDetectionService to handle text selections
- Add handling for mixed formatting states
- Update unit tests for this functionality
- Update Editor.ts as needed
- Document progress and prompt for manual testing and approval

### Slice 6: UI Update for Format State

- Update RichTextButton.tsx to display active state
- Add CSS for active button state
- Update RichTextEditor.tsx to pass format state to buttons
- Add unit tests for UI components
- Document progress and prompt for manual testing and approval

### Slice 7: Selection Change Event Handling

- Add event listeners for cursor movement and selection changes
- Ensure format state updates on selection/cursor changes
- Add unit tests for this functionality
- Document progress and prompt for manual testing and approval

## Implementation Checklist

Each slice must complete the following before moving to the next:

1. [x] Slice 1: Bold Format Detection at Cursor Position
   - [x] Write unit tests for FormatDetectionService
   - [x] Implement FormatDetectionService for bold detection
   - [x] Update Editor.ts to use FormatDetectionService
   - [x] Add tests for Editor.getFormatState
   - [x] Ensure all tests pass
   - [x] Fix bug with text selection format detection
   - [ ] Manual testing
   - [ ] Explicit human approval ("continue")

2. [ ] Slice 2: Italic Format Detection at Cursor Position
   - [ ] Write unit tests
   - [ ] Implement the function
   - [ ] Ensure tests pass
   - [ ] Manual testing
   - [ ] Explicit human approval ("continue")

3. [ ] Slice 3: Underline Format Detection at Cursor Position
   - [ ] Write unit tests
   - [ ] Implement the function
   - [ ] Ensure tests pass
   - [ ] Manual testing
   - [ ] Explicit human approval ("continue")

4. [ ] Slice 4: List Format Detection at Cursor Position
   - [ ] Write unit tests
   - [ ] Implement the function
   - [ ] Ensure tests pass
   - [ ] Manual testing
   - [ ] Explicit human approval ("continue")

5. [ ] Slice 5: Format Detection for Text Selection
   - [ ] Write unit tests
   - [ ] Implement the function
   - [ ] Ensure tests pass
   - [ ] Manual testing
   - [ ] Explicit human approval ("continue")

6. [ ] Slice 6: UI Update for Format State
   - [ ] Write unit tests
   - [ ] Implement UI updates
   - [ ] Ensure tests pass
   - [ ] Manual testing
   - [ ] Explicit human approval ("continue")

7. [ ] Slice 7: Selection Change Event Handling
   - [ ] Write unit tests
   - [ ] Implement event listeners
   - [ ] Ensure tests pass
   - [ ] Manual testing
   - [ ] Explicit human approval ("continue")

## Manual Testing Instructions

To test each vertical slice:

1. Build and run the application
2. Navigate to a page with the rich text editor
3. Test the specific functionality for the current slice (instructions will be provided for each slice)
4. Verify the behavior matches the expected outcome
5. Provide explicit "continue" to proceed to the next slice

### Manual Testing for Slice 1: Bold Format Detection

For this slice, we need to verify that the FormatDetectionService correctly detects bold formatting at the cursor position.

1. Build and run the application using:

   ```bash
   npm run dev
   ```

2. Navigate to a page with the rich text editor
3. Place your cursor inside a bold text element
   - You can create bold text by selecting some text and pressing Ctrl+B or clicking the Bold button
4. Open the browser's developer tools (F12)
5. In the Console tab, you should see automatic logging of the format state whenever your cursor moves or when text is selected
   - Look for messages starting with "Format state at cursor position:" showing the current formatting state
   - You'll see a boolean value for `bold: true` when inside bold text, and `bold: false` otherwise
   - You'll also see additional information about the cursor position:
     - If text is selected: "Text selection detected:" with details about the selection range
     - If it's just a cursor position: "Cursor position:" with container, parentElement, and offset information

6. You can also manually check the format state by running the following in the console:

   ```javascript
   // Get the editor component instance
   const editor = document.querySelector('#rich-text-editor-content').__reactFiber$;

   // Call getFormatState() method
   const formatState = editor.getFormatState();

   // The format state is automatically logged to the console
   ```

7. Verify that formatState.bold is true when the cursor is inside a bold element
8. Move the cursor to regular (non-bold) text and verify formatState.bold is false
9. Try selecting text that includes both bold and non-bold sections to see the debug information
10. Provide explicit "continue" to proceed to Slice 2 if all tests pass

### Technical Considerations

- Performance: Format detection should be efficient, especially for large text selections
- Reactivity: Format state should update immediately when selection changes
- Browser compatibility: Ensure consistent behavior across browsers

## Progress Tracking

### Current Step

- Completed implementation of Slice 1: Bold Format Detection at Cursor Position
- All automated tests pass successfully
- Awaiting manual testing and human approval before proceeding to Slice 2

### Completed Work

1. Created FormatDetectionService with an implementation for bold format detection
   - Implemented getFormatState() method that returns bold status at cursor position
   - Added unit tests covering various cases for bold format detection
   - Setup FormatState interface with all format types we'll implement
   - Fixed text selection format detection to properly report bold state

2. Updated Editor class to use FormatDetectionService
   - Added public getFormatState() method that delegates to FormatDetectionService
   - Added unit tests to verify proper delegation
   - Added debug console logging for format state and cursor/selection information

### Key Findings

1. **Current Architecture**:
   - The main `RichTextEditor` component (React) uses an `Editor` class for core rich text functionality
   - The `Editor` class delegates to specialized services:
     - `FormattingService`: Handles text formatting (bold, italic, underline)
     - `ListService`: Handles list creation and management
     - `SelectionService`: Abstraction for browser selection operations
     - `NormalizationService`: Cleans up and normalizes the HTML structure
     - `FormatDetectionService`: Detects formatting at cursor position or in selected text

2. **Formatting Implementation**:
   - Bold is implemented with `<strong>` tags
   - Italic is implemented with `<em>` tags
   - Underline is implemented with `<span class="underline">` elements
   - Formats can be nested (e.g., bold text inside italic text)
   - Formats can be toggled on/off via toolbar buttons or keyboard shortcuts

3. **Selection Management**:
   - Uses browser's Selection and Range APIs
   - `SelectionService` provides an abstraction layer over browser-specific selection features

4. **Component Scoping**:
   - Each `RichTextEditor` instance creates its own isolated editor ecosystem:
     - Individual `Editor` instance
     - Individual service instances (FormatDetectionService, FormattingService, etc.)
     - Individual root element reference (contentRef)
   - Proper boundary enforcement:
     - The `findClosestAncestor` function explicitly stops traversal at the root element boundary
     - Format detection is properly scoped to check only within the bounds of its root element
     - Multiple editor instances on the same page will operate independently
   - This ensures that operations like format detection, toggling formatting, and list management
     are properly isolated to the correct editor component even when multiple editors exist on the page
