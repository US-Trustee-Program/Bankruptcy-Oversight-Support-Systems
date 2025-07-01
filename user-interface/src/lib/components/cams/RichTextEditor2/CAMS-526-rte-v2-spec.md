# DESIGN LOG: CAMS RichTextEditor2 Component

## 1. Project Overview & Core Goals

*   **Objective:** Develop a drop-in replacement for the existing RichTextEditor component with improved architecture, finite state machine state management, virtual DOM document representation, and HTML encoding for content storage.
*   **Core Goals:**
    *   Maintainability through Option-Enabling Software Architecture (OeSA)
    *   Scalability with virtual DOM and FSM-based state management
    *   Fast User Experience with optimized rendering and operations
    *   Low Operational Cost through comprehensive testing and clean architecture
    *   Accessibility compliance (WCAG 2.1 AA)
    *   XSS protection through HTML sanitization

## 2. Architectural Decisions

### DECISION-001: Finite State Machine for State Management
*   **Context:** The original RichTextEditor lacked clear state management, leading to unpredictable behavior and difficult debugging.
*   **Decision:** Implement a finite state machine with four distinct states: IDLE, TYPING, SELECTING, and FORMATTING.
*   **Alternatives Considered:**
    *   **Alternative A:** React state management with useState/useReducer
    *   **Alternative B:** External state management library (Redux, Zustand)
    *   **Alternative C:** No formal state management (status quo)
*   **Rationale & Trade-offs:** FSM provides predictable state transitions and makes the component behavior explicit and testable. Trade-off: Additional complexity in implementation, but significant gains in maintainability and debugging.
*   **Implications:** All user interactions must be modeled as state transitions, requiring careful design of events and state handlers.

### DECISION-002: Virtual DOM Document Representation
*   **Context:** Direct DOM manipulation in the original component led to synchronization issues and performance problems.
*   **Decision:** Implement a virtual DOM tree structure to represent document state, with synchronization to actual DOM.
*   **Alternatives Considered:**
    *   **Alternative A:** Direct DOM manipulation (status quo)
    *   **Alternative B:** Document fragments for batch operations
    *   **Alternative C:** Third-party virtual DOM library
*   **Rationale & Trade-offs:** Virtual DOM provides predictable document state, enables efficient batch operations, and simplifies testing. Trade-off: Memory overhead and complexity, but gains in reliability and performance.
*   **Implications:** All document operations must work through virtual DOM, requiring comprehensive tree operation utilities.

### DECISION-003: Services Architecture with Pure Functions
*   **Context:** Need for testable, reusable business logic separated from UI concerns.
*   **Decision:** Implement core functionality as pure functions in service modules (FormattingDetectionService, FormattingRemovalService, ParagraphOperationsService).
*   **Alternatives Considered:**
    *   **Alternative A:** Class-based services with instance methods
    *   **Alternative B:** Inline functions within components
    *   **Alternative C:** Utility classes with static methods
*   **Rationale & Trade-offs:** Pure functions are easier to test, reason about, and compose. They eliminate side effects and improve reliability. Trade-off: Requires careful dependency injection, but gains in testability and maintainability.
*   **Implications:** All business logic must be stateless and depend only on input parameters.

### DECISION-004: Dependency Inversion with Humble Objects
*   **Context:** Need to isolate browser APIs and third-party dependencies from core business logic.
*   **Decision:** Use humble objects and adapters to abstract browser selection APIs and other external dependencies.
*   **Alternatives Considered:**
    *   **Alternative A:** Direct browser API usage throughout codebase
    *   **Alternative B:** Wrapper classes for browser APIs
    *   **Alternative C:** Mock browser APIs in tests only
*   **Rationale & Trade-offs:** Humble objects enable comprehensive unit testing and reduce coupling to browser-specific behavior. Trade-off: Additional abstraction layer, but significant gains in testability and portability.
*   **Implications:** All browser interactions must go through abstraction interfaces.

### DECISION-005: HTML Encoding with DOMPurify Sanitization
*   **Context:** Need for secure HTML storage and XSS protection while maintaining rich text formatting.
*   **Decision:** Use DOMPurify for HTML sanitization with custom configuration for allowed tags and attributes.
*   **Alternatives Considered:**
    *   **Alternative A:** Custom HTML sanitization implementation
    *   **Alternative B:** No sanitization (security risk)
    *   **Alternative C:** Plain text storage only
*   **Rationale & Trade-offs:** DOMPurify is battle-tested and maintained, providing robust XSS protection. Trade-off: External dependency, but critical security benefits.
*   **Implications:** All HTML content must be sanitized before storage or display.

### DECISION-006: List Management Architecture
*   **Context:** Need to support bulleted and numbered lists with nesting capabilities while maintaining virtual DOM consistency.
*   **Decision:** Implement ListOperationsService with pure functions for list creation, conversion, and nesting operations. Extend virtual DOM to support ul, ol, and li node types.
*   **Alternatives Considered:**
    *   **Alternative A:** Direct DOM manipulation for list operations
    *   **Alternative B:** Third-party list management library
    *   **Alternative C:** Simplified list support without nesting
*   **Rationale & Trade-offs:** Service-based approach maintains architectural consistency and testability. Virtual DOM extension ensures predictable list state management. Trade-off: Increased complexity, but comprehensive list functionality.
*   **Implications:** Requires new VNode types, list-specific keyboard handlers, and conversion utilities between paragraphs and list items.

### DECISION-007: Performance Optimization Strategy
*   **Context:** Need to handle large documents efficiently while maintaining responsive user experience.
*   **Decision:** Implement virtual DOM operation batching, debounced onChange callbacks, and memory management patterns.
*   **Alternatives Considered:**
    *   **Alternative A:** Real-time operations without batching
    *   **Alternative B:** Virtualization for large document rendering
    *   **Alternative C:** Lazy loading of document sections
*   **Rationale & Trade-offs:** Batching reduces DOM thrashing and improves performance. Debouncing prevents excessive callback execution. Trade-off: Slight delay in operations, but significant performance gains.
*   **Implications:** Requires operation queue management, batch processing logic, and performance monitoring utilities.

### DECISION-008: Accessibility Enhancement Design
*   **Context:** Need to meet WCAG 2.1 AA compliance and provide comprehensive screen reader support.
*   **Decision:** Implement ARIA attributes, keyboard navigation patterns, and screen reader announcements through dedicated accessibility service.
*   **Alternatives Considered:**
    *   **Alternative A:** Basic ARIA attributes only
    *   **Alternative B:** Third-party accessibility library
    *   **Alternative C:** Browser default accessibility features
*   **Rationale & Trade-offs:** Comprehensive accessibility ensures legal compliance and inclusive user experience. Service-based approach maintains testability. Trade-off: Additional implementation complexity, but critical accessibility benefits.
*   **Implications:** Requires AccessibilityService, ARIA state management, and keyboard navigation handlers.

### DECISION-009: Empty Paragraph Definition with Zero-Width Space
*   **Context:** Need for consistent representation of empty paragraphs across different browsers and editing scenarios while maintaining semantic correctness and accessibility.
*   **Decision:** Define empty paragraphs as paragraph elements containing a single zero-width space character (U+200B) instead of `<br>` tags or truly empty elements.
*   **Alternatives Considered:**
    *   **Alternative A:** Empty paragraph elements with no content (`<p></p>`)
    *   **Alternative B:** Paragraph elements with `<br>` tags (`<p><br></p>`)
    *   **Alternative C:** Non-breaking space character (`&nbsp;`)
*   **Rationale & Trade-offs:** Zero-width space provides consistent cursor positioning across browsers, maintains semantic paragraph structure, and ensures accessibility compliance. Unlike `<br>` tags, it doesn't introduce visual spacing issues. Unlike empty elements, it provides a reliable cursor target. Trade-off: Slightly more complex content handling, but significant gains in cross-browser consistency and user experience.
*   **Implications:** All paragraph creation, splitting, and merging operations must use the ZERO_WIDTH_SPACE constant. HTML encoding/decoding must handle zero-width space characters appropriately. Testing must account for zero-width space in empty paragraph assertions.

### DECISION-010: Core State Management Structure
*   **Context:** Need for simple, predictable state management that supports undo/redo and virtual DOM operations while using self-documenting variable names.
*   **Decision:** Implement atomic state updates with a single EditorState interface using descriptive names: `virtualDOM` instead of `vdom`, `currentEditorMode` instead of `fsm`, with all operations following the pattern `(EditorState) => EditorState`.
*   **Alternatives Considered:**
    *   **Alternative A:** Separate state objects for different concerns
    *   **Alternative B:** Direct virtual DOM manipulation without centralized state
    *   **Alternative C:** Using acronyms (vdom, fsm) for brevity
*   **Rationale & Trade-offs:** Atomic state updates ensure consistency and simplify undo/redo implementation. Pure functions enable predictable behavior and easier testing. Self-documenting names improve code readability and reduce onboarding time. Trade-off: Requires immutable update patterns and slightly more verbose naming, but provides architectural clarity and maintainability.
*   **Implications:** All editor operations must be implemented as pure functions that return new state objects rather than mutating existing state. All variable names must be self-documenting without acronyms.

### DECISION-011: Path-Based Selection Addressing
*   **Context:** Need for robust selection management that survives virtual DOM updates and supports operation-based undo/redo.
*   **Decision:** Implement path-based selection addressing using arrays of indices to navigate the virtual DOM tree, rather than direct node references.
*   **Alternatives Considered:**
    *   **Alternative A:** Direct VNode references with offsets
    *   **Alternative B:** DOM-based selection tracking
    *   **Alternative C:** ID-based node addressing
*   **Rationale & Trade-offs:** Path-based addressing survives VNode recreation during virtual DOM updates and is serializable for undo/redo operations. Works reliably across different DOM structures. Trade-off: Requires path resolution logic for DOM operations, but provides robust selection management.
*   **Implications:** Selection state must be converted between path-based representation and browser selection API. All selection operations must work through path resolution. Selection survives virtual DOM recreation.

### DECISION-012: Operation-Based Undo/Redo Architecture
*   **Context:** Need for memory-efficient undo/redo that integrates with core state management architecture from the start of Phase 2.1.
*   **Decision:** Implement operation-based history using EditorOperation objects that contain the operation data and its inverse operation. UndoRedoService is a core architectural component, not an optional feature.
*   **Alternatives Considered:**
    *   **Alternative A:** Full state snapshots for undo/redo
    *   **Alternative B:** No undo/redo support initially
    *   **Alternative C:** Command pattern with separate undo commands
*   **Rationale & Trade-offs:** Operation-based history uses significantly less memory than full snapshots and enables fine-grained undo/redo behavior. Integration from the start ensures all operations are designed to be reversible. Trade-off: Requires careful operation design and sophisticated inverse logic, but provides efficient and comprehensive undo/redo.
*   **Implications:** Every editor operation must be designed to generate an inverse operation. All state mutations must go through the UndoRedoService to maintain history. UndoRedoService must be implemented from Phase 2.1 start.

### DECISION-013: Error Recovery Strategy
*   **Context:** Need for graceful handling of virtual DOM/real DOM synchronization issues without disrupting user experience.
*   **Decision:** Implement virtual DOM as the definitive source of truth with error recovery that preserves user's active typing and maintains editing flow.
*   **Alternatives Considered:**
    *   **Alternative A:** Real DOM as source of truth with virtual DOM syncing
    *   **Alternative B:** Error reporting without recovery
    *   **Alternative C:** Full editor restart on errors
*   **Rationale & Trade-offs:** Virtual DOM as source of truth provides predictable behavior and easier testing. Recovery strategy maintains user experience while logging issues for debugging. Trade-off: Requires sophisticated recovery logic, but prevents user data loss and editing disruption.
*   **Implications:** All DOM synchronization must prioritize virtual DOM state. Error recovery must preserve user's current typing and maintain editor mode. Errors should be logged but not exposed to users.

### DECISION-014: BeforeInput Event Strategy
*   **Context:** Need for reliable input handling that maintains virtual DOM as source of truth before browser DOM mutations occur.
*   **Decision:** Use `beforeinput` event exclusively for all input operations, preventing default browser behavior and handling all mutations through virtual DOM operations.
*   **Alternatives Considered:**
    *   **Alternative A:** Mixed approach with some direct DOM manipulation
    *   **Alternative B:** Input event handling after DOM changes
    *   **Alternative C:** Keydown/keypress event handling
*   **Rationale & Trade-offs:** BeforeInput provides user intent before DOM mutations, allowing virtual DOM to remain authoritative. Preventing default gives complete control over editor behavior. Trade-off: Requires comprehensive input type handling, but ensures predictable behavior across all input scenarios.
*   **Implications:** All user input must be handled through beforeinput event handlers. Default browser behavior must be prevented for all editor-managed input types. Virtual DOM must handle all content mutations.

## 3. Data Models / Schema

### Core Editor State (DECISION-010)

#### Entity: EditorState
*   `virtualDOM`: VNode - Document structure representation using self-documenting name
*   `selection`: Selection - Cursor/selection state using path-based addressing
*   `currentEditorMode`: EditorMode - Current finite state machine mode (not fsm)

#### Type: EditorMode
*   `'IDLE'` - Default state, ready for user input
*   `'TYPING'` - Active text input in progress
*   `'SELECTING'` - Text selection in progress
*   `'FORMATTING'` - Formatting operation in progress

#### Type: StateTransition
*   Function signature: `(currentState: EditorState) => EditorState`
*   All editor operations must follow this pure function pattern

### Path-Based Selection (DECISION-011)

#### Entity: Selection
*   `startPath`: number[] - Array of indices to navigate virtual DOM tree (e.g., [0, 2, 1])
*   `startOffset`: number - Character offset within the target node
*   `endPath`: number[] - End position path using same format
*   `endOffset`: number - End character offset
*   `isCollapsed`: boolean - Whether selection is just a cursor

#### Interface: SelectionService
*   `pathToNode(virtualDOM: VNode, path: number[]): VNode | null` - Resolve path to node
*   `nodeToPath(virtualDOM: VNode, targetNode: VNode): number[] | null` - Get path for node
*   `setBrowserSelection(selection: Selection, realDOM: Element): void` - Set browser selection
*   `getBrowserSelection(realDOM: Element): Selection | null` - Get current browser selection

### Operation-Based History (DECISION-012)

#### Entity: EditorOperation
*   `type`: 'insertText' | 'deleteText' | 'formatText' | 'insertParagraph' | 'toggleList' - Operation type
*   `data`: unknown - Operation-specific data (strongly typed, no 'any' types)
*   `inverse`: EditorOperation - The operation to undo this one
*   `timestamp`: number - When the operation was executed

#### Interface: UndoRedoService
*   `execute(operation: EditorOperation): EditorState` - Execute operation and update history
*   `undo(): EditorState | null` - Undo last operation
*   `redo(): EditorState | null` - Redo previously undone operation
*   `canUndo(): boolean` - Whether undo is available
*   `canRedo(): boolean` - Whether redo is available
*   `clear(): void` - Clear all history

### Error Recovery (DECISION-013)

#### Interface: ErrorRecoveryStrategy
*   `recoverFromDesync(virtualDOM: VNode, realDOM: Element): EditorState` - Recover from sync issues
*   `preserveActiveContent(realDOM: Element): string` - Extract user's active typing
*   `logRecoveryEvent(error: Error, context: unknown): void` - Log recovery events for debugging

### BeforeInput Handling (DECISION-014)

#### Interface: BeforeInputHandler
*   `handleBeforeInput(event: InputEvent, currentState: EditorState): EditorState` - Process beforeinput events
*   `preventDefaultForEditorInputTypes(event: InputEvent): boolean` - Determine if should prevent default
*   `mapInputTypeToOperation(inputType: string): EditorOperation | null` - Convert input type to operation

#### Type: SupportedInputType
*   `'insertText'` - Text insertion
*   `'deleteContentBackward'` - Backspace deletion
*   `'deleteContentForward'` - Delete key deletion
*   `'insertParagraph'` - Enter key paragraph creation
*   `'formatBold'` - Bold formatting
*   `'formatItalic'` - Italic formatting
*   `'formatUnderline'` - Underline formatting

### Virtual DOM Structure (Existing)

#### Entity: VNode (Virtual DOM Node)
*   `type`: 'text' | 'element' - Node type discriminator
*   `tagName`: string (optional) - HTML tag name for element nodes
*   `attributes`: Record<string, string> (optional) - HTML attributes
*   `textContent`: string (optional) - Text content for text nodes
*   `children`: VNode[] - Child nodes array
*   `parent`: VNode (optional) - Parent node reference

### Component Interface (Existing)

#### Entity: RichTextEditor2Props
*   `id`: string - Unique component identifier
*   `label`: string (optional) - Accessibility label
*   `ariaDescription`: string (optional) - ARIA description
*   `onChange`: (value: string) => void (optional) - Change callback
*   `disabled`: boolean (optional) - Disabled state
*   `required`: boolean (optional) - Required field indicator
*   `className`: string (optional) - CSS class names

### Future Data Models

#### Entity: ListNode (Extended VNode for Lists) - Phase 3B
*   `type`: 'element' - Always element type for list nodes
*   `tagName`: 'ul' | 'ol' | 'li' - List-specific tag names
*   `attributes`: Record<string, string> - HTML attributes including list-type, start, etc.
*   `children`: VNode[] - Child list items or content
*   `listLevel`: number - Nesting level for nested lists
*   `listType`: 'bulleted' | 'numbered' - Semantic list type

#### Entity: PerformanceMetrics - Phase 4A
*   `operationCount`: number - Number of queued operations
*   `batchSize`: number - Current batch processing size
*   `memoryUsage`: number - Estimated memory usage in bytes
*   `renderTime`: number - Last render operation time in milliseconds
*   `documentSize`: number - Current document size in characters

#### Entity: AccessibilityState - Phase 4B
*   `currentRole`: string - Current ARIA role
*   `announcements`: string[] - Queue of screen reader announcements
*   `focusedElement`: string - ID of currently focused element
*   `keyboardNavigation`: boolean - Whether keyboard navigation is active
*   `ariaLive`: 'polite' | 'assertive' | 'off' - Live region announcement level

## 4. API Endpoints (if applicable)

*Not applicable - this is a client-side component with no server API interactions.*

## 5. Key Components & Responsibilities

### Implemented Components
*   **`Editor`:** Core editor logic encapsulating FSM and virtual DOM. Handles all user interactions and maintains document state.
*   **`StateMachine`:** Manages editor state transitions and validates state changes according to FSM rules.
*   **`VirtualDOMTree`:** Manages virtual DOM tree structure, node creation, and tree traversal operations.
*   **`VirtualDOMOperations`:** Provides tree manipulation operations (insert, delete, update nodes).
*   **`HtmlCodec`:** Handles HTML encoding/decoding and sanitization using DOMPurify.
*   **`FormattingDetectionService`:** Pure functions for detecting current formatting state at cursor position.
*   **`FormattingRemovalService`:** Pure functions for removing formatting from selected text or nodes.
*   **`ParagraphOperationsService`:** Pure functions for paragraph creation, splitting, merging, and manipulation.
*   **`SelectionService`:** Humble object abstracting browser selection APIs for testability.
*   **`RichTextEditor2`:** Thin React component providing UI layer and prop interface compatibility.

### Components to be Implemented
*   **`ListOperationsService`:** Pure functions for list creation, conversion between paragraphs and lists, nesting operations, and list item manipulation.
*   **`PerformanceService`:** Utilities for operation batching, debouncing, memory management, and performance monitoring.
*   **`AccessibilityService`:** ARIA attribute management, screen reader announcements, keyboard navigation patterns, and accessibility state tracking.
*   **`ClipboardService`:** Enhanced clipboard operations with rich text preservation, copy/cut functionality, and format-aware paste handling.
*   **`KeyboardNavigationService`:** Advanced keyboard handling including Tab navigation, list shortcuts, and accessibility-compliant navigation patterns.
*   **`HyperlinkService`:** URL detection, anchor tag creation, and link management within rich text content.
*   **`ValidationService`:** HTML structure validation, content normalization, and whitespace management.
*   **`UndoRedoService`:** Virtual DOM snapshot management for undo/redo functionality with efficient memory usage.

## 6. Future Considerations & Tech Debt

### Phase 3: Advanced Features Implementation Guide

#### CAMS-526-LISTS: List Management Architecture
**Implementation Approach:**
*   Create `ListOperationsService` with pure functions for list operations
*   Extend VNode types to support `ul`, `ol`, and `li` elements with nesting metadata
*   Implement list conversion utilities (paragraph ↔ list item)
*   Add list-specific keyboard handlers (Enter, Tab, Shift+Tab for nesting)
*   Create list state detection and manipulation functions

**Key Functions Required:**
*   `createList(type: 'ul' | 'ol', items: string[]): VNode`
*   `convertParagraphToListItem(paragraph: VNode): VNode`
*   `nestListItem(listItem: VNode, direction: 'in' | 'out'): VNode`
*   `splitListAtCursor(list: VNode, position: number): VNode[]`

#### CAMS-526-PERF: Performance Optimization Strategy
**Implementation Approach:**
*   Implement operation batching with `PerformanceService.batchOperations()`
*   Add debouncing for onChange callbacks (300ms default)
*   Create memory management utilities for large document handling
*   Implement virtual DOM operation queuing and batch processing

**Key Patterns:**
*   Batch DOM updates using `requestAnimationFrame`
*   Debounce expensive operations (HTML encoding, onChange)
*   Implement memory cleanup for unused VNode references
*   Add performance monitoring and metrics collection

#### CAMS-526-A11Y: Accessibility Enhancement Design
**Implementation Approach:**
*   Create `AccessibilityService` for ARIA management
*   Implement keyboard navigation patterns following WCAG 2.1 AA
*   Add screen reader announcements for state changes
*   Ensure proper focus management and tab order

**Key Features:**
*   Dynamic ARIA attributes based on editor state
*   Screen reader announcements for formatting changes
*   Keyboard shortcuts with accessibility compliance
*   Focus trap management within editor boundaries

#### CAMS-526-CLIPBOARD: Enhanced Clipboard Operations
**Implementation Approach:**
*   Extend current paste handling to support copy/cut operations
*   Implement rich text preservation in clipboard data
*   Add format-aware paste handling for external content
*   Create clipboard data sanitization and validation

**Key Functions:**
*   `copySelection(selection: VNode[]): ClipboardData`
*   `cutSelection(selection: VNode[]): ClipboardData`
*   `pasteWithFormatPreservation(data: ClipboardData): VNode[]`

### Phase 4: Polish and Optimization Implementation Guide

#### CAMS-526-KEYBOARD: Advanced Keyboard Navigation
**Implementation Approach:**
*   Create `KeyboardNavigationService` for complex navigation patterns
*   Implement Tab navigation with proper accessibility support
*   Add list-specific keyboard shortcuts (Ctrl+Shift+L for lists)
*   Ensure keyboard navigation works with screen readers

#### CAMS-526-HYPERLINKS: Link Management
**Implementation Approach:**
*   Create `HyperlinkService` for URL detection and link creation
*   Implement automatic link detection during typing
*   Add link editing and removal functionality
*   Ensure links are properly represented in virtual DOM

#### CAMS-526-UNDO-REDO: History Management
**Implementation Approach:**
*   Implement `UndoRedoService` with virtual DOM snapshots
*   Create efficient snapshot storage with memory limits
*   Add keyboard shortcuts (Ctrl+Z, Ctrl+Y) for undo/redo
*   Ensure history preservation across formatting operations

### Technical Debt Items
*   **CAMS-526-MIGRATION**: Complete migration strategy documentation and testing for drop-in replacement
*   **CAMS-526-DOCS**: Comprehensive API documentation and usage examples
*   **CAMS-526-E2E**: End-to-end testing scenarios for complex user workflows
*   **CAMS-526-BDD**: Behavior-driven development tests for user scenarios
*   **CAMS-526-VALIDATION**: HTML structure validation and content normalization

### Paragraph Handling Requirements
*   **Initialization**: Editor must start with single empty `<p>` element, no direct text nodes in root
*   **Enter Key**: Creates new paragraphs with proper cursor positioning and content splitting
*   **Structure**: All text content must be wrapped in paragraph elements for semantic correctness
*   **Browser Compatibility**: Normalize paragraph behavior across different browsers
*   **Virtual DOM**: Paragraph structure must be properly represented in virtual DOM tree

### Current Implementation Status
*   **✅ Completed**: Core architecture (FSM, Virtual DOM, HTML encoding), basic functionality (text input, formatting, paragraph handling), component interface, comprehensive testing (296 tests)
*   **🚧 In Progress**: Toolbar implementation with state synchronization
*   **⏳ Planned**: List management, advanced keyboard handling, clipboard operations, performance optimization, accessibility enhancements
