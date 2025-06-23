import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { ListUtilities } from './ListUtilities';
import { MockSelectionService } from './SelectionService.humble';
import { safelySetHtml } from './Editor.utilities';
import { ZERO_WIDTH_SPACE } from './Editor.constants';
import { setCursorInElement } from './RichTextEditor.test-utils';

describe('ListUtilities', () => {
  let root: HTMLDivElement;
  let listUtilities: ListUtilities;
  let selectionService: MockSelectionService;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    selectionService = new MockSelectionService();
    listUtilities = new ListUtilities(root, selectionService);
  });

  afterEach(() => {
    document.body.removeChild(root);
  });

  describe('createListWithEmptyItem', () => {
    test('creates unordered list with empty item', () => {
      const list = listUtilities.createListWithEmptyItem('ul');

      expect(list.tagName.toLowerCase()).toBe('ul');
      expect(list.children.length).toBe(1);
      expect(list.children[0].tagName.toLowerCase()).toBe('li');
      expect(list.children[0].textContent).toBe(ZERO_WIDTH_SPACE);
    });

    test('creates ordered list with empty item', () => {
      const list = listUtilities.createListWithEmptyItem('ol');

      expect(list.tagName.toLowerCase()).toBe('ol');
      expect(list.children.length).toBe(1);
      expect(list.children[0].tagName.toLowerCase()).toBe('li');
      expect(list.children[0].textContent).toBe(ZERO_WIDTH_SPACE);
    });
  });

  describe('unwrapListItem with nested lists', () => {
    test('handles list items with nested lists', () => {
      // Create a list with a nested list
      safelySetHtml(root, '<ul><li>Parent item<ul><li>Nested item</li></ul></li></ul>');

      // Get the parent list item
      const parentLi = root.querySelector('li')!;
      const parentList = root.querySelector('ul')!;

      // Set cursor in the parent list item
      setCursorInElement(parentLi, 0, selectionService);

      // Get the selection
      const range = selectionService.getRangeAtStartOfSelection();

      // Call unwrapListItem directly
      listUtilities.unwrapListItem(parentLi, parentList, range!);

      // Verify the parent item is now a paragraph
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelector('p')!.textContent).toContain('Parent item');

      // Verify the nested list is preserved
      expect(root.querySelector('ul')).toBeTruthy();
      expect(root.querySelector('li')).toBeTruthy();
      expect(root.querySelector('li')!.textContent).toBe('Nested item');
    });

    test('handles complex nested list structure with multiple levels', () => {
      // Create a complex nested list structure with multiple levels
      safelySetHtml(
        root,
        `
        <ul>
          <li>Level 1 Item 1</li>
          <li>Level 1 Item 2
            <ul>
              <li>Level 2 Item 1</li>
              <li>Level 2 Item 2
                <ul>
                  <li>Level 3 Item 1</li>
                </ul>
              </li>
            </ul>
          </li>
        </ul>
      `,
      );

      // Get the level 2 list item with a nested list
      const level2Item = root.querySelectorAll('ul > li > ul > li')[1] as HTMLElement;
      const level2List = level2Item.parentElement!;

      // Set cursor in the level 2 list item
      setCursorInElement(level2Item, 0, selectionService);

      // Get the selection
      const range = selectionService.getRangeAtStartOfSelection();

      // Call unwrapListItem directly
      listUtilities.unwrapListItem(
        level2Item as HTMLLIElement,
        level2List as HTMLUListElement,
        range!,
      );

      // Verify the level 2 item is now a paragraph
      expect(root.querySelectorAll('p').length).toBe(1);
      expect(root.querySelector('p')!.textContent).toContain('Level 2 Item 2');

      // Verify the level 3 list is preserved and moved after the paragraph
      const level3List = root.querySelector('p + ul');
      expect(level3List).toBeTruthy();
      expect(level3List!.querySelector('li')!.textContent).toBe('Level 3 Item 1');
    });

    test('handles unwrapping list item with multiple nested lists', () => {
      // Create a list item with multiple nested lists
      safelySetHtml(
        root,
        `
        <ul>
          <li>Parent item
            <ul><li>First nested list item</li></ul>
            <ul><li>Second nested list item</li></ul>
          </li>
        </ul>
      `,
      );

      // Get the parent list item
      const parentLi = root.querySelector('li')!;
      const parentList = root.querySelector('ul')!;

      // Set cursor in the parent list item
      setCursorInElement(parentLi, 0, selectionService);

      // Get the selection
      const range = selectionService.getRangeAtStartOfSelection();

      // Call unwrapListItem directly
      listUtilities.unwrapListItem(parentLi, parentList, range!);

      // Verify the parent item is now a paragraph
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelector('p')!.textContent).toContain('Parent item');

      // Verify both nested lists are preserved
      const nestedLists = root.querySelectorAll('ul');
      expect(nestedLists.length).toBe(2);

      // The order of the nested lists might vary, so we'll just check that both exist
      const listTexts = Array.from(nestedLists).map(
        (list) => list.querySelector('li')!.textContent,
      );
      expect(listTexts).toContain('First nested list item');
      expect(listTexts).toContain('Second nested list item');
    });

    test('handles unwrapping list item with non-text node as first child in final paragraph', () => {
      // Create a list with a list item containing a span
      safelySetHtml(root, '<ul><li><span>Text in span</span></li></ul>');

      // Get the list item
      const listItem = root.querySelector('li')!;
      const list = root.querySelector('ul')!;

      // Set cursor in the list item
      const span = root.querySelector('span')!;
      const range = selectionService.createRange();
      range.setStart(span.firstChild!, 0);
      range.collapse(true);
      selectionService.setSelectionRange(range);

      // Mock the createRange method to return a range that will trigger the non-text node branch
      const originalCreateRange = selectionService.createRange;
      selectionService.createRange = vi.fn().mockImplementation(() => {
        return originalCreateRange.call(selectionService);
      });

      // Call unwrapListItem directly
      listUtilities.unwrapListItem(listItem, list, range!);

      // Restore the original method
      selectionService.createRange = originalCreateRange;

      // Verify the list item is now a paragraph with the span
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelector('p span')).toBeTruthy();
      expect(root.querySelector('p')!.textContent).toBe('Text in span');
    });

    test('handles list items with empty text content', () => {
      // Create a list with an empty list item
      safelySetHtml(root, '<ul><li></li></ul>');

      // Get the list item
      const listItem = root.querySelector('li')!;
      const list = root.querySelector('ul')!;

      // Set cursor in the list item
      setCursorInElement(listItem, 0, selectionService);

      // Get the selection
      const range = selectionService.getRangeAtStartOfSelection();

      // Call unwrapListItem directly
      listUtilities.unwrapListItem(listItem, list, range!);

      // Verify the list item is now a paragraph with zero-width space
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelector('p')!.textContent).toBe(ZERO_WIDTH_SPACE);
    });

    test('handles non-text node as first child in paragraph', () => {
      // Create a list with a list item containing a span
      safelySetHtml(root, '<ul><li><span>Text in span</span></li></ul>');

      // Get the list item
      const listItem = root.querySelector('li')!;
      const list = root.querySelector('ul')!;

      // Set cursor in the list item
      const span = root.querySelector('span')!;
      const range = selectionService.createRange();
      range.setStart(span.firstChild!, 0);
      range.collapse(true);
      selectionService.setSelectionRange(range);

      // Call unwrapListItem directly
      listUtilities.unwrapListItem(listItem, list, range!);

      // Verify the list item is now a paragraph with the span
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelector('p span')).toBeTruthy();
      expect(root.querySelector('p')!.textContent).toBe('Text in span');
    });

    test('handles root list not in editor root', () => {
      // Create a separate root not in the editor
      const outsideroot = document.createElement('div');
      document.body.appendChild(outsideroot);
      safelySetHtml(outsideroot, '<ul><li>Outside item</li></ul>');

      try {
        // Get the list item and list
        const listItem = outsideroot.querySelector('li')!;
        const list = outsideroot.querySelector('ul')!;

        // Set cursor in the list item
        setCursorInElement(listItem, 0, selectionService);

        // Get the selection
        const range = selectionService.getRangeAtStartOfSelection();

        // Call unwrapListItem directly
        listUtilities.unwrapListItem(listItem, list, range!);

        // The method should return early without changes
        expect(outsideroot.querySelector('ul')).toBeTruthy();
        expect(outsideroot.querySelector('li')).toBeTruthy();
        expect(outsideroot.querySelector('p')).toBeFalsy();
      } finally {
        // Clean up
        document.body.removeChild(outsideroot);
      }
    });

    test('handles split index not found', () => {
      // Create a list with a list item
      safelySetHtml(root, '<ul><li>Item</li></ul>');

      // Get the list item and list
      const listItem = root.querySelector('li')!;
      const list = root.querySelector('ul')!;

      // Create a mock list item that's not in the DOM
      const mockLi = document.createElement('li');
      mockLi.textContent = 'Mock item';

      // Set cursor in the real list item
      setCursorInElement(listItem, 0, selectionService);

      // Get the selection
      const range = selectionService.getRangeAtStartOfSelection();

      // Call unwrapListItem with the mock list item
      listUtilities.unwrapListItem(mockLi, list, range!);

      // Verify the fallback case was used
      expect(root.querySelector('p')).toBeTruthy();
      // The paragraph should contain the content of the mock list item
      expect(root.querySelector('p')!.textContent).toBe('Mock item');
      expect(root.querySelector('ul')).toBeTruthy();
    });

    test('handles non-text node firstChild in unwrapListItem', () => {
      // Create a list with a list item containing a span
      safelySetHtml(root, '<ul><li><span>Text in span</span></li></ul>');

      // Get the list item
      const listItem = root.querySelector('li')!;
      const list = root.querySelector('ul')!;

      // Set cursor in the list item
      const span = root.querySelector('span')!;
      const range = selectionService.createRange();
      range.setStart(span, 0); // Set cursor at the span element itself, not its text content
      range.collapse(true);
      selectionService.setSelectionRange(range);

      // Call unwrapListItem directly
      listUtilities.unwrapListItem(listItem, list, range!);

      // Verify the list item is now a paragraph with the span
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelector('p span')).toBeTruthy();
      expect(root.querySelector('p')!.textContent).toBe('Text in span');
    });

    test('handles non-text node firstChild in paragraph with complex structure', () => {
      // Create a list with a list item containing a complex structure
      safelySetHtml(root, '<ul><li><div><span>Text in span</span></div></li></ul>');

      // Get the list item
      const listItem = root.querySelector('li')!;
      const list = root.querySelector('ul')!;

      // Set cursor in the list item
      const span = root.querySelector('span')!;
      const range = selectionService.createRange();
      range.setStart(span.firstChild!, 0);
      range.collapse(true);
      selectionService.setSelectionRange(range);

      // Mock the createRange method to return a range that will trigger the non-text node branch
      const originalCreateRange = selectionService.createRange;
      selectionService.createRange = vi.fn().mockImplementation(() => {
        return originalCreateRange.call(selectionService);
      });

      // Call unwrapListItem directly
      listUtilities.unwrapListItem(listItem, list, range!);

      // Restore the original method
      selectionService.createRange = originalCreateRange;

      // Verify the list item is now a paragraph with the text content preserved
      expect(root.querySelector('p')).toBeTruthy();
      // The structure might not be preserved exactly as in the original list item
      expect(root.querySelector('p')!.textContent).toBe('Text in span');
    });
  });

  describe('setCursorInListItem', () => {
    test('positions cursor at correct offset in simple text', () => {
      const listItem = document.createElement('li');
      listItem.textContent = 'Test content';
      root.appendChild(listItem);

      const setSelectionRangeSpy = vi.spyOn(selectionService, 'setSelectionRange');

      listUtilities.setCursorInListItem(listItem, 5);

      expect(setSelectionRangeSpy).toHaveBeenCalled();
      const range = setSelectionRangeSpy.mock.calls[0][0];
      expect(range.startOffset).toBe(5);
    });

    test('positions cursor at end when offset exceeds text length', () => {
      const listItem = document.createElement('li');
      listItem.textContent = 'Short';
      root.appendChild(listItem);

      const setSelectionRangeSpy = vi.spyOn(selectionService, 'setSelectionRange');

      listUtilities.setCursorInListItem(listItem, 100);

      expect(setSelectionRangeSpy).toHaveBeenCalled();
      const range = setSelectionRangeSpy.mock.calls[0][0];
      expect(range.startOffset).toBe(1); // Should use the fallback position
    });

    test('falls back to positioning after last child when no text nodes found', () => {
      const listItem = document.createElement('li');
      const img = document.createElement('img');
      listItem.appendChild(img);
      root.appendChild(listItem);

      const setSelectionRangeSpy = vi.spyOn(selectionService, 'setSelectionRange');

      listUtilities.setCursorInListItem(listItem, 0);

      expect(setSelectionRangeSpy).toHaveBeenCalled();
    });
  });

  describe('findRootList', () => {
    test('returns null for null input', () => {
      const result = listUtilities.findRootList(null);
      expect(result).toBeNull();
    });

    test('returns same list when it is already root level', () => {
      safelySetHtml(root, '<ul><li>Item</li></ul>');
      const list = root.querySelector('ul')!;

      const result = listUtilities.findRootList(list);
      expect(result).toBe(list);
    });

    test('finds root list when given nested list', () => {
      safelySetHtml(root, '<ul><li>Item<ul><li>Nested</li></ul></li></ul>');
      const nestedList = root.querySelector('ul ul')!;
      const rootList = root.querySelector('ul')!;

      const result = listUtilities.findRootList(nestedList as HTMLUListElement);
      expect(result).toBe(rootList);
    });
  });

  describe('getAncestorIfLastLeaf', () => {
    test('returns the list itself when it has no parent list item', () => {
      safelySetHtml(root, '<ul><li>Item</li></ul>');
      const list = root.querySelector('ul')!;

      const result = listUtilities.getAncestorIfLastLeaf(list);
      expect(result).toBe(list);
    });

    test('returns false when list item is not the last child', () => {
      safelySetHtml(root, '<ul><li>First<ul><li>Nested</li></ul></li><li>Second</li></ul>');
      const nestedList = root.querySelector('ul ul')!;

      const result = listUtilities.getAncestorIfLastLeaf(nestedList as HTMLUListElement);
      expect(result).toBe(false);
    });

    test('recursively finds ancestor when list item is last child', () => {
      safelySetHtml(root, '<ul><li>Item<ul><li>Nested</li></ul></li></ul>');
      const nestedList = root.querySelector('ul ul')!;
      const rootList = root.querySelector('ul')!;

      const result = listUtilities.getAncestorIfLastLeaf(nestedList as HTMLUListElement);
      expect(result).toBe(rootList);
    });
  });
});
