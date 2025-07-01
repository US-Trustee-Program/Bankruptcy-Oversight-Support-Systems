# RichTextEditor2 Architectural Decision Records

This document contains detailed architectural decision records for RichTextEditor2, documenting the reasoning behind key design choices.

## Overview

This file tracks architectural decisions made during the RichTextEditor2 development, providing context and rationale for future developers and design reviews.

## Decision Records

### DECISION-010: Core State Management Structure
**Date**: 2025-07-01
**Status**: Approved
**Context**: Need for simple, predictable state management that supports undo/redo and virtual DOM operations.

**Problem**: The original RichTextEditor lacked clear state management, leading to unpredictable behavior. We need a structure that:
- Supports atomic updates for undo/redo
- Maintains virtual DOM as source of truth
- Uses self-documenting variable names
- Follows pure functional patterns

**Decision**: Implement atomic state updates with a single EditorState interface:

```typescript
interface EditorState {
  virtualDOM: VNode;                    // Document structure representation
  selection: Selection;                 // Cursor/selection state using path-based addressing
  currentEditorMode: EditorMode;        // Current finite state machine mode
}

type EditorMode = 'IDLE' | 'TYPING' | 'SELECTING' | 'FORMATTING';
type StateTransition = (currentState: EditorState) => EditorState;
```

**Alternatives Considered**:
- **Alternative A**: Separate state objects for different concerns
  - *Rejected*: Would complicate undo/redo and increase synchronization complexity
- **Alternative B**: Direct virtual DOM manipulation without centralized state
  - *Rejected*: Makes testing difficult and prevents reliable undo/redo
- **Alternative C**: Using acronyms (vdom, fsm) for brevity
  - *Rejected*: Reduces code readability and increases onboarding time

**Consequences**:
- ✅ All editor operations must be pure functions returning new state
- ✅ Undo/redo becomes straightforward with state snapshots
- ✅ Code is more readable with self-documenting names
- ❌ Requires immutable update patterns throughout codebase
- ❌ Slightly more verbose than acronym-based naming

### DECISION-011: Path-Based Selection Addressing
**Date**: 2025-07-01
**Status**: Approved
**Context**: Need for robust selection management that survives virtual DOM updates and supports operation-based undo/redo.

**Problem**: Selection management must:
- Survive VNode recreation during virtual DOM updates
- Be serializable for operation-based undo/redo
- Work reliably across different DOM structures
- Support complex selections (cross-paragraph, formatted text)

**Decision**: Implement path-based selection addressing using arrays of indices:

```typescript
interface Selection {
  startPath: number[];    // [0, 2, 1] = first block, third child, second child
  startOffset: number;    // Character offset within the target node
  endPath: number[];      // End position path
  endOffset: number;      // End character offset
  isCollapsed: boolean;   // Whether selection is just a cursor
}
```

**Alternatives Considered**:
- **Alternative A**: Direct VNode references with offsets
  - *Rejected*: References become invalid when VNodes are recreated
- **Alternative B**: DOM-based selection tracking
  - *Rejected*: Couples selection to real DOM, breaking virtual DOM architecture
- **Alternative C**: ID-based node addressing
  - *Rejected*: Requires maintaining ID mappings and doesn't handle dynamic content well

**Consequences**:
- ✅ Selection survives virtual DOM recreation
- ✅ Serializable for undo/redo operations
- ✅ Works with any virtual DOM structure
- ❌ Requires path resolution logic for DOM operations
- ❌ More complex than direct references

### DECISION-012: Operation-Based Undo/Redo Architecture
**Date**: 2025-07-01
**Status**: Approved
**Context**: Need for memory-efficient undo/redo that integrates with core state management architecture.

**Problem**: Undo/redo system must:
- Use minimal memory for large documents
- Support fine-grained operations
- Integrate with virtual DOM architecture from the start
- Handle complex operations (formatting, lists, etc.)

**Decision**: Implement operation-based history with inverse operations:

```typescript
interface EditorOperation {
  type: 'insertText' | 'deleteText' | 'formatText' | 'insertParagraph' | 'toggleList';
  data: unknown;              // Operation-specific data (strongly typed)
  inverse: EditorOperation;   // The operation to undo this one
  timestamp: number;
}

interface UndoRedoService {
  execute(operation: EditorOperation): EditorState;
  undo(): EditorState | null;
  redo(): EditorState | null;
  canUndo(): boolean;
  canRedo(): boolean;
}
```

**Alternatives Considered**:
- **Alternative A**: Full state snapshots for undo/redo
  - *Rejected*: Memory intensive for large documents, coarse-grained undo behavior
- **Alternative B**: No undo/redo support initially
  - *Rejected*: Core feature requirement, better to design from start
- **Alternative C**: Command pattern with separate undo commands
  - *Rejected*: More complex than inverse operations, harder to maintain

**Consequences**:
- ✅ Memory efficient - only stores operation data
- ✅ Fine-grained undo/redo behavior
- ✅ Forces good operation design from the start
- ❌ Every operation must be carefully designed to be reversible
- ❌ Complex operations require sophisticated inverse logic

### DECISION-013: Error Recovery Strategy
**Date**: 2025-07-01
**Status**: Approved
**Context**: Need for graceful handling of virtual DOM/real DOM synchronization issues without disrupting user experience.

**Problem**: Error recovery must:
- Handle virtual DOM/real DOM desynchronization gracefully
- Preserve user's active typing and editing flow
- Provide debugging information without exposing errors to users
- Maintain virtual DOM as authoritative source

**Decision**: Virtual DOM as source of truth with graceful recovery:

```typescript
interface ErrorRecoveryStrategy {
  recoverFromDesync(virtualDOM: VNode, realDOM: Element): EditorState;
  preserveActiveContent(realDOM: Element): string;
  logRecoveryEvent(error: Error, context: unknown): void;
}

// Recovery implementation priority:
// 1. Preserve user's currently typed content
// 2. Log error for debugging
// 3. Rebuild virtual DOM to match reality + preserved content
// 4. Continue editing without interruption
```

**Alternatives Considered**:
- **Alternative A**: Real DOM as source of truth with virtual DOM syncing
  - *Rejected*: Defeats virtual DOM architecture, makes state unpredictable
- **Alternative B**: Error reporting without recovery
  - *Rejected*: Poor user experience, could cause data loss
- **Alternative C**: Full editor restart on errors
  - *Rejected*: Terrible user experience, loses editing context

**Consequences**:
- ✅ Maintains architectural integrity (virtual DOM authority)
- ✅ Preserves user experience during errors
- ✅ Provides debugging information for development
- ❌ Requires sophisticated recovery logic
- ❌ May mask underlying bugs if recovery is too aggressive

### DECISION-014: BeforeInput Event Strategy
**Date**: 2025-07-01
**Status**: Approved
**Context**: Need for reliable input handling that maintains virtual DOM as source of truth before browser DOM mutations occur.

**Problem**: Input handling must:
- Capture user intent before DOM mutations
- Maintain virtual DOM as authoritative source
- Support all editor input types consistently
- Prevent browser default behavior for editor-managed content

**Decision**: Exclusive use of `beforeinput` event with prevented defaults:

```typescript
interface BeforeInputHandler {
  handleBeforeInput(event: InputEvent, currentState: EditorState): EditorState;
  preventDefaultForEditorInputTypes(event: InputEvent): boolean;
  mapInputTypeToOperation(inputType: string): EditorOperation | null;
}

// All editor input goes through beforeinput → virtual DOM operation → DOM patch
```

**Alternatives Considered**:
- **Alternative A**: Mixed approach with some direct DOM manipulation
  - *Rejected*: Creates inconsistent behavior and breaks virtual DOM authority
- **Alternative B**: Input event handling after DOM changes
  - *Rejected*: Virtual DOM becomes reactive instead of authoritative
- **Alternative C**: Keydown/keypress event handling
  - *Rejected*: Less semantic, doesn't provide clear user intent

**Consequences**:
- ✅ Virtual DOM remains authoritative for all content changes
- ✅ Clear user intent from beforeinput event types
- ✅ Consistent behavior across all input scenarios
- ❌ Must handle all input types comprehensively
- ❌ Requires preventing default for all editor-managed inputs
- ❌ More complex than allowing some browser default behavior

## Decision Impact Matrix

| Decision | State Mgmt | Selection | Undo/Redo | Error Recovery | Input Handling |
|----------|------------|-----------|-----------|----------------|----------------|
| DECISION-010 | ✅ Core | Defines Interface | Enables | Provides Context | Receives Updates |
| DECISION-011 | Uses Interface | ✅ Core | Enables Serialization | Part of Recovery | Updates State |
| DECISION-012 | Integrates With | Uses Serializable | ✅ Core | Logs Operations | Processes Operations |
| DECISION-013 | Maintains Authority | Preserves Context | Maintains History | ✅ Core | Continues Flow |
| DECISION-014 | Updates Through | Manages Changes | Creates Operations | Prevents Issues | ✅ Core |

## Implementation Priority

Based on dependencies and architectural impact:

1. **DECISION-010** (State Management) - Foundation for everything else
2. **DECISION-014** (BeforeInput) - Required for reliable input handling
3. **DECISION-011** (Path-Based Selection) - Enables virtual DOM operations
4. **DECISION-012** (Undo/Redo) - Must be integrated from start of Phase 2.1
5. **DECISION-013** (Error Recovery) - Important but can be refined iteratively

## Review and Updates

This document should be updated when:
- New architectural decisions are made
- Existing decisions are modified or reversed
- Implementation reveals issues with documented decisions
- Performance or usability testing suggests architectural changes

**Last Updated**: 2025-07-01
**Next Review**: After Phase 2.1 completion
