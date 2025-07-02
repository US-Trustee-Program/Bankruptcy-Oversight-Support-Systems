# Rich Text Editor Implementation Plan

This document outlines the tasks required to implement the rich text editor as specified in `specification.md`.

## 1. Project Scaffolding & Setup

- [ ] Create the base directory structure inside the `RichTextEditor` root directory:
  RichTextEditor/
  ├── core/
  │   ├── history/
  │   ├── model/
  │   ├── io/
  │   ├── clipboard/
  │   ├── selection/
  │   └── utils/
  ```
- [ ] Add all new files with empty content as defined in the "Project Structure" section of the specification.
- [ ] Integrate provided files: `RichTextButton.tsx`, `RichTextButton.scss`, `RichTextIcon.tsx`, and `core/constants.ts`.

## 2. Core Logic Implementation (`RichTextEditor/core/`)

### 2.1. Foundational Types and Services
- [ ] **`types.ts`**: Define all shared interfaces and types (e.g., `VDOMNode`, `VDOMSelection`, `EditorCommand`, `EditorState`).
- [ ] **`selection/SelectionService.humble.ts`**: Implement the provided `SelectionService` interface and its browser/mock implementations.
- [ ] **`selection/SelectionService.humble.test.ts`**: Write unit tests for the Selection Service implementations.
- [ ] **`utils/Editor.utilities.ts`**: Implement the provided `editorUtilities`.
- [ ] **`utils/Editor.utilities.test.ts`**: Write unit tests for `Editor.utilities`.

### 2.2. VDOM Model (`core/model/`)
- [ ] **`VDOMNode.ts`**: Define the VDOM node structure and factory functions.
- [ ] **`VDOMNode.test.ts`**: Write unit tests for `VDOMNode` helpers.
- [ ] **`VDOMMutations.ts`**: Implement pure functions for VDOM manipulation (insert, delete, split, merge).
- [ ] **`VDOMMutations.test.ts`**: Write unit tests for `VDOMMutations`.
- [ ] **`VDOMFormatting.ts`**: Implement pure functions for toggling bold, italic, and underline.
- [ ] **`VDOMFormatting.test.ts`**: Write unit tests for `VDOMFormatting`.
- [ ] **`VDOMListOperations.ts`**: Implement pure functions for list manipulation.
- [ ] **`VDOMListOperations.test.ts`**: Write unit tests for `VDOMListOperations`.
- [ ] **`VDOMNormalization.ts`**: Implement pure functions for VDOM cleanup and consistency checks.
- [ ] **`VDOMNormalization.test.ts`**: Write unit tests for `VDOMNormalization`.
- [ ] **`VDOMSelection.ts`**: Implement logic for mapping between browser selection and VDOM selection.
- [ ] **`VDOMSelection.test.ts`**: Write unit tests for `VDOMSelection`.

### 2.3. Input/Output (`core/io/`)
- [ ] **`VDOMToHTML.ts`**: Implement the pure function to convert VDOM to an HTML string.
- [ ] **`VDOMToHTML.test.ts`**: Write unit tests for `VDOMToHTML`.
- [ ] **`HTMLToVDOM.ts`**: Implement the pure function to convert HTML to VDOM.
- [ ] **`HTMLToVDOM.test.ts`**: Write unit tests for `HTMLToVDOM`.

### 2.4. Feature Modules
- [ ] **`history/HistoryManager.ts`**: Implement the undo/redo stack manager.
- [ ] **`history/HistoryManager.test.ts`**: Write unit tests for `HistoryManager`.
- [ ] **`clipboard/ClipboardManager.ts`**: Implement clipboard interaction logic (copy, cut, paste).
- [ ] **`clipboard/ClipboardManager.test.ts`**: Write unit tests for `ClipboardManager`.
- [ ] **`FSM.ts`**: Implement the Finite State Machine to dispatch events and commands.
- [ ] **`FSM.test.ts`**: Write unit tests for the FSM.

### 2.5. The Editor Core
- [ ] **`Editor.ts`**: Implement the main `Editor` class, integrating all the core modules (VDOM, History, I/O, FSM).
- [ ] **`Editor.test.ts`**: Write comprehensive unit tests for the `Editor` class using `MockSelectionService`.

## 3. React UI Component (`RichTetEditor/`)

- [ ] **`RichTextEditor.tsx`**: Re-implement the main React component.
    - [ ] Render the `contentEditable` div and formatting buttons.
    - [ ] Manage internal state (`htmlContent`, `currentFormatting`, etc.).
    - [ ] Initialize the `Editor` core class within a `useEffect` hook.
    - [ ] Implement the required `RichTextEditorProps` (id, label, etc.).
    - [ ] Implement the required `RichTextEditorRef` imperative handle methods (`clearValue`, `getValue`, `setValue`, etc.).
    - [ ] Attach DOM event listeners (`onInput`, `onKeyDown`, `onPaste`, etc.).
    - [ ] In event listeners, delegate event handling to the `Editor` instance.
    - [ ] Implement callbacks (`onContentChange`, `onFormattingChange`, `onSelectionUpdate`) to receive state from the `Editor`.
    - [ ] Update the component's state and the `contentEditable` div's `innerHTML` based on the editor's callbacks.
    - [ ] Implement selection restoration logic using `useLayoutEffect`.
- [ ] **`RichTextEditor.test.tsx`**: Write integration tests for the `RichTextEditor` component using React Testing Library and `userEvent`.
    - [ ] Test that user interactions (typing, button clicks) correctly update the content.
    - [ ] Test the imperative handle methods.
    - [ ] Test prop handling (e.g., `disabled`, `required`).
    - [ ] Test accessibility features (`label`, `ariaDescription`).
