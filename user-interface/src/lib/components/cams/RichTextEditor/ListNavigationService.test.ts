import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { ListNavigationService } from './ListNavigationService';
import { ListUtilities } from './ListUtilities';
import { MockSelectionService } from './SelectionService.humble';
import { safelySetHtml, safelyGetHtml } from './utilities';
import { ZERO_WIDTH_SPACE } from './editor.constants';
import { setCursorInElement, setCursorInParagraph2 } from './test-utils';

describe('ListNavigationService', () => {
  let root: HTMLDivElement;
  let listNavigationService: ListNavigationService;
  let listUtilities: ListUtilities;
  let selectionService: MockSelectionService;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    selectionService = new MockSelectionService();
    listUtilities = new ListUtilities(root, selectionService);
    listNavigationService = new ListNavigationService(root, selectionService, listUtilities);
  });

  afterEach(() => {
    document.body.removeChild(root);
  });

  describe('handleEnterKey', () => {
    const createEnterEvent = (): React.KeyboardEvent<HTMLDivElement> =>
      ({
        key: 'Enter',
        preventDefault: vi.fn(),
      }) as unknown as React.KeyboardEvent<HTMLDivElement>;

    const createNonEnterEvent = (): React.KeyboardEvent<HTMLDivElement> =>
      ({
        key: 'Space',
        preventDefault: vi.fn(),
      }) as unknown as React.KeyboardEvent<HTMLDivElement>;

    test('returns false for non-Enter keys', () => {
      const event = createNonEnterEvent();
      const result = listNavigationService.handleEnterKey(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when no selection exists', () => {
      selectionService.getCurrentSelection = vi.fn().mockReturnValue(null);

      const event = createEnterEvent();
      const result = listNavigationService.handleEnterKey(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('creates new paragraph on Enter in regular paragraph', () => {
      safelySetHtml(root, '<p>Some text</p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph2(paragraph, 4, selectionService);

      const event = createEnterEvent();
      const result = listNavigationService.handleEnterKey(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(root.querySelectorAll('p')).toHaveLength(2);
    });

    test('exits empty list item and creates paragraph', () => {
      safelySetHtml(root, '<ul><li>Item 1</li><li></li></ul>');
      const emptyListItem = root.querySelectorAll('li')[1];
      setCursorInElement(emptyListItem, 0, selectionService);

      const event = createEnterEvent();
      const result = listNavigationService.handleEnterKey(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelectorAll('li')).toHaveLength(1);
    });

    test('should exit empty list item and create paragraph at root when list item is empty and enter is pressed', () => {
      safelySetHtml(root, '<ul><li>Item 1<ul><li>Nested item</li><li></li></ul></li></ul>');
      const emptyListItem = root.querySelectorAll('ul ul li')[1]!;
      setCursorInElement(emptyListItem as HTMLElement, 0, selectionService);

      const event = createEnterEvent();
      const result = listNavigationService.handleEnterKey(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(safelyGetHtml(root)).toEqual(
        `<ul><li>Item 1<ul><li>Nested item</li></ul></li></ul><p>${ZERO_WIDTH_SPACE}</p>`,
      );
    });

    test('handles enter in non-empty list item normally', () => {
      safelySetHtml(root, '<ul><li>Non-empty item</li></ul>');
      const listItem = root.querySelector('li')!;
      setCursorInElement(listItem, 5, selectionService);

      const event = createEnterEvent();
      const result = listNavigationService.handleEnterKey(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('removes entire list when all children become empty after Enter', () => {
      // Create a list where all items are empty/whitespace only
      // After removing one empty item, the remaining items should all be empty too
      root.innerHTML = ''; // Start fresh

      const list = document.createElement('ul');

      // First item: completely empty
      const emptyItem1 = document.createElement('li');
      // Second item: only whitespace
      const emptyItem2 = document.createElement('li');
      emptyItem2.textContent = '   '; // Only whitespace

      list.appendChild(emptyItem1);
      list.appendChild(emptyItem2);
      root.appendChild(list);

      // Position cursor in the first empty item
      const range = selectionService.createRange();
      range.setStart(emptyItem1, 0);
      range.collapse(true);
      selectionService.setSelectionRange(range);

      const event = createEnterEvent();
      const result = listNavigationService.handleEnterKey(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();

      // Should trigger lines 121-122: check if all remaining children are empty and remove the list
      expect(root.querySelector('ul')).toBeFalsy(); // List should be removed
      expect(root.querySelector('p')).toBeTruthy(); // Paragraph should be created
    });

    test('inserts paragraph directly when not in a paragraph context', () => {
      // Create a situation where we press Enter but are NOT in a paragraph
      // This should trigger the else branch: range.collapse(false); range.insertNode(newParagraph);
      root.innerHTML = ''; // Start fresh - no paragraphs

      // Position cursor directly in the root, not in a paragraph or list
      const textNode = document.createTextNode('Some text');
      root.appendChild(textNode);

      const range = selectionService.createRange();
      range.setStart(textNode, 5); // Position in middle of text
      range.collapse(true);
      selectionService.setSelectionRange(range);

      const event = createEnterEvent();
      const result = listNavigationService.handleEnterKey(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();

      // Should trigger lines 144-146: else branch that inserts paragraph directly
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelector('p')!.textContent).toBe(ZERO_WIDTH_SPACE);
    });
  });

  describe('handleDeleteKeyOnList', () => {
    const createBackspaceEvent = (): React.KeyboardEvent<HTMLDivElement> =>
      ({
        key: 'Backspace',
        preventDefault: vi.fn(),
      }) as unknown as React.KeyboardEvent<HTMLDivElement>;

    const createDeleteEvent = (): React.KeyboardEvent<HTMLDivElement> =>
      ({
        key: 'Delete',
        preventDefault: vi.fn(),
      }) as unknown as React.KeyboardEvent<HTMLDivElement>;

    const createOtherKeyEvent = (): React.KeyboardEvent<HTMLDivElement> =>
      ({
        key: 'Enter',
        preventDefault: vi.fn(),
      }) as unknown as React.KeyboardEvent<HTMLDivElement>;

    test('returns false for non-Delete/Backspace keys', () => {
      const event = createOtherKeyEvent();
      const result = listNavigationService.handleDeleteKeyOnList(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when not at start of list item', () => {
      safelySetHtml(root, '<ul><li>Item content</li></ul>');
      const listItem = root.querySelector('li')!;
      setCursorInElement(listItem, 4, selectionService); // Not at start

      const event = createBackspaceEvent();
      const result = listNavigationService.handleDeleteKeyOnList(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when not in a list', () => {
      safelySetHtml(root, '<p>Not in a list</p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph2(paragraph, 0, selectionService);

      const event = createBackspaceEvent();
      const result = listNavigationService.handleDeleteKeyOnList(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when not the last item in the list', () => {
      safelySetHtml(root, '<ul><li>First item</li><li>Second item</li></ul>');
      const firstItem = root.querySelectorAll('li')[0];
      setCursorInElement(firstItem, 0, selectionService);

      const event = createBackspaceEvent();
      const result = listNavigationService.handleDeleteKeyOnList(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when list item has nested lists', () => {
      safelySetHtml(root, '<ul><li>Item with nested list<ul><li>Nested item</li></ul></li></ul>');
      const listItem = root.querySelector('li')!;
      setCursorInElement(listItem, 0, selectionService);

      const event = createBackspaceEvent();
      const result = listNavigationService.handleDeleteKeyOnList(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('removes empty list item when backspace is pressed at start', () => {
      // Use a list item with a BR element, which is a common way to represent an empty list item
      safelySetHtml(root, '<ul><li>First item</li><li><br></li></ul>');
      const emptyItem = root.querySelectorAll('li')[1];

      // Set the cursor at the start of the list item (before the BR element)
      const range = selectionService.createRange();
      range.setStart(emptyItem, 0);
      range.collapse(true);
      selectionService.setSelectionRange(range);

      const event = createBackspaceEvent();
      const result = listNavigationService.handleDeleteKeyOnList(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(root.querySelectorAll('li').length).toBe(1);
    });

    test('converts list item to paragraph when backspace is pressed at start of last item', () => {
      safelySetHtml(root, '<ul><li>First item</li><li>Last item</li></ul>');
      const lastItem = root.querySelectorAll('li')[1];
      setCursorInElement(lastItem, 0, selectionService);

      const event = createBackspaceEvent();
      const result = listNavigationService.handleDeleteKeyOnList(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(root.querySelectorAll('li').length).toBe(1);
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelector('p')!.textContent).toBe('Last item');
    });

    test('works with Delete key as well as Backspace', () => {
      safelySetHtml(root, '<ul><li>First item</li><li>Last item</li></ul>');
      const lastItem = root.querySelectorAll('li')[1];
      setCursorInElement(lastItem, 0, selectionService);

      const event = createDeleteEvent();
      const result = listNavigationService.handleDeleteKeyOnList(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    test('removes parent list when it becomes empty after removing non-empty item', () => {
      // Create a list with only one non-empty item
      // When we remove this item, the list should become empty and be removed
      root.innerHTML = ''; // Start fresh

      const list = document.createElement('ul');
      const singleItem = document.createElement('li');
      singleItem.textContent = 'Only item with content';
      list.appendChild(singleItem);
      root.appendChild(list);

      // Position cursor at start of the single item
      const range = selectionService.createRange();
      range.setStart(singleItem.firstChild!, 0);
      range.collapse(true);
      selectionService.setSelectionRange(range);

      const event = createBackspaceEvent();
      const result = listNavigationService.handleDeleteKeyOnList(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();

      // Should trigger lines 186-187: remove parent list when it becomes empty
      expect(root.querySelector('ul')).toBeFalsy(); // List should be removed
      expect(root.querySelector('p')).toBeTruthy(); // Paragraph should be created with content
      expect(root.querySelector('p')!.textContent).toBe('Only item with content');
    });

    test('removes parent list when all remaining children are empty after deletion', () => {
      // Create a list where after removing the content item,
      // all remaining items have only whitespace
      root.innerHTML = ''; // Start fresh

      const list = document.createElement('ul');

      // First item: only whitespace
      const emptyItem = document.createElement('li');
      emptyItem.textContent = '   '; // Only whitespace

      // Second item: has content (this will be removed)
      const contentItem = document.createElement('li');
      contentItem.textContent = 'Content item';

      list.appendChild(emptyItem);
      list.appendChild(contentItem);
      root.appendChild(list);

      // Position cursor at start of the content item
      const range = selectionService.createRange();
      range.setStart(contentItem.firstChild!, 0);
      range.collapse(true);
      selectionService.setSelectionRange(range);

      const event = createBackspaceEvent();
      const result = listNavigationService.handleDeleteKeyOnList(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();

      // Should trigger lines 200-201: check if all remaining children are empty and remove list
      // After removing contentItem, only emptyItem remains with whitespace
      expect(root.querySelector('ul')).toBeFalsy(); // List should be removed due to lines 200-201
      expect(root.querySelector('p')).toBeTruthy(); // Paragraph should be created
    });

    test('should return false when the range starts with a ul element but the element does not contain a li element', () => {
      // Create a ul element without any li elements
      const ul = document.createElement('ul');
      root.appendChild(ul);

      // Set up a selection range that starts with the ul element
      const range = selectionService.createRange();
      range.setStart(ul, 0);
      range.collapse(true);
      selectionService.setSelectionRange(range);

      // Create a backspace event
      const event = createBackspaceEvent();

      // Call the method under test
      const result = listNavigationService.handleDeleteKeyOnList(event);

      // Verify the result is false (method didn't handle the event)
      expect(result).toBe(false);

      // Verify the ul element is still in the DOM
      expect(root.querySelector('ul')).toBeTruthy();

      // Verify the preventDefault wasn't called (since the method returned false)
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('should return false when the range starts in an li element within a ul element within another li within a ul within another li element and that topmost li element is not the last child of its parent ul', () => {
      safelySetHtml(
        root,
        `
        <ul>
          <li>
            <ul>
              <li>
                <ul>
                  <li>Test content</li>
                </ul>
              </li>
            </ul>
          </li>
          <li>Last item</li>
        </ul>
        `,
      );

      // Set up a selection range that starts in the deepest nested li
      const range = selectionService.createRange();
      range.setStart(root.querySelector('ul ul ul li')!.firstChild!, 0);
      range.collapse(true);
      selectionService.setSelectionRange(range);

      // Create a backspace event
      const event = createBackspaceEvent();

      // Call the method under test
      const result = listNavigationService.handleDeleteKeyOnList(event);

      // Verify the result is false (method didn't handle the event)
      expect(result).toBe(false);

      // Verify the preventDefault wasn't called (since the method returned false)
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('should return grandparent list when the range starts in an li element within a ul element within another li within a ul', () => {
      safelySetHtml(
        root,
        `
        <li>
        <ul>
          <li>
            <ul>
              <li>Test content</li>
            </ul>
          </li>
        </ul>
        </li>
        `,
      );

      // Set up a selection range that starts in the deepest nested li
      const range = selectionService.createRange();
      range.setStart(root.querySelector('ul ul li')!.firstChild!, 0);
      range.collapse(true);
      selectionService.setSelectionRange(range);

      // Create a backspace event
      const event = createBackspaceEvent();

      // Call the method under test
      const result = listNavigationService.handleDeleteKeyOnList(event);

      // Verify the result is false (method didn't handle the event)
      expect(result).toBe(true);
    });

    test("should access the first child's first child as a text node when unwrapping a list item that contains inline formatted elements where the resulting paragraph's first child is an element node rather than a direct text node", () => {
      // Create a list with multiple list items to avoid special case handling
      const ul = document.createElement('ul');

      // First list item (will be unwrapped)
      const li1 = document.createElement('li');
      const strongElement = document.createElement('strong');
      strongElement.textContent = 'Bold text';
      li1.appendChild(strongElement);

      // Second list item (to prevent special case handling)
      const li2 = document.createElement('li');
      li2.textContent = 'Second item';

      ul.appendChild(li1);
      ul.appendChild(li2);
      root.appendChild(ul);

      // Set up a selection within the list item's formatted content
      const range = selectionService.createRange();
      range.setStart(strongElement.firstChild!, 2); // Position cursor at "Bo|ld text"
      range.collapse(true);

      // Spy on the setSelectionRange method to verify it gets called
      const setSelectionRangeSpy = vi.spyOn(selectionService, 'setSelectionRange');

      // Call unwrapListItem to convert the list item to a paragraph
      listUtilities.unwrapListItem(li1, ul, range);

      // Verify the list still exists (with remaining item)
      const remainingList = root.querySelector('ul');
      expect(remainingList).toBeTruthy();
      expect(remainingList?.children.length).toBe(1);
      expect(remainingList?.textContent?.trim()).toBe('Second item');

      // Verify a paragraph was created with the unwrapped content
      const paragraph = root.querySelector('p');
      expect(paragraph).toBeTruthy();

      // Verify the paragraph contains the inline formatted element
      const strongInParagraph = paragraph?.querySelector('strong');
      expect(strongInParagraph).toBeTruthy();
      expect(strongInParagraph?.textContent).toBe('Bold text');

      // Verify that the paragraph's first child is the strong element (not a text node)
      expect(paragraph?.firstChild?.nodeName).toBe('STRONG');
      expect(paragraph?.firstChild?.nodeType).toBe(Node.ELEMENT_NODE);

      // Verify that the strong element's first child is the text node
      expect(strongInParagraph?.firstChild?.nodeType).toBe(Node.TEXT_NODE);
      expect(strongInParagraph?.firstChild?.textContent).toBe('Bold text');

      // Verify setSelectionRange was called (indicating cursor positioning occurred)
      expect(setSelectionRangeSpy).toHaveBeenCalled();
    });
  });
});
