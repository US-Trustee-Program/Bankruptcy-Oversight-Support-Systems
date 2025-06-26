# CAMS-526 RichTextEditor2 Implementation Goals

## Overview
This document outlines the implementation plan for RichTextEditor2, a new rich text editor component that uses a finite state machine for state management, virtual DOM for document representation, and HTML encoding for content storage.

## Guidelines

- Use vitest for unit testing.
- Use the BrowserSelectionService humble object for tests in place of tight coupling with the browser API.
- Use test-driven development practices. Write tests before writing implementation.

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
- [ ] Integrate FSM with React component lifecycle
    - [x] Connect FSM state to React state
    - [ ] Handle state transitions in event handlers
    - [ ] Ensure proper cleanup and state reset

### 2. Virtual DOM for Document State
- [x] Design virtual DOM structure for rich text content
    - [x] Define node types (text, element, formatting)
    - [x] Create virtual DOM tree structure
    - [x] Implement virtual DOM manipulation methods
- [ ] Implement virtual DOM to real DOM synchronization
    - [ ] Create diff algorithm for virtual DOM changes
    - [ ] Implement efficient DOM updates
    - [ ] Handle cursor position preservation during updates
- [ ] Virtual DOM operations
    - [ ] Insert/delete operations
    - [ ] Text formatting operations
    - [ ] List management operations
    - [ ] Undo/redo support through virtual DOM snapshots

### 3. HTML Encoding and Content Management
- [ ] Implement robust HTML encoding/decoding
    - [ ] Safe HTML parsing from external sources
    - [ ] HTML sanitization for security
    - [ ] Consistent HTML output formatting
- [ ] Content validation and normalization
    - [ ] Validate HTML structure
    - [ ] Normalize whitespace and formatting
    - [ ] Handle edge cases in HTML content

### 4. Core Editor Features
- [ ] Text formatting capabilities
    - [ ] Bold, italic, underline formatting
    - [ ] Format application through FSM
    - [ ] Format removal and toggling
- [ ] List management
    - [ ] Bulleted lists (ul)
    - [ ] Numbered lists (ol)
    - [ ] List nesting support
    - [ ] List item navigation
- [ ] Keyboard event handling
    - [ ] Enter key behavior (new paragraphs/list items)
    - [ ] Backspace/Delete key behavior
    - [ ] Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U)
    - [ ] Tab navigation and indentation
- [ ] Clipboard operations
    - [ ] Paste handling with HTML sanitization
    - [ ] Copy/cut operations
    - [ ] Rich text preservation in clipboard

### 5. Component Interface Compatibility
- [ ] Maintain same prop interface as RichTextEditor
    - [ ] id, label, ariaDescription, onChange, disabled, required, className
- [ ] Maintain same ref interface as RichTextEditor
    - [ ] clearValue, getValue, getHtml, setValue, disable, focus methods
- [ ] Ensure drop-in replacement capability
    - [ ] Same CSS class structure
    - [ ] Same accessibility attributes
    - [ ] Same event handling patterns

### 6. Testing Strategy
- [ ] Unit tests for finite state machine
    - [ ] State transition testing
    - [ ] Edge case handling
    - [ ] State consistency validation
- [ ] Unit tests for virtual DOM
    - [ ] Virtual DOM manipulation
    - [ ] Diff algorithm testing
    - [ ] DOM synchronization testing
- [ ] Integration tests for component
    - [ ] User interaction scenarios
    - [ ] Keyboard event handling
    - [ ] Clipboard operations
    - [ ] Accessibility compliance
- [ ] Performance testing
    - [ ] Large document handling
    - [ ] Rapid input scenarios
    - [ ] Memory usage optimization

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
2. [X] Create virtual DOM structure
3. Set up HTML encoding/decoding

### Phase 2: Basic Editor Functionality
1. Text input and editing
2. Basic formatting (bold, italic, underline)
3. Paragraph handling

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
