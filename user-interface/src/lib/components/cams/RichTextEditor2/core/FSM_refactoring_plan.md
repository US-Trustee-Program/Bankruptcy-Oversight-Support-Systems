# FSM Handler Refactoring Plan

This plan outlines the refactoring of FSM handlers to use the VDOMSelection module's exported
functions for selection state management and formatting queries.

## Key Points from Specification

1. Selection state is owned by Editor class (`this.state.selection`).
2. VDOMSelection module exports:
   - getSelectionFromBrowser()
   - applySelectionToBrowser()
   - getNodesInRange()
   - getFormattingAtSelection()
3. All cursor movements must update VDOMSelection state
4. Formatting queries must use getFormattingAtSelection()

## Guidelines

1. Each FSM handler will be refactored as a vertical slice
2. TDD must be practiced for each change a. Write test using VDOMSelection exports b. Test must fail
   initially c. Refactor handler to use exports d. Test must pass e. Remove old tests
3. Do not modify VDOMSelection.ts - only use its exports
4. Remove any internal selection manipulation code
5. Mark TODOs as complete when finished [✓]

## TODO List by Vertical Slice [ ]

### Slice 1: handleSetCursorPosition [✓]

- [✓] Write test to verify cursor position updates VDOMSelection
- [✓] Refactor to use getSelectionFromBrowser()
- [✓] Use applySelectionToBrowser() to sync browser state
- [✓] Remove getTextContent() function - no longer needed
- [✓] Remove direct DOM position calculations
- [✓] Verify test passes
- [✓] Remove stale tests

### Slice 2: handleMoveCursorLeft/Right [✓]

- [✓] Write test for cursor movement using VDOMSelection exports
- [✓] Remove calculateNodePositions() - no longer needed (not found in current codebase)
- [✓] Use getSelectionFromBrowser() to get current position
- [✓] Use applySelectionToBrowser() to update position
- [✓] Ensure cursor position updates trigger selection state change
- [✓] Verify tests pass
- [✓] Remove stale tests (simplified cross-node navigation for now)

### Slice 3: handleBackspace [ ]

- [ ] Write test using VDOMSelection exports
- [ ] Remove textContentOffsetToNodeOffset() usage
- [ ] Use getSelectionFromBrowser() to get current position
- [ ] Use getNodesInRange() to determine nodes to remove
- [ ] Use applySelectionToBrowser() to update final position
- [ ] Remove handleBackspaceFallback() - no longer needed
- [ ] Verify test passes
- [ ] Remove stale tests

### Slice 4: handleInsertText [ ]

- [ ] Write test to verify VDOMSelection is properly updated
- [ ] Use getSelectionFromBrowser() to get insert position
- [ ] Apply formatting based on getFormattingAtSelection()
- [ ] Use applySelectionToBrowser() after insertion
- [ ] Verify test passes
- [ ] Remove stale tests

### Slice 5: handleToggleBold [ ]

- [ ] Write test using getFormattingAtSelection() for state checks
- [ ] Remove internal format state checks
- [ ] Use getFormattingAtSelection() to determine toggle action
- [ ] Update selection after toggle using applySelectionToBrowser()
- [ ] Verify test passes
- [ ] Remove stale tests

### Slice 6: handleEnterKey [ ]

- [ ] Write test verifying proper selection update after enter
- [ ] Use getSelectionFromBrowser() to get current position
- [ ] Apply new line and update VDOMSelection state
- [ ] Use applySelectionToBrowser() to sync browser
- [ ] Verify test passes
- [ ] Remove stale tests

### Slice 7: handleSetSelection [ ]

- [ ] Write test to verify selection sync with browser
- [ ] Use getSelectionFromBrowser() to validate incoming selection
- [ ] Use applySelectionToBrowser() to sync state
- [ ] Verify test passes
- [ ] Remove stale tests

### Cleanup [ ]

- [ ] Remove unused private methods:
  - calculateNodePositions()
  - getTextContent()
  - textContentOffsetToNodeOffset()
- [ ] Remove internal selection conversion code
- [ ] Verify all tests still pass
- [ ] Run full test suite

## Implementation Notes

1. VDOMSelection State Flow:

   - Browser Selection Change -> getSelectionFromBrowser() -> Update Editor state
   - Editor State Change -> applySelectionToBrowser() -> Update Browser selection

2. Format State Flow:

   - Before format changes -> getFormattingAtSelection()
   - After format changes -> Update selection -> applySelectionToBrowser()

3. Test Structure:

   ```typescript
   describe('FSM Handler Refactoring', () => {
     let selectionService: SelectionService;
     let editor: Editor;

     beforeEach(() => {
       selectionService = new MockSelectionService();
       editor = new Editor({ selectionService });
     });

     // Test each handler...
   });
   ```

## Definition of Done

- All TODOs marked complete [✓]
- No internal selection manipulation code remains
- All selection updates use VDOMSelection exports
- All format queries use getFormattingAtSelection()
- All tests pass
- No stale/redundant tests
- No modification to VDOMSelection.ts
