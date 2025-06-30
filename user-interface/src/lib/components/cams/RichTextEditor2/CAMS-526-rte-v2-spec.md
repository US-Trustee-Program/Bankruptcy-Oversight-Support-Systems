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

## 3. Data Models / Schema

### Entity: VNode (Virtual DOM Node)
*   `type`: 'text' | 'element' - Node type discriminator
*   `tagName`: string (optional) - HTML tag name for element nodes
*   `attributes`: Record<string, string> (optional) - HTML attributes
*   `textContent`: string (optional) - Text content for text nodes
*   `children`: VNode[] - Child nodes array
*   `parent`: VNode (optional) - Parent node reference

### Entity: EditorState (FSM States)
*   `IDLE`: Default state, ready for user input
*   `TYPING`: Active text input in progress
*   `SELECTING`: Text selection in progress
*   `FORMATTING`: Formatting operation in progress

### Entity: EditorEvent (FSM Events)
*   `INPUT`: Text input event
*   `KEYBOARD_SHORTCUT`: Formatting keyboard shortcut
*   `SELECTION_CHANGE`: Selection change event
*   `RESET`: Reset to idle state

### Entity: RichTextEditor2Props
*   `id`: string - Unique component identifier
*   `label`: string (optional) - Accessibility label
*   `ariaDescription`: string (optional) - ARIA description
*   `onChange`: (value: string) => void (optional) - Change callback
*   `disabled`: boolean (optional) - Disabled state
*   `required`: boolean (optional) - Required field indicator
*   `className`: string (optional) - CSS class names

### Entity: ListNode (Extended VNode for Lists)
*   `type`: 'element' - Always element type for list nodes
*   `tagName`: 'ul' | 'ol' | 'li' - List-specific tag names
*   `attributes`: Record<string, string> - HTML attributes including list-type, start, etc.
*   `children`: VNode[] - Child list items or content
*   `listLevel`: number - Nesting level for nested lists
*   `listType`: 'bulleted' | 'numbered' - Semantic list type

### Entity: PerformanceMetrics
*   `operationCount`: number - Number of queued operations
*   `batchSize`: number - Current batch processing size
*   `memoryUsage`: number - Estimated memory usage in bytes
*   `renderTime`: number - Last render operation time in milliseconds
*   `documentSize`: number - Current document size in characters

### Entity: AccessibilityState
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
