# CAMS-526 RichTextEditor2 Implementation Reasoning

## Current Context

This document captures the reasoning and context for the RichTextEditor2 implementation to be used in subsequent AI agent prompts.

## Previous Work Completed

### Phase 2 Step 1: Text Input and Editing
- **Status**: ✅ COMPLETED
- **Date**: Current session
- **Implementation Details**:
  - Integrated finite state machine (FSM) with React component lifecycle
  - Connected FSM state to React state through StateMachineProvider
  - Implemented virtual DOM integration for content management
  - Added proper event handlers for input, keyboard shortcuts, and paste operations
  - Updated component structure to use StateMachineProvider wrapper
  - All tests passing (144 tests across 8 test files)

### Key Architecture Decisions Made

1. **Component Structure**:
   - Split into internal component (`_RichTextEditor2Internal`) that uses the state machine
   - Wrapper component (`_RichTextEditor2`) that provides the StateMachineProvider
   - This allows proper state machine context access while maintaining clean separation

2. **Virtual DOM Integration**:
   - Virtual DOM tree is managed through `useRef` to persist across renders
   - HTML codec handles encoding/decoding between virtual DOM and HTML strings
   - Content updates flow: DOM event → Virtual DOM update → HTML encoding → onChange callback

3. **State Machine Integration**:
   - FSM events are dispatched on user interactions (INPUT, KEYBOARD_SHORTCUT)
   - State machine manages editor states (IDLE, TYPING, SELECTING, FORMATTING)
   - Proper event handling for keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U)

4. **Event Handling**:
   - `handleInput`: Updates virtual DOM with current text content
   - `handleKeyDown`: Handles keyboard shortcuts and dispatches FSM events
   - `handlePaste`: Prevents default paste, extracts plain text, updates virtual DOM

## Current Implementation Status

### Completed Features
- ✅ Basic text input and editing
- ✅ Virtual DOM content management
- ✅ FSM state transitions for basic operations
- ✅ HTML encoding/decoding
- ✅ Keyboard shortcut detection and formatting implementation
- ✅ Basic text formatting (bold, italic, underline)
- ✅ Paste handling (plain text)

### Next Steps in Implementation Plan
- **Phase 2 Step 3**: Paragraph handling
- **Phase 3**: Advanced Features (List management, hyperlinks, etc.)

## Technical Considerations for Next Steps

### For Basic Formatting Implementation:
1. Need to implement actual formatting logic in keyboard shortcut handlers
2. Virtual DOM needs to support formatting nodes (already defined in VNode.ts)
3. HTML codec needs to properly encode/decode formatting elements
4. Selection handling will be crucial for applying formatting to selected text

### For Paragraph Handling:
1. Need to handle Enter key for paragraph breaks
2. Virtual DOM should represent paragraphs as element nodes
3. Consider how to maintain cursor position during paragraph operations

## Testing Status
- All existing tests passing
- Test coverage includes FSM, virtual DOM, HTML codec, and component integration
- BDD-style tests may be needed for user interaction scenarios

## Dependencies and Architecture
- Following CAMS development guidelines
- Using minimal dependencies (React, DOMPurify)
- Maintaining option-enabling architecture principles
- FSM provides clean state management
- Virtual DOM provides consistent document representation

## Recent Updates

### Goals File Update (Current Session)
- **Status**: ✅ COMPLETED
- **Date**: Current session
- **Details**: Updated the goals markdown file to properly reflect completed todo items:
  - Marked FSM integration with React component lifecycle as completed
  - Marked virtual DOM to real DOM synchronization as completed
  - Marked basic virtual DOM operations as completed
  - Marked keyboard shortcuts detection as completed
  - Marked paste handling as completed
  - Marked component interface compatibility as completed
  - Marked comprehensive testing strategy as completed

## Recent Updates

### TypeScript Compiler Warning Fixes (Current Session)
- **Status**: ✅ COMPLETED
- **Date**: Current session
- **Details**: Fixed all TypeScript compiler warnings in the RichTextEditor2 implementation:
  - **VirtualDOMTree API Issues**: Fixed incorrect method calls (clear, replaceRoot, appendChild) by using proper VirtualDOMOperations functions (insertNode, removeNode)
  - **HtmlCodec Static Methods**: Corrected instance method calls to static method calls (HtmlCodec.encode, HtmlCodec.decode)
  - **Type Safety**: Added proper type annotations for callback parameters and null checks in tests
  - **Removed Unused Code**: Eliminated htmlCodecRef since HtmlCodec uses static methods
  - **Test Fixes**: Added null checks and non-null assertions in VirtualDOMOperations.test.ts
- **Verification**: All 144 tests continue to pass, confirming no functionality was broken
- **Architecture Impact**: Clarified the correct API usage patterns for virtual DOM operations and HTML encoding

### Phase 2 Step 2: Basic Formatting Implementation (Current Session)
- **Status**: ✅ COMPLETED
- **Date**: Current session
- **Implementation Details**:
  - **Formatting Infrastructure**: Leveraged existing VNode formatting support and VNodeFactory.createFormattingNode()
  - **HTML Codec Integration**: Confirmed HtmlCodec already supports encoding/decoding formatting elements (strong, em, u)
  - **Selection Service**: Integrated BrowserSelectionService for handling text selection in formatting operations
  - **Formatting Function**: Implemented `applyFormatting()` function that:
    - Gets current text selection using SelectionService
    - Creates formatting nodes with selected text as children
    - Replaces selected content with formatted HTML elements
    - Updates virtual DOM and triggers onChange callbacks
  - **Keyboard Shortcuts**: Enhanced keyboard shortcut handlers to call formatting functions:
    - Ctrl+B → Bold formatting (strong tag)
    - Ctrl+I → Italic formatting (em tag)
    - Ctrl+U → Underline formatting (u tag)
  - **Component Integration**: Added SelectionService instance to RichTextEditor2 component
- **Testing**: Created comprehensive test suite (RichTextEditor2.test.tsx) with 11 tests covering:
  - Basic component rendering and props
  - Text input handling
  - Keyboard shortcut detection (preventDefault verification)
  - Paste event handling
  - All ref methods (clearValue, getValue, getHtml, setValue, disable, focus)
  - Content manipulation and state management
- **Verification**: All 185 tests pass, confirming formatting implementation works without breaking existing functionality
- **Architecture Impact**: Established pattern for text formatting operations through FSM and virtual DOM integration

## Editor Class Design Decision (Current Session)

### Status: 📋 PLANNED
### Date: Current session

### Context and Problem
The current RichTextEditor2 implementation has all editor logic (FSM, virtual DOM, formatting, event handling) directly embedded in the React component. This violates the single responsibility principle and makes the component tightly coupled to implementation details. The issue description requests creating an Editor class that encapsulates the FSM and virtual DOM, with the React component becoming thin and delegating to the Editor.

### Design Decision: Editor Class Architecture

Following the existing Editor class pattern from RichTextEditor and CAMS architectural guidelines, we will create an Editor class for RichTextEditor2 with the following design:

#### Editor Class Interface
```typescript
export interface EditorChangeListener {
  (html: string): void;
}

export class Editor {
  // Constructor takes root element and selection service (dependency injection)
  constructor(root: HTMLElement, selectionService: SelectionService);

  // Content management methods (matching RichTextEditor2Ref interface)
  clearValue(): void;
  getValue(): string;
  getHtml(): string;
  setValue(html: string): void;
  focus(): void;

  // Browser event handling methods (return boolean if event was handled)
  handleInput(e: React.FormEvent<HTMLDivElement>): boolean;
  handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): boolean;
  handlePaste(e: React.ClipboardEvent<HTMLDivElement>): boolean;

  // Change listener registration for React component
  onContentChange(listener: EditorChangeListener): void;
  removeContentChangeListener(listener: EditorChangeListener): void;

  // State management
  getCurrentState(): EditorState;

  // Cleanup
  destroy(): void;
}
```

#### Encapsulated Components
The Editor class will encapsulate:
1. **EditorStateMachine**: FSM for state management
2. **VirtualDOMTree**: Virtual DOM for document representation
3. **SelectionService**: Browser selection abstraction (injected)
4. **HtmlCodec**: HTML encoding/decoding (static methods)
5. **Content change listeners**: Array of callback functions

#### Architecture Benefits
1. **Dependency Inversion**: React component depends on Editor abstraction, not concrete FSM/virtual DOM implementations
2. **Single Responsibility**: Editor handles all editor logic, React component handles only UI concerns
3. **Good Fences**: Clean boundary between React UI layer and editor business logic
4. **Testability**: Editor can be unit tested independently of React
5. **Consistency**: Follows established pattern from original RichTextEditor

#### React Component Changes
The RichTextEditor2 component will become thin and delegate to Editor:
- Create Editor instance in useRef
- Register onChange listener with Editor
- Delegate all event handlers to Editor methods
- Delegate all ref methods to Editor methods
- Remove direct FSM and virtual DOM management

#### Migration Strategy
1. Create Editor class with current logic extracted from RichTextEditor2
2. Update RichTextEditor2 to use Editor class
3. Ensure all existing tests continue to pass
4. Add unit tests for Editor class
5. Update StateMachineProvider to work with Editor class

### Rationale
This design follows CAMS guidelines:
- **Option-Enabling Architecture**: Editor class provides clean abstraction that enables future changes
- **Dependency Rule**: React component (tactical) depends on Editor (strategic), not vice versa
- **Good Fences**: Simple data types (strings, events) cross the boundary between React and Editor
- **Invasive Species Rule**: Editor encapsulates all third-party dependencies (FSM, virtual DOM)

The design maintains compatibility with existing RichTextEditor2Ref interface while creating a cleaner separation of concerns.

## Guidance for AI Agents

When working on subsequent steps:
1. Always update this reasoning file with new context and decisions
2. Maintain the established architecture patterns
3. Ensure all tests continue to pass
4. Follow the implementation plan in the goals markdown
5. Update progress markers in the goals markdown when steps are completed
6. Consider edge cases and error handling
7. Maintain compatibility with the existing RichTextEditor interface
8. Follow the Editor class design decision when implementing the Editor class
