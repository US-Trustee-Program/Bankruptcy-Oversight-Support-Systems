import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { ListService } from './ListService';
import { MockSelectionService } from './SelectionService.humble';
import editorUtilities from './utilities';
import {
  DOMPURIFY_CONFIG,
  ZERO_WIDTH_SPACE,
} from '@/lib/components/cams/RichTextEditor/editor.constants';
import DOMPurify from 'dompurify';

// Helper functions adapted for SelectionService pattern
function setCursorInParagraph(
  paragraph: HTMLParagraphElement,
  offset: number,
  selectionService: MockSelectionService,
) {
  const range = selectionService.createRange();
  if (!paragraph.firstChild) {
    paragraph.appendChild(document.createTextNode(''));
  }
  range.setStart(paragraph.firstChild!, offset);
  range.collapse(true);
  selectionService.setSelectionRange(range);
  return selectionService.getCurrentSelection();
}

function setCursorInElement(
  element: Element,
  offset: number,
  selectionService: MockSelectionService,
) {
  const range = selectionService.createRange();
  if (!element.firstChild) {
    element.appendChild(document.createTextNode(''));
  }
  range.setStart(element.firstChild!, offset);
  range.collapse(true);
  selectionService.setSelectionRange(range);
  return selectionService.getCurrentSelection();
}

function safelySetInnerHTML(element: HTMLElement, html: string): void {
  element.innerHTML = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
}

describe('ListService', () => {
  let root: HTMLDivElement;
  let listService: ListService;
  let selectionService: MockSelectionService;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    selectionService = new MockSelectionService();
    listService = new ListService(root, selectionService);
  });

  afterEach(() => {
    document.body.removeChild(root);
  });

  describe('toggleList', () => {
    test('converts paragraph to unordered list', () => {
      safelySetInnerHTML(root, '<p>Test paragraph</p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph(paragraph, 4, selectionService);

      listService.toggleList('ul');

      expect(root.querySelector('ul')).toBeTruthy();
      expect(root.querySelector('li')).toBeTruthy();
      expect(root.querySelector('li')!.textContent).toBe('Test paragraph');
    });

    test('converts paragraph to ordered list', () => {
      safelySetInnerHTML(root, '<p>Test paragraph</p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph(paragraph, 4, selectionService);

      listService.toggleList('ol');

      expect(root.querySelector('ol')).toBeTruthy();
      expect(root.querySelector('li')).toBeTruthy();
      expect(root.querySelector('li')!.textContent).toBe('Test paragraph');
    });

    test('unwraps list item back to paragraph', () => {
      safelySetInnerHTML(root, '<ul><li>List item</li></ul>');
      const listItem = root.querySelector('li')!;
      setCursorInElement(listItem, 4, selectionService);

      listService.toggleList('ul');

      expect(root.querySelector('ul')).toBeFalsy();
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelector('p')!.textContent).toBe('List item');
    });

    test('creates empty list when cursor is in empty paragraph', () => {
      safelySetInnerHTML(root, '<p></p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph(paragraph, 0, selectionService);

      listService.toggleList('ul');

      expect(root.querySelector('ul')).toBeTruthy();
      expect(root.querySelector('li')).toBeTruthy();
      expect(root.querySelector('p')).toBeFalsy();
    });

    test('does nothing when cursor is not in editor range', () => {
      // Position cursor outside the container
      const outsideElement = document.createElement('div');
      document.body.appendChild(outsideElement);
      setCursorInElement(outsideElement, 0, selectionService);

      const originalHTML = root.innerHTML;
      listService.toggleList('ul');

      expect(root.innerHTML).toBe(originalHTML);

      document.body.removeChild(outsideElement);
    });

    test('toggleList handles nested lists correctly', () => {
      safelySetInnerHTML(root, '<ul><li>Item 1<ul><li>Nested item</li></ul></li></ul>');
      const nestedItem = root.querySelector('ul ul li')!;
      setCursorInElement(nestedItem, 3, selectionService);

      listService.toggleList('ul');

      // Should unwrap the nested list item to a paragraph
      expect(root.querySelectorAll('li').length).toBe(1);
      expect(root.querySelectorAll('p').length).toBe(1);
      expect(root.querySelector('p')!.textContent).toBe('Nested item');
    });

    test('toggleList returns false when no selection exists', () => {
      // Mock no selection
      selectionService.getCurrentSelection = vi.fn().mockReturnValue(null);
      const isEditorInRangeSpy = vi.spyOn(editorUtilities, 'isEditorInRange').mockReturnValue(true);
      const findClosestAncestorSpy = vi.spyOn(editorUtilities, 'findClosestAncestor');

      listService.toggleList('ol');

      expect(isEditorInRangeSpy).toHaveBeenCalled();
      expect(isEditorInRangeSpy).toHaveReturnedWith(true);
      expect(findClosestAncestorSpy).not.toHaveBeenCalled();
      vi.resetAllMocks();
    });

    test('toggleList creates different list types', () => {
      safelySetInnerHTML(root, '<p>Test paragraph</p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph(paragraph, 4, selectionService);

      // First create an unordered list
      listService.toggleList('ul');
      expect(root.querySelector('ul')).toBeTruthy();
      expect(root.querySelector('ol')).toBeFalsy();

      // Then convert it to an ordered list
      const listItem = root.querySelector('li')!;
      setCursorInElement(listItem, 4, selectionService);
      listService.toggleList('ol');

      expect(root.querySelector('ul')).toBeFalsy();
      expect(root.querySelector('ol')).toBeTruthy();
    });

    test('toggleList handles empty paragraphs correctly', () => {
      safelySetInnerHTML(root, '<p></p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph(paragraph, 0, selectionService);

      listService.toggleList('ul');

      expect(root.querySelector('ul')).toBeTruthy();
      expect(root.querySelector('li')).toBeTruthy();
    });
  });

  describe('handleDentures', () => {
    const createDentureEvent = (shiftKey: boolean): React.KeyboardEvent<HTMLDivElement> =>
      ({
        key: 'Tab',
        shiftKey,
        preventDefault: vi.fn(),
      }) as unknown as React.KeyboardEvent<HTMLDivElement>;

    afterEach(() => {
      vi.resetAllMocks();
    });

    test('returns false for non-Tab keys', () => {
      const event = {
        key: 'Enter',
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      const result = listService.handleDentures(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when no selection exists', () => {
      // Mock no selection
      selectionService.getCurrentSelection = vi.fn().mockReturnValue(null);

      const event = createDentureEvent(false);
      const result = listService.handleDentures(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when selection has no ranges', () => {
      // Mock selection with no ranges
      selectionService.getCurrentSelection = vi.fn().mockReturnValue({
        rangeCount: 0,
      } as Selection);

      const event = createDentureEvent(false);
      const result = listService.handleDentures(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when not in a list item', () => {
      safelySetInnerHTML(root, '<p>Not in a list</p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph(paragraph, 0, selectionService);

      const event = createDentureEvent(false);
      const result = listService.handleDentures(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('handles Tab for indentation in list item', () => {
      safelySetInnerHTML(root, '<ul><li>Item 1</li><li>Item 2</li></ul>');
      const listItem = root.querySelectorAll('li')[1] as HTMLElement;
      setCursorInElement(listItem, 0, selectionService);

      const event = createDentureEvent(false);
      const result = listService.handleDentures(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();

      // Check that the list item was indented
      const nestedList = root.querySelector('li ul');
      expect(nestedList).toBeTruthy();
      expect(nestedList!.querySelector('li')!.textContent).toBe('Item 2');
    });

    test('handles Shift+Tab for outdentation in list item', () => {
      safelySetInnerHTML(root, '<ul><li>Item 1<ul><li>Nested item</li></ul></li></ul>');
      const nestedItem = root.querySelector('ul ul li')! as HTMLElement;
      setCursorInElement(nestedItem, 0, selectionService);

      const outdentEvent = createDentureEvent(true);
      const result = listService.handleDentures(outdentEvent);

      expect(result).toBe(true);
      expect(outdentEvent.preventDefault).toHaveBeenCalled();

      // Check that the list item was outdented
      const listItems = root.querySelectorAll('li');
      expect(listItems.length).toBe(2);
      expect(listItems[0].textContent).toBe('Item 1');
      expect(listItems[1].textContent).toBe('Nested item');
    });

    test('handles Shift+Tab for outdentation in list item and all sibbling list items after it become its children', () => {
      safelySetInnerHTML(
        root,
        '<ul><li>Item 1<ul><li>item 2</li><li>item 3</li><li>item 4</li><li>item 5</li></ul></li></ul>',
      );
      const nestedItem = root.querySelector('ul ul li:nth-child(1)')! as HTMLElement;
      setCursorInElement(nestedItem, 0, selectionService);

      const outdentEvent = createDentureEvent(true);
      const result = listService.handleDentures(outdentEvent);

      expect(result).toBe(true);
      expect(outdentEvent.preventDefault).toHaveBeenCalled();

      // Check that the list item was outdented
      expect(root.innerHTML).toEqual(
        '<ul><li>Item 1<ul></ul></li><li>item 2<ul><li>item 3</li><li>item 4</li><li>item 5</li></ul></li></ul>',
      );
    });

    test('returns early from outdentation if rangeCount is 0', () => {
      safelySetInnerHTML(root, '<ul><li>Item 1</li></ul>');
      const item = root.querySelector('ul li')! as HTMLElement;
      setCursorInElement(item, 0, selectionService);

      const fakeSelection = {
        rangeCount: 0,
        getRangeAt: vi.fn(),
      };
      const getSelectionSpy = vi
        .spyOn(selectionService, 'getCurrentSelection')
        .mockReturnValue(fakeSelection as unknown as Selection);

      listService.outdentListItem();

      expect(getSelectionSpy).toHaveBeenCalled();
      expect(fakeSelection.getRangeAt).not.toHaveBeenCalled();
    });

    test('returns early from outdentation if there is no target list element', () => {
      safelySetInnerHTML(root, '<div><p>Item 1</p></div>');
      const item = root.querySelector('div p')! as HTMLElement;
      setCursorInElement(item, 0, selectionService);

      const fakeRange = { startContainer: document.createElement('div') };
      const fakeSelection = {
        rangeCount: 1,
        getRangeAt: vi.fn(() => fakeRange),
      };
      const getSelectionSpy = vi
        .spyOn(selectionService, 'getCurrentSelection')
        .mockReturnValue(fakeSelection as unknown as Selection);
      const arrayFromSpy = vi.spyOn(Array, 'from');

      listService.outdentListItem();

      expect(getSelectionSpy).toHaveBeenCalled();
      expect(fakeSelection.getRangeAt).toHaveBeenCalledWith(0);
      expect(arrayFromSpy).not.toHaveBeenCalled();
    });

    test('returns early from outdentation if list item parent is the outermost list', () => {
      safelySetInnerHTML(root, '<ul><li>Item 1</li></ul>');
      const item = root.querySelector('ul li')! as HTMLElement;
      setCursorInElement(item, 0, selectionService);

      const arrayFromSpy = vi.spyOn(Array, 'from');
      const containsSpy = vi.spyOn(HTMLElement.prototype, 'contains');

      listService.outdentListItem();

      expect(arrayFromSpy).toHaveBeenCalled();
      expect(containsSpy).not.toHaveBeenCalled();
    });

    test('returns early from outdentation if list item parent is not a list', () => {
      safelySetInnerHTML(root, '<div><li>Item 1</li></div>');
      const item = root.querySelector('div li')! as HTMLElement;
      setCursorInElement(item, 0, selectionService);

      const arrayFromSpy = vi.spyOn(Array, 'from');
      const containsSpy = vi.spyOn(HTMLElement.prototype, 'contains');

      listService.outdentListItem();

      expect(arrayFromSpy).toHaveBeenCalled();
      expect(containsSpy).not.toHaveBeenCalled();
    });

    test('returns early from outdentation if root element does not contain list', () => {
      safelySetInnerHTML(root, '<li><ul><li>Item 1</li></ul></li>');
      const item = root.querySelector('li ul li')! as HTMLElement;
      setCursorInElement(item, 0, selectionService);

      const arrayFromSpy = vi.spyOn(Array, 'from');
      const arrayIncludesSpy = vi.spyOn(Array.prototype, 'includes').mockReturnValue(true);
      const containsSpy = vi.spyOn(HTMLElement.prototype, 'contains').mockReturnValue(false);
      const insertBeforeSpy = vi.spyOn(HTMLElement.prototype, 'insertBefore');

      listService.outdentListItem();

      expect(arrayFromSpy).toHaveBeenCalled();
      expect(arrayIncludesSpy).toHaveBeenCalled();
      expect(arrayIncludesSpy).toHaveReturnedWith(true);
      expect(containsSpy).toHaveReturnedWith(false);
      expect(insertBeforeSpy).not.toHaveBeenCalled();
    });
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
      const result = listService.handleEnterKey(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when no selection exists', () => {
      selectionService.getCurrentSelection = vi.fn().mockReturnValue(null);

      const event = createEnterEvent();
      const result = listService.handleEnterKey(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('creates new paragraph on Enter in regular paragraph', () => {
      safelySetInnerHTML(root, '<p>Some text</p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph(paragraph, 4, selectionService);

      const event = createEnterEvent();
      const result = listService.handleEnterKey(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(root.querySelectorAll('p')).toHaveLength(2);
    });

    test('exits empty list item and creates paragraph', () => {
      safelySetInnerHTML(root, '<ul><li>Item 1</li><li></li></ul>');
      const emptyListItem = root.querySelectorAll('li')[1];
      setCursorInElement(emptyListItem, 0, selectionService);

      const event = createEnterEvent();
      const result = listService.handleEnterKey(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelectorAll('li')).toHaveLength(1);
    });

    test('handles enter in non-empty list item normally', () => {
      safelySetInnerHTML(root, '<ul><li>Non-empty item</li></ul>');
      const listItem = root.querySelector('li')!;
      setCursorInElement(listItem, 5, selectionService);

      const event = createEnterEvent();
      const result = listService.handleEnterKey(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
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
      const result = listService.handleDeleteKeyOnList(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when not at start of list item', () => {
      safelySetInnerHTML(root, '<ul><li>Item content</li></ul>');
      const listItem = root.querySelector('li')!;
      setCursorInElement(listItem, 4, selectionService); // Not at start

      const event = createBackspaceEvent();
      const result = listService.handleDeleteKeyOnList(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when not in a list', () => {
      safelySetInnerHTML(root, '<p>Not in a list</p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph(paragraph, 0, selectionService);

      const event = createBackspaceEvent();
      const result = listService.handleDeleteKeyOnList(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when not the last item in the list', () => {
      safelySetInnerHTML(root, '<ul><li>First item</li><li>Second item</li></ul>');
      const firstItem = root.querySelectorAll('li')[0];
      setCursorInElement(firstItem, 0, selectionService);

      const event = createBackspaceEvent();
      const result = listService.handleDeleteKeyOnList(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when list item has nested lists', () => {
      safelySetInnerHTML(
        root,
        '<ul><li>Item with nested list<ul><li>Nested item</li></ul></li></ul>',
      );
      const listItem = root.querySelector('li')!;
      setCursorInElement(listItem, 0, selectionService);

      const event = createBackspaceEvent();
      const result = listService.handleDeleteKeyOnList(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('removes empty list item when backspace is pressed at start', () => {
      // Use a list item with a BR element, which is a common way to represent an empty list item
      safelySetInnerHTML(root, '<ul><li>First item</li><li><br></li></ul>');
      const emptyItem = root.querySelectorAll('li')[1];

      // Set the cursor at the start of the list item (before the BR element)
      const range = selectionService.createRange();
      range.setStart(emptyItem, 0);
      range.collapse(true);
      selectionService.setSelectionRange(range);

      const event = createBackspaceEvent();
      const result = listService.handleDeleteKeyOnList(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(root.querySelectorAll('li').length).toBe(1);
    });

    test('converts list item to paragraph when backspace is pressed at start of last item', () => {
      safelySetInnerHTML(root, '<ul><li>First item</li><li>Last item</li></ul>');
      const lastItem = root.querySelectorAll('li')[1];
      setCursorInElement(lastItem, 0, selectionService);

      const event = createBackspaceEvent();
      const result = listService.handleDeleteKeyOnList(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(root.querySelectorAll('li').length).toBe(1);
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelector('p')!.textContent).toBe('Last item');
    });

    test('works with Delete key as well as Backspace', () => {
      safelySetInnerHTML(root, '<ul><li>First item</li><li>Last item</li></ul>');
      const lastItem = root.querySelectorAll('li')[1];
      setCursorInElement(lastItem, 0, selectionService);

      const event = createDeleteEvent();
      const result = listService.handleDeleteKeyOnList(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  describe('unwrapListItem with nested lists', () => {
    test('handles list items with nested lists', () => {
      // Create a list with a nested list
      safelySetInnerHTML(root, '<ul><li>Parent item<ul><li>Nested item</li></ul></li></ul>');

      // Get the parent list item
      const parentLi = root.querySelector('li')!;
      const parentList = root.querySelector('ul')!;

      // Set cursor in the parent list item
      setCursorInElement(parentLi, 0, selectionService);

      // Get the selection
      const selection = selectionService.getCurrentSelection();

      // Call unwrapListItem directly
      listService.unwrapListItem(parentLi, parentList, selection);

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
      safelySetInnerHTML(
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
      const selection = selectionService.getCurrentSelection();

      // Call unwrapListItem directly
      listService.unwrapListItem(
        level2Item as HTMLLIElement,
        level2List as HTMLUListElement,
        selection,
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
      safelySetInnerHTML(
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
      const selection = selectionService.getCurrentSelection();

      // Call unwrapListItem directly
      listService.unwrapListItem(parentLi, parentList, selection);

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
      safelySetInnerHTML(root, '<ul><li><span>Text in span</span></li></ul>');

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

      // Get the selection
      const selection = selectionService.getCurrentSelection();

      // Call unwrapListItem directly
      listService.unwrapListItem(listItem, list, selection);

      // Restore the original method
      selectionService.createRange = originalCreateRange;

      // Verify the list item is now a paragraph with the span
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelector('p span')).toBeTruthy();
      expect(root.querySelector('p')!.textContent).toBe('Text in span');
    });

    test('handles list items with empty text content', () => {
      // Create a list with an empty list item
      safelySetInnerHTML(root, '<ul><li></li></ul>');

      // Get the list item
      const listItem = root.querySelector('li')!;
      const list = root.querySelector('ul')!;

      // Set cursor in the list item
      setCursorInElement(listItem, 0, selectionService);

      // Get the selection
      const selection = selectionService.getCurrentSelection();

      // Call unwrapListItem directly
      listService.unwrapListItem(listItem, list, selection);

      // Verify the list item is now a paragraph with zero-width space
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelector('p')!.textContent).toBe(ZERO_WIDTH_SPACE);
    });

    test('handles non-text node as first child in paragraph', () => {
      // Create a list with a list item containing a span
      safelySetInnerHTML(root, '<ul><li><span>Text in span</span></li></ul>');

      // Get the list item
      const listItem = root.querySelector('li')!;
      const list = root.querySelector('ul')!;

      // Set cursor in the list item
      const span = root.querySelector('span')!;
      const range = selectionService.createRange();
      range.setStart(span.firstChild!, 0);
      range.collapse(true);
      selectionService.setSelectionRange(range);

      // Get the selection
      const selection = selectionService.getCurrentSelection();

      // Call unwrapListItem directly
      listService.unwrapListItem(listItem, list, selection);

      // Verify the list item is now a paragraph with the span
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelector('p span')).toBeTruthy();
      expect(root.querySelector('p')!.textContent).toBe('Text in span');
    });

    test('handles root list not in editor root', () => {
      // Create a separate root not in the editor
      const outsideroot = document.createElement('div');
      document.body.appendChild(outsideroot);
      safelySetInnerHTML(outsideroot, '<ul><li>Outside item</li></ul>');

      try {
        // Get the list item and list
        const listItem = outsideroot.querySelector('li')!;
        const list = outsideroot.querySelector('ul')!;

        // Set cursor in the list item
        setCursorInElement(listItem, 0, selectionService);

        // Get the selection
        const selection = selectionService.getCurrentSelection();

        // Call unwrapListItem directly
        listService.unwrapListItem(listItem, list, selection);

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
      safelySetInnerHTML(root, '<ul><li>Item</li></ul>');

      // Get the list item and list
      const listItem = root.querySelector('li')!;
      const list = root.querySelector('ul')!;

      // Create a mock list item that's not in the DOM
      const mockLi = document.createElement('li');
      mockLi.textContent = 'Mock item';

      // Set cursor in the real list item
      setCursorInElement(listItem, 0, selectionService);

      // Get the selection
      const selection = selectionService.getCurrentSelection();

      // Call unwrapListItem with the mock list item
      listService.unwrapListItem(mockLi, list, selection);

      // Verify the fallback case was used
      expect(root.querySelector('p')).toBeTruthy();
      // The paragraph should contain the content of the mock list item
      expect(root.querySelector('p')!.textContent).toBe('Mock item');
      expect(root.querySelector('ul')).toBeTruthy();
    });

    test('handles non-text node firstChild in unwrapListItem', () => {
      // Create a list with a list item containing a span
      safelySetInnerHTML(root, '<ul><li><span>Text in span</span></li></ul>');

      // Get the list item
      const listItem = root.querySelector('li')!;
      const list = root.querySelector('ul')!;

      // Set cursor in the list item
      const span = root.querySelector('span')!;
      const range = selectionService.createRange();
      range.setStart(span, 0); // Set cursor at the span element itself, not its text content
      range.collapse(true);
      selectionService.setSelectionRange(range);

      // Get the selection
      const selection = selectionService.getCurrentSelection();

      // Call unwrapListItem directly
      listService.unwrapListItem(listItem, list, selection);

      // Verify the list item is now a paragraph with the span
      expect(root.querySelector('p')).toBeTruthy();
      expect(root.querySelector('p span')).toBeTruthy();
      expect(root.querySelector('p')!.textContent).toBe('Text in span');
    });

    test('handles non-text node firstChild in paragraph with complex structure', () => {
      // Create a list with a list item containing a complex structure
      safelySetInnerHTML(root, '<ul><li><div><span>Text in span</span></div></li></ul>');

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

      // Get the selection
      const selection = selectionService.getCurrentSelection();

      // Call unwrapListItem directly
      listService.unwrapListItem(listItem, list, selection);

      // Restore the original method
      selectionService.createRange = originalCreateRange;

      // Verify the list item is now a paragraph with the text content preserved
      expect(root.querySelector('p')).toBeTruthy();
      // The structure might not be preserved exactly as in the original list item
      expect(root.querySelector('p')!.textContent).toBe('Text in span');
    });
  });

  describe('Branch Coverage Tests for Uncovered Lines', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('insertList returns early when range.startroot is not within root (lines 799-800)', () => {
      // Create a selection outside the root
      const outsideElement = document.createElement('div');
      document.body.appendChild(outsideElement);
      outsideElement.textContent = 'Outside content';

      const range = selectionService.createRange();
      range.setStart(outsideElement.firstChild!, 0);
      range.collapse(true);
      selectionService.setSelectionRange(range);

      // Call insertList - should return early
      listService.insertList('ul');

      // The mock root should remain empty since the method returned early
      expect(root.innerHTML).toBe('');

      // Restore original root
      document.body.removeChild(outsideElement);
    });

    test('insertList else branch when not in paragraph or cursor not at paragraph level (lines 804-805)', () => {
      safelySetInnerHTML(root, '<div><span>Text in span</span></div>');

      const span = root.querySelector('span')!;
      const range = selectionService.createRange();
      range.setStart(span.firstChild!, 2);
      range.collapse(true);
      selectionService.setSelectionRange(range);

      listService.insertList('ul');

      // Should insert list at cursor position since we're not in a paragraph
      expect(root.querySelector('ul')).toBeTruthy();
      expect(root.querySelector('li')).toBeTruthy();
    });

    describe('convertParagraphToList method - uncovered branches', () => {
      test('convertParagraphToList returns early when selection is null (lines 833-835)', () => {
        safelySetInnerHTML(root, '<p>Test content</p>');
        const paragraph = root.querySelector('p')!;

        // Mock the getCurrentSelection method using vi.spyOn
        const spy = vi
          .spyOn(selectionService, 'getCurrentSelection')
          .mockImplementation(() => null as unknown as Selection);

        const range = selectionService.createRange();
        range.setStart(paragraph.firstChild!, 0);

        listService.convertParagraphToList(paragraph, 'ul', range);

        // Should remain unchanged since method returned early
        expect(root.innerHTML).toBe('<p>Test content</p>');

        // Verify the mock was called
        expect(spy).toHaveBeenCalled();
      });

      test('convertParagraphToList handles empty list item content (lines 854-855)', () => {
        safelySetInnerHTML(root, '<p></p>'); // Empty paragraph
        const paragraph = root.querySelector('p')!;

        const range = selectionService.createRange();
        range.setStart(paragraph, 0);
        range.collapse(true);
        selectionService.setSelectionRange(range);

        listService.convertParagraphToList(paragraph, 'ul', range);

        // Should have created a list with a zero-width space
        const listItem = root.querySelector('li')!;
        expect(listItem.textContent).toBe('\u200B'); // Zero-width space
      });
    });

    describe('getCursorOffsetInParagraph and setCursorInListItem - uncovered branches', () => {
      test('setCursorInListItem returns early when selection is null (lines 894)', () => {
        safelySetInnerHTML(root, '<ul><li>Test content</li></ul>');
        const listItem = root.querySelector('li')!;

        // Mock selectionService to return null
        const originalGetCurrentSelection = selectionService.getCurrentSelection;
        selectionService.getCurrentSelection = () => null as unknown as Selection;

        listService.setCursorInListItem(listItem, 5);

        // Should not throw and method should return early
        expect(true).toBe(true); // Test passes if no error thrown

        // Restore original method
        selectionService.getCurrentSelection = originalGetCurrentSelection;
      });

      test('setCursorInListItem fallback positioning (lines 900-901)', () => {
        safelySetInnerHTML(root, '<ul><li><strong>Bold text</strong></li></ul>');
        const listItem = root.querySelector('li')!;

        // Set a very high target offset to trigger fallback
        listService.setCursorInListItem(listItem, 999);

        // Should position cursor at end without error
        const selection = selectionService.getCurrentSelection();
        expect(selection).toBeTruthy();
      });
    });

    describe('unwrapListItem method - uncovered branches', () => {
      test('unwrapListItem fallback when splitIndex is -1 (line 1254)', () => {
        // Create a complex list structure where the target item can't be found
        safelySetInnerHTML(root, '<ul><li>Item 1</li><li>Item 2</li></ul>');
        const list = root.querySelector('ul')!;

        // Create a detached list item that's not actually in the list
        const detachedLi = document.createElement('li');
        detachedLi.textContent = 'Detached item';

        const selection = selectionService.getCurrentSelection();
        const range = selectionService.createRange();
        range.setStart(detachedLi.firstChild!, 0);
        range.collapse(true);
        selection.addRange(range);

        listService.unwrapListItem(detachedLi, list, selection);

        // Should handle the fallback case gracefully
        expect(root.querySelector('p')).toBeTruthy();
      });

      test('unwrapListItem with list not in root returns early', () => {
        // Create a detached list
        const detachedList = document.createElement('ul');
        safelySetInnerHTML(detachedList, '<li>Detached item</li>');
        const detachedLi = detachedList.querySelector('li')!;

        // Set up a valid range in the selection for the detached list item
        const range = selectionService.createRange();
        range.setStart(detachedLi.firstChild!, 0);
        range.collapse(true);
        selectionService.setSelectionRange(range);

        const selection = selectionService.getCurrentSelection();

        listService.unwrapListItem(detachedLi, detachedList, selection);

        // Should return early and not modify root
        expect(root.innerHTML).toBe(''); // Should remain empty since root starts empty
      });
    });

    describe('Additional edge cases for complete coverage', () => {
      test('insertList with empty paragraph and no content', () => {
        safelySetInnerHTML(root, '<p></p>');
        const paragraph = root.querySelector('p')!;

        const range = selectionService.createRange();
        range.setStart(paragraph, 0);
        range.collapse(true);
        selectionService.setSelectionRange(range);

        listService.insertList('ol');

        // Should create ordered list
        expect(root.querySelector('ol')).toBeTruthy();
        expect(root.querySelector('li')).toBeTruthy();
      });

      test('convertParagraphToList with paragraph containing only elements', () => {
        safelySetInnerHTML(root, '<p><br></p>');
        const paragraph = root.querySelector('p')!;

        const range = selectionService.createRange();
        range.setStart(paragraph, 0);
        range.collapse(true);
        selectionService.setSelectionRange(range);

        listService.convertParagraphToList(paragraph, 'ul', range);

        // Should convert paragraph with BR to list
        expect(root.querySelector('ul')).toBeTruthy();
        expect(root.querySelector('li')).toBeTruthy();
        expect(root.querySelector('li br')).toBeTruthy();
      });

      test('setCursorInListItem with complex nested content', () => {
        safelySetInnerHTML(
          root,
          '<ul><li><em>Italic</em> and <strong>bold</strong> text</li></ul>',
        );
        const listItem = root.querySelector('li')!;

        // Test positioning in middle of complex content
        listService.setCursorInListItem(listItem, 10);

        const selection = selectionService.getCurrentSelection();
        expect(selection.rangeCount).toBe(1);
      });
    });
  });
  describe('getAncestorIfLastLeaf - uncovered branch coverage', () => {
    test('returns false when grandparent list item is not the last child', () => {
      // Create a nested list structure where the grandparent list item is NOT the last child
      safelySetInnerHTML(
        root,
        `
        <ul>
          <li>First item
            <ul>
              <li>Nested item</li>
            </ul>
          </li>
          <li>Second item (this makes the first item NOT the last)</li>
        </ul>
      `,
      );

      const nestedList = root.querySelector('ul ul')! as HTMLUListElement;

      // Call getAncestorIfLastLeaf - this should return false because the grandparent
      // list item (first <li>) is not the last child of its parent list
      const result = listService.getAncestorIfLastLeaf(nestedList);

      // Should return false because the first li is not the last child
      expect(result).toBe(false);
    });

    test('recursively calls itself when grandparent list item is the last child', () => {
      // Create a clean nested list structure without whitespace text nodes
      // Use appendChild to avoid whitespace issues
      const topList = document.createElement('ul');
      const topLi = document.createElement('li');
      topLi.textContent = 'Top level item';

      const midList = document.createElement('ul');
      const midLi = document.createElement('li');
      midLi.textContent = 'Second level item';

      const deepList = document.createElement('ul');
      const deepLi = document.createElement('li');
      deepLi.textContent = 'Third level item';

      deepList.appendChild(deepLi);
      midLi.appendChild(deepList);
      midList.appendChild(midLi);
      topLi.appendChild(midList);
      topList.appendChild(topLi);
      root.appendChild(topList);

      // Call getAncestorIfLastLeaf - this should trigger the recursive call
      // because each grandparent list item IS the last child at each level
      const result = listService.getAncestorIfLastLeaf(deepList);

      // The method should recursively check up the chain and eventually return the top list
      // or return false if at some point a condition fails
      expect(typeof result).toBe('object'); // Should return an element or false
      expect(result).not.toBe(false); // Should not return false for this valid structure
    });

    test('returns parentList when no grandparent list item is found', () => {
      // Create a top-level list (not nested in any list item)
      const topList = document.createElement('ul');
      const listItem = document.createElement('li');
      listItem.textContent = 'Top level item';
      topList.appendChild(listItem);
      root.appendChild(topList);

      // Call getAncestorIfLastLeaf on the top-level list
      // This should return the parentList itself because there's no grandparent list item
      const result = listService.getAncestorIfLastLeaf(topList);

      // Should return the parentList when no grandparent list item exists (lines 593-594)
      expect(result).toBe(topList);
    });

    test('returns parentList when grandparent list item exists but no grandparent list', () => {
      // Create a structure where we have a list item containing a list,
      // but that list item is not inside another list
      const rootDiv = document.createElement('div');
      const listItem = document.createElement('li');
      const nestedList = document.createElement('ul');
      const nestedLi = document.createElement('li');

      nestedLi.textContent = 'Nested item';
      nestedList.appendChild(nestedLi);
      listItem.appendChild(nestedList);
      rootDiv.appendChild(listItem);
      root.appendChild(rootDiv);

      // Call getAncestorIfLastLeaf on the nested list
      // This should find the grandparent list item but no grandparent list
      const result = listService.getAncestorIfLastLeaf(nestedList);

      // Should return the parentList when grandparent list item exists but no grandparent list
      expect(result).toBe(nestedList);
    });
  });

  test('indentListItem creates new nested list when previous item has no nested list', () => {
    // Create a list with two items where the first has no nested list
    safelySetInnerHTML(root, '<ul><li>First item</li><li>Second item</li></ul>');

    const secondLi = root.querySelectorAll('li')[1];
    const range = selectionService.createRange();
    range.setStart(secondLi.firstChild!, 0);
    range.collapse(true);
    selectionService.setSelectionRange(range);

    // Call indentListItem - this should trigger lines 752-753
    // where it creates a new nested list when none exists
    listService.indentListItem();

    // Should have created a nested list in the first item
    const firstLi = root.querySelectorAll('li')[0];
    expect(firstLi.querySelector('ul')).toBeTruthy();

    // The second item should now be nested under the first
    expect(firstLi.querySelector('ul li')).toBeTruthy();
    expect(firstLi.querySelector('ul li')!.textContent).toBe('Second item');
  });

  test('indentListItem returns early when no list item found', () => {
    // Create a paragraph (not in a list)
    safelySetInnerHTML(root, '<p>Not in a list item</p>');

    const paragraph = root.querySelector('p')!;
    const range = selectionService.createRange();
    range.setStart(paragraph.firstChild!, 0);
    range.collapse(true);
    selectionService.setSelectionRange(range);

    // Call indentListItem - should return early because cursor is not in a list item (line 759-760)
    listService.indentListItem();

    // HTML should remain unchanged
    expect(root.innerHTML).toBe('<p>Not in a list item</p>');
  });

  test('indentListItem returns early when list item has no parent list', () => {
    // Clear the initial empty paragraph that Editor creates
    safelySetInnerHTML(root, '');

    // Create an orphaned list item (not inside a list)
    const listItem = document.createElement('li');
    listItem.textContent = 'Orphaned item';
    root.appendChild(listItem);

    const range = selectionService.createRange();
    range.setStart(listItem.firstChild!, 0);
    range.collapse(true);
    selectionService.setSelectionRange(range);

    // Call indentListItem - should return early because li has no parentElement (lines 764-765)
    listService.indentListItem();

    // HTML should remain unchanged
    expect(root.innerHTML).toBe('<li>Orphaned item</li>');
  });

  test('indentListItem returns early when no previous list item exists', () => {
    // Create a list with only one item (no previous sibling)
    safelySetInnerHTML(root, '<ul><li>Only item</li></ul>');

    const listItem = root.querySelector('li')!;
    const range = selectionService.createRange();
    range.setStart(listItem.firstChild!, 0);
    range.collapse(true);
    selectionService.setSelectionRange(range);

    // Call indentListItem - should return early because no previous LI exists (lines 769-770)
    listService.indentListItem();

    // HTML should remain unchanged - no indentation should occur
    expect(root.innerHTML).toBe('<ul><li>Only item</li></ul>');
  });
});
