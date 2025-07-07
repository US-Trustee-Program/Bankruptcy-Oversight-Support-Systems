# Basic Formatting - Narrow Vertical Slices Implementation Plan

This document outlines the implementation of the "Basic Formatting" slice using narrow vertical
slices. Each slice delivers a minimal but complete user-facing feature that touches all layers of
the system, building incrementally toward the full text formatting functionality.

## Overview

The "Basic Formatting" slice from the main plan is broken down into 5 narrow vertical slices, each
delivering a working feature that users can interact with:

1. **Format State Detection** - Track and detect formatting state
2. **Bold Text Toggle** - Apply/remove bold formatting to selected text
3. **Italic Text Toggle** - Apply/remove italic formatting to selected text
4. **Underline Text Toggle** - Apply/remove underline formatting to selected text
5. **Keyboard Shortcuts** - Support for standard formatting keyboard shortcuts

Each slice follows the vertical slice principle: it touches all architectural layers (VDOM model,
Editor core, React component) and delivers working functionality.

## Slice 1: Format State Detection

**Goal**: Detect and track the formatting state of the current selection

**User Story**: As a user, I can see the formatting state of my current text selection

**Components to implement**:

- [x] **VDOM Foundation**:

  - [x] Enhanced `VDOMSelection.ts` to track format state
  - [x] Format detection logic in `VDOMFormatting.ts`

- [x] **Core Editor**:

  - [x] Format state tracking in `Editor.ts`
  - [x] Format state change notification via callback

- [x] **React Component**:

  - [x] Add a toolbar above the edit field but within the same component as the edit field.
  - [x] Use the RichTextButton.tsx and RichTextIcon.tsx components to create buttons for the bold,
        italic, and underline functionality.
  - [x] The styling for the buttons that is specific to this use case, whould be within it's own
        file (such as the RichTextEditor.scss file).
  - [x] The bold button should not have an icon but should have a capital letter B as it's content.
        The letter B should have css (defined within RichTextEditor.scss file) to add bold styling
        to the text in the button.
  - [x] The italic button should not have an icon but should have a capital letter I as it's
        content. The letter I should have css to add em (emphasis, italic) styling to the text in
        the button.
  - [x] The underline button should not have an icon but should have a capital letter U as it's
        content. The letter U shouild have css to add text underline styling to the text in the
        button.
  - [x] Format state visualization in toolbar buttons
  - [x] Format state update on selection change

- **Steps to Proceed**

  - [x] Implement initial formatting functionality
  - [x] Add debug logging to trace formatting function calls
  - [x] Pause to allow the developer (user) to manually test the changes in a browser.
  - [x] Fixed linting errors in Editor.ts
  - [x] Wait for the developer to say "continue" before proceeding.
  - [x] Stop often to discuss with the human developer what AI would like to do. Get approval from
        developer.

- [x] **Tests**:
  - [x] Unit test for format state detection
  - [x] Unit test for format state tracking
  - [x] Integration test for format state UI updates
  - [x] Debug logging to verify keyboard shortcuts functionality

**Acceptance Criteria**:

- [x] When selecting bold text, the bold button appears active
- [x] When selecting italic text, the italic button appears active
- [x] When selecting underlined text, the underline button appears active
- [x] When selecting mixed formatting, the appropriate buttons show the mixed state
- [x] Both Ctrl+B (Windows) and Cmd+B (Mac) keyboard shortcuts toggle bold formatting

## Slice 2: Bold Text Toggle

**Goal**: Toggle bold formatting on selected text

**User Story**: As a user, I can make text bold or unbold text by clicking a button

**Components to implement**:

- [x] **VDOM Operations**:

  - [x] Bold formatting in `VDOMFormatting.ts`
  - [x] Text node splitting for partial formatting

- [x] **Core Editor**:

  - [x] Bold command handling via FSM
  - [x] Keyboard shortcut support for Ctrl+B (primary) and Cmd+B (on Mac)
  - [x] Direct processing of `TOGGLE_BOLD` commands through FSM
  - [x] Fixed linting errors in Editor.ts

- [x] **React Component**:

  - [x] Bold button implementation
  - [x] Button click handling for bold

- **Steps to Proceed**

  - [ ] Implement 1 step
  - [ ] Pause to allow the developer (user) to manually test the changes in a browser.
  - [ ] Wait for the developer to say "continue" before proceeding.
  - [ ] Stop often to discuss with the human developer what AI would like to do. Get approval from
        developer.

- [x] **Tests**:
  - [x] Unit test for bold formatting operation
  - [x] Unit test for keyboard shortcut (Ctrl+B) handling
  - [ ] Integration test for bold button click

**Acceptance Criteria**:

- [x] Pressing Ctrl+B (Cmd+B on Mac) toggles bold formatting through FSM
- [x] Bold formatting operations are processed by the FSM using `toggleBoldInSelection`
- [ ] Clicking the bold button when text is selected makes the text bold
- [ ] Clicking the bold button when bold text is selected makes the text normal
- [ ] Bold formatting is preserved when editing text
- [ ] Bold formatting is properly displayed in the editor

**Implementation Notes**:

The Editor has been refactored to handle formatting commands directly through the FSM rather than
having dedicated methods like `toggleBold()`. Keyboard shortcuts (like Ctrl+B) are processed in
`handleKeyDown()` and converted to FSM commands (`TOGGLE_BOLD`), which then delegate to the
formatting functions in `VDOMFormatting.ts`.

## Slice 3: Italic Text Toggle

**Goal**: Toggle italic formatting on selected text

**User Story**: As a user, I can make text italic or remove italic formatting by clicking a button

**Components to implement**:

- [ ] **VDOM Operations**:

  - [ ] Italic formatting in `VDOMFormatting.ts`
  - [ ] Text node handling for mixed formatting

- [ ] **Core Editor**:

  - [ ] `toggleItalic()` method
  - [ ] Italic command handling

- [ ] **React Component**:

  - [ ] Italic button implementation
  - [ ] Button click handling for italic

- **Steps to Proceed**

  - [ ] Implement 1 step
  - [ ] Pause to allow the developer (user) to manually test the changes in a browser.
  - [ ] Wait for the developer to say "continue" before proceeding.
  - [ ] Stop often to discuss with the human developer what AI would like to do. Get approval from
        developer.

- [ ] **Tests**:
  - [ ] Unit test for italic formatting operation
  - [ ] Unit test for italic toggle command
  - [ ] Integration test for italic button click

**Acceptance Criteria**:

- Clicking the italic button when text is selected makes the text italic
- Clicking the italic button when italic text is selected makes the text normal
- Italic formatting is preserved when editing text
- Italic formatting is properly displayed in the editor

## Slice 4: Underline Text Toggle

**Goal**: Toggle underline formatting on selected text

**User Story**: As a user, I can underline text or remove underlining by clicking a button

**Components to implement**:

- [ ] **VDOM Operations**:

  - [ ] Underline formatting in `VDOMFormatting.ts`
  - [ ] Text node handling for mixed formatting

- [ ] **Core Editor**:

  - [ ] `toggleUnderline()` method
  - [ ] Underline command handling

- [ ] **React Component**:

  - [ ] Underline button implementation
  - [ ] Button click handling for underline

- **Steps to Proceed**

  - [ ] Implement 1 step
  - [ ] Pause to allow the developer (user) to manually test the changes in a browser.
  - [ ] Wait for the developer to say "continue" before proceeding.
  - [ ] Stop often to discuss with the human developer what AI would like to do. Get approval from
        developer.

- [ ] **Tests**:
  - [ ] Unit test for underline formatting operation
  - [ ] Unit test for underline toggle command
  - [ ] Integration test for underline button click

**Acceptance Criteria**:

- Clicking the underline button when text is selected makes the text underlined
- Clicking the underline button when underlined text is selected removes the underlining
- Underline formatting is preserved when editing text
- Underline formatting is properly displayed in the editor

## Slice 5: Keyboard Shortcuts

**Goal**: Support keyboard shortcuts for formatting operations

**User Story**: As a user, I can use standard keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U) to format
text. Mac keyboard will use Cmd+B, Cmd+I and Cmd+U and will work identical, and even call the same
functions, as the ctrl commands.

**Components to implement**:

- [x] **Core Editor**:

  - [x] Keyboard shortcut mapping for Ctrl+B (implemented)
  - [ ] Keyboard shortcut mapping for Ctrl+I (Cmd+I on Mac)
  - [ ] Keyboard shortcut mapping for Ctrl+U (Cmd+U on Mac)
  - [x] Shortcut command routing through FSM

- [ ] **React Component**:

  - [x] Key event handling for Ctrl+B shortcut (implemented)
  - [ ] Key event handling for additional shortcuts
  - [x] Prevention of browser default behavior for shortcuts

- **Steps to Proceed**

  - [ ] Implement 1 step
  - [ ] Pause to allow the developer (user) to manually test the changes in a browser.
  - [ ] Wait for the developer to say "continue" before proceeding.
  - [ ] Stop often to discuss with the human developer what AI would like to do. Get approval from
        developer.

- [x] **Tests**:
  - [x] Unit test for keyboard shortcut handling (Ctrl+B implemented)
  - [ ] Integration test for each additional shortcut (Ctrl+I, Ctrl+U)

**Acceptance Criteria**:

- [x] Pressing Ctrl+B (Cmd+B on Mac) toggles bold formatting
- [ ] Pressing Ctrl+I (Cmd+I on Mac) toggles italic formatting
- [ ] Pressing Ctrl+U (Cmd+U on Mac) toggles underline formatting
- [x] Browser's default behavior for these shortcuts is prevented

**Implementation Notes**:

Keyboard shortcuts are handled in the Editor's `handleKeyDown()` method and converted to FSM
commands. The implementation follows the same pattern as the bold toggle:

1. Detect the key combination (e.g., `event.ctrlKey && event.key === 'b'`)
2. Prevent default browser behavior with `event.preventDefault()`
3. Create an FSM command (e.g., `{ type: 'TOGGLE_BOLD' }`)
4. Process the command through `this.fsm.processCommand()`

## Implementation Notes

### Testing Guidelines

- **Running Tests**:
  - To run all tests: `npm test`
  - To run specific test file: `npm test -- path/to/file/test.test.ts`
  - Example:
    `npm test -- src/lib/components/cams/RichTextEditor2/core/model/VDOMFormatting.new.test.ts`
  - When tests fail, check for:
    - Mock implementation issues (ensure mocks match imported names)
    - Type errors (avoid using 'any' type in tests)
    - Unused variables (remove or use them)

### Format State and Functionality

- Format state detection (Slice 1) must include the foundation for actually applying formats
- A working implementation of formatting functionality is required before completing Slice 2
- Text node splitting for partial formatting should be implemented early to avoid significant
  refactoring later
- Formatting must work properly within the context of paragraphs/nodes from Slice 2 of the main plan
- The ability to format a selection across multiple paragraphs is essential

### Implementation Order

1. The formatting functionality should be implemented as soon as possible, before any content
   structure work
2. Partial formatting (applying formatting to part of a text node) should not be deferred too long
3. Stop after each formatting slice and wait for approval before continuing. The human developer
   would like to manually test each change in a browser.
4. Complete all formatting slices (1-5) before moving on to the main plan's Slice 3 implementation

### UI/UX Guidelines

- Button styling for format states:
  - All buttons should have consistent unselected styling (light gray background, dark text)
  - All buttons should have consistent selected styling (dark background, light text)
  - Selected state should change both button and text color
  - Ensure high contrast between text and button background for accessibility (WCAG 2.1 AA
    compliance)
  - The visual difference between selected/unselected should be clearly distinguishable
  - Buttons should maintain accessibility when in selected/unselected states

### VDOM Structure

- No specific VDOM structure is required as long as it renders correctly in the DOM
- The implementation should focus on correct functionality rather than specific structure
- The VDOM structure should support robust formatting capabilities without enforcing a specific
  approach

## Implementation Strategy

### Development Approach

1. **Test-Driven Development**: Write failing tests first, implement minimal code to pass
2. **One Slice at a Time**: Complete each slice fully before moving to the next
3. **Human user check and approval**: Human user has opportunity to test in browser and approval
   before continuing.
4. **Incremental Refinement**: Each slice may require refactoring previous components

### Implementation Order and Dependencies

1. We must complete formatting functionality before moving to Slice 3 of the main plan
2. The implementation order of slices within this plan should be:

   - Slice 1: Format State Detection - Implement first to enable button UI and foundation
   - Slice 2-4: Formatting Toggles - Implement all together as a cohesive feature
   - Slice 5: Keyboard Shortcuts - Implement last after all toggles are working

3. Since format state detection and paragraph structure are interdependent, we'll ensure formatting
   works correctly with existing paragraph nodes and across paragraph boundaries.

### Architectural Principles

- **Vertical Integration**: Each slice touches VDOM, Editor, and React layers
- **Minimal Viable Feature**: Each slice delivers the smallest possible working feature
- **Progressive Enhancement**: Later slices build on and enhance earlier implementations

### Quality Gates

- All tests must pass before moving to next slice
- Each slice must be demonstrable to users
- Code must maintain type safety throughout
- No slice should break functionality from previous slices
- Formatting operations must work seamlessly across paragraphs and with different text structures

## Benefits of This Approach

1. **Rapid Feedback**: Users can interact with working features immediately
2. **Risk Reduction**: Problems are discovered early in small, manageable pieces
3. **Clear Progress**: Each slice represents tangible progress toward the goal
4. **Flexible Prioritization**: Slices can be reordered based on user feedback
5. **Easier Testing**: Small, focused functionality is easier to test thoroughly

## Implementation Path Summary

1. **Phase 1: Foundation (Slice 1)**

   - Implement toolbar UI with buttons for bold, italic, underline
   - Add format state detection and visualization
   - Establish format state tracking in Editor

2. **Phase 2: Basic Formatting (Slices 2-4)**

   - Implement bold, italic, underline toggle operations in VDOM
   - Add format command handling in Editor
   - Connect UI buttons to formatting operations

3. **Phase 3: Enhancement (Slice 5)**
   - Add keyboard shortcut support
   - Final polish and optimization
   - Ensure cross-browser compatibility

Each phase delivers incremental, working functionality to users while building toward the complete
formatting solution.

## Next Steps

1. Begin with Slice 1: Format State Detection
2. Implement using TDD approach
3. Validate each slice with both unit and integration tests
4. Demonstrate working functionality before proceeding to next slice

## Relation to Main Plan

This formatting plan implements Slice 3 (Basic Formatting) from the main editor plan. Key
integration points:

1. **Dependency on Slices 1-2**: Formatting builds on the basic text input and paragraph operations
2. **Prerequisite for Slices 4-7**: Other features like undo/redo and list support will need to
   handle formatted text
3. **Implementation Priority**: Formatting should be fully implemented before moving to Slice 4
   (Undo/Redo)

## Technical Implementation Checklist

Based on review of the existing code, we need to implement:

1. **Format Persistence**: ✅ Text formatting must persist across operations like paragraph splits,
   deletions, and merges
2. **Multi-paragraph Formatting**: ✅ Users should be able to format selections that span multiple
   paragraphs
3. **Mixed Formatting**: ✅ The system should handle mixed formatting within a selection correctly
4. **DOM Rendering**: ✅ Formatted text must render correctly in the contentEditable DOM element
5. **Format Toggling Logic**: ✅ The toggle behavior should follow standard word processor conventions

### Implementation Guidelines

1. **YAGNI Principle**: Follow the "You Aren't Gonna Need It" principle - don't add functionality
   until it's necessary. Remove unused parameters, avoid speculative code, and implement only what's
   needed for the current slice.
2. **Progressive Enhancement**: Implement features incrementally, ensuring each step is fully
   functional before moving to the next.
3. **Test-Driven Development**: Write tests before or alongside implementation code to ensure
   correctness.
4. **Human Validation**: Pause for human review and manual testing after each significant change.

### Implementation Tasks

1. **VDOMFormatting.ts** (Implemented)

   - ✅ Implemented `getNodeFormatState` function for format detection
   - ✅ Implemented `getFormattingAtSelection` function
   - ✅ Implemented `toggleBoldInSelection` function for bold formatting
   - ✅ Added text node splitting for partial formatting
   - ✅ Implemented `toggleItalicInSelection` function for italic formatting
   - ✅ Implemented `toggleUnderlineInSelection` function for underline formatting

2. **VDOMSelection.ts** (Implemented)

   - ✅ Updated `getFormattingAtSelection` function to correctly detect formatting in selection
   - ✅ Added support for detecting mixed formatting states (partially formatted)

3. **Editor.ts** (Implemented)

   - ✅ Added format state tracking and notification via callbacks
   - ✅ Updated command handling for bold operations
   - ✅ Updated command handling for italic operations
   - ✅ Updated command handling for underline operations
   - ✅ Implemented keyboard shortcut handling for formatting commands

4. **RichTextEditor.tsx** (Partially Implemented)

   - ✅ Added format button UI implementation
   - ✅ Added click handlers for format operations
   - ✅ Added format state visualization
   - ✅ Implemented keyboard shortcut handling

5. **Tests** (Partially Implemented)
   - ✅ Added tests for format state detection
   - ✅ Added tests for bold formatting operation
   - ✅ Added tests for italic formatting operation
   - ✅ Added tests for underline formatting operation
   - ✅ Added tests for keyboard shortcuts
   - [ ] Add more comprehensive tests for edge cases like mixed formatting
