# ListService.ts Test Coverage Plan


### Test Plan by Method:

#### 1. `handleDeleteKeyOnList` (lines 186-187, 200-201, 215-220)

**Test for lines 186-187:**

- Create a list with a single non-empty item
- Position cursor at end of the item
- Trigger delete key to remove the item
- Verify the entire list gets removed when it becomes empty

**Test for lines 200-201:**

- Create a list with one content item and one whitespace-only item
- Remove the content item
- Verify the list gets removed when all remaining children are empty/whitespace

#### 2. `unwrapListItem` (lines 361-362, 453-458, 469)

**Test for line 469:**

- Create list item where firstChild is an element node (not text)
- Unwrap the item
- Verify the textNode check and cursor positioning logic

#### 3. `indentListItem` (lines 490-491, 502-503)

**Test for lines 490-491:**

- Position cursor outside any list item (e.g., in a paragraph)
- Call indentListItem
- Verify early return when no list item is found

**Test for lines 502-503:**

- Create a list with a single item (no previous sibling)
- Position cursor in the first item
- Call indentListItem
- Verify early return when no previous list item exists

#### 4. `insertList` (lines 537-538, 542-543)

**Test for lines 537-538:**

- Mock selectionService.getCurrentSelection() to return null or selection with rangeCount: 0
- Call insertList
- Verify early return when selection is invalid

**Test for lines 542-543:**

- Create a range with startContainer outside the root element
- Call insertList
- Verify early return when range is outside root

### Implementation Notes:

1. Each test should be specifically designed to trigger the exact conditional branch
2. Use proper mocking for SelectionService methods when needed
3. Verify both the condition execution and the expected behavior
4. Clean up any incorrectly labeled tests that don't actually cover the intended lines
5. Run coverage reports after each batch to verify progress

### Coverage Verification:

After implementing these tests, run:

```bash
npm run coverage -- --coverage.include="**/ListService.ts"
```

To verify that all targeted lines are now covered.
