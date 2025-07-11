# Tiptap Addition

Always abide by the applicable `.cursor/rules` files.

We want to evaluate the [Tiptap editor](https://tiptap.dev/docs/editor/getting-started/overview) with [this simple ui](https://tiptap.dev/docs/ui-components/templates/simple-editor). Code should be created in the `user-interface/src/lib/components/cams/TiptapEditor/` directory. Required packages should be installed in `user-interface/package.json`.

## Steps

- [x] Implement a humble object or wrapper for the Tiptap editor.
  - [x] Ensure editor content is semantically-correct HTML prior to persistence.
    - [x] If it is not automatically semantically-correct we need to convert and then when editing an existing note ingest the stored semantically-correct content mapped to whatever Tiptap uses.
- [] Integrate the various components included in SimpleEditor
  - [x] Bold, italic, underline
  - [x] Ordered list, bullet list
  - [] Links
  - [] Other components incrementally
- [x] Integrate TiptapEditor into `CaseNoteFormModal` and mock it for tests to avoid
      jsdom/ProseMirror issues.
- [] Ensure that draft note content is added to the editor properly.

**Current status:**

- TiptapEditor is integrated and working in the UI.
- Ordered and bullet lists are implemented and working in both tests and the browser.
- All tests are green for these features.
- Next step: continue with further SimpleEditor features or polish as needed.
