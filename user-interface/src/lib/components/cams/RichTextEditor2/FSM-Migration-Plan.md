# FSM Migration Plan: Slice-by-Slice Updates for New VDOMSelection Interface

## Overview

This document outlines the plan to update the FSM (Finite State Machine) to work with the new
VDOMSelection interface. Instead of layered phases, we're taking a slice-by-slice approach where
each slice is one event handler, ensuring each is fully functional before moving to the next.

## Current Problem

The FSM currently uses a simplified selection model with `offset`-based positions, but the new
VDOMSelection interface uses `VDOMPosition` with `{ node: VDOMNode, offset: number }`. The FSM also
imports missing functions (`textContentOffsetToNodeOffset`, `getTextOffsetInVDOM`) and creates
invalid selection formats.

## Handler Analysis & Implementation Order

### Prerequisites: Essential Utilities

**Must be created before any slice implementation:**

Create these foundational utilities in `VDOMSelection.ts`:

```typescript
// Conversion utilities
function absoluteOffsetToVDOMPosition(vdom: VDOMNode[], offset: number): VDOMPosition;
function vdomPositionToAbsoluteOffset(vdom: VDOMNode[], position: VDOMPosition): number;

// Validation utilities
function validateVDOMPosition(vdom: VDOMNode[], position: VDOMPosition): boolean;
function createDefaultSelection(vdom: VDOMNode[]): VDOMSelection;
function createCollapsedSelection(position: VDOMPosition): VDOMSelection;

// Navigation utilities
function getPreviousTextPosition(vdom: VDOMNode[], position: VDOMPosition): VDOMPosition | null;
function getNextTextPosition(vdom: VDOMNode[], position: VDOMPosition): VDOMPosition | null;
function isAtDocumentStart(vdom: VDOMNode[], position: VDOMPosition): boolean;
function isAtDocumentEnd(vdom: VDOMNode[], position: VDOMPosition): boolean;

// Legacy compatibility (for gradual migration)
function textContentOffsetToNodeOffset(vdom: VDOMNode[], offset: number): any; // temporary
function getTextOffsetInVDOM(vdom: VDOMNode[], nodeId: string, offset: number): number; // temporary
```

---

## SLICE 1: handleSetSelection ✅ (EASIEST START)

**Status**: ✅ Likely already works **Complexity**: Low **Dependencies**: None **Priority**: 1
(Start here)

### Current State

Already expects `VDOMSelection` as input, basic implementation should work.

### Changes Needed

1. Add validation using new VDOMSelection utilities
2. Ensure robust error handling
3. Add fallback selection creation

### Implementation Steps

1. Add position validation using `validateVDOMPosition`
2. Add fallback using `createDefaultSelection` for invalid inputs
3. Test with various selection scenarios

### Success Criteria

- Handles valid VDOMSelection input correctly
- Gracefully handles invalid/null selections
- Maintains existing functionality

---

## SLICE 2: handleSetCursorPosition ⚠️ (BUILD FOUNDATION)

**Status**: ❌ Needs conversion utilities **Complexity**: Medium **Dependencies**: Conversion
utilities from prerequisites **Priority**: 2 (Build conversion foundation)

### Current Issues

- Takes numeric position, creates `{ start: { offset: number } }` selection
- Needs to create proper `VDOMPosition` with node references

### Implementation Steps

1. Use `absoluteOffsetToVDOMPosition` to convert numeric input
2. Use `createCollapsedSelection` to create proper VDOMSelection
3. Add bounds checking and validation
4. Test with various cursor positions

### Success Criteria

- Correctly converts numeric positions to VDOMPosition
- Creates valid VDOMSelection objects
- Handles edge cases (negative positions, beyond document end)

---

## SLICE 3: handleEnterKey ✅ (EASY WIN)

**Status**: ✅ Likely works as-is **Complexity**: Low **Dependencies**: None **Priority**: 3 (Quick
win to build momentum)

### Current State

Appends BR node, preserves current selection.

### Potential Issues

- May need to validate selection format
- Ensure selection references remain valid after VDOM changes

### Implementation Steps

1. Verify current implementation works with new selection format
2. Add validation if needed
3. Test BR insertion at various cursor positions

### Success Criteria

- BR nodes inserted correctly
- Selection preserved accurately
- No regression in functionality

---

## SLICE 4: handleMoveCursorLeft 🔥 (CORE NAVIGATION)

**Status**: ❌ Major rewrite needed **Complexity**: High **Dependencies**: Navigation utilities
**Priority**: 4 (Core functionality)

### Current Issues

- Uses absolute offset arithmetic (`currentCursorPosition - 1`)
- Needs node-aware navigation
- Must handle node boundaries correctly

### Implementation Steps

1. Replace absolute offset logic with `getPreviousTextPosition`
2. Use `isAtDocumentStart` for boundary detection
3. Handle transitions between different node types
4. Test cursor movement across various VDOM structures

### Success Criteria

- Cursor moves correctly within and between nodes
- Handles document start boundary
- Maintains proper VDOMPosition references

---

## SLICE 5: handleMoveCursorRight 🔥 (CORE NAVIGATION)

**Status**: ❌ Major rewrite needed **Complexity**: High **Dependencies**: Navigation utilities
(similar to left) **Priority**: 5 (Core functionality)

### Current Issues

Same as handleMoveCursorLeft but in reverse direction.

### Implementation Steps

1. Replace absolute offset logic with `getNextTextPosition`
2. Use `isAtDocumentEnd` for boundary detection
3. Handle transitions between different node types
4. Test cursor movement across various VDOM structures

### Success Criteria

- Cursor moves correctly within and between nodes
- Handles document end boundary
- Maintains proper VDOMPosition references

---

## SLICE 6: handleInsertText ⚠️ (DEPENDENCY ASSESSMENT)

**Status**: ⚠️ Depends on VDOMFormatting compatibility **Complexity**: Medium **Dependencies**:
VDOMFormatting module updates **Priority**: 6 (After core navigation)

### Current State

Uses `insertTextWithFormatting` - need to verify compatibility with new selection model.

### Assessment Required

1. Check if `insertTextWithFormatting` expects old or new selection format
2. Update VDOMFormatting functions if necessary
3. Verify formatToggleState integration

### Implementation Steps

1. Test current implementation with new selection format
2. Update VDOMFormatting functions if needed
3. Ensure proper toggle state handling
4. Test text insertion at various cursor positions

### Success Criteria

- Text inserted correctly at cursor position
- Formatting applied based on toggle state
- Selection updated properly after insertion

---

## SLICE 7: handleToggleBold ⚠️ (FORMATTING DEPENDENCIES)

**Status**: ⚠️ Depends on VDOMFormatting functions **Complexity**: Medium-High **Dependencies**:
VDOMFormatting module **Priority**: 7 (After text insertion works)

### Current Dependencies

- `getFormatStateAtCursorPosition`
- `toggleBoldInSelection`

### Assessment Required

1. Verify these functions work with new VDOMPosition
2. Update formatting functions if necessary
3. Test toggle state logic

### Implementation Steps

1. Verify VDOMFormatting compatibility
2. Update formatting functions if needed
3. Test bold toggle for both cursor and range selections
4. Verify toggle state management

### Success Criteria

- Bold toggling works for cursor positions
- Bold toggling works for range selections
- Toggle state managed correctly

---

## SLICE 8: handleBackspace 🔥🔥 (MOST COMPLEX)

**Status**: ❌ Complete overhaul needed **Complexity**: Very High **Dependencies**: VDOMMutations,
all utilities **Priority**: 8 (Save hardest for last)

### Current Issues

- Complex conversion chain: absolute → node → VDOMMutations → absolute
- Uses missing functions: `textContentOffsetToNodeOffset`, `getTextOffsetInVDOM`
- Creates invalid selection format: `{ start: { nodeId, offset } }`

### Required Changes

1. Remove conversion chain entirely
2. Work directly with VDOMSelection throughout
3. Update VDOMMutations.deleteContentWithCleanup if needed
4. Handle edge cases (document start, empty content)

### Implementation Steps

1. Assess VDOMMutations compatibility with new selection format
2. Rewrite to work directly with VDOMPosition
3. Remove fallback to absolute offset conversion
4. Handle boundary conditions properly
5. Test deletion at various positions and node boundaries

### Success Criteria

- Backspace deletes correct character
- Selection positioned correctly after deletion
- Handles document start boundary
- Works across node boundaries
- No more conversion chain dependencies

---

## Implementation Strategy

### Order of Implementation

1. **Create Prerequisites** - Essential utilities first
2. **Slice 1** (handleSetSelection) - Easiest win
3. **Slice 2** (handleSetCursorPosition) - Build conversion foundation
4. **Slice 3** (handleEnterKey) - Another easy win
5. **Slice 4 & 5** (cursor movement) - Core navigation functionality
6. **Slice 6** (handleInsertText) - Text manipulation
7. **Slice 7** (handleToggleBold) - Formatting features
8. **Slice 8** (handleBackspace) - Most complex, save for last

### Testing Strategy Per Slice

For each slice:

1. **Unit tests** for the specific handler
2. **Integration tests** with mock VDOM structures
3. **Edge case testing** (empty VDOM, boundaries, invalid selections)
4. **Regression testing** to ensure other handlers still work

### Risk Mitigation

- Keep original handler as `handleXxxLegacy` during development
- Easy to rollback individual slices if issues arise
- Can run A/B tests between old and new implementations
- Each slice is independently testable

### Success Metrics

- ✅ **Incremental progress** - working system at each step
- ✅ **Independent testing** - each slice can be fully tested
- ✅ **Clear scope** - focused changes per iteration
- ✅ **Risk mitigation** - easy rollback of individual handlers
- ✅ **Dependency clarity** - know exactly what each slice needs

## Current Status

- [ ] Prerequisites created
- [ ] Slice 1: handleSetSelection
- [ ] Slice 2: handleSetCursorPosition
- [ ] Slice 3: handleEnterKey
- [ ] Slice 4: handleMoveCursorLeft
- [ ] Slice 5: handleMoveCursorRight
- [ ] Slice 6: handleInsertText
- [ ] Slice 7: handleToggleBold
- [ ] Slice 8: handleBackspace

## Notes

- This plan prioritizes getting basic functionality working quickly
- Complex handlers (backspace, formatting) are saved for when foundation is solid
- Each slice can be independently developed and tested
- Clear rollback strategy for each individual handler
