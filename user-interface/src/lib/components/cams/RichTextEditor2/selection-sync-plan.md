# Basic Text Input & Display - Narrow Vertical Slices Implementation Plan

This document outlines the implementation of the "Basic Text Input & Display" slice using narrow vertical slices. Each slice delivers a minimal but complete user-facing feature that touches all layers of the system, building incrementally toward the full functionality.

## Overview

The "Basic Text Input & Display" slice from the main plan is broken down into 5 narrow vertical slices, each delivering a working feature that users can interact with:

1. **Static Text Display** - Display pre-defined text content
2. **Single Character Input** - Type one character and see it displayed
3. **Text String Input** - Type multiple characters and see them displayed
4. **Basic Text Deletion** - Delete characters using backspace
5. **Cursor Position Tracking** - Visual cursor positioning and basic selection

Each slice follows the vertical slice principle: it touches all architectural layers (VDOM model, Editor core, React component) and delivers working functionality.

## Slice 1: Static Text Display

**Goal**: Display a hardcoded paragraph of text in the editor

**User Story**: As a user, I can see text content displayed in the editor area

**Components to implement**:

- [x] **VDOM Foundation**:
  - [x] Minimal `VDOMNode.ts` with paragraph and text node types only
  - [x] Basic `VDOMToHTML.ts` to convert VDOM to displayable HTML
- [x] **Core Editor**:
  - [x] Minimal `Editor.ts` class with hardcoded content
  - [x] `getContent()` method returning HTML string (as `getHtml()` in the implementation)
- [x] **React Component**:
  - [x] Basic `RichTextEditor.tsx` with contentEditable div
  - [x] Display content from Editor via dangerouslySetInnerHTML
- [x] **Tests**:
  - [x] Unit test for VDOMNode creation
  - [x] Unit test for VDOMToHTML conversion
  - [x] Unit test for Editor.getContent()
  - [x] Integration test for component rendering

**Acceptance Criteria**:

- [x] Editor displays "Hello, World!" text
- [x] Text is properly formatted as a paragraph
- [x] Component renders without errors

## Slice 2: Single Character Input ✓

**Goal**: Type one character and see it replace the existing content

**User Story**: As a user, I can type a single character and see it displayed

**Components to implement**:

- [x] **VDOM Operations**:
  - [x] Basic text replacement in `VDOMMutations.ts`
  - [x] Simple cursor position tracking in `VDOMSelection.ts`
- [x] **Core Editor**:
  - [x] `insertText(char: string)` method
  - [x] Content change notification via callback
- [x] **React Component**:
  - [x] `onInput` event handler (implemented as beforeinput in Editor.ts)
  - [x] Character extraction from input event
  - [x] Content update and re-render
- [x] **Tests**:
  - [x] Unit test for text insertion mutation
  - [x] Unit test for Editor.insertText()
  - [x] Integration test for typing one character

**Acceptance Criteria**:

- [x] Typing 'A' replaces content with 'A'
- [x] Content updates are reflected in the display
- [x] Only single character input is supported

## Slice 3: Text String Input ✓

**Goal**: Type multiple characters and see them accumulate

**User Story**: As a user, I can type multiple characters and see them build up as a string

**Components to implement**:

- [x] **VDOM Operations**:
  - [x] Text accumulation in `VDOMMutations.ts`
  - [x] Cursor position advancement in `VDOMSelection.ts`
- [x] **Core Editor**:
  - [x] Enhanced `insertText()` to handle string building
  - [x] Internal content state management
- [x] **React Component**:
  - [x] Enhanced input handling for multiple characters
  - [x] Proper event handling to prevent browser default behavior
- [x] **Tests**:
  - [x] Unit test for string accumulation
  - [x] Unit test for cursor advancement
  - [x] Integration test for typing multiple characters

**Acceptance Criteria**:

- [x] Typing "Hello" results in "Hello" being displayed
- [x] Each character appears as it's typed
- [x] Cursor position advances with each character

## Slice 4: Basic Text Deletion ✓

**Goal**: Delete characters using backspace key

**User Story**: As a user, I can use backspace to delete characters I've typed

**Components to implement**:

- [x] **VDOM Operations**:
  - [x] Text deletion in `VDOMMutations.ts`
  - [x] Cursor position retreat in `VDOMSelection.ts`
- [x] **Core Editor**:
  - [x] `deleteText()` method (implemented through the FSM's `handleBackspace()`)
  - [x] Backspace key command handling
- [x] **React Component**:
  - [x] `onKeyDown` event handler for backspace (implemented in Editor.ts)
  - [x] Prevention of default backspace behavior
- [x] **Tests**:
  - [x] Unit test for text deletion mutation
  - [x] Unit test for Editor.deleteText()
  - [x] Integration test for backspace functionality

**Acceptance Criteria**:

- [x] Backspace removes the last character
- [x] Cursor position moves backward appropriately
- [x] Cannot delete beyond the beginning of text

## Slice 5: Cursor Position Tracking ✓

**Goal**: Show visual cursor and handle basic selection

**User Story**: As a user, I can see where my cursor is positioned and click to move it

**Components to implement**:

- [x] **Selection Foundation**:
  - [x] Basic `SelectionService.humble.ts` with minimal browser selection API
  - [x] Selection mapping in `VDOMSelection.ts`
  - [x] `HTMLToVDOM.ts` for parsing existing content
- [x] **Core Editor**:
  - [x] Selection state tracking
  - [x] `setSelection()` and `getSelection()` methods (implemented through FSM)
  - [x] Selection change notifications
- [x] **React Component**:
  - [x] Click event handling for cursor positioning
  - [x] Selection synchronization between VDOM and DOM
  - [x] Proper cursor display
- [x] **Tests**:
  - [x] Unit test for selection service
  - [x] Unit test for selection mapping
  - [x] Integration test for cursor positioning

**Acceptance Criteria**:

- [x] Clicking in text positions cursor at click location
- [x] Cursor is visually displayed
- [x] Typing inserts text at cursor position
- [x] Backspace deletes character before cursor

## Implementation Strategy

### Development Approach

1. **Test-Driven Development**: Write failing tests first, implement minimal code to pass
2. **One Slice at a Time**: Complete each slice fully before moving to the next
3. **Incremental Refinement**: Each slice may require refactoring previous components

### Architectural Principles

- **Vertical Integration**: Each slice touches VDOM, Editor, and React layers
- **Minimal Viable Feature**: Each slice delivers the smallest possible working feature
- **Progressive Enhancement**: Later slices build on and enhance earlier implementations

### Quality Gates

- All tests must pass before moving to next slice
- Each slice must be demonstrable to users
- Code must maintain type safety throughout
- No slice should break functionality from previous slices

## Benefits of This Approach

1. **Rapid Feedback**: Users can interact with working features immediately
2. **Risk Reduction**: Problems are discovered early in small, manageable pieces
3. **Clear Progress**: Each slice represents tangible progress toward the goal
4. **Flexible Prioritization**: Slices can be reordered based on user feedback
5. **Easier Testing**: Small, focused functionality is easier to test thoroughly

## Next Steps

1. Begin with Slice 1: Static Text Display
2. Implement using TDD approach
3. Validate each slice with both unit and integration tests
4. Demonstrate working functionality before proceeding to next slice
