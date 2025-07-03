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
- [ ] **VDOM Foundation**:
  - [ ] Minimal `VDOMNode.ts` with paragraph and text node types only
  - [ ] Basic `VDOMToHTML.ts` to convert VDOM to displayable HTML
- [ ] **Core Editor**:
  - [ ] Minimal `Editor.ts` class with hardcoded content
  - [ ] `getContent()` method returning HTML string
- [ ] **React Component**:
  - [ ] Basic `RichTextEditor.tsx` with contentEditable div
  - [ ] Display content from Editor via dangerouslySetInnerHTML
- [ ] **Tests**:
  - [ ] Unit test for VDOMNode creation
  - [ ] Unit test for VDOMToHTML conversion
  - [ ] Unit test for Editor.getContent()
  - [ ] Integration test for component rendering

**Acceptance Criteria**:
- Editor displays "Hello, World!" text
- Text is properly formatted as a paragraph
- Component renders without errors

## Slice 2: Single Character Input

**Goal**: Type one character and see it replace the existing content

**User Story**: As a user, I can type a single character and see it displayed

**Components to implement**:
- [ ] **VDOM Operations**:
  - [ ] Basic text replacement in `VDOMMutations.ts`
  - [ ] Simple cursor position tracking in `VDOMSelection.ts`
- [ ] **Core Editor**:
  - [ ] `insertText(char: string)` method
  - [ ] Content change notification via callback
- [ ] **React Component**:
  - [ ] `onInput` event handler
  - [ ] Character extraction from input event
  - [ ] Content update and re-render
- [ ] **Tests**:
  - [ ] Unit test for text insertion mutation
  - [ ] Unit test for Editor.insertText()
  - [ ] Integration test for typing one character

**Acceptance Criteria**:
- Typing 'A' replaces content with 'A'
- Content updates are reflected in the display
- Only single character input is supported

## Slice 3: Text String Input

**Goal**: Type multiple characters and see them accumulate

**User Story**: As a user, I can type multiple characters and see them build up as a string

**Components to implement**:
- [ ] **VDOM Operations**:
  - [ ] Text accumulation in `VDOMMutations.ts`
  - [ ] Cursor position advancement in `VDOMSelection.ts`
- [ ] **Core Editor**:
  - [ ] Enhanced `insertText()` to handle string building
  - [ ] Internal content state management
- [ ] **React Component**:
  - [ ] Enhanced input handling for multiple characters
  - [ ] Proper event handling to prevent browser default behavior
- [ ] **Tests**:
  - [ ] Unit test for string accumulation
  - [ ] Unit test for cursor advancement
  - [ ] Integration test for typing multiple characters

**Acceptance Criteria**:
- Typing "Hello" results in "Hello" being displayed
- Each character appears as it's typed
- Cursor position advances with each character

## Slice 4: Basic Text Deletion

**Goal**: Delete characters using backspace key

**User Story**: As a user, I can use backspace to delete characters I've typed

**Components to implement**:
- [ ] **VDOM Operations**:
  - [ ] Text deletion in `VDOMMutations.ts`
  - [ ] Cursor position retreat in `VDOMSelection.ts`
- [ ] **Core Editor**:
  - [ ] `deleteText()` method
  - [ ] Backspace key command handling
- [ ] **React Component**:
  - [ ] `onKeyDown` event handler for backspace
  - [ ] Prevention of default backspace behavior
- [ ] **Tests**:
  - [ ] Unit test for text deletion mutation
  - [ ] Unit test for Editor.deleteText()
  - [ ] Integration test for backspace functionality

**Acceptance Criteria**:
- Backspace removes the last character
- Cursor position moves backward appropriately
- Cannot delete beyond the beginning of text

## Slice 5: Cursor Position Tracking

**Goal**: Show visual cursor and handle basic selection

**User Story**: As a user, I can see where my cursor is positioned and click to move it

**Components to implement**:
- [ ] **Selection Foundation**:
  - [ ] Basic `SelectionService.humble.ts` with minimal browser selection API
  - [ ] Selection mapping in `VDOMSelection.ts`
  - [ ] `HTMLToVDOM.ts` for parsing existing content
- [ ] **Core Editor**:
  - [ ] Selection state tracking
  - [ ] `setSelection()` and `getSelection()` methods
  - [ ] Selection change notifications
- [ ] **React Component**:
  - [ ] Click event handling for cursor positioning
  - [ ] Selection synchronization between VDOM and DOM
  - [ ] Proper cursor display
- [ ] **Tests**:
  - [ ] Unit test for selection service
  - [ ] Unit test for selection mapping
  - [ ] Integration test for cursor positioning

**Acceptance Criteria**:
- Clicking in text positions cursor at click location
- Cursor is visually displayed
- Typing inserts text at cursor position
- Backspace deletes character before cursor

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
