# CAMS-526 RichTextEditor2 Implementation Goals

## Overview
This document outlines the implementation plan for RichTextEditor2, a new rich text editor component that uses a finite state machine for state management, virtual DOM for document representation, and HTML encoding for content storage.

## AI Agent Guidelines

- Use the project guidelines in the `.junie` and `.cursor` directories.
- Read context, decisions, and reasoning from `CAMS-526-rte-v2-reasoning.md` to include details from the last step implemented.
- Use vitest for unit testing. Use `test` rather than `it` for tests.
- Use `@testing-library/react. Prefer userEvent over fireEvent.
- Use the BrowserSelectionService humble object for tests in place of tight coupling with the browser API.
- Use test-driven development practices. Write tests before writing implementation.
- Unit test coverage for branches and lines is 100%.
- All TypeScript compiler warnings must be resolved.
- Run `npm run lint:fix` to lint source files. Fix any reported linter issues.

When working on implementation steps:
- **Always update the reasoning file**: Save context, decisions, and reasoning to `CAMS-526-rte-v2-reasoning.md`
- **Include verbose descriptions of reasoning**: Write verbose reasoning to `CAMS-526-rte-v2-reasoning.md`
- **Document architecture decisions**: Record why specific approaches were chosen
- **Update progress**: Mark completed tasks in this goal file and update the reasoning file
- **Maintain context**: Include enough detail for subsequent AI agents to understand the current state
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
    - [ ] Text formatting operations
        - [ ] Format detection utilities for existing content
        - [ ] Format removal operations for toggle functionality
        - [ ] Format state queries for UI feedback
    - [ ] Paragraph management operations
        - [ ] Paragraph node creation and insertion
        - [ ] Paragraph boundary detection and manipulation
        - [ ] Paragraph splitting and merging operations
        - [ ] Cross-paragraph content operations
        - [ ] Paragraph-aware text insertion and deletion
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
    - [x] Format removal and toggling
        - [x] Detect existing formatting in selected text
        - [x] Remove formatting when already applied (toggle off)
        - [x] Apply formatting when not present (toggle on)
        - [x] Handle mixed formatting states in selections
        - [x] Update toolbar/UI to reflect current formatting state
- [x] Paragraph handling and structure
    - [x] Paragraph creation and management
        - [x] Automatic paragraph wrapping for content
        - [x] Paragraph boundary detection and navigation
        - [x] Empty paragraph handling and cleanup
    - [x] Paragraph formatting operations
        - [x] Apply formatting to entire paragraphs
        - [x] Preserve paragraph structure during formatting
        - [x] Handle cross-paragraph selections
    - [ ] Paragraph-aware cursor positioning
        - [ ] Maintain cursor position within paragraph context
        - [ ] Handle cursor movement between paragraphs
        - [ ] Preserve cursor position during virtual DOM updates
- [ ] List management
    - [ ] Bulleted lists (ul)
    - [ ] Numbered lists (ol)
    - [ ] List nesting support
    - [ ] List item navigation
- [x] Keyboard event handling
    - [x] Enter key behavior (new paragraphs/list items)
        - [x] Create new paragraph on Enter key press
        - [x] Handle Enter within formatted text
        - [x] Preserve formatting in new paragraphs when appropriate
        - [x] Handle Enter at beginning/middle/end of paragraphs
    - [x] Backspace/Delete key behavior
        - [x] Merge paragraphs when deleting paragraph boundaries
        - [x] Handle backspace at paragraph beginnings
        - [x] Preserve formatting during paragraph merging
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
- [x] Integration tests for the component
    - [x] User interaction scenarios
    - [x] Keyboard event handling
    - [x] Clipboard operations
    - [x] Accessibility compliance
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
    - [ ] Cleanup event listeners
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

### 9. Editor Class Design Decision
- [x] Create Editor class to encapsulate FSM and virtual DOM
    - [x] Design Editor class interface for browser event handling
    - [x] Implement onChange listener registration for RichTextEditor2 component
    - [x] Make RichTextEditor2 component thin and delegating to Editor
    - [x] Follow CAMS dependency inversion and good-fences principles
- [x] Delegate Editor responsibilities to helper functions
  - [x] Prefer pure functions that can be imported from library modules
  - [x] Write library modules to `services` subdirectory under the `editor` directory

### 11. Documentation and Migration
- [ ] Architecture documentation
    - [ ] Finite state machine design
    - [ ] Virtual DOM structure
    - [ ] HTML encoding strategy
    - [ ] Editor class architecture and interface

## Implementation Phases

### Phase 1: Core Architecture
1. [x] Implement basic finite state machine
2. [X] Create virtual DOM structure
3. [x] Set up HTML encoding/decoding
4. [x] Implement Editor abstraction from RichTextEditor2

### Phase 2: Basic Editor Functionality
1. [x] Text input and editing
2. [x] Basic formatting (bold, italic, underline)
3. [x] Style toggling implementation
    - [x] Implement formatting state detection in Editor class
    - [x] Create toggleFormatting method to replace applyFormatting
    - [x] Add virtual DOM utilities for format detection and removal
    - [x] Update keyboard shortcut handlers to use toggle functionality
    - [x] Add comprehensive tests for toggle behavior
    - [x] Handle edge cases (partial selections, nested formatting)
4. [x] Paragraph handling
    - [x] Virtual DOM paragraph operations
        - [x] Implement paragraph node creation and insertion in virtual DOM
        - [x] Add paragraph boundary detection utilities
        - [x] Create paragraph splitting operations for Enter key handling
        - [x] Implement paragraph merging operations for Backspace/Delete
        - [x] Add cross-paragraph content manipulation support
    - [x] Paragraph-aware editor behaviors
        - [x] Implement Enter key paragraph creation logic
        - [x] Add Backspace/Delete paragraph merging behavior
        - [ ] Create paragraph navigation and cursor positioning
        - [x] Handle formatting preservation across paragraph operations
    - [ ] HTML structure and encoding
        - [ ] Ensure proper paragraph HTML output (<p> tags)
        - [ ] Handle paragraph-based content parsing from HTML input
        - [ ] Maintain paragraph structure during HTML sanitization
    - [ ] Integration with existing systems
        - [ ] Update FSM to handle paragraph-related state transitions
        - [ ] Integrate paragraph operations with formatting system
        - [ ] Ensure paragraph handling works with clipboard operations
        - [x] Add comprehensive tests for paragraph functionality

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
