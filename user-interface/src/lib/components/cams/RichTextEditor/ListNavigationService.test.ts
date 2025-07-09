import { vi, describe, test, expect, beforeEach } from 'vitest';
import { ListNavigationService } from './ListNavigationService';
import { SelectionService } from './SelectionService.humble';
import { ListUtilities } from './ListUtilities';
import { ZERO_WIDTH_SPACE } from './Editor.constants';

/**
 * Tests for ListNavigationService
 *
 * This file organizes tests into logical sections:
 * - Empty Item Handling: Tests for consistent behavior with empty list items
 * - Empty Item Detection: Tests for correctly identifying empty list items
 * - Normalization Behavior: Tests for normalizing different forms of empty items
 * - Exiting Lists: Tests for exiting list mode when pressing Enter on empty items
 */

// Shared test helpers and setup
const createMockRange = () => ({
  startContainer: null as Node | null,
  startOffset: 0,
  collapsed: true,
  setStart: vi.fn(),
  setEnd: vi.fn(),
  insertNode: vi.fn(),
  collapse: vi.fn(),
  cloneContents: vi.fn(),
  deleteContents: vi.fn(),
});

const createMockSelection = (mockRange: ReturnType<typeof createMockRange>) => ({
  getRangeAt: vi.fn().mockReturnValue(mockRange),
  removeAllRanges: vi.fn(),
  addRange: vi.fn(),
  rangeCount: 1,
});

const createEnterKeyEvent = () =>
  ({
    key: 'Enter',
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }) as unknown as React.KeyboardEvent<HTMLDivElement>;

describe('ListNavigationService', () => {
  let root: HTMLDivElement;
  let selectionService: SelectionService;
  let listUtilities: ListUtilities;
  let listNavigationService: ListNavigationService;
  let mockRange: ReturnType<typeof createMockRange>;
  let mockSelection: ReturnType<typeof createMockSelection>;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.resetAllMocks();

    // Set up DOM
    document.body.innerHTML = '';
    root = document.createElement('div');
    document.body.appendChild(root);

    // Set up range and selection
    mockRange = createMockRange();
    mockSelection = createMockSelection(mockRange);

    // Set up mocks
    selectionService = {
      getCurrentSelection: vi.fn().mockReturnValue(mockSelection),
      getRangeAtStartOfSelection: vi.fn().mockReturnValue(mockRange),
      setSelectionRange: vi.fn(),
      createRange: vi.fn().mockReturnValue({ ...mockRange }),
      createDocumentFragment: vi.fn().mockImplementation(() => document.createDocumentFragment()),
      createElement: vi.fn().mockImplementation((tag) => document.createElement(tag)),
      createTextNode: vi.fn().mockImplementation((text) => document.createTextNode(text)),
      getSelectedText: vi.fn(),
      selectNodeContents: vi.fn(),
      createTreeWalker: vi.fn(),
    } as unknown as SelectionService;

    listUtilities = {
      findRootList: vi.fn().mockImplementation((list) => {
        if (list && list.parentNode === root) {
          // Simulate creating and adding a paragraph after the list
          setTimeout(() => {
            const p = document.createElement('p');
            p.textContent = ZERO_WIDTH_SPACE;
            root.appendChild(p);
          }, 0);
        }
        return list;
      }),
      getAncestorIfLastLeaf: vi.fn(),
      getAncestorListItem: vi.fn(),
      getAncestorList: vi.fn().mockImplementation(() => null),
      isEmptyListItem: vi.fn().mockImplementation(() => false),
    } as unknown as ListUtilities;

    listNavigationService = new ListNavigationService(root, selectionService, listUtilities);
  });

  // Helper function to create a list with a specific list type
  const setupListWithEmptyItem = (listType: 'ul' | 'ol', content = ZERO_WIDTH_SPACE) => {
    const list = document.createElement(listType);
    root.appendChild(list);

    const listItem = document.createElement('li');
    list.appendChild(listItem);

    if (content) {
      listItem.appendChild(document.createTextNode(content));
    }

    return { list, listItem };
  };

  // Helper function to create a list with multiple items
  // Not used in current tests, but kept for future test expansion
  const _setupMultiItemList = (
    listType: 'ul' | 'ol',
    itemContents: string[] = ['Item 1', 'Item 2', ''],
  ) => {
    const list = document.createElement(listType);
    root.appendChild(list);

    const listItems = itemContents.map((content) => {
      const li = document.createElement('li');
      if (content === '') {
        li.appendChild(document.createTextNode(ZERO_WIDTH_SPACE));
      } else {
        li.textContent = content;
      }
      list.appendChild(li);
      return li;
    });

    return { list, listItems };
  };

  // Note: Basic Navigation tests were intentionally omitted as they are not relevant
  // to the specific list behaviors being tested in this file

  // Tests from ListEmptyItemTest.test.ts
  describe('Empty Item Handling', () => {
    test('should handle empty bullet list item consistently after normalization', () => {
      // Set up a bullet list with a normalized empty item
      const { listItem } = setupListWithEmptyItem('ul');

      // Set up the range to be inside the list item
      mockRange.startContainer = listItem.firstChild!; // The text node with ZWS

      // Create a keyboard event for Enter key
      const enterEvent = createEnterKeyEvent();

      // Call handleEnterKey
      const result = listNavigationService.handleEnterKey(enterEvent);

      // Since the list item should be detected as empty, the event should be handled
      expect(result).toBe(true);
      expect(enterEvent.preventDefault).toHaveBeenCalled();
    });

    test('should handle empty numbered list item consistently after normalization', () => {
      // Set up a numbered list with a normalized empty item
      const { listItem } = setupListWithEmptyItem('ol');

      // Set up the range to be inside the list item
      mockRange.startContainer = listItem.firstChild!; // The text node with ZWS

      // Create a keyboard event for Enter key
      const enterEvent = createEnterKeyEvent();

      // Call handleEnterKey
      const result = listNavigationService.handleEnterKey(enterEvent);

      // Since the list item should be detected as empty, the event should be handled
      expect(result).toBe(true);
      expect(enterEvent.preventDefault).toHaveBeenCalled();
    });

    test('should handle Enter key consistently for both list types after normalization', () => {
      // Since we're just checking for consistent behavior between list types,
      // we'll test each one separately and compare results

      // Test ordered list
      root.innerHTML = '';
      const { listItem: olItem } = setupListWithEmptyItem('ol');
      mockRange.startContainer = olItem.firstChild!;

      const olEnterEvent = createEnterKeyEvent();

      const olResult = listNavigationService.handleEnterKey(olEnterEvent);

      // Test unordered list
      root.innerHTML = '';
      const { listItem: ulItem } = setupListWithEmptyItem('ul');
      mockRange.startContainer = ulItem.firstChild!;

      const ulEnterEvent = createEnterKeyEvent();

      const ulResult = listNavigationService.handleEnterKey(ulEnterEvent);

      // Both list types should result in the same behavior
      expect(olResult).toBe(ulResult);
      expect(olEnterEvent.preventDefault).toHaveBeenCalled();
      expect(ulEnterEvent.preventDefault).toHaveBeenCalled();
    });
  });

  // Tests for empty item detection
  describe('Empty Item Detection', () => {
    test('should detect empty list items correctly for Enter key handling', () => {
      // Setup a list with a single item containing only a zero-width space
      const { listItem } = setupListWithEmptyItem('ul');
      mockRange.startContainer = listItem.firstChild!;

      // Set up Enter event
      const enterEvent = createEnterKeyEvent();

      // Call handleEnterKey
      const result = listNavigationService.handleEnterKey(enterEvent);

      // Should handle the event because it's an empty item
      expect(result).toBe(true);
      expect(enterEvent.preventDefault).toHaveBeenCalled();
    });

    test('should detect list item with double zero-width space as empty', () => {
      // Setup a list with a single item containing two zero-width spaces
      const { listItem } = setupListWithEmptyItem('ul', ZERO_WIDTH_SPACE + ZERO_WIDTH_SPACE);
      mockRange.startContainer = listItem.firstChild!;

      // Set up Enter event
      const enterEvent = createEnterKeyEvent();

      // Call handleEnterKey
      const result = listNavigationService.handleEnterKey(enterEvent);

      // Should handle the event because it's detected as an empty item
      expect(result).toBe(true);
      expect(enterEvent.preventDefault).toHaveBeenCalled();
    });
  });

  // Tests for normalization behavior (testing indirectly through handleEnterKey)
  describe('Normalization Behavior', () => {
    test('should normalize and handle empty list item with double ZERO_WIDTH_SPACE', () => {
      const doubleZWS = ZERO_WIDTH_SPACE + ZERO_WIDTH_SPACE;
      const { listItem } = setupListWithEmptyItem('ul', doubleZWS);

      // Mock the range to be inside the list item
      mockRange.startContainer = listItem.firstChild!;
      mockRange.startOffset = 1; // Between the two ZWS characters

      // Setup Enter event
      const enterEvent = createEnterKeyEvent();

      // Call handleEnterKey (which internally normalizes the list item)
      const result = listNavigationService.handleEnterKey(enterEvent);

      // Should handle the event because it's detected as an empty item
      expect(result).toBe(true);
      expect(enterEvent.preventDefault).toHaveBeenCalled();
    });

    test('should normalize and handle empty list item with <br> element', () => {
      // Setup list with <br> element
      const { listItem } = setupListWithEmptyItem('ul', '');
      const br = document.createElement('br');
      listItem.appendChild(br);

      // Mock the range to be at the br element
      mockRange.startContainer = listItem;
      mockRange.startOffset = 0;

      // Setup Enter event
      const enterEvent = createEnterKeyEvent();

      // Call handleEnterKey (which internally normalizes)
      const result = listNavigationService.handleEnterKey(enterEvent);

      // Should handle the event
      expect(result).toBe(true);
      expect(enterEvent.preventDefault).toHaveBeenCalled();
    });

    test('should not exit list for non-empty list item', () => {
      // Setup list with actual content
      const { listItem } = setupListWithEmptyItem('ul', 'Some content');

      // Mock the range to be in the content
      mockRange.startContainer = listItem.firstChild!;
      mockRange.startOffset = 5;

      // Setup Enter event
      const enterEvent = createEnterKeyEvent();

      // Call handleEnterKey
      const result = listNavigationService.handleEnterKey(enterEvent);

      // Should not handle the event since it's not an empty item
      expect(result).toBe(false);
    });
  });

  // Tests for exiting lists
  describe('Exiting Lists', () => {
    test('should exit ordered list on Enter in empty list item', () => {
      // Setup ordered list with empty list item
      const { list, listItem } = setupListWithEmptyItem('ol');
      mockRange.startContainer = listItem.firstChild!;

      // Mock findRootList to use the actual list
      vi.spyOn(listUtilities, 'findRootList').mockReturnValue(list);

      // Create Enter event
      const enterEvent = createEnterKeyEvent();

      // Call handleEnterKey
      const result = listNavigationService.handleEnterKey(enterEvent);

      // Should handle the event
      expect(result).toBe(true);
      expect(enterEvent.preventDefault).toHaveBeenCalled();

      // List item should be removed (we simulate this via the mock)
      expect(listUtilities.findRootList).toHaveBeenCalledWith(list);
    });

    test('should exit unordered list on Enter in empty list item', () => {
      // Setup unordered list with empty list item
      const { list, listItem } = setupListWithEmptyItem('ul');
      mockRange.startContainer = listItem.firstChild!;

      // Mock findRootList to use the actual list
      vi.spyOn(listUtilities, 'findRootList').mockReturnValue(list);

      // Create Enter event
      const enterEvent = createEnterKeyEvent();

      // Call handleEnterKey
      const result = listNavigationService.handleEnterKey(enterEvent);

      // Should handle the event
      expect(result).toBe(true);
      expect(enterEvent.preventDefault).toHaveBeenCalled();

      // List item should be removed (we simulate this via the mock)
      expect(listUtilities.findRootList).toHaveBeenCalledWith(list);
    });

    test('should exit numbered list with double ZERO_WIDTH_SPACE', () => {
      // Setup ordered list with a list item containing double ZWS
      const doubleZWS = ZERO_WIDTH_SPACE + ZERO_WIDTH_SPACE;
      const { list, listItem } = setupListWithEmptyItem('ol', doubleZWS);

      // Set the range to be inside the list item
      mockRange.startContainer = listItem.firstChild!;
      mockRange.startOffset = 1; // Between the two ZWS characters

      // Mock findRootList to use the actual list
      vi.spyOn(listUtilities, 'findRootList').mockReturnValue(list);

      // Create Enter event
      const enterEvent = createEnterKeyEvent();

      // Call handleEnterKey
      const result = listNavigationService.handleEnterKey(enterEvent);

      // Should handle the event
      expect(result).toBe(true);
      expect(enterEvent.preventDefault).toHaveBeenCalled();

      // List item should be normalized and then removed
      expect(listUtilities.findRootList).toHaveBeenCalledWith(list);
    });
  });
});
