# CAMS-526 RichTextEditor2 Implementation Goals

## Overview

This document outlines the implementation plan for RichTextEditor2, a new rich text editor component
that uses a finite state machine for state management, virtual DOM for document representation, and
HTML encoding for content storage.

## Iterative Design and Implementation Process

Refer to the design guidelines `/.junie/design-guidelines.md`.

This is our process:

1. You will ask for design input from me for each goal.
2. You will consider my design input and update the specification as necessary to include design
   decisions.
3. You will ask me for test scenarios.
4. You will suggest uncovered edge cases to include in the test scenarios.
5. You will implement tests for the test scenarios.
6. You will ask me to review the tests you implement.
7. You will write the implementation to pass the test while adhering to all other project
   guidelines.
8. You will confirm all tests for the newly written code pass.
9. You will confirm the test coverage goals are met.
10. You will confirm no TypeScript errors or warnings exist.
11. You will lint the code and fix any linter errors.

## AI Agent Guidelines

- Use the project guidelines in the `.junie` and `.cursor` directories.
- Use vitest for unit testing. Use `test` rather than `it` for tests.
- Use `@testing-library/react. Prefer userEvent over fireEvent.
- Use the BrowserSelectionService humble object for tests in place of tight coupling with the
  browser API.
- Use test-driven development practices. Write tests before writing implementation.
- Unit test coverage for branches and lines is 100%.
- All TypeScript compiler warnings must be resolved.
- Avoid the use of the `any` keyword in TypeScript.
- Run `npm run lint:fix` to lint source files. Fix any reported linter issues.

When working on implementation steps:

- **Refer to the specification**: Refer to `CAMS-526-rte-v2-spec.md` for the component
  specification. If and when the design must change, update the spec file accordingly. Include
  verbose reasoning in the decision records.
- **Document architecture decisions**: Record why specific approaches were chosen
- **Update progress**: Mark completed tasks in this goal file
- **Maintain context**: Include enough detail for subsequent AI agents to understand the current
  state
- **Test verification**: Confirm all tests pass before marking steps complete
- **Follow established patterns**: Maintain consistency with existing architecture decisions

## Allowed Dependencies

It is important to minimize third party dependencies.

- DOMPurify for HTML sanitization against XSS attacks
- React core library

## Phase 2.1 Architectural Decisions

### **State Management Structure**

Based on design input, the core state will use self-documenting variable names:

```typescript
interface EditorState {
  virtualDOM: VNode;                    // Document structure representation
  selection: Selection;                 // Cursor/selection state using path-based addressing
  currentEditorMode: EditorMode;        // Current finite state machine mode
}

type EditorMode = 'IDLE' | 'TYPING' | 'SELECTING' | 'FORMATTING';

// All state transitions follow this pattern:
type StateTransition = (currentState: EditorState) => EditorState;
```

### **Selection Addressing Strategy**

Path-based addressing chosen for robustness and undo/redo compatibility:

```typescript
interface Selection {
  startPath: number[];    // [0, 2, 1] = first block, third child, second child
  startOffset: number;    // Character offset within the target node
  endPath: number[];      // End position path
  endOffset: number;      // End character offset
  isCollapsed: boolean;   // Whether selection is just a cursor
}
```

**Rationale**: Path-based addressing survives VNode recreation and is serializable for operation-based undo/redo.

### **Operation-Based Undo/Redo**

```typescript
interface EditorOperation {
  type: 'insertText' | 'deleteText' | 'formatText' | 'insertParagraph' | 'toggleList';
  data: unknown;              // Operation-specific data (no 'any' types)
  inverse: EditorOperation;   // The operation to undo this one
  timestamp: number;
}
```

### **Error Recovery Strategy**

Virtual DOM as source of truth with graceful user experience:
- Preserve actively typed content during recovery
- Log errors for debugging without interrupting user flow
- Maintain user in current editing mode during recovery

## Current State Assessment

### ✅ **Completed (Phase 1)**

- **Core Architecture**: Finite State Machine (4 states), Virtual DOM with tree operations, HTML
  encoding/decoding with DOMPurify
- **Service Foundation**: Service-based architecture with pure functions
- **Infrastructure**: Comprehensive testing suite (329 tests passing), component interface structure
- **Virtual DOM Operations**: Basic tree manipulation, node creation/deletion

### ❌ **Critical Issues in Phase 2 (Requires Re-Implementation)**

- **Input Handling Breaks Virtual DOM**: `handleInput()` completely replaces virtual DOM content
  with a single text node, destroying all formatting and paragraph structure on every keystroke
- **Virtual DOM/Real DOM Synchronization Chaos**: Code inconsistently updates real DOM first, then
  tries to sync virtual DOM by re-parsing, which is backwards and unreliable
- **Cursor Position Management Broken**: Formatting and paragraph operations don't maintain cursor
  position after virtual DOM updates
- **No Proper Initialization**: Virtual DOM starts empty with no paragraph structure
- **Selection Service Integration Issues**: Cursor positioning calculations are incompatible with
  virtual DOM operations

### ❌ **Missing Components (Phase 3 & 4)**

- Toolbar implementation with state synchronization
- List management system
- Performance optimization features
- Enhanced accessibility features
- Advanced clipboard operations

## Implementation Plan

### **Core Architectural Enhancements for Phase 2**

_To address the critical issues, the re-implementation will be guided by the following architectural
principles. These decisions must be documented in the specification._

1.  **Event-Driven Input Handling**:

    - **Mandate `beforeinput` Event**: All input operations will be handled by listening to the
      `beforeinput` event. This provides clear user _intent_ (`insertText`, `insertParagraph`, etc.)
      before the DOM is mutated, allowing our virtual DOM to be the definitive source of truth. This
      replaces the old, unreliable method of parsing the DOM after it has changed.

2.  **Selection-First State Management**:

    - **Atomic State Updates**: The editor's state will be treated as an immutable, atomic unit
      comprising the virtual DOM tree, selection state, and current editor mode (`{virtualDOM, selection, currentEditorMode}`).
    - **Pure Mutation Functions**: All operations will be pure functions with the signature
      `(currentState: EditorState) => EditorState`. For example:
      `(currentState: EditorState) => { virtualDOM: newVirtualDOM, selection: newSelection, currentEditorMode: newMode }`.
    - **Explicit Synchronization**: A change is committed to the browser in two explicit steps: 1)
      Patch the real DOM based on a diff of the old and new virtual DOM. 2) Set the browser's selection
      based on the new selection state. The cursor is never an afterthought.

3.  **Fundamental Undo/Redo Integration**:

    - **Core Architectural Pillar**: The `UndoRedoService` is not a "feature" to be added later. It
      is a fundamental part of the state management architecture and will be implemented from the
      very beginning of Phase 2. Every state mutation will be designed to integrate with it.

4.  **Simplified, Reliable Virtual DOM Patching**:
    - **Initial Strategy**: We will start with a simple and reliable virtual DOM patch strategy: on any
      change, we will find the lowest common ancestor of the changed nodes and re-render that entire
      subtree in the real DOM.
    - **Progressive Optimization**: More advanced diff/patching algorithms will be implemented later
      as a dedicated performance optimization, preventing premature complexity.

### **Phase 2 (Re-Implementation): Vertical-Slice Rearchitecture**

_Priority: CRITICAL - This phase replaces the previous layered approach with end-to-end,
user-testable vertical slices. Each slice delivers a complete, stable piece of functionality._

#### **Phase 2.1: Foundational State & Reliable Text Input**

**Objective**: Implement the core state management architecture and enable a user to type and delete
text in a single paragraph reliably.

**Tasks**:

1.  **Core State & Undo/Redo Implementation**
    - [ ] Implement `UndoRedoService` to manage operation history with EditorOperation interface
    - [ ] Design core mutation logic to be compatible with the undo stack from the start
    - [ ] Define the `EditorState` interface with self-documenting names (virtualDOM, selection, currentEditorMode)
    - [ ] Implement path-based `Selection` interface for robust addressing
2.  **`beforeinput` Handler for Text**
    - [ ] Implement `beforeinput` handlers for `insertText` and `deleteContentBackward`
    - [ ] Create pure mutation functions with signature `(EditorState) => EditorState`
    - [ ] Prevent the browser's default action and take full control of the DOM change
3.  **Virtual DOM-to-DOM Synchronization**
    - [ ] Implement the initial "re-render subtree" patching strategy
    - [ ] Use `requestAnimationFrame` for all DOM writes to prevent layout thrashing
    - [ ] Implement the `SelectionService` logic to set the browser selection after a DOM patch
    - [ ] Implement error recovery strategy with virtual DOM as source of truth
4.  **Integration & Testing**
    - [ ] Write comprehensive unit tests for the state mutation logic
    - [ ] Write integration tests for typing and deleting characters
    - [ ] Confirm undo/redo works correctly for all text operations
    - [ ] Ensure 100% test coverage and no TypeScript warnings

**Dependencies**: Existing Virtual DOM components, SelectionService humble object.

#### **Phase 2.2: Reliable Paragraphs**

**Objective**: Enable a user to reliably create new paragraphs with the Enter key and merge them
with Backspace.

**Tasks**:

1.  **`beforeinput` Handler for Paragraphs**
    - [ ] Implement `beforeinput` handlers for `insertParagraph`
    - [ ] Extend the handler for `deleteContentBackward` to detect and handle merging paragraphs
    - [ ] Create pure mutation functions for splitting and merging paragraph nodes in the virtual DOM
2.  **Cursor & Selection Logic**
    - [ ] Ensure the selection state is correctly calculated and set after splitting/merging
          paragraphs using path-based addressing
3.  **Integration & Testing**
    - [ ] Write integration tests for creating and merging paragraphs
    - [ ] Confirm undo/redo works correctly for all paragraph operations
    - [ ] Test edge cases like empty paragraphs and merging paragraphs with different formatting

**Dependencies**: Phase 2.1 completion.

#### **Phase 2.3: Reliable Formatting**

**Objective**: Enable a user to reliably apply and remove basic formatting (bold, italic, underline)
on a text selection.

**Tasks**:

1.  **Formatting Mutation Logic**
    - [ ] Implement pure mutation functions to apply/remove formatting by modifying virtual DOM node
          attributes and structure
    - [ ] Handle toggling, nesting, and applying formatting to mixed-format selections
2.  **Selection-Based Formatting**
    - [ ] Implement the logic to apply formatting based on the current path-based `Selection` state
    - [ ] Update `FormattingDetectionService` to read format state from the virtual DOM and selection
3.  **Integration & Testing**
    - [ ] Write integration tests for applying, removing, and toggling all formats
    - [ ] Confirm undo/redo works correctly for all formatting operations

**Dependencies**: Phase 2.2 completion.

### **Phase 3A: Toolbar Implementation**

_Priority: High - Required for basic user interaction_

**Objective**: Complete the toolbar with formatting buttons that sync with editor state

**Tasks**:

1.  **Toolbar Container & State Synchronization**

- [ ] Implement toolbar state management connected to Editor finite state machine
- [ ] Create toolbar update mechanism based on cursor position and formatting state
- [ ] Add toolbar enabled/disabled state handling

2.  **Formatting Button Integration**

- [ ] Connect existing `RichTextButton` components to Editor formatting methods
- [ ] Implement button active/inactive states based on current formatting
- [ ] Add ARIA attributes for accessibility compliance

3.  **Toolbar Testing**

- [ ] Unit tests for toolbar state synchronization
- [ ] Integration tests for button interactions
- [ ] Accessibility tests for keyboard navigation

**Dependencies**: **Phase 2.3 must be complete and stable**

### **Phase 3B: List Management System**

_Priority: High - Core feature requirement_

**Objective**: Implement comprehensive list functionality (bulleted/numbered, nesting)

**Tasks**:

1.  **ListOperationsService Implementation**

- [ ] Create pure functions for list creation, conversion, and nesting
- [ ] Implement paragraph ↔ list item conversion utilities
- [ ] Add list splitting and merging operations

2.  **Virtual DOM Extensions**

- [ ] Extend VNode types to support `ul`, `ol`, `li` elements
- [ ] Add list metadata (nesting level, list type)
- [ ] Update VirtualDOMOperations for list-specific operations

3.  **Keyboard Handling**

- [ ] Implement Enter key behavior in lists (new list items)
- [ ] Add Tab/Shift+Tab for list nesting/unnesting
- [ ] Handle Backspace at list boundaries (convert to paragraphs)

4.  **Toolbar Integration**

- [ ] Add list buttons to toolbar
- [ ] Implement list state detection and button states
- [ ] Add list formatting shortcuts (Ctrl+Shift+L)

**Dependencies**: Phase 2.3 completion, existing paragraph operations

### **Phase 3C: Enhanced Clipboard Operations**

_Priority: Medium - User experience enhancement_

**Objective**: Complete clipboard functionality with copy/cut and rich text preservation

**Tasks**:

1.  **ClipboardService Implementation**

- [ ] Extend current paste handling to support copy/cut operations
- [ ] Implement rich text preservation in clipboard data
- [ ] Add format-aware paste handling for external content

2.  **Selection-Based Operations**

- [ ] Implement copy selection functionality
- [ ] Add cut selection with virtual DOM updates
- [ ] Handle complex selection scenarios (cross-paragraph, mixed formatting)

3.  **Integration & Testing**

- [ ] Add keyboard shortcuts (Ctrl+C, Ctrl+X, Ctrl+V)
- [ ] Comprehensive clipboard operation testing
- [ ] Cross-browser compatibility testing

**Dependencies**: Phase 2.3 completion, existing SelectionService

### **Phase 4A: Performance Optimization**

_Priority: Medium - Required for large documents_

**Objective**: Implement performance optimizations for responsive user experience

**Tasks**:

1.  **PerformanceService Implementation**

- [ ] Implement virtual DOM operation batching
- [ ] Add debounced onChange callbacks (300ms default)
- [ ] Create memory management utilities for large documents

2.  **Operation Optimization**

- [ ] Implement operation queuing and batch processing
- [ ] Add performance monitoring and metrics collection
- [ ] Implement advanced diff/patch operations to replace the initial "re-render subtree" strategy

3.  **Memory Management**

- [ ] Implement cleanup for unused VNode references
- [ ] Add memory usage monitoring
- [ ] Optimize virtual DOM tree size management

**Dependencies**: Phase 2.3 completion

### **Phase 4B: Accessibility Enhancement**

_Priority: High - Legal compliance requirement_

**Objective**: Achieve WCAG 2.1 AA compliance with comprehensive screen reader support

**Tasks**:

1.  **AccessibilityService Implementation**

- [ ] Create ARIA attribute management system
- [ ] Implement screen reader announcements for state changes
- [ ] Add keyboard navigation patterns following WCAG guidelines

2.  **Enhanced Keyboard Navigation**

- [ ] Implement TabNavigationService for complex navigation
- [ ] Add accessibility-compliant keyboard shortcuts
- [ ] Ensure proper focus management and tab order

3.  **Screen Reader Support**

- [ ] Dynamic ARIA attributes based on editor state
- [ ] Announcements for formatting changes and operations
- [ ] Focus trap management within editor boundaries

**Dependencies**: Phase 2.3 completion, existing Editor class, finite state machine

### **Phase 4C: Advanced Features**

_Priority: Low - Nice-to-have enhancements_

**Objective**: Complete advanced functionality for comprehensive rich text editing

**Tasks**:

1.  **HyperlinkService Implementation**

- [ ] Automatic URL detection during typing
- [ ] Link creation and editing functionality
- [ ] Proper virtual DOM representation of anchor tags

2.  **ValidationService Implementation**

- [ ] HTML structure validation
- [ ] Content normalization and whitespace management
- [ ] Error handling for malformed content

**Dependencies**: All previous phases

### **Phase 5: Polish & Documentation**

_Priority: Medium - Production readiness_

**Objective**: Production-ready component with comprehensive documentation

**Tasks**:

1.  **Migration Strategy**

- [ ] Complete drop-in replacement testing
- [ ] Performance comparison with original RichTextEditor
- [ ] Migration guide documentation

2.  **Documentation & Testing**

- [ ] API documentation and usage examples
- [ ] End-to-end testing scenarios
- [ ] Behavior-driven development tests

3.  **Final Optimization**

- [ ] Code review and cleanup
- [ ] Performance benchmarking
- [ ] Cross-browser compatibility verification

## Phase 2 Re-Implementation Success Criteria

### **Core Functionality Requirements**

- ✅ **Text Input**: Users can type text without losing formatting or paragraph structure
- ✅ **Cursor Positioning**: Cursor position is maintained accurately during all operations
- ✅ **Formatting**: Bold, italic, underline work reliably with proper toggle behavior
- ✅ **Paragraph Operations**: Enter key creates new paragraphs, Backspace merges them
- ✅ **Content Persistence**: Virtual DOM and real DOM remain synchronized
- ✅ **Change Notifications**: onChange callbacks fire with correct HTML content

### **Technical Requirements**

- ✅ **Virtual DOM Integrity**: Virtual DOM remains the single source of truth
- ✅ **Performance**: No unnecessary full DOM replacements during typing
- ✅ **State Consistency**: Finite state machine state transitions work correctly with all operations
- ✅ **Selection Management**: Text selection and cursor position handling is reliable using path-based addressing
- ✅ **Error Recovery**: Component handles edge cases gracefully without corruption

### **Testing Requirements**

- ✅ **Unit Tests**: All core Editor methods pass comprehensive unit tests
- ✅ **Integration Tests**: Full component functionality works in realistic scenarios
- ✅ **Manual Testing**: Component functions properly in browser with real user interactions
- ✅ **Regression Tests**: Previous test suite continues to pass with new implementation

## Success Criteria & Overall Validation

### **Phase Completion Criteria**

- ✅ All unit tests pass (maintain 100% coverage)
- ✅ No TypeScript errors or warnings
- ✅ All linter issues resolved
- ✅ Component interface compatibility maintained
- ✅ Performance benchmarks met
- ✅ Accessibility compliance verified (WCAG 2.1 AA)

### **Final Validation**

- **Drop-in Replacement**: Seamless replacement of original RichTextEditor in existing CAMS
  applications
- **Performance**: Improved performance metrics vs. original component
- **Maintainability**: Clean architecture enables easy future enhancements
- **User Experience**: Intuitive and responsive rich text editing experience
- **Accessibility**: Full compliance with government accessibility standards

## Implementation Notes

1. **Architecture-First Approach**: Phase 2 re-implementation must establish the correct virtual
   DOM-first architecture before adding features
2. **No Feature Additions**: Phase 2 focuses purely on making basic functionality reliable - no new
   features
3. **Comprehensive Testing**: Each sub-phase requires thorough testing before proceeding
4. **Performance Monitoring**: Track performance impact of architectural changes
5. **Backward Compatibility**: Maintain existing component interface throughout re-implementation
6. **Iterative Development**: Each phase should follow the established TDD process outlined in this
   document
7. **Architectural Consistency**: Maintain the established patterns (finite state machine, Virtual DOM, service-based
   architecture)
8. **Self-Documenting Code**: Use clear variable names and avoid acronyms (virtualDOM instead of vdom, currentEditorMode instead of fsm)
9. **Strict TypeScript**: No use of 'any' type - all interfaces must be properly typed
10. **Error Recovery**: Implement graceful error handling with virtual DOM as source of truth
