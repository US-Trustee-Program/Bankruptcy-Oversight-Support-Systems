# CAMS-526 RichTextEditor2 Implementation Goals

## Overview

This document outlines the implementation plan for RichTextEditor2, a new rich text editor component
that uses a finite state machine for state management, virtual DOM for document representation, and
HTML encoding for content storage.

## AI Agent Guidelines

- Read context, decisions, and reasoning from `CAMS-526-rte-v2-reasoning.md` to include details from
  the last step implemented.
- Use vitest for unit testing. Use `test` instead of `it` for test cases.
- Use `@testing-library/react1. Prefer userEvent over fireEvent.
- Use the BrowserSelectionService humble object for tests in place of tight coupling with the
  browser API.
- Use test-driven development practices. Write tests before writing implementation.
- Unit test coverage for branches and lines is 100%.
- All typescript compiler warnings must be resolved.
- Run `npm run lint:fix` to lint source files. Fix any reported linter issues.

When working on implementation steps:

- **Always update the reasoning file**: Save context, decisions, and reasoning to
  `CAMS-526-rte-v2-reasoning.md`
- **Document architecture decisions**: Record why specific approaches were chosen
- **Update progress**: Mark completed tasks in this goals file and update the reasoning file
- **Maintain context**: Include enough detail for subsequent AI agents to understand the current
  state
- **Test verification**: Confirm all tests pass before marking steps complete
- **Follow established patterns**: Maintain consistency with existing architecture decisions

## Allowed Dependencies

It is important to minimize third party dependencies.

- DOMPurify for HTML sanitization against XSS attacks
- React core library

## Architecture Goals

### 1. Finite State Machine (FSM) Implementation

- [x] Design and implement a finite state machine to manage editor state
  - [x] Define editor states (e.g., idle, typing, formatting, selecting)
  - [x] Define state transitions and triggers
  - [x] Implement state machine core logic
  - [x] Create state machine context/provider
- [x] Integrate FSM with React component lifecycle
  - [x] Connect FSM state to React state
  - [x] Handle state transitions in event handlers
  - [x] Ensure proper cleanup and state reset

### 2. Virtual DOM for Document State

- [x] Design virtual DOM structure for rich text content
  - [x] Define node types (text, element, formatting)
  - [x] Create virtual DOM tree structure
  - [x] Implement virtual DOM manipulation methods
- [x] Implement virtual DOM to real DOM synchronization
  - [x] Create diff algorithm for virtual DOM changes
  - [x] Implement efficient DOM updates
  - [ ] Handle cursor position preservation during updates
- [x] Virtual DOM operations
  - [x] Insert/delete operations
  - [ ] Text formatting operations (IN PROGRESS - toggle behavior in Phase 2b)
  - [ ] List management operations
  - [ ] Undo/redo support through virtual DOM snapshots

### 3. HTML Encoding and Content Management

- [x] Implement robust HTML encoding/decoding
  - [x] Safe HTML parsing from external sources
  - [x] HTML sanitization for security
  - [x] Consistent HTML output formatting
- [ ] Content validation and normalization
  - [ ] Validate HTML structure
  - [ ] Normalize whitespace and formatting
  - [ ] Handle edge cases in HTML content

### 4. Core Editor Features

- [x] Text formatting capabilities
  - [x] Bold, italic, underline formatting
  - [x] Format application through FSM
  - [ ] Format removal and toggling (IN PROGRESS - See Phase 2b below)
- [ ] List management
  - [ ] Bulleted lists (ul)
  - [ ] Numbered lists (ol)
  - [ ] List nesting support
  - [ ] List item navigation
- [x] Keyboard event handling
  - [ ] Enter key behavior (new paragraphs/list items)
  - [ ] Backspace/Delete key behavior
  - [x] Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U)
  - [ ] Tab navigation and indentation
- [x] Clipboard operations
  - [x] Paste handling with HTML sanitization
  - [ ] Copy/cut operations
  - [ ] Rich text preservation in clipboard

### 5. Component Interface Compatibility

- [x] Maintain same prop interface as RichTextEditor
  - [x] id, label, ariaDescription, onChange, disabled, required, className
- [x] Maintain same ref interface as RichTextEditor
  - [x] clearValue, getValue, getHtml, setValue, disable, focus methods
- [x] Ensure drop-in replacement capability
  - [x] Same CSS class structure
  - [x] Same accessibility attributes
  - [x] Same event handling patterns

### 6. Testing Strategy

- [x] Unit tests for finite state machine
  - [x] State transition testing
  - [x] Edge case handling
  - [x] State consistency validation
- [x] Unit tests for virtual DOM
  - [x] Virtual DOM manipulation
  - [x] Diff algorithm testing
  - [x] DOM synchronization testing
- [x] Integration tests for component
  - [x] User interaction scenarios
  - [x] Keyboard event handling
  - [x] Clipboard operations
  - [x] Accessibility compliance
  - [ ] Formatting toggle behavior (Phase 2b)
  - [ ] Mixed selection formatting scenarios (Phase 2b)
- [ ] Performance testing
  - [ ] Large document handling
  - [ ] Rapid input scenarios
  - [ ] Memory usage optimization
- [ ] BDD-style Test
  - [ ] Write BDD-style test for the RichTextEditor2 component

### 7. Performance Considerations

- [ ] Optimize virtual DOM operations
  - [ ] Minimize unnecessary re-renders
  - [ ] Efficient diff calculations
  - [ ] Batch DOM updates
- [ ] Debounce expensive operations
  - [ ] HTML encoding/decoding
  - [ ] onChange callbacks
  - [ ] Virtual DOM synchronization
- [ ] Memory management
  - [ ] Clean up event listeners
  - [ ] Manage virtual DOM tree size
  - [ ] Optimize state machine memory usage

### 8. Accessibility and UX

- [ ] Maintain accessibility standards
  - [ ] ARIA attributes and roles
  - [ ] Keyboard navigation support
  - [ ] Screen reader compatibility
- [ ] User experience enhancements
  - [ ] Smooth cursor movement
  - [ ] Consistent formatting behavior
  - [ ] Intuitive keyboard shortcuts
  - [ ] Visual feedback for state changes

### 9. Documentation and Migration

- [ ] Architecture documentation
- [ ] Finite state machine design
- [ ] Virtual DOM structure
- [ ] HTML encoding strategy

## Implementation Phases

### Phase 1: Core Architecture

1. [x] Implement basic finite state machine
2. [x] Create virtual DOM structure
3. [x] Set up HTML encoding/decoding

### Phase 2: Basic Editor Functionality

1. [x] Text input and editing
2. [x] Basic formatting (bold, italic, underline)
3. [ ] Paragraph handling

### Phase 2b: Format Toggle Implementation (Current Priority)

**Goal**: Implement proper toggle behavior for formatting - keyboard shortcuts should toggle
formatting on/off based on current selection state.

#### Selection Analysis Infrastructure

- [x] Create `SelectionFormattingAnalyzer` service
  - [x] `analyzeSelection()` - analyze current selection formatting states
  - [x] `getFormattingState()` - determine if formatting is not applied/partial/full
  - [x] `getNodesInRange()` - get virtual DOM nodes intersecting selection
- [x] Define formatting analysis data structures
  - [x] `FormattingState` enum (NOT_APPLIED, PARTIALLY_APPLIED, FULLY_APPLIED)
  - [x] `FormattingAnalysis` interface for selection analysis results
- [x] Extend `SelectionService.humble.ts` with virtual DOM mapping
  - [x] `getVirtualNodesInSelection()` - map selection to virtual DOM nodes
  - [x] `mapSelectionToVirtualDOM()` - convert browser selection to virtual nodes

#### Formatting Detection Logic

- [x] Create `FormattingDetector` utility
  - [x] `hasFormatting()` - check if node has specific formatting
  - [x] `getAppliedFormats()` - get all formats applied to a node
  - [x] `isDescendantOfFormatting()` - check for inherited formatting from ancestors
- [x] Implement selection-wide formatting analysis
  - [x] Count formatted vs unformatted nodes in selection
  - [x] Determine overall formatting state (none/partial/full coverage)
  - [x] Handle nested formatting scenarios

#### Formatting Removal Operations

- [x] Create `FormattingRemover` utility
  - [x] `removeFormatting()` - remove specific format from nodes
  - [x] `unwrapFormattingNode()` - unwrap formatting nodes and promote children
  - [x] `removeFormattingFromSelection()` - batch removal for selection
- [x] Enhance virtual DOM operations for removal
  - [x] Split formatting nodes when removing from partial selections
  - [x] Update parent-child relationships after unwrapping
  - [x] Maintain proper virtual DOM tree structure

#### Mixed Selection Handling

- [ ] 🚨 **CRITICAL**: Implement node splitting for partial selections
  - [ ] Create `splitFormattingNodeAtBoundaries()` function
  - [ ] Split formatting nodes at selection start/end boundaries
  - [ ] Preserve formatting on unselected portions of split nodes
  - [ ] Handle complex nesting scenarios during splits
- [ ] Implement partial formatting application
  - [ ] Apply formatting only to unformatted parts of selection
  - [ ] Leave already-formatted content unchanged
  - [ ] Handle edge cases (adjacent formatting nodes, empty selections)
- [ ] Intelligent toggle logic
  - [ ] FULLY_APPLIED → Remove formatting from entire selection
  - [ ] NOT_APPLIED → Apply formatting to entire selection
  - [ ] PARTIALLY_APPLIED → Apply formatting to unformatted parts

#### Integration and Implementation

- [x] Replace `applyFormatting` with `toggleFormatting`
  - [x] Implement toggle logic based on selection analysis
  - [ ] 🚨 **CRITICAL BUG**: Current implementation removes entire formatting nodes instead of
        splitting
  - [ ] Maintain cursor position during formatting operations
  - [x] Ensure proper virtual DOM and real DOM synchronization
- [x] Update keyboard shortcut handlers
  - [x] Replace `applyFormatting` calls with `toggleFormatting`
  - [x] Maintain existing keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U)
  - [x] Ensure FSM events are properly dispatched

#### Testing for Toggle Behavior

- [x] Unit tests for new components
  - [x] `SelectionFormattingAnalyzer.test.ts`
  - [x] `FormattingDetector.test.ts`
  - [x] `FormattingRemover.test.ts`
- [ ] Integration tests for toggle behavior
  - [ ] Simple toggle on/off scenarios
  - [ ] 🚨 **CRITICAL**: Mixed formatting scenarios with node splitting
    - [ ] Test: "another test" selection in `This is <strong>another</strong> test`
    - [ ] Expected: `This is <strong>another test</strong>`
    - [ ] Currently fails due to wholesale node removal bug
  - [ ] Nested formatting handling
  - [ ] Edge cases (empty selections, single character, full document)
- [x] Regression testing
  - [x] Verify all existing tests continue to pass
  - [x] Ensure no functionality is broken by toggle implementation

#### Edge Cases and Polish

- [ ] Handle complex scenarios
  - [ ] Empty selections (no-op behavior)
  - [ ] Nested formatting (bold inside italic)
  - [ ] Adjacent formatting nodes (merge when possible)
  - [ ] Cursor position preservation across toggle operations
- [ ] Performance optimization
  - [ ] Optimize formatting analysis for large selections
  - [ ] Minimize DOM manipulation operations
  - [ ] Cache analysis results when appropriate

### Phase 3: Advanced Features

1. List management
2. Hyperlink detection and wrapping with anchor tags
3. Advanced keyboard handling
4. Clipboard operations

### Phase 4: Polish and Optimization

1. Performance optimization
2. Comprehensive testing
3. Documentation

## Success Criteria

- [ ] Drop-in replacement for existing RichTextEditor
- [ ] Improved performance and reliability
- [ ] Maintainable and extensible architecture
- [ ] Comprehensive test coverage
- [ ] Full accessibility compliance
