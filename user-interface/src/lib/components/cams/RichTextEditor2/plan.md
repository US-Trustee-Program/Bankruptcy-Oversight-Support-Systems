# Rich Text Editor Implementation Plan - Vertical Slices

This document outlines the implementation of the rich text editor using vertical slices of
functionality. Each slice delivers a complete, user-facing feature, building on the previous slices.

## 0. Initial Project Setup (Already Completed)

- [x] Create the base directory structure as defined in the specification
- [x] Integrate provided files: `RichTextButton.tsx`, `RichTextButton.scss`, `RichTextIcon.tsx`, and
      `core/constants.ts`
- [x] Define basic shared types in `types.ts`

## 1. Slice: Basic Text Input & Display

This slice focuses on the most fundamental feature: allowing users to type text and see it
displayed.

- [ ] **Foundational Components:**
  - [ ] Minimal `VDOMNode` structure (paragraph and text nodes only) in `model/VDOMNode.ts`
  - [ ] Basic text insert/delete operations in `model/VDOMMutations.ts`
  - [ ] Simple selection mapping in `model/VDOMSelection.ts`
  - [ ] Basic HTML conversion (VDOM ↔ HTML) in `io/VDOMToHTML.ts` and `io/HTMLToVDOM.ts`
  - [ ] Selection service implementation in `selection/SelectionService.humble.ts`
- [ ] **Core Editor:**

  - [ ] Basic `Editor` class with minimal state (VDOM, selection) in `Editor.ts`
  - [ ] Text input/deletion handling
  - [ ] Content change notifications

- [ ] **React Component:**
  - [ ] Minimal `RichTextEditor.tsx` with contentEditable div
  - [ ] Basic event handling (input, keydown)
  - [ ] Content display from Editor
  - [ ] Selection synchronization
- [ ] **Tests:**
  - [ ] Unit tests for all components
  - [ ] Integration test for typing and displaying text

## 2. Slice: Paragraph Operations

This slice adds the ability to create and navigate between paragraphs.

- [ ] **Model Extensions:**
  - [ ] Paragraph split/merge operations in `model/VDOMMutations.ts`
  - [ ] Cross-paragraph selection in `model/VDOMSelection.ts`
- [ ] **Core Editor:**
  - [ ] Enter key handling for paragraph creation
  - [ ] Backspace/Delete at paragraph boundaries
- [ ] **Tests:**
  - [ ] Unit tests for paragraph operations
  - [ ] Integration tests for creating/merging paragraphs

## 3. Slice: Basic Formatting (Bold, Italic, Underline)

This slice adds the first formatting capabilities.

- [ ] **Formatting Components:**

  - [ ] Format toggle operations in `model/VDOMFormatting.ts`
  - [ ] Format state detection in `model/VDOMSelection.ts`

- [ ] **Core Editor:**
  - [ ] Format toggle command handling
  - [ ] Keyboard shortcut support (Ctrl+B, Ctrl+I, Ctrl+U)
  - [ ] Format state notifications
- [ ] **React Component:**
  - [ ] Formatting buttons implementation
  - [ ] Format state visualization
  - [ ] Button click handling
- [ ] **Tests:**
  - [ ] Unit tests for formatting operations
  - [ ] Integration tests for button clicks and keyboard shortcuts

## 4. Slice: Undo/Redo

This slice adds the ability to undo and redo changes.

- [ ] **History Components:**
  - [ ] History stack in `history/HistoryManager.ts`
  - [ ] State snapshot capture and restoration
- [ ] **Core Editor:**
  - [ ] Integration with history manager
  - [ ] Undo/redo command handling (Ctrl+Z, Ctrl+Y)
- [ ] **Tests:**
  - [ ] Unit tests for history operations
  - [ ] Integration tests for undo/redo functionality

## 5. Slice: List Support

This slice adds support for ordered and unordered lists.

- [ ] **List Components:**
  - [ ] List operations in `model/VDOMListOperations.ts`
  - [ ] List normalization in `model/VDOMNormalization.ts`
- [ ] **Core Editor:**
  - [ ] List toggle command handling
  - [ ] Special key handling in lists (Tab, Backspace, Enter)
- [ ] **React Component:**
  - [ ] List buttons implementation
  - [ ] List state visualization
- [ ] **Tests:**
  - [ ] Unit tests for list operations
  - [ ] Integration tests for list creation and manipulation

## 6. Slice: Clipboard Operations

This slice adds support for copy, cut, and paste operations.

- [ ] **Clipboard Components:**
  - [ ] Clipboard interaction in `clipboard/ClipboardManager.ts`
- [ ] **Core Editor:**
  - [ ] Copy/cut/paste command handling
  - [ ] HTML sanitization for paste operations
- [ ] **Tests:**
  - [ ] Unit tests for clipboard operations
  - [ ] Integration tests for copy/cut/paste functionality

## 7. Slice: Public API & Accessibility

This final slice completes the public API and ensures accessibility features.

- [ ] **Utilities:**
  - [ ] HTML cleaning and safety in `utils/Editor.utilities.ts`
- [ ] **Core Editor:**
  - [ ] Complete command handling via FSM
  - [ ] Final polish of content normalization
- [ ] **React Component:**
  - [ ] Full imperative handle implementation (clearValue, getValue, etc.)
  - [ ] Complete props handling (disabled, required, etc.)
  - [ ] Accessibility attributes and behaviors
- [ ] **Tests:**
  - [ ] Comprehensive unit and integration tests
  - [ ] Accessibility testing
  - [ ] Edge case handling

## Implementation Strategy Notes

1. Each slice should be developed using TDD:

   - Write failing tests first
   - Implement minimal code to make tests pass
   - Refactor while keeping tests passing

2. Each slice should be completed and functioning before moving to the next:

   - Includes tests for both individual components and integration
   - May require temporary scaffolding that will be replaced in later slices

3. Throughout development, maintain:
   - Decoupling between Editor core and DOM
   - Pure function approach for VDOM operations
   - Type safety across all interfaces
