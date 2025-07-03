# Selection Synchronization Implementation Plan

This document outlines the plan for implementing proper selection synchronization between the real
DOM and virtual DOM in the RichTextEditor component.

## Key Gaps Analysis

1. **SelectionService Integration**:

   - The SelectionService interface in VDOMSelection.ts is considered the "modern" interface
   - We need to update SelectionService.humble.ts to match this interface
   - This requires adding new methods to both BrowserSelectionService and MockSelectionService
     classes

2. **Editor Selection Handling**:

   - Editor needs to integrate with VDOMSelection module
   - Editor needs to add callbacks for selection changes
   - Editor should use the SelectionService for DOM interactions

3. **React Component Selection Synchronization**:
   - Will be addressed after Editor selection handling is improved
   - Goal is to keep the component slim

## Implementation Plan

### 1. Update SelectionService.humble.ts

First, enhance SelectionService.humble.ts to include all methods required by VDOMSelection.ts:

- Add the missing methods to the SelectionService interface:

  - getSelectionText()
  - isSelectionCollapsed()
  - getSelectionAnchorNode()
  - getSelectionAnchorOffset()
  - getSelectionFocusNode()
  - getSelectionFocusOffset()

- Implement these methods in both BrowserSelectionService and MockSelectionService classes
- Ensure proper implementation with direct browser API calls in BrowserSelectionService
- Provide sensible mock implementations in MockSelectionService

### 2. Enhance Editor for Selection Tracking

Next, update the Editor class to properly track and synchronize selection:

- Update the Editor constructor to accept additional parameters:

  - selectionService: SelectionService
  - onSelectionChange: (selection: VDOMSelection) => void

- Add selection tracking functionality:

  - Track VDOMSelection state internally
  - Update selection state after content changes
  - Notify via onSelectionChange callback when selection changes

- Integrate with VDOMSelection module:

  - Use getSelectionFromBrowser() to map DOM selection to VDOM
  - Update content handling to maintain proper selection state

- Add selection-specific methods:
  - getSelection(): Returns current VDOM selection
  - setSelection(selection: VDOMSelection): Sets selection state

### 3. Update FSM to Handle Selection

The FSM needs to be aware of selection state:

- Update processCommand to accept and return selection state
- Add commands for selection manipulation (SET_SELECTION, etc.)
- Ensure all content operations update selection appropriately
- Return both new content and new selection from command processing

### 4. Testing Strategy

We'll develop tests in this order:

1. **SelectionService Tests**:

   - Test new methods added to BrowserSelectionService and MockSelectionService
   - Test edge cases like empty selection or selection spanning elements

2. **VDOMSelection Integration Tests**:

   - Test bidirectional mapping with updated SelectionService
   - Test various selection scenarios (cursor, text range, multi-node)

3. **Editor Selection Tests**:

   - Test selection tracking during content changes
   - Test selection notifications
   - Test selection preservation and restoration

4. **End-to-End Component Tests**:
   - Test user interactions with selection (clicking, typing, arrow keys)
   - Test selection behavior after content updates

### 5. Implementation Sequence

1. First, update SelectionService.humble.ts with new methods
2. Write tests for the updated SelectionService implementation
3. Update Editor to track and notify selection changes
4. Write tests for Editor selection handling
5. Update FSM to handle selection state
6. Write tests for FSM selection handling
7. After all the above is working, reassess React component needs

## Benefits of This Approach

1. **Interface Alignment**: By enhancing SelectionService.humble.ts to match the interface in
   VDOMSelection.ts, we ensure compatibility between components.

2. **Clear Responsibility Boundaries**:

   - SelectionService handles browser selection API interactions
   - VDOMSelection handles mapping between DOM and VDOM selections
   - Editor maintains selection state and handles notifications
   - FSM ensures selection state is updated with content changes

3. **Test-Driven Development**:

   - Each component can be tested independently
   - We can validate selection behavior at each level

4. **Incremental Implementation**:
   - Focus first on getting the core selection tracking working
   - Defer React component enhancements until basic functionality is validated

## Next Steps

1. Begin by updating the SelectionService.humble.ts interface and implementations
2. Follow with test-driven implementation of each component in sequence
3. Validate selection behavior at each stage before proceeding to the next
