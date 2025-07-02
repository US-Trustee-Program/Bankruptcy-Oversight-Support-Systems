Okay, excellent! Your clarity on this point is crucial. Moving to **Option #2** (where the `Editor` class is completely decoupled from the `HTMLElement` and communicates via callbacks) is indeed the cleaner, more testable, and more idiomatic React approach.

While the provided `RichTextEditor.tsx` initially passes `contentRef.current` to the `Editor` constructor, your earlier clarification that "The LLM may implement the RichTextEditor React component so long as it honors the prop and imperative API interfaces. It does not have to reuse the concrete implementation of RichTextEditor" gives us the flexibility to **re-implement `RichTextEditor.tsx`** to align with Option #2, while still preserving its external `RichTextEditorRef` and `RichTextEditorProps` APIs. This is the ideal outcome.

Let's update the plan to fully embrace Option #2. This will simplify the `Editor` core, making it a pure VDOM manager, and shift the browser DOM interaction responsibilities entirely to the `RichTextEditor.tsx` component, which will orchestrate `SelectionService` and HTML rendering.

---

## Detailed Implementation Plan: React Rich Text Editor (Finalized - Option #2: Editor is HTML-Agnostic)

This plan outlines the architecture, components, data structures, and interactions required to build the browser-based rich text editor component, fully adhering to the provided `RichTextEditor.tsx` **public API**, integrating provided dependencies, and strictly following the project-level guidelines, with the **Editor core completely decoupled from the `contentEditable` DOM element.**

### 1. Architectural Principles & Overview

*   **TypeScript First:** All code will be written in TypeScript, leveraging its type safety and developer tooling benefits. Interfaces and types will be explicitly defined for all data structures and function signatures.
*   **Test-Driven Development (TDD):** For each functional requirement, unit tests will be written *first*, aiming for **100% branch and line coverage**. The implementation code will then be developed to pass these tests. **Vitest** and **React Testing Library with `userEvent`** will be the primary testing tools.
*   **Humble Object Pattern & Invasive-Species Rule:** Direct interaction with global browser APIs (`window.getSelection()`, `document.createRange()`, `document.createElement()`, etc.) will be abstracted behind the `SelectionService` interface (and its `BrowserSelectionService` and `MockSelectionService` implementations). This ensures the majority of our code depends on things under our control and isolates third-party/browser dependencies. `DOMPurify` will also be used in an isolated manner within converter and clipboard modules.
*   **Decoupled Editor Core:** The `Editor` class (`core/Editor.ts`) will **not** have direct knowledge of the `contentEditable` HTMLElement. It will manage the Virtual DOM and its transformations, emitting an HTML string and current formatting/selection state via callbacks. This adheres strongly to the **Dependency Rule**.
*   **Orchestrating React Component:** The **re-implemented `RichTextEditor.tsx` component** will be responsible for:
    *   Rendering the `contentEditable` div.
    *   Instantiating the `Editor` and subscribing to its change events.
    *   Updating the `contentEditable` div's `innerHTML` based on HTML received from the `Editor`.
    *   Translating the `VDOMSelection` received from the `Editor` into a browser `Range` and applying it via `SelectionService`.
    *   Capturing all browser DOM events (`onInput`, `onKeyDown`, `onPaste`, `onMouseUp`, `onBlur`) and passing them, along with the *current browser selection*, to the `Editor` for processing.
    *   Updating formatting buttons based on state received from the `Editor`.
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
    *   Initialize an `Editor` instance in `useEffect` (on mount), passing the `selectionService` and **three new internal callbacks**:
        *   `onContentChange: (html: string) => void` (for `htmlContent` state)
        *   `onFormattingChange: (formatting: { bold: boolean; italic: boolean; underline: boolean; }) => void` (for `currentFormatting` state)
        *   `onSelectionUpdate: (vdomSelection: VDOMSelection) => void` (for `currentVDOMSelection` state)
    *   Attach all necessary event listeners (`onInput`, `onKeyDown`, `onMouseUp`, `onBlur`, `onCut`, `onCopy`, `onPaste`) to the `contentEditable` div.
    *   **Crucially, for each event listener:**
        *   Call `event.preventDefault()` if the `Editor` method indicates it has handled the event.
        *   Call the appropriate `Editor` instance method, passing the raw `event` object and `selectionService.getCurrentSelection()` (or just `selectionService` if the `Editor` method fetches it internally).
    *   Update the `contentEditable` div's `innerHTML` with `htmlContent` received from the `Editor`'s `onContentChange` callback. This is the only place `innerHTML` should be set.
    *   Update button states based on `currentFormatting`.
    *   **Crucial for Selection Restoration:** In a `useLayoutEffect` (or a similar post-render hook), after `htmlContent` updates, use `VDOMSelection.applySelectionToBrowser(selectionService, currentVDOMSelection, contentRef.current, editorRef.current?.getVDOM() || [])` to restore the browser's text selection/cursor position.
    *   **Imperative Handle Implementation:**
        *   `clearValue()`: Reset `htmlContent` to empty, and call `editorRef.current?.initializeEmptyContent()`.
        *   `getValue()`: Call `contentRef.current?.innerText || ''`.
        *   `getHtml()`: Call `editorUtilities.cleanHtml(safelyGetHtml(contentRef.current))`.
        *   `setValue(html: string)`: Call `editorRef.current?.setValue(html)`. The `Editor` will then emit the new HTML via `onContentChange`.
        *   `disable(val: boolean)`: Update internal `inputDisabled` state.
        *   `focus()`: Calls `contentRef.current.focus()`. Then, as in the original, use `selectionService.createRange()`, `selectionService.setSelectionRange()` to position cursor if empty.

#### 4.2 `Editor` Class (`core/Editor.ts`)

*   **Purpose:** The core logic encapsulating VDOM, FSM, History, Clipboard. It is **HTML-agnostic** and operates purely on its internal VDOM state. It provides HTML and formatting state via callbacks. It adheres to the **Dependency Rule** by only depending on `SelectionService` interface for interactions with the browser's DOM/Selection API, not the `HTMLElement` itself.
*   **Constructor:**
    *   `constructor(selectionService: SelectionService, onContentChange: (html: string) => void, onFormattingChange: (formatting: { bold: boolean; italic: boolean; underline: boolean; }) => void, onSelectionUpdate: (vdomSelection: VDOMSelection) => void)`
    *   `selectionService`: Injected dependency for browser DOM/selection interactions (e.g., getting current browser `Selection` for VDOM mapping).
    *   `onContentChange`: Callback to `RichTextEditor.tsx` when content (VDOM) changes.
    *   `onFormattingChange`: Callback to `RichTextEditor.tsx` when current formatting (at selection) changes.
    *   `onSelectionUpdate`: Callback to `RichTextEditor.tsx` when internal VDOM selection changes, to guide browser selection restoration.
    *   Initializes `this.vdom` (defaulting to an empty paragraph with `ZERO_WIDTH_SPACE`).
    *   Initializes `this.historyManager` and `this.clipboardManager`.
*   **Internal State:**
    *   `vdom: VDOMNode[]`: Current state of the Virtual DOM.
    *   `selection: VDOMSelection`: Internal representation of the current cursor position/selection range within the VDOM.
    *   `historyManager: HistoryManager`: Manages the undo/redo stack.
    *   `clipboardManager: ClipboardManager`: Handles clipboard operations.
    *   `selectionService: SelectionService`: Injected dependency.
*   **Public Methods (API to match calls from `RichTextEditor.tsx` and imperative handle):**
    *   `setValue(html: string): void`: Sanitizes `html` with `DOMPurify`, parses to VDOM via `HTMLToVDOM.parseHTMLToVDOM`, updates `this.vdom`, then calls `_emitChange` and `_emitSelectionAndFormatting`.
    *   `getHtml(): string`: Returns `VDOMToHTML.renderVDOMToHTML(this.vdom)`.
    *   `toggleSelection(formatType: RichTextFormat, browserSelection: Selection, rootElement: HTMLElement): boolean`: Maps to `applyFormat` command. Receives current browser selection and root element from `RichTextEditor.tsx`. Updates VDOM. Returns `true` if VDOM changed.
    *   `toggleList(listType: 'ul' | 'ol', browserSelection: Selection, rootElement: HTMLElement): boolean`: Maps to `TOGGLE_LIST` command. Receives current browser selection and root element. Updates VDOM. Returns `true` if VDOM changed.
    *   `handleCtrlKey(e: KeyboardEvent, browserSelection: Selection, rootElement: HTMLElement): boolean`: Processes `Ctrl+B`, `Ctrl+I`, `Ctrl+U`, `Ctrl+Z`, `Ctrl+Y`. Returns `true` if handled and event should be prevented.
    *   `handleBackspaceOnEmptyContent(e: KeyboardEvent, browserSelection: Selection, rootElement: HTMLElement): boolean`: Returns `true` if handled.
    *   `handleDentures(e: KeyboardEvent, browserSelection: Selection, rootElement: HTMLElement): boolean`: Returns `true` if handled.
    *   `handleEnterKey(e: KeyboardEvent, browserSelection: Selection, rootElement: HTMLElement): boolean`: Returns `true` if handled.
    *   `handleDeleteKeyOnList(e: KeyboardEvent, browserSelection: Selection, rootElement: HTMLElement): boolean`: Returns `true` if handled.
    *   `handlePrintableKey(e: KeyboardEvent, browserSelection: Selection, rootElement: HTMLElement): boolean`: Processes character input. Returns `true` if text was inserted.
    *   `handlePaste(e: ClipboardEvent, browserSelection: Selection, rootElement: HTMLElement): boolean`: Delegates to `clipboardManager.paste`. Returns `true` if content was pasted.
    *   `undo(browserSelection: Selection, rootElement: HTMLElement): void`: Orchestrates `historyManager.undo()`. Updates VDOM and selection, then calls `_emitChange` and `_emitSelectionAndFormatting`.
    *   `redo(browserSelection: Selection, rootElement: HTMLElement): void`: Orchestrates `historyManager.redo()`. Updates VDOM and selection, then calls `_emitChange` and `_emitSelectionAndFormatting`.
    *   `initializeEmptyContent(): void`: Resets `this.vdom` to a single empty paragraph with ZWS. Calls `_emitChange` and `_emitSelectionAndFormatting`.
    *   `getVDOM(): VDOMNode[]`: Exposes current VDOM state for `RichTextEditor.tsx`'s selection restoration.
*   **Private/Internal Methods:**
    *   `_dispatch(command: EditorCommand, payload?: any)`: Internal dispatcher to `FSM.processCommand`.
    *   `_updateVDOM(newVDOM: VDOMNode[], newSelection: VDOMSelection, isPersistentChange: boolean = true)`:
        *   Updates `this.vdom` and `this.selection`.
        *   If `isPersistentChange` is true, pushes the *previous* state (`this.vdom`, `this.selection`) onto the `historyManager`'s undo stack.
        *   Calls `_emitChange()` and `_emitSelectionAndFormatting()`.
    *   `_emitChange()`: Calls `this.onContentChange(this.getHtml())`.
    *   `_emitSelectionAndFormatting()`: Determines active formatting at `this.selection` using `VDOMSelection.getFormattingAtSelection` and calls `this.onFormattingChange` and `this.onSelectionUpdate`.
    *   `_updateSelectionFromBrowser(browserSelection: Selection, rootElement: HTMLElement): void`: Internal helper to update `this.selection` from browser data. Called by various `handle*` methods at the start.

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

### 6. Event Handling & Workflow (Detailed with Option #2)

1.  **User Interaction:** User types, clicks, selects text in `contentEditable` div, clicks formatting buttons, or uses keyboard shortcuts.
2.  **`RichTextEditor.tsx` Captures Event:** `onInput`, `onKeyDown`, `onPaste`, `onMouseUp`, `onBlur`, button `onClick` handlers.
3.  **Delegation to `Editor`:**
    *   **All User Interactions:** `RichTextEditor.tsx`'s event handlers will call appropriate `editorRef.current` methods, passing the `event` object, `selectionService.getCurrentSelection()` (or fetching it just before the call), and `contentRef.current` as `rootElement`.
    *   `RichTextEditor.tsx` will `e.preventDefault()` for events where the `Editor` method returns `true` (indicating it has handled the event and no default browser action should occur).
4.  **`Editor` Processes Event/Command:**
    *   The `Editor` method first calls `_updateSelectionFromBrowser(browserSelection, rootElement)` to ensure its internal `this.selection` is up-to-date with the browser's current state.
    *   It then dispatches an `EditorCommand` to the `FSM`.
5.  **FSM/Command Dispatcher:** Processes the command and returns the new `vdom`, `selection`, and `didChange`/`isPersistent` flags.
6.  **VDOM Mutation & History Update:** `Editor`'s `_updateVDOM` updates its internal state and pushes to `HistoryManager`.
7.  **Normalization:** `VDOMNormalization.normalizeVDOM` is called.
8.  **Emit Changes (Internal `Editor` callbacks):**
    *   `Editor` calls `this.onContentChange(this.getHtml())`.
    *   `Editor` calls `this.onFormattingChange(currentFormatting)`.
    *   `Editor` calls `this.onSelectionUpdate(this.selection)`.
9.  **`RichTextEditor.tsx` Re-renders & External `onChange`:**
    *   `RichTextEditor.tsx` updates its `htmlContent` state, triggering a re-render.
    *   `RichTextEditor.tsx` uses `safelySetHtml(contentRef.current, htmlContent)` to update the DOM.
    *   `RichTextEditor.tsx` updates `currentFormatting` state, updating buttons.
    *   `RichTextEditor.tsx` calls `VDOMSelection.applySelectionToBrowser(selectionService, currentVDOMSelection, contentRef.current, editorRef.current?.getVDOM() || [])` in `useLayoutEffect` to restore the browser selection.
    *   `RichTextEditor.tsx` calls its external `onChange?.(getHtml())` prop for major changes.

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

---

This plan is now fully aligned with your preference for Option #2 and accounts for the provided `RichTextEditor.tsx` API constraints by having the LLM re-implement the React component to fit this architecture.

Are you ready for the LLM to begin the code generation phase?
