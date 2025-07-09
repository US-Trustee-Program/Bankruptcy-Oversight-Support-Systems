# RichTextEditor Enhancement Plan

## Implementation Rules

1. Always follow TDD, YAGNI, KISS, DRY, and implementing code using well define
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

1. [x] Create functionality to determine the formatting state at the current cursor position or for selected text
2. [x] Update toolbar UI to reflect the active formatting states
3. [x] Handle mixed formatting states appropriately

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
   - [x] Manual testing
   - [x] Explicit human approval ("continue")

2. [x] Slice 2: Italic Format Detection at Cursor Position
   - [x] Write unit tests
   - [x] Implement the function
   - [x] Ensure tests pass
   - [x] Manual testing
   - [x] Explicit human approval ("continue")

3. [x] Slice 3: Underline Format Detection at Cursor Position
   - [x] Write unit tests
   - [x] Implement the function
   - [x] Ensure tests pass
   - [x] Manual testing
   - [x] Explicit human approval ("continue")

4. [x] Slice 4: List Format Detection at Cursor Position
   - [x] Write unit tests
   - [x] Implement the function
   - [x] Ensure tests pass
   - [x] Debug list detection issue
     - [x] Fixed issue where content was being placed directly in list elements without proper list item tags
     - [x] Improved insertList method to be more robust in handling different DOM structures
   - [x] Manual testing
   - [x] Explicit human approval ("continue")

5. [x] Slice 5: Format Detection for Text Selection
   - [x] Write unit tests
   - [x] Implement the function
   - [x] Handle mixed formatting detection for selections
   - [x] Ensure tests pass
   - [x] Manual testing
   - [x] Explicit human approval ("continue")

6. [x] Slice 6: UI Update for Format State
   - [x] Write unit tests
   - [x] Implement UI updates
   - [x] Ensure tests pass
   - [x] Manual testing
   - [x] Explicit human approval ("continue")

7. [x] Slice 7: Selection Change Event Handling
   - [x] Write unit tests
   - [x] Implement event listeners
   - [x] Ensure tests pass
   - [x] Manual testing
   - [x] Explicit human approval ("continue")

8. [x] Bug Fix: Exiting Numbered List (Simple)
   - [x] Write test case to reproduce the issue with exiting numbered lists
   - [x] Implement fix for exiting numbered lists when Enter is pressed on an empty list item
   - [x] Consolidated related test files into ListNavigationService.test.ts
   - [x] Moved RichTextEditorEnterKeyBug.test.ts into Editor.test.ts
   - [x] Deleted redundant test files after ensuring all tests pass
   - [x] Ensure tests pass
   - [x] Manual testing and verification
   - [x] Explicit human approval ("continue")

9. [ ] Bug Fix: Formatting Removal Bug (Moderate)
   - [ ] Create specific test cases to reproduce the issue
   - [ ] Analyze the root cause in FormattingService
   - [ ] Implement basic fix for simple formatting removal
   - [ ] Ensure text content is preserved when removing formatting
   - [ ] Ensure tests pass
   - [ ] Manual testing and verification
   - [ ] Explicit human approval ("continue")

10. [ ] Bug Fix: Nested Formatting Issue (Complex)

- [ ] Create test cases for nested formatting scenarios
- [ ] Implement special case detection for toggling formatting off from an entire formatting element
- [ ] Improve text content preservation when replacing formatting elements
- [ ] Enhance removeFormatFromFragment to be more robust in handling nested elements
- [ ] Fix handling of partial formatting selection
- [ ] Ensure all tests pass including FormatBugReproduction tests
- [ ] Manual testing and verification
- [ ] Explicit human approval ("continue")

## Manual Testing Instructions

To test each vertical slice:

1. Build and run the application
2. Navigate to a page with the rich text editor
3. Test the specific functionality for the current slice (instructions will be provided for each slice)
4. Verify the behavior matches the expected outcome
5. Provide explicit "continue" to proceed to the next slice

### Manual Testing for Slice 3: Underline Format Detection

For this slice, we need to verify that the FormatDetectionService correctly detects underline formatting at the cursor position.

1. Build and run the application using:

   ```bash
   npm run dev
   ```

2. Navigate to a page with the rich text editor
3. Place your cursor inside an underlined text element
   - You can create underlined text by selecting some text and pressing Ctrl+U or clicking the Underline button
4. Open the browser's developer tools (F12)
5. In the Console tab, you should see automatic logging of the format state whenever your cursor moves or when text is selected
   - Look for messages starting with "Format state at cursor position:" showing the current formatting state
   - You'll see a boolean value for `underline: true` when inside underlined text, and `underline: false` otherwise
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

7. Verify that formatState.underline is true when the cursor is inside an underlined element
8. Move the cursor to regular (non-underlined) text and verify formatState.underline is false
9. Try selecting text that includes both underlined and non-underlined sections to see the debug information
10. Provide explicit "continue" to proceed to Slice 4 if all tests pass

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

### Manual Testing for Slice 4: List Format Detection

For this slice, we need to verify that the FormatDetectionService correctly detects list formatting (both ordered and unordered) at the cursor position.

1. Build and run the application using:

   ```bash
   npm run dev
   ```

2. Navigate to a page with the rich text editor
3. Create both ordered and unordered lists in the editor
   - You can create lists by clicking the corresponding buttons in the toolbar
   - Create at least one ordered list and one unordered list with multiple items
4. Open the browser's developer tools (F12)
5. Place your cursor inside an unordered list item
6. In the Console tab, you should see automatic logging of the format state whenever your cursor moves or when text is selected
   - Look for messages starting with "Format state at cursor position:" showing the current formatting state
   - You'll see `unorderedList: true` when the cursor is inside an unordered list
   - You'll see `orderedList: false` when the cursor is inside an unordered list
7. Move your cursor to an ordered list item
   - You should see `orderedList: true` in the console
   - You should see `unorderedList: false` in the console
8. Move your cursor to regular text (outside any list)
   - You should see both `orderedList: false` and `unorderedList: false` in the console
9. Try selecting text within a list item and verify the format state shows the correct list type
10. Try selecting text that spans multiple list items or crosses between a list and non-list content
11. You can also manually check the format state by running the following in the console:

    ```javascript
    // Get the editor component instance
    const editor = document.querySelector('#rich-text-editor-content').__reactFiber$;

    // Call getFormatState() method
    const formatState = editor.getFormatState();

    // The format state is automatically logged to the console
    ```

12. Verify that the list formatting detection works correctly in all scenarios
13. Provide explicit "continue" to proceed to Slice 5 if all tests pass

### Debugging List Detection Issue

We've identified that while list detection works correctly in our unit tests, there seems to be an issue with it in the actual browser environment when using the RichTextEditor. Follow these steps to debug the issue:

1. We've added enhanced debugging to the `Editor.handleSelectionChange` method that will print additional diagnostic information about list detection to the console whenever the cursor moves or text is selected:
   - It will show the raw result of finding list elements in the DOM
   - It will compare these results with what's reported in the format state

2. We've created two debugging tools you can use:
   - `list-detection-debug.html`: A standalone HTML file with a simplified editor that you can open in a browser to test list detection in isolation
   - `debug-format-detection.ts`: A utility script that can be imported into your application for on-demand debugging

3. To debug with the standalone HTML tool:
   - Open the `list-detection-debug.html` file in a browser
   - Click inside list items and watch the debug output
   - Use the "Check Format at Cursor" button to manually trigger format detection
   - Toggle between list types and paragraphs to see how the detection works

4. To debug in the actual application:
   - Make sure you have the browser's developer tools console open
   - Place your cursor inside a list item
   - Check the console for logs starting with "List detection debug:"
   - These logs will show whether the issue is with the DOM traversal or with how the format state is being set

5. Key things to check:
   - Confirm the DOM structure is as expected (list items should be direct children of ul/ol elements)
   - Verify that `findClosestAncestor` is correctly identifying list items and their parent lists
   - Check that the format state is being properly updated based on the detection results

After resolving the issue, continue with the manual testing steps for Slice 4 as originally outlined.

## Troubleshooting List Detection

We've discovered an issue where list detection isn't working properly in the browser context despite the tests passing. Here's what we've done to troubleshoot:

### Debugging Tools Created

1. Enhanced debug logging in `FormatDetectionService.isWithinList()` method
   - Added detailed information about node structure
   - Added DOM path tracing for better context
   - Added checks to verify if elements are actually in the DOM

2. Enhanced debug logging in `Editor.handleSelectionChange()`
   - Added more comprehensive selection information
   - Added DOM path tracing
   - Added direct comparison between utilities and service results

3. Created a standalone HTML debug file `direct-list-debug.html`
   - Pure HTML/JS implementation of list detection
   - Allows testing list detection in isolation from React
   - Provides visual debugging information

4. Created a TypeScript debug module `debug-list-detection.ts`
   - Can be imported and used directly in the application
   - Provides comprehensive logging about list detection
   - Highlights any discrepancies between direct checks and the service

### Potential Issues to Investigate

1. **DOM Structure Mismatch**: The actual DOM structure in the browser might differ from what we expect or what's used in tests.

2. **Shadow DOM / React Isolation**: React might be creating isolated DOM contexts that affect how `findClosestAncestor` works.

3. **Root Element Boundaries**: The `root` element reference might not be properly set, causing ancestor checks to fail.

4. **Selection API Differences**: The Selection API might behave differently in the browser compared to JSDOM in tests.

5. **List Implementation Differences**: The actual list implementation in the editor might differ from test expectations.

### Next Steps for Debugging

1. Use the browser console to directly call `debugListDetection()` when the cursor is in a list
2. Compare the DOM structure in the browser with what's expected
3. Check if `findClosestAncestor` is stopping too early at the root boundary
4. Verify that the `root` element reference is correctly set in the browser context
5. Check if the list items are properly nested within list elements

Once we identify the specific issue, we can implement a fix and proceed with manual testing and approval.

## Implementation Notes for Slice 4

### List Detection Fix

The list detection implementation had a defect where the format state was correctly showing list detection in unit tests but not consistently in the browser. After investigating with debug tools, we found that:

1. The list item detection was working correctly (finding `<li>` elements)
2. However, the list type detection (ordered vs unordered) had inconsistencies

The key fixes implemented were:

- **Direct Parent Check**: Added explicit checks for the direct parent element of list items before falling back to ancestor searching:

  ```typescript
  // First check if direct parent matches the list type
  if (directParent?.tagName?.toLowerCase() === listType) {
    listElement = directParent;
  } else {
    // Then try to find an ancestor with the specified list type
    listElement = editorUtilities.findClosestAncestor<HTMLElement>(
      this.root,
      listItemElement,
      listType,
    );
  }
  ```

- **Enhanced Debug Output**: Added comprehensive debugging to show:
  - DOM path from node to root
  - Format state values
  - List structure checks
  - Direct parent relationships

- **Format State Validation**: Added explicit verification that the detected DOM structure matches the reported format state

### Format State Display

- Added more prominent format state display in the console for easier debugging
- Added explicit output of "matchesFormatState" to quickly identify mismatches

### Code Cleanup

Once the implementation was confirmed to be working properly:

- Removed all debugging console logs from FormatDetectionService
- Removed all debugging console logs from Editor class
- Removed the debug event listeners from the Editor class
- Simplified the FormatDetectionService.isWithinList method to focus on core functionality
- Simplified the Editor.getFormatState method to be more direct
- Removed all temporary debug files:
  - debug-list-detection.ts
  - debug-format-detection.ts
  - debug-list-detection.test.ts
  - direct-list-debug.html
  - list-detection-debug.html

### Results

List detection now works correctly in both unit tests and browser contexts:

- Unordered lists correctly report `unorderedList: true`
- Ordered lists correctly report `orderedList: true`
- Format state matches the actual DOM structure
- Code is clean and production-ready

The fix enables proper visual indication of active list formatting in the toolbar, completing Slice 4's requirements.

### Manual Testing for Bug Fix: Nested Formatting Removal

To verify that the nested formatting bug has been fixed:

1. Build and run the application using:

   ```bash
   npm run dev
   ```

2. Navigate to a page with the rich text editor
3. Test the following scenarios:

   **Scenario 1: Simple Bold Toggle**
   - Type some text (e.g., "Test text")
   - Select all of the text
   - Apply bold formatting (Ctrl+B or click Bold button)
   - The text should now be bold
   - Select all of the bold text again
   - Remove bold formatting (Ctrl+B or click Bold button again)
   - Verify the text is no longer bold but is still present

   **Scenario 2: Nested Formatting Bug Test**
   - Type a word (e.g., "Initial")
   - Select the word and make it bold
   - Place cursor at the end of the bold text
   - Type more text (e.g., " text") - now you have "Initial text" with "Initial" being bold
   - Select just the word "text" (not the bold part)
   - Apply underline formatting (Ctrl+U or click Underline button)
   - Type more text inside the underlined section (e.g., " more") - now you have "Initial text more" with "Initial" being bold and "text more" being underlined
   - Select just the word "more"
   - Remove underline formatting (Ctrl+U or click Underline button)
   - Type additional text (e.g., " final") - now you have "Initial text more final" with formatting applied to different parts
   - Select the entire text
   - Remove bold formatting (Ctrl+B or click Bold button)
   - Verify all bold formatting is completely removed (no nested formatting tags)
   - The text should still be "Initial text more final" with only appropriate formatting remaining

4. Open the browser's developer tools (F12)
5. Inspect the HTML structure in the editor to verify there are no nested formatting tags
6. Check that removing formatting properly preserves the text content

If the formatting is properly removed in all scenarios, and no nested tags remain in the HTML structure, the bug has been successfully fixed.

### Manual Testing for Slice 7: Selection Change Event Handling

For this slice, we need to verify that the editor properly updates the toolbar button states when the cursor moves or text is selected.

1. Build and run the application using:

   ```bash
   npm run dev
   ```

2. Navigate to a page with the rich text editor
3. Test the following scenarios:

   **Scenario 1: Cursor Movement Between Formats**
   - Type some text and apply different formatting to different parts:
     - Make some text bold (Ctrl+B or Bold button)
     - Make some text italic (Ctrl+I or Italic button)
     - Make some text underlined (Ctrl+U or Underline button)
   - Move your cursor through the text using arrow keys or mouse clicks
   - Verify that the toolbar buttons update to show the active formatting at the current cursor position:
     - The Bold button should be active (highlighted) when the cursor is in bold text
     - The Italic button should be active when the cursor is in italic text
     - The Underline button should be active when the cursor is in underlined text

   **Scenario 2: Text Selection**
   - Select a range of text that has mixed formatting
   - Verify that the toolbar buttons reflect the formatting of the selected text
   - If the entire selection has bold formatting, the Bold button should be active
   - If only part of the selection has italic formatting, the Italic button should still be active

   **Scenario 3: List Detection**
   - Create both ordered and unordered lists in the editor
   - Click inside different list items
   - Verify that the corresponding list button shows as active when the cursor is inside that list type
   - Move between list types and verify the active button changes accordingly

   **Scenario 4: Performance**
   - Rapidly type text and move the cursor
   - Verify that the UI remains responsive
   - Verify that the format state updates appropriately without excessive performance impact

4. Open the browser's developer tools (F12)
5. In the Console tab, check for any errors related to selection change events
6. Verify that there are no performance warnings or excessive re-renders
7. If all scenarios work correctly and the format state updates reliably when moving the cursor or selecting text, then this slice is complete
8. Provide explicit "continue" to proceed to the next slice
