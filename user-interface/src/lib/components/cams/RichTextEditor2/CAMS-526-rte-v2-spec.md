# CAMS-526 RichTextEditor2 Component Specification

## Overview

This specification documents the RichTextEditor2 component implementation for the CAMS (Case
Management System) project. The component is designed as a drop-in replacement for the existing
RichTextEditor, featuring improved architecture with finite state machine (FSM) state management,
virtual DOM document representation, and HTML encoding for content storage.

## Architecture Overview

### Core Design Principles

The RichTextEditor2 follows CAMS development guidelines and implements an Option-Enabling Software
Architecture (OeSA):

- **Screaming Architecture**: Directory structure reflects the domain (rich text editing) rather
  than technical implementation
- **Dependency Rule**: Strategic components (Editor, FSM) do not depend on tactical components
  (React, DOM APIs)
- **Good Fences**: Clean boundaries with simple data types crossing major boundaries
- **Invasive Species Rule**: Third-party dependencies are isolated through humble objects and
  adapters

### Component Architecture

```
RichTextEditor2/
├── RichTextEditor2.tsx           # Thin React component (UI layer)
├── editor/
│   ├── Editor.ts                 # Core editor logic (strategic)
│   └── services/                 # Pure function services
│       ├── FormattingDetectionService.ts
│       ├── FormattingRemovalService.ts
│       └── ParagraphOperationsService.ts
├── state-machine/
│   ├── StateMachine.ts           # Finite state machine
│   └── StateMachineContext.tsx   # React context wrapper
├── virtual-dom/
│   ├── VNode.ts                  # Virtual node definitions
│   ├── VNodeFactory.ts           # Node creation utilities
│   ├── VirtualDOMTree.ts         # Tree management
│   ├── VirtualDOMOperations.ts   # Tree operations
│   └── HtmlCodec.ts              # HTML encoding/decoding
└── SelectionService.humble.ts    # Browser selection abstraction
```

## Current Implementation Status

### Completed Features ✅

#### Phase 1: Core Architecture

- **Finite State Machine**: Complete FSM implementation with states (IDLE, TYPING, SELECTING,
  FORMATTING)
- **Virtual DOM**: Full virtual DOM structure with node types, tree operations, and synchronization
- **HTML Encoding**: Robust HTML encoding/decoding with DOMPurify sanitization
- **Editor Class**: Complete Editor abstraction encapsulating FSM and virtual DOM

#### Phase 2: Basic Editor Functionality

- **Text Input and Editing**: Full text input handling with virtual DOM integration
- **Basic Formatting**: Bold, italic, underline formatting with toggle functionality
- **Style Toggling**: Complete implementation with formatting detection and removal services
- **Paragraph Handling**: Comprehensive paragraph operations including:
  - Enter key paragraph creation and splitting
  - Backspace/Delete paragraph merging
  - Paragraph formatting operations
  - Cross-paragraph content manipulation
  - Enhanced cursor positioning within paragraphs
  - Paragraph boundary detection and navigation
  - Cursor position preservation during virtual DOM updates

#### Component Interface

- **Props Interface**: Complete compatibility with original RichTextEditor props
- **Ref Interface**: All ref methods implemented (clearValue, getValue, getHtml, setValue, disable,
  focus)
- **Event Handling**: Full keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U) and paste handling

#### Testing Infrastructure

- **Comprehensive Test Coverage**: 296 tests across all components
- **Unit Tests**: FSM, virtual DOM, services, and Editor class
- **Integration Tests**: Component-level user interaction scenarios
- **Test-Driven Development**: All features implemented with tests-first approach

### Remaining Work 🚧

#### Phase 3: Advanced Features

1. **Toolbar Implementation** 🔄

   - Integrate RichTextButton components with state machine
   - Visual feedback for formatting state
   - Accessibility compliance for toolbar
   - Keyboard navigation support

2. **List Management** ⏳

   - Bulleted lists (ul) creation and management
   - Numbered lists (ol) creation and management
   - List nesting support (sub-lists)
   - List item navigation and manipulation
   - List-to-paragraph and paragraph-to-list conversion

3. **Advanced Keyboard Handling** ⏳

   - Tab navigation and indentation
   - List-specific keyboard shortcuts
   - Advanced cursor positioning

4. **Enhanced Clipboard Operations** ⏳
   - Copy/cut operations with rich text preservation
   - Rich text preservation in clipboard
   - Improved paste handling for complex HTML

#### Phase 4: Polish and Optimization

1. **Performance Optimization** ⏳

   - Virtual DOM operation optimization
   - Debouncing expensive operations
   - Memory management improvements
   - Large document handling optimization

2. **Accessibility and UX** ⏳

   - ARIA attributes and roles enhancement
   - Screen reader compatibility improvements
   - Smooth cursor movement
   - Visual feedback for state changes

3. **Content Management** ⏳
   - HTML structure validation
   - Whitespace and formatting normalization
   - Edge case handling in HTML content

## Technical Specifications

### Editor Class Interface

```typescript
export interface EditorChangeListener {
  (html: string): void;
}

export class Editor {
  constructor(root: HTMLElement, selectionService: SelectionService);

  // Content management
  clearValue(): void;
  getValue(): string;
  getHtml(): string;
  setValue(html: string): void;
  focus(): void;
  disable(disabled: boolean): void;

  // Event handling
  handleInput(e: React.FormEvent<HTMLDivElement>): boolean;
  handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): boolean;
  handlePaste(e: React.ClipboardEvent<HTMLDivElement>): boolean;

  // Change listeners
  onContentChange(listener: EditorChangeListener): void;
  removeContentChangeListener(listener: EditorChangeListener): void;

  // State management
  getCurrentState(): EditorState;

  // Cleanup
  destroy(): void;
}
```

### React Component Interface

```typescript
export interface RichTextEditor2Props {
  id: string;
  label?: string;
  ariaDescription?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export interface RichTextEditor2Ref {
  clearValue: () => void;
  getValue: () => string;
  getHtml: () => string;
  setValue: (value: string) => void;
  disable: (value: boolean) => void;
  focus: () => void;
}
```

### Services Architecture

All services follow the pure function pattern and are located in `editor/services/`:

- **FormattingDetectionService**: Pure functions for detecting formatting states
- **FormattingRemovalService**: Pure functions for removing formatting
- **ParagraphOperationsService**: Pure functions for paragraph manipulation

### State Machine States

```typescript
enum EditorState {
  IDLE = 'IDLE',
  TYPING = 'TYPING',
  SELECTING = 'SELECTING',
  FORMATTING = 'FORMATTING',
}

enum EditorEvent {
  INPUT = 'INPUT',
  KEYBOARD_SHORTCUT = 'KEYBOARD_SHORTCUT',
  SELECTION_CHANGE = 'SELECTION_CHANGE',
  RESET = 'RESET',
}
```

### Virtual DOM Structure

```typescript
interface VNode {
  type: 'text' | 'element';
  tagName?: string;
  attributes?: Record<string, string>;
  textContent?: string;
  children: VNode[];
  parent?: VNode;
}
```

## Paragraph Handling Design Directives

### Core Paragraph Behavior Requirements

The RichTextEditor2 component must adhere to specific paragraph handling behaviors to ensure
consistent and predictable user experience:

#### 1. Initialization Behavior

- **Initial Structure**: Upon component initialization, the editor must contain a single empty
  paragraph (`<p>`) element as the first and only child of the root contenteditable div
- **No Direct Text Nodes**: The root div must never contain text nodes as direct children; all text
  content must be wrapped in paragraph elements
- **Non-Deletable Root Paragraph**: The initial empty paragraph cannot be deleted by user actions
  (Backspace, Delete keys)
- **HTML Structure**: The initial state should render as:
  ```html
  <div contenteditable="true">
    <p></p>
  </div>
  ```

#### 2. Enter Key Behavior

- **New Paragraph Creation**: When the Enter key is pressed, create a new empty paragraph (`<p>`)
  element
- **Cursor Positioning**: Place the cursor inside the newly created paragraph at the beginning of
  the paragraph
- **Visual Behavior**: This creates the visual effect of a new line with the cursor positioned at
  the start
- **Paragraph Splitting**: If Enter is pressed within existing content, split the current paragraph
  at the cursor position, creating two paragraphs

#### 3. Paragraph Structure Maintenance

- **Consistent Wrapper**: All text content must be contained within paragraph elements
- **Empty Paragraph Handling**: Empty paragraphs should be preserved to maintain line structure
- **Cross-Paragraph Operations**: Formatting and editing operations must respect paragraph
  boundaries
- **HTML Output**: All HTML output must maintain proper paragraph structure with `<p>` tags

#### 4. Implementation Requirements

- **Virtual DOM Support**: The virtual DOM must properly represent paragraph structure
- **ParagraphOperationsService**: Paragraph operations must be implemented through the
  ParagraphOperationsService
- **State Machine Integration**: Paragraph creation and manipulation must integrate with the editor
  state machine
- **Selection Management**: Cursor positioning and selection must be paragraph-aware

#### 5. Browser Compatibility

- **Cross-Browser Consistency**: Paragraph behavior must be consistent across all supported browsers
- **DOM Normalization**: The component must normalize browser-specific paragraph handling
  differences
- **Selection Preservation**: Cursor position must be preserved during paragraph operations

### Technical Implementation Notes

These directives ensure that:

- The editor maintains a predictable document structure
- Text content is always properly containerized in semantic HTML elements
- User interactions (Enter key, content editing) behave consistently
- The virtual DOM and actual DOM remain synchronized with paragraph structure
- Accessibility standards are maintained through proper semantic markup

## Implementation Guidelines

### Development Practices

1. **Test-Driven Development**: Write tests before implementation
2. **Pure Functions**: Prefer pure functions in services over stateful classes
3. **Dependency Injection**: Use constructor injection for dependencies
4. **Error Handling**: Implement comprehensive error handling and edge cases
5. **TypeScript**: Maintain strict TypeScript compliance with no compiler warnings

### Code Organization

1. **Services Pattern**: Implement new functionality as pure functions in services directory
2. **Single Responsibility**: Each service should have a single, well-defined responsibility
3. **Interface Segregation**: Define minimal interfaces for dependencies
4. **Dependency Inversion**: Depend on abstractions, not concretions

### Testing Requirements

1. **Unit Test Coverage**: Maintain 100% line and branch coverage
2. **Integration Tests**: Test component behavior from user perspective
3. **Mock Dependencies**: Use humble objects for browser APIs
4. **BDD-Style Tests**: Write behavior-driven tests for user scenarios

## Next Implementation Steps

### Priority 1: Toolbar Implementation

**Objective**: Complete the visual toolbar with formatting buttons

**Tasks**:

1. Integrate RichTextButton components with Editor class
2. Implement toolbar state synchronization with formatting state
3. Add visual feedback for active formatting
4. Ensure accessibility compliance
5. Add keyboard navigation support

**Acceptance Criteria**:

- Toolbar buttons reflect current formatting state
- Clicking buttons toggles formatting correctly
- Keyboard shortcuts work alongside toolbar buttons
- ARIA attributes provide proper accessibility
- All existing tests continue to pass

### Priority 2: List Management

**Objective**: Implement bulleted and numbered list functionality

**Tasks**:

1. Create ListOperationsService with pure functions
2. Extend virtual DOM to support list nodes (ul, ol, li)
3. Implement list creation and conversion operations
4. Add list-specific keyboard handling
5. Implement list nesting support

**Acceptance Criteria**:

- Users can create bulleted and numbered lists
- Lists can be nested and un-nested
- List items can be converted to paragraphs and vice versa
- Keyboard navigation works within lists
- List formatting is preserved during operations

### Priority 3: Performance Optimization

**Objective**: Optimize component performance for large documents

**Tasks**:

1. Implement virtual DOM operation batching
2. Add debouncing for expensive operations
3. Optimize memory usage and cleanup
4. Add performance monitoring and metrics

**Acceptance Criteria**:

- Component handles large documents (>10KB) smoothly
- Memory usage remains stable during extended use
- Virtual DOM operations are efficiently batched
- No memory leaks in long-running sessions

## Success Criteria

### Functional Requirements

- ✅ Drop-in replacement for existing RichTextEditor
- ✅ Maintains same prop and ref interface
- ✅ Supports basic text formatting (bold, italic, underline)
- ✅ Handles paragraph operations correctly
- 🚧 Supports list creation and management
- 🚧 Provides accessible toolbar interface
- 🚧 Handles large documents efficiently

### Non-Functional Requirements

- ✅ Maintainable and extensible architecture
- ✅ Comprehensive test coverage (296 tests passing)
- ✅ TypeScript compliance with no compiler warnings
- ✅ Follows CAMS development guidelines
- 🚧 Performance optimized for production use
- 🚧 Full accessibility compliance (WCAG 2.1 AA)

### Technical Requirements

- ✅ Finite state machine for state management
- ✅ Virtual DOM for document representation
- ✅ HTML encoding with XSS protection
- ✅ Services architecture with pure functions
- ✅ Dependency injection and inversion
- ✅ Clean separation of concerns

## Dependencies

### Allowed Dependencies

- **React**: Core library for UI components
- **DOMPurify**: HTML sanitization for XSS protection

### Internal Dependencies

- **CAMS Design System**: RichTextButton and other UI components
- **Testing Libraries**: @testing-library/react, vitest
- **TypeScript**: Type safety and development tooling

## Migration Strategy

The RichTextEditor2 is designed as a drop-in replacement:

1. **Interface Compatibility**: Same props and ref interface as original
2. **CSS Compatibility**: Same CSS class structure
3. **Event Compatibility**: Same event handling patterns
4. **Accessibility Compatibility**: Same ARIA attributes and roles

## Conclusion

The RichTextEditor2 component represents a significant architectural improvement over the original
RichTextEditor. With its FSM-based state management, virtual DOM document representation, and
services-based architecture, it provides a solid foundation for rich text editing functionality in
the CAMS application.

The current implementation has successfully completed the core architecture and basic functionality
phases. The remaining work focuses on advanced features (lists, toolbar), performance optimization,
and accessibility enhancements.

The component follows CAMS development guidelines and implements option-enabling architecture
principles, making it maintainable, testable, and extensible for future requirements.
