## Detailed Implementation Plan: React Rich Text Editor

This plan outlines the architecture, components, data structures, and interactions required to build the browser-based rich text editor component, fully adhering to the provided `RichTextEditor.tsx` **public API**, integrating provided dependencies, and strictly following the project-level guidelines, with the **Editor core completely decoupled from the `contentEditable` DOM element.**

### 1. Architectural Principles & Overview

*   **TypeScript First:** All code will be written in TypeScript, leveraging its type safety and developer tooling benefits. Interfaces and types will be explicitly defined for all data structures and function signatures.
*   **Test-Driven Development (TDD):** For each functional requirement, unit tests will be written *first*, aiming for **100% branch and line coverage**. The implementation code will then be developed to pass these tests. **Vitest** and **React Testing Library with `userEvent`** will be the primary testing tools.
*   **Humble Object Pattern & Invasive-Species Rule:** Direct interaction with global browser APIs (`window.getSelection()`, `document.createRange()`, `document.createElement()`, etc.) will be abstracted behind the `SelectionService` interface (and its `BrowserSelectionService` and `MockSelectionService` implementations). This ensures the majority of our code depends on things under our control and isolates third-party/browser dependencies. `DOMPurify` will also be used in an isolated manner within converter and clipboard modules.
*   **DOM-Injected Editor Core:** The `Editor` class (`core/Editor.ts`) will receive the `contentEditable` HTMLElement via injection from the `RichTextEditor.tsx` component through the `setRootElement()` method. The Editor will manage the Virtual DOM and its transformations, directly updating the injected DOM element and emitting formatting/selection state via callbacks. This maintains the **Dependency Rule** by having the React component (higher-level) inject the DOM dependency into the Editor (lower-level).
*   **Orchestrating React Component:** The **re-implemented `RichTextEditor.tsx` component** will be responsible for:
    *   Rendering the `contentEditable` div.
    *   Instantiating the `Editor` and subscribing to its change events.
    *   Injecting the `contentEditable` div reference into the `Editor` via `setRootElement()` method.
    *   Updating formatting buttons based on state received from the `Editor`.
    *   The `Editor` will handle DOM updates and event listeners directly on the injected element.
*   **Virtual DOM (VDOM):** A TypeScript representation of the editor's content, designed to be easily manipulated programmatically. It will be the single source of truth for the editor's content.
*   **Finite State Machine (FSM):** The FSM within the `Editor` will interpret user events and trigger corresponding transformations on the VDOM. It acts as an "Event Processor" or "Command Dispatcher" that maps input events and explicit commands (e.g., from buttons, shortcuts) to VDOM operations.
*   **Pure Functions & Single Responsibility Principle (SRP):** All VDOM manipulation logic, formatting, and conversion functions will be implemented as pure functions in separate modules, ensuring testability, maintainability, and ease of Undo/Redo implementation. This also contributes to managing technical debt.
*   **XSS Protection:** `DOMPurify` (from `RichTextEditor.constants.ts`) will be used to sanitize all incoming HTML content (e.g., during paste operations or when setting `initialValue`).
*   **Empty Paragraphs:** An empty paragraph will be represented in the VDOM and rendered to HTML as `<p>${ZERO_WIDTH_SPACE}</p>` (where `ZERO_WIDTH_SPACE` is `\u200b`). This ensures the `contentEditable` caret can be placed and manipulated correctly in empty blocks.
*   **Good-Fences Rule:** Boundaries between modules, layers, or components will remain clean, simple, and well-defined. Only simple data types (e.g., `VDOMNode`, `VDOMSelection`, `EditorCommand`, `EditorState` interfaces defined in `types.ts`) will cross major boundaries.

### 2. High-Level Architecture Diagram

```mermaid
graph TD
    A[RichTextEditor.tsx (Re-implemented)] -->|1. User Events (Input, KeyDown, MouseUp, Button Clicks)| B(Editor Class Instance)
    B -->|2. Pass Browser Event & Selection| C[Finite State Machine (FSM)]
    C -->|3. Command: Transform VDOM & Update History| D[Virtual DOM (VDOM) State & Undo/Redo History]
    D -->|4. VDOM Operation (Pure Functions)| D
    D -->|5. VDOM Changed & Selection Updated| E[VDOM to HTML Converter]
    E -->|6. Formatted HTML String & Current Formatting State & VDOMSelection| B
    B -->|7. onContentChange(htmlString), onFormattingChange(state), onSelectionChange(vdomSelection) Callbacks| A
    A -->|8. Renders HTML in contentEditable div & Updates Button State & Applies Browser Selection| F[Browser DOM]
    F --> A
    subgraph Browser Abstraction (Humble Object)
        G[SelectionService (Provided Interface)]
        H[BrowserSelectionService (Provided Impl)]
        I[MockSelectionService (Provided Impl)]
        H -- depends on --> J[window/document]
    end
    A -- uses --> G
    B -- uses --> G
    D -- uses --> G
    E -- uses --> G
    F -- interacts with --> H
```

### 3. Project Structure (Relative to `RichTextEditor` root, within an existing `src` directory)

The deliverables will consist of the following directory and files, assumed to be placed within your existing project's `src` folder (e.g., `src/RichTextEditor/`). The structure adheres to the principles of **Screaming Architecture** by organizing components and logic in a way that reflects their role in the editor domain, rather than purely technical layering, while also maintaining clarity for a reusable component.

```
RichTextEditor/
│   RichTextEditor.tsx               // React UI component (must honor prop/imperative interfaces)
│   RichTextEditor.test.tsx          // Unit tests for RichTextEditor component (integration tests)
│   RichTextButton.tsx               // PROVIDED - Reused component
│   RichTextButton.scss              // PROVIDED - Styles for RichTextButton
│   RichTextIcon.tsx                 // PROVIDED - Reused component
├── core/                            // Central editor logic, adhering to domain separation
│   ├── Editor.ts                    // Main Editor class (implementation of the core logic)
│   ├── Editor.test.ts               // Unit tests for Editor class (using MockSelectionService)
│   ├── types.ts                     // Global interfaces/types for VDOM, Selection, Commands (strategic)
│   ├── constants.ts                 // PROVIDED - Reused constants (ZERO_WIDTH_SPACE, DOMPURIFY_CONFIG, etc.)
│   ├── FSM.ts                       // Event/Command dispatcher logic
│   ├── FSM.test.ts                  // Unit tests for FSM
│   ├── history/                     // Undo/Redo specific logic
│   │   ├── HistoryManager.ts        // Manages Undo/Redo stack
│   │   └── HistoryManager.test.ts   // Unit tests for HistoryManager
│   ├── model/                       // VDOM structure and core manipulation (Strategic Document Model)
│   │   ├── VDOMNode.ts              // Defines VDOMNode structure, factory functions
│   │   ├── VDOMNode.test.ts         // Unit tests for VDOMNode helpers
│   │   ├── VDOMMutations.ts         // Pure functions for VDOM manipulation (insert, delete, split, merge)
│   │   ├── VDOMMutations.test.ts    // Unit tests for VDOMMutations
│   │   ├── VDOMFormatting.ts        // Pure functions for VDOM formatting (toggle bold/italic/underline)
│   │   ├── VDOMFormatting.test.ts   // Unit tests for VDOMFormatting
│   │   ├── VDOMListOperations.ts    // Pure functions for list manipulation (toggle list)
│   │   ├── VDOMListOperations.test.ts// Unit tests for VDOMListOperations
│   │   ├── VDOMNormalization.ts     // Pure functions for VDOM cleanup/consistency
│   │   ├── VDOMNormalization.test.ts// Unit tests for VDOMNormalization
│   │   └── VDOMSelection.ts         // Logic for browser-VDOM selection mapping
│   │   └── VDOMSelection.test.ts    // Unit tests for VDOMSelection
│   ├── io/                          // Input/Output for the VDOM (converters)
│   │   ├── VDOMToHTML.ts            // Pure function: VDOM -> HTML
│   │   ├── VDOMToHTML.test.ts       // Unit tests for VDOMToHTML
│   │   ├── HTMLToVDOM.ts            // Pure function: HTML -> VDOM (for initialValue, paste)
│   │   └── HTMLToVDOM.test.ts       // Unit tests for HTMLToVDOM
│   ├── clipboard/                   // Handles clipboard interactions
│   │   ├── ClipboardManager.ts      // Handles clipboard interactions (copy, cut, paste)
│   │   └── ClipboardManager.test.ts // Unit tests for ClipboardManager
│   ├── selection/
│   │   ├── SelectionService.humble.ts // PROVIDED - Humble object interface and implementations
│   │   └── SelectionService.humble.test.ts // Unit tests for SelectionService implementations (if deemed necessary by tests)
│   └── utils/
│       ├── Editor.utilities.ts      // Implementation for provided `editorUtilities`
│       └── Editor.utilities.test.ts // Unit tests for Editor.utilities
```
*Note on Screaming Architecture: The `editor/` folder has been renamed to `core/` to better reflect its central role, and `vdom/` has been renamed to `model/` to emphasize its role as the document model. `converters/` has been moved to `io/` for Input/Output.*

### 4. Detailed Component Breakdown

#### 4.1 Re-implemented RichTextEditor Component (`components/RichTextEditor.tsx`)

*   **Purpose:** The React UI layer. It will manage the `contentEditable` div, interpret browser events, delegate to the `Editor` class, and update the UI based on `Editor`'s callbacks. It **must** honor the `RichTextEditorRef` and `RichTextEditorProps` interfaces.
*   **Props:** (As provided) `id`, `label`, `ariaDescription`, `onChange`, `disabled`, `required`, `className`.
*   **Imperative Handle:** (As provided) `clearValue`, `getValue`, `getHtml`, `setValue`, `disable`, `focus`.
*   **Internal State (`useState` / `useRef`):**
    *   `contentRef`: `MutableRefObject<HTMLDivElement | null>` - Ref to the `contentEditable` div.
    *   `editorRef`: `MutableRefObject<Editor | null>` - To hold the `Editor` instance.
    *   `htmlContent`: `string` - The current HTML string received from `Editor` to render.
    *   `currentFormatting`: `{ bold: boolean; italic: boolean; underline: boolean; }` - State to update button active/inactive.
    *   `currentVDOMSelection`: `VDOMSelection | null` - The VDOM selection received from `Editor`, crucial for restoring browser selection.
    *   `selectionService`: `BrowserSelectionService` instance.
*   **Responsibilities:**
    *   Render a `div` with `contentEditable="true"` and `id={CONTENT_INPUT_SELECTOR}`.
    *   Render formatting buttons using the `RichTextButton` component, displaying `currentFormatting` state.
    *   Initialize an `Editor` instance in `useState`, passing the `selectionService` and **callback functions**:
        *   `onChange: (html: string) => void` (for external `onChange` prop and internal state updates)
        *   `onSelectionChange: (vdomSelection: VDOMSelection) => void` (for `currentFormatting` state updates)
    *   In `useEffect` (after mount), call `editor.setRootElement(contentRef.current)` to inject the DOM element.
    *   The `Editor` handles all DOM manipulation and event listeners automatically after injection.
    *   Update button states based on `currentFormatting` received from `onSelectionChange` callback.
    *   **Imperative Handle Implementation:**
        *   `clearValue()`: Call `editor.clearValue()`. The `Editor` handles DOM updates automatically.
        *   `getValue()`: Call `editor.getValue()`.
        *   `getHtml()`: Call `editor.getHtml()`.
        *   `setValue(html: string)`: Call `editor.setValue(html)`. The `Editor` handles DOM updates automatically.
        *   `disable(val: boolean)`: Update the `contentEditable` attribute on `contentRef.current`.
        *   `focus()`: Call `contentRef.current?.focus()`.

#### 4.2 `Editor` Class (`core/Editor.ts`)

*   **Purpose:** The core logic encapsulating VDOM, FSM, History, Clipboard. It receives a DOM element via injection and directly manages its content and event listeners. It provides HTML and formatting state via callbacks. It adheres to the **Dependency Rule** by accepting the DOM element as an injected dependency from the higher-level React component.
*   **Constructor:**
    *   `constructor(options: EditorOptions)` where `EditorOptions` includes:
        *   `selectionService: SelectionService`: Injected dependency for browser DOM/selection interactions.
        *   `onChange: (html: string) => void`: Callback to `RichTextEditor.tsx` when content (VDOM) changes.
        *   `onSelectionChange?: (vdomSelection: VDOMSelection) => void`: Optional callback when internal VDOM selection changes.
        *   `rootElement?: HTMLDivElement`: Optional initial DOM element reference.
    *   Initializes `this.vdom` (defaulting to an empty paragraph with `ZERO_WIDTH_SPACE`).
    *   Initializes `this.historyManager` and `this.clipboardManager`.
    *   If `rootElement` is provided, sets up DOM interaction immediately.
*   **Internal State:**
    *   `rootElement: HTMLDivElement | null`: Reference to the injected DOM element.
    *   `vdom: VDOMNode[]`: Current state of the Virtual DOM.
    *   `selection: VDOMSelection`: Internal representation of the current cursor position/selection range within the VDOM.
    *   `historyManager: HistoryManager`: Manages the undo/redo stack.
    *   `clipboardManager: ClipboardManager`: Handles clipboard operations.
    *   `selectionService: SelectionService`: Injected dependency.
*   **Public Methods (API to match calls from `RichTextEditor.tsx` and imperative handle):**
    *   `setRootElement(rootElement: HTMLDivElement | null): void`: Injects the DOM element reference, sets up event listeners, and updates the DOM content. Called by `RichTextEditor.tsx` after mounting.
    *   `setValue(html: string): void`: Sanitizes `html` with `DOMPurify`, parses to VDOM via `HTMLToVDOM.parseHTMLToVDOM`, updates `this.vdom`, then calls `_emitChange` and `_emitSelectionAndFormatting`.
    *   `getHtml(): string`: Returns `VDOMToHTML.renderVDOMToHTML(this.vdom)`.
    *   `getValue(): string`: Returns the plain text content of the editor.
    *   `clearValue(): void`: Resets `this.vdom` to empty state and updates the DOM.
    *   `initializeEmptyContent(): void`: Resets `this.vdom` to a single empty paragraph with ZWS. Calls `_emitChange` and `_emitSelectionAndFormatting`.
    *   `getVDOM(): VDOMNode[]`: Exposes current VDOM state for debugging or advanced use cases.
    *   Note: Event handling methods are now internal and called automatically via DOM event listeners set up by `setRootElement()`.
*   **Private/Internal Methods:**
    *   `_dispatch(command: EditorCommand, payload?: any)`: Internal dispatcher to `FSM.processCommand`.
    *   `_updateVDOM(newVDOM: VDOMNode[], newSelection: VDOMSelection, isPersistentChange: boolean = true)`:
        *   Updates `this.vdom` and `this.selection`.
        *   If `isPersistentChange` is true, pushes the *previous* state (`this.vdom`, `this.selection`) onto the `historyManager`'s undo stack.
        *   Calls `_emitChange()` and `_emitSelectionAndFormatting()`.
    *   `_emitChange()`: Calls `this.onChange(this.getHtml())` and updates the DOM content if `rootElement` is available.
    *   `_emitSelectionAndFormatting()`: Determines active formatting at `this.selection` using `VDOMSelection.getFormattingAtSelection` and calls `this.onSelectionChange`.
    *   `setupEventListeners(element: HTMLDivElement): void`: Sets up DOM event listeners for user input, keyboard events, and mouse clicks.
    *   `cleanupEventListeners(): void`: Removes existing DOM event listeners.
    *   `handleBeforeInput(event: InputEvent): boolean`: Processes user input events and updates VDOM accordingly.
    *   `handleKeyDown(event: KeyboardEvent): boolean`: Processes keyboard events including shortcuts and navigation.
    *   `handleClick(event: MouseEvent): void`: Updates selection state based on mouse clicks.
    *   `syncSelectionFromBrowser(): void`: Updates internal VDOM selection from current browser selection.

#### 4.3 `core/types.ts`

*   Defines all custom types and interfaces, including `RichTextFormatState` for button formatting.

#### 4.4 `core/constants.ts` (PROVIDED)

*   Used directly.

#### 4.5 Finite State Machine (FSM) Module (`core/FSM.ts`)

*   **Purpose:** Pure function to interpret `EditorCommand` objects and translate them into VDOM operations.
*   **`processCommand(command: EditorCommand, currentVDOM: VDOMNode[], currentSelection: VDOMSelection): { newVDOM: VDOMNode[], newSelection: VDOMSelection, didChange: boolean, isPersistent: boolean }`:** Returns new VDOM, selection, and flags.

#### 4.6 History Manager (`core/history/HistoryManager.ts`)

*   **Class `HistoryManager`:** Standard `pushState`, `undo`, `redo`, `canUndo`, `canRedo`.

#### 4.7 Virtual DOM (VDOM) Modules (`core/model/` directory)

All functions within these modules **must be pure functions**. They will accept `SelectionService` and `rootElement` as arguments when needed for DOM interaction, but they will not store or own these.

*   **`VDOMNode.ts`**: Helper functions for creating various `VDOMNode` types, assigning unique `id`s.
*   **`VDOMSelection.ts`**:
    *   `getSelectionFromBrowser(selectionService: SelectionService, rootElement: HTMLElement, vdom: VDOMNode[]): VDOMSelection`: Maps native `Selection` to `VDOMSelection`.
    *   `applySelectionToBrowser(selectionService: SelectionService, vdomSelection: VDOMSelection, rootElement: HTMLElement, vdom: VDOMNode[])`: Maps `VDOMSelection` back to a native `Range` and sets via `selectionService`.
    *   `getNodesInRange`, `getFormattingAtSelection`.
*   **`VDOMMutations.ts`**: `insertText`, `deleteContent`, `splitNode`, `mergeNodes`.
*   **`VDOMFormatting.ts`**: `toggleFormat`.
*   **`VDOMListOperations.ts`**: `toggleList`.
*   **`VDOMNormalization.ts`**: `normalizeVDOM`. Ensures ZWS for empty paragraphs.

#### 4.8 Converters (`core/io/` directory)

*   **`VDOMToHTML.ts`**: `renderVDOMToHTML(vdom: VDOMNode[]): string`. Handles ZWS rendering for empty paragraphs.
*   **`HTMLToVDOM.ts`**: `parseHTMLToVDOM(htmlString: string, selectionService: SelectionService): VDOMNode[]`. Sanitizes with `DOMPurify`. Converts empty HTML paragraphs to VDOM with ZWS.

#### 4.9 Clipboard Manager (`core/clipboard/ClipboardManager.ts`)

*   **Class `ClipboardManager`:**
    *   Constructor accepts `selectionService: SelectionService`.
    *   `copy(vdom: VDOMNode[], selection: VDOMSelection, event: ClipboardEvent, rootElement: HTMLElement)`: Extracts, converts, sets clipboard data.
    *   `cut(vdom: VDOMNode[], selection: VDOMSelection, event: ClipboardEvent, rootElement: HTMLElement): { newVDOM: VDOMNode[]; newSelection: VDOMSelection; }`
    *   `paste(vdom: VDOMNode[], selection: VDOMSelection, event: ClipboardEvent, rootElement: HTMLElement): { newVDOM: VDOMNode[]; newSelection: VDOMSelection; }`: Sanitizes incoming HTML.

#### 4.10 Selection Service (`core/selection/SelectionService.humble.ts`) - (PROVIDED)

*   Used by `RichTextEditor.tsx`, `Editor.ts` (via injection), and VDOM-related modules where browser DOM/selection queries/mutations are needed.

#### 4.11 Editor Utilities (`core/utils/Editor.utilities.ts`)

*   `cleanHtml`, `safelyGetHtml`, `safelySetHtml`, `isEmptyContent`. These will be called by `RichTextEditor.tsx`.

### 5. Data Structures (No changes)

### 6. Event Handling & Workflow (DOM Injection Pattern)

1.  **Initialization:** `RichTextEditor.tsx` creates an `Editor` instance and calls `editor.setRootElement(contentRef.current)` to inject the DOM element.
2.  **DOM Event Setup:** `Editor` automatically sets up event listeners (`beforeinput`, `keydown`, `click`) on the injected DOM element.
3.  **User Interaction:** User types, clicks, selects text in `contentEditable` div, or clicks formatting buttons.
4.  **Direct Event Handling:**
    *   **DOM Events:** `Editor`'s internal event handlers (`handleBeforeInput`, `handleKeyDown`, `handleClick`) process events directly.
    *   **Button Events:** `RichTextEditor.tsx` button handlers call `Editor` methods directly (e.g., for formatting commands).
5.  **`Editor` Processes Event/Command:**
    *   The `Editor` calls `syncSelectionFromBrowser()` to update its internal `this.selection` from the current browser state.
    *   It then dispatches an `EditorCommand` to the `FSM`.
6.  **FSM/Command Dispatcher:** Processes the command and returns the new `vdom`, `selection`, and `didChange`/`isPersistent` flags.
7.  **VDOM Mutation & History Update:** `Editor`'s `_updateVDOM` updates its internal state and pushes to `HistoryManager`.
8.  **Normalization:** `VDOMNormalization.normalizeVDOM` is called.
9.  **DOM Update & Callbacks:**
    *   `Editor` calls `_emitChange()` which updates the DOM content directly and calls `this.onChange(this.getHtml())`.
    *   `Editor` calls `_emitSelectionAndFormatting()` which calls `this.onSelectionChange(this.selection)`.
10. **`RichTextEditor.tsx` Re-renders:**
    *   `RichTextEditor.tsx` updates `currentFormatting` state based on `onSelectionChange` callback, updating buttons.
    *   `RichTextEditor.tsx` calls its external `onChange?.(html)` prop for major changes.

### 7. TDD Approach & Test Coverage

*   **Follow Test-Driven Development Principles:** Tests will be written *before* implementation.
*   **Pure Functions First:** All core pure functions will have 100% branch and line coverage. `MockSelectionService` will be instrumental here.
*   **Integration Tests:**
    *   `core/Editor.test.ts`: Tests the `Editor` class's public API, injecting `MockSelectionService` and validating HTML output and callback behavior. This test will be independent of a full browser DOM.
    *   `components/RichTextEditor.test.tsx`: Uses `vitest` and `React Testing Library` with `userEvent` for end-to-end user interaction simulation. This is where `BrowserSelectionService` or a comprehensive mock simulating JSDOM behavior will be used, to verify UI updates, `onChange` prop calls, and browser selection behavior.

### 8. Deliverables from LLM

The LLM should generate the complete project structure and code as outlined in section 3, following the TDD approach (tests first, then implementation for each module/file). All generated Markdown (e.g., for any internal documentation) will adhere to the specified Markdown Guidelines (nested lists with 4 spaces, proper heading hierarchy, blank lines). All generated code files will end in a newline.

*   **Full Type Definitions:** In `types.ts` and throughout the codebase.
*   **Comprehensive Test Suite:** For *all* pure functions and class methods, aiming for 100% coverage. Tests should demonstrate the TDD process by being detailed and covering edge cases.
*   **Skeletal Code:** For all classes and functions, with detailed logic implemented where the tests dictate.
*   **External Dependencies:** The LLM should note the need for `uuid` (for VDOM node IDs) and `dompurify` (for XSS sanitization) npm packages.
