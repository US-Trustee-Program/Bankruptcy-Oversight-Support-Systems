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

## 4. API Endpoints (if applicable)

*Not applicable - this is a client-side component with no server API interactions.*

## 5. Key Components & Responsibilities

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

## 6. Future Considerations & Tech Debt

### Phase 3: Advanced Features (In Progress)
*   **CAMS-526-TOOLBAR**: Toolbar implementation with RichTextButton integration and visual state feedback
*   **CAMS-526-LISTS**: List management (ul, ol) with nesting support and keyboard navigation
*   **CAMS-526-KEYBOARD**: Advanced keyboard handling including Tab navigation and list shortcuts
*   **CAMS-526-CLIPBOARD**: Enhanced clipboard operations with rich text preservation

### Phase 4: Polish and Optimization (Planned)
*   **CAMS-526-PERF**: Performance optimization for large documents with virtual DOM batching and debouncing
*   **CAMS-526-A11Y**: Accessibility enhancements including ARIA attributes and screen reader compatibility
*   **CAMS-526-CONTENT**: Content management with HTML validation and whitespace normalization

### Technical Debt Items
*   **CAMS-526-MIGRATION**: Complete migration strategy documentation and testing for drop-in replacement
*   **CAMS-526-DOCS**: Comprehensive API documentation and usage examples
*   **CAMS-526-E2E**: End-to-end testing scenarios for complex user workflows

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
