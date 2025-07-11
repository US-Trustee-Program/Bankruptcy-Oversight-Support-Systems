# Tiptap Addition

Always abide by the applicable `.cursor/rules` files.

We want to evaluate the [Tiptap editor](https://tiptap.dev/docs/editor/getting-started/overview) with [this simple ui](https://tiptap.dev/docs/ui-components/templates/simple-editor). Code should be created in the `user-interface/src/lib/components/cams/TiptapEditor/` directory. Required packages should be installed in `user-interface/package.json`.

## Steps

- [x] Implement a humble object or wrapper for the Tiptap editor.
    - [x] Ensure editor content is semantically-correct HTML prior to persistence.
        - [x] If it is not automatically semantically-correct we need to convert and then when editing an existing note ingest the stored semantically-correct content mapped to whatever Tiptap uses.
- [] Integrate the various components included in SimpleEditor
    - [x] Bold, italic, underline
    - [] Other components incrementally
- [x] Integrate TiptapEditor into `CaseNoteFormModal` and mock it for tests to avoid jsdom/ProseMirror issues.
- [x] Update tests to use the ref-based API of the mock editor and ensure state updates are flushed with `waitFor` after ref-based changes.
- [x] Fix circular dependency and module mocking issues in test setup.
- [ ] All tests green: **2 tests remain failing** (button enable/disable and form cache restore after modal reopen).
    - [ ] Investigate and fix why the submit button is not disabled/enabled as expected after ref-based content changes.
    - [ ] Investigate and fix why the form cache is not restoring the title value after modal reopen.

**Current status:**
- TiptapEditor is integrated and working in the UI.
- Most tests pass, but two remain failing as described above.
- Next step: debug and resolve the remaining test failures for full green.
