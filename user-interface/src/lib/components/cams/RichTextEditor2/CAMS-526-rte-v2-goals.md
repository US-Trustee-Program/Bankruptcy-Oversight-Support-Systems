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

### **Phase 2 (Re-Implementation): Core Editor Functionality**

_Priority: CRITICAL - Must be completed before any other phases_

**Objective**: Re-architect the core Editor class to properly integrate FSM, Virtual DOM, and real
DOM with reliable synchronization

#### **Phase 2A: Virtual DOM Synchronization Architecture**

_Fix the fundamental virtual DOM/real DOM synchronization_

**Tasks**:

1. **Proper Editor Initialization**

   - [ ] Initialize virtual DOM with proper paragraph structure on component mount
   - [ ] Ensure virtual DOM is the single source of truth
   - [ ] Implement proper empty state (paragraph with zero-width space)

2. **Virtual DOM-First Operations**

   - [ ] Re-architect all operations to update virtual DOM first
   - [ ] Implement reliable virtual DOM → real DOM synchronization
   - [ ] Add cursor position preservation during DOM updates

3. **Selection Service Integration**
   - [ ] Fix cursor position calculations to work with virtual DOM operations
   - [ ] Implement proper selection restoration after DOM updates
   - [ ] Add selection validation and error handling

**Dependencies**: Existing Virtual DOM components, SelectionService

#### **Phase 2B: Text Input and Editing Re-Implementation**

_Fix basic text input to preserve structure and formatting_

**Tasks**:

1. **Input Event Handling Redesign**

   - [ ] Replace destructive `handleInput` with incremental virtual DOM updates
   - [ ] Implement proper text insertion at cursor position
   - [ ] Preserve paragraph and formatting structure during typing

2. **Content Change Detection**

   - [ ] Implement efficient change detection between virtual DOM states
   - [ ] Add minimal DOM update operations (not full replacement)
   - [ ] Optimize onChange callback frequency

3. **Text Manipulation Operations**
   - [ ] Implement character insertion/deletion at specific positions
   - [ ] Add text selection and replacement operations
   - [ ] Handle special characters and whitespace properly

**Dependencies**: Phase 2A completion

#### **Phase 2C: Formatting System Re-Implementation**

_Fix formatting to work reliably with virtual DOM_

**Tasks**:

1. **Format Application Redesign**

   - [ ] Implement formatting through virtual DOM operations only
   - [ ] Fix toggle behavior to properly detect and remove existing formatting
   - [ ] Add nested formatting support

2. **Selection-Based Formatting**

   - [ ] Fix formatting application to selected text ranges
   - [ ] Implement proper format boundary detection
   - [ ] Handle cross-paragraph formatting selections

3. **Format State Management**
   - [ ] Implement reliable format state queries for UI feedback
   - [ ] Add format state persistence during editing operations
   - [ ] Fix keyboard shortcut formatting integration

**Dependencies**: Phase 2B completion, existing FormattingDetectionService

#### **Phase 2D: Paragraph Operations Re-Implementation**

_Fix paragraph handling for reliable structure_

**Tasks**:

1. **Enter Key Behavior Redesign**

   - [ ] Implement reliable paragraph splitting at cursor position
   - [ ] Fix cursor positioning in new paragraphs
   - [ ] Handle formatting preservation across paragraph splits

2. **Backspace/Delete Operations**

   - [ ] Implement reliable paragraph merging operations
   - [ ] Fix cursor positioning after paragraph operations
   - [ ] Handle formatting preservation during merging

3. **Paragraph Structure Maintenance**
   - [ ] Ensure all content is properly wrapped in paragraphs
   - [ ] Implement paragraph validation and normalization
   - [ ] Add error recovery for malformed paragraph structure

**Dependencies**: Phase 2C completion, existing ParagraphOperationsService

#### **Phase 2E: Integration Testing and Stabilization**

_Ensure reliable operation of core functionality_

**Tasks**:

1. **Integration Testing**

   - [ ] Comprehensive testing of Editor class with real DOM interactions
   - [ ] User interaction scenario testing (typing, formatting, navigation)
   - [ ] Cross-browser compatibility testing

2. **Performance Optimization**

   - [ ] Optimize virtual DOM update frequency
   - [ ] Implement efficient DOM diff and patch operations
   - [ ] Add performance monitoring for core operations

3. **Error Handling and Recovery**
   - [ ] Add robust error handling for virtual DOM operations
   - [ ] Implement recovery mechanisms for DOM synchronization failures
   - [ ] Add debugging utilities for development

**Dependencies**: Phase 2D completion

### **Phase 3A: Toolbar Implementation**

_Priority: High - Required for basic user interaction_

**Objective**: Complete the toolbar with formatting buttons that sync with editor state

**Tasks**:

1. **Toolbar Container & State Synchronization**

   - [ ] Implement toolbar state management connected to Editor FSM
   - [ ] Create toolbar update mechanism based on cursor position and formatting state
   - [ ] Add toolbar enabled/disabled state handling

2. **Formatting Button Integration**

   - [ ] Connect existing `RichTextButton` components to Editor formatting methods
   - [ ] Implement button active/inactive states based on current formatting
   - [ ] Add ARIA attributes for accessibility compliance

3. **Toolbar Testing**
   - [ ] Unit tests for toolbar state synchronization
   - [ ] Integration tests for button interactions
   - [ ] Accessibility tests for keyboard navigation

**Dependencies**: **Phase 2 must be complete and stable**

### **Phase 3B: List Management System**

_Priority: High - Core feature requirement_

**Objective**: Implement comprehensive list functionality (bulleted/numbered, nesting)

**Tasks**:

1. **ListOperationsService Implementation**

   - [ ] Create pure functions for list creation, conversion, and nesting
   - [ ] Implement paragraph ↔ list item conversion utilities
   - [ ] Add list splitting and merging operations

2. **Virtual DOM Extensions**

   - [ ] Extend VNode types to support `ul`, `ol`, `li` elements
   - [ ] Add list metadata (nesting level, list type)
   - [ ] Update VirtualDOMOperations for list-specific operations

3. **Keyboard Handling**

   - [ ] Implement Enter key behavior in lists (new list items)
   - [ ] Add Tab/Shift+Tab for list nesting/unnesting
   - [ ] Handle Backspace at list boundaries (convert to paragraphs)

4. **Toolbar Integration**
   - [ ] Add list buttons to toolbar
   - [ ] Implement list state detection and button states
   - [ ] Add list formatting shortcuts (Ctrl+Shift+L)

**Dependencies**: Phase 2 completion, existing paragraph operations

### **Phase 3C: Enhanced Clipboard Operations**

_Priority: Medium - User experience enhancement_

**Objective**: Complete clipboard functionality with copy/cut and rich text preservation

**Tasks**:

1. **ClipboardService Implementation**

   - [ ] Extend current paste handling to support copy/cut operations
   - [ ] Implement rich text preservation in clipboard data
   - [ ] Add format-aware paste handling for external content

2. **Selection-Based Operations**

   - [ ] Implement copy selection functionality
   - [ ] Add cut selection with virtual DOM updates
   - [ ] Handle complex selection scenarios (cross-paragraph, mixed formatting)

3. **Integration & Testing**
   - [ ] Add keyboard shortcuts (Ctrl+C, Ctrl+X, Ctrl+V)
   - [ ] Comprehensive clipboard operation testing
   - [ ] Cross-browser compatibility testing

**Dependencies**: Phase 2 completion, existing SelectionService

### **Phase 4A: Performance Optimization**

_Priority: Medium - Required for large documents_

**Objective**: Implement performance optimizations for responsive user experience

**Tasks**:

1. **PerformanceService Implementation**

   - [ ] Implement virtual DOM operation batching
   - [ ] Add debounced onChange callbacks (300ms default)
   - [ ] Create memory management utilities for large documents

2. **Operation Optimization**

   - [ ] Batch DOM updates using requestAnimationFrame
   - [ ] Implement operation queuing and batch processing
   - [ ] Add performance monitoring and metrics collection

3. **Memory Management**
   - [ ] Implement cleanup for unused VNode references
   - [ ] Add memory usage monitoring
   - [ ] Optimize virtual DOM tree size management

**Dependencies**: Phase 2 completion, existing virtual DOM operations

### **Phase 4B: Accessibility Enhancement**

_Priority: High - Legal compliance requirement_

**Objective**: Achieve WCAG 2.1 AA compliance with comprehensive screen reader support

**Tasks**:

1. **AccessibilityService Implementation**

   - [ ] Create ARIA attribute management system
   - [ ] Implement screen reader announcements for state changes
   - [ ] Add keyboard navigation patterns following WCAG guidelines

2. **Enhanced Keyboard Navigation**

   - [ ] Implement TabNavigationService for complex navigation
   - [ ] Add accessibility-compliant keyboard shortcuts
   - [ ] Ensure proper focus management and tab order

3. **Screen Reader Support**
   - [ ] Dynamic ARIA attributes based on editor state
   - [ ] Announcements for formatting changes and operations
   - [ ] Focus trap management within editor boundaries

**Dependencies**: Phase 2 completion, existing Editor class, FSM

### **Phase 4C: Advanced Features**

_Priority: Low - Nice-to-have enhancements_

**Objective**: Complete advanced functionality for comprehensive rich text editing

**Tasks**:

1. **HyperlinkService Implementation**

   - [ ] Automatic URL detection during typing
   - [ ] Link creation and editing functionality
   - [ ] Proper virtual DOM representation of anchor tags

2. **UndoRedoService Implementation**

   - [ ] Virtual DOM snapshot management
   - [ ] Efficient snapshot storage with memory limits
   - [ ] Keyboard shortcuts (Ctrl+Z, Ctrl+Y) integration

3. **ValidationService Implementation**
   - [ ] HTML structure validation
   - [ ] Content normalization and whitespace management
   - [ ] Error handling for malformed content

**Dependencies**: All previous phases

### **Phase 5: Polish & Documentation**

_Priority: Medium - Production readiness_

**Objective**: Production-ready component with comprehensive documentation

**Tasks**:

1. **Migration Strategy**

   - [ ] Complete drop-in replacement testing
   - [ ] Performance comparison with original RichTextEditor
   - [ ] Migration guide documentation

2. **Documentation & Testing**

   - [ ] API documentation and usage examples
   - [ ] End-to-end testing scenarios
   - [ ] Behavior-driven development tests

3. **Final Optimization**
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
- ✅ **State Consistency**: FSM state transitions work correctly with all operations
- ✅ **Selection Management**: Text selection and cursor position handling is reliable
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
7. **Architectural Consistency**: Maintain the established patterns (FSM, Virtual DOM, service-based
   architecture)
