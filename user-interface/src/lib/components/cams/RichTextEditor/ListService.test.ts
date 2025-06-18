import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { ListService } from './ListService';
import { MockSelectionService } from './SelectionService.humble';
import { DOMPURIFY_CONFIG } from '@/lib/components/cams/RichTextEditor/editor.constants';
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
    const createEvent = (shiftKey: boolean): React.KeyboardEvent<HTMLDivElement> =>
      ({
        key: 'Tab',
        shiftKey,
        preventDefault: vi.fn(),
      }) as unknown as React.KeyboardEvent<HTMLDivElement>;

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

      const event = createEvent(false);
      const result = listService.handleDentures(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when selection has no ranges', () => {
      // Mock selection with no ranges
      selectionService.getCurrentSelection = vi.fn().mockReturnValue({
        rangeCount: 0,
      } as Selection);

      const event = createEvent(false);
      const result = listService.handleDentures(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when not in a list item', () => {
      safelySetInnerHTML(root, '<p>Not in a list</p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph(paragraph, 0, selectionService);

      const event = createEvent(false);
      const result = listService.handleDentures(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('handles Tab for indentation in list item', () => {
      safelySetInnerHTML(root, '<ul><li>Item 1</li><li>Item 2</li></ul>');
      const listItem = root.querySelectorAll('li')[1] as HTMLElement;
      setCursorInElement(listItem, 0, selectionService);

      const event = createEvent(false);
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

      const event = createEvent(true);
      const result = listService.handleDentures(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();

      // Check that the list item was outdented
      const listItems = root.querySelectorAll('li');
      expect(listItems.length).toBe(2);
      expect(listItems[0].textContent).toBe('Item 1');
      expect(listItems[1].textContent).toBe('Nested item');
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
});
