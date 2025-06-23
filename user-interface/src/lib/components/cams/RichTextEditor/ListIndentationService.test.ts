import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { ListIndentationService } from './ListIndentationService';
import { ListUtilities } from './ListUtilities';
import { MockSelectionService } from './SelectionService.humble';
import { safelySetHtml } from './utilities';
import { setCursorInElement } from './test-utils';

describe('ListIndentationService', () => {
  let root: HTMLDivElement;
  let listIndentationService: ListIndentationService;
  let listUtilities: ListUtilities;
  let selectionService: MockSelectionService;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    selectionService = new MockSelectionService();
    listUtilities = new ListUtilities(root, selectionService);
    listIndentationService = new ListIndentationService(root, selectionService, listUtilities);
  });

  afterEach(() => {
    document.body.removeChild(root);
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

      const result = listIndentationService.handleDentures(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when no selection exists', () => {
      // Mock no selection
      selectionService.getCurrentSelection = vi.fn().mockReturnValue(null);

      const event = createDentureEvent(false);
      const result = listIndentationService.handleDentures(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when selection has no ranges', () => {
      // Mock selection with no ranges
      selectionService.getRangeAtStartOfSelection = vi.fn().mockReturnValue(undefined);

      const event = createDentureEvent(false);
      const result = listIndentationService.handleDentures(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when not in a list item', () => {
      safelySetHtml(root, '<p>Not in a list</p>');
      const paragraph = root.querySelector('p')!;
      setCursorInElement(paragraph, 0, selectionService);

      const event = createDentureEvent(false);
      const result = listIndentationService.handleDentures(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('handles Tab for indentation in list item', () => {
      safelySetHtml(root, '<ul><li>Item 1</li><li>Item 2</li></ul>');
      const listItem = root.querySelectorAll('li')[1] as HTMLElement;
      setCursorInElement(listItem, 0, selectionService);

      const event = createDentureEvent(false);
      const result = listIndentationService.handleDentures(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();

      // Check that the list item was indented
      const nestedList = root.querySelector('li ul');
      expect(nestedList).toBeTruthy();
      expect(nestedList!.querySelector('li')!.textContent).toBe('Item 2');
    });

    test('handles Shift+Tab for outdentation in list item', () => {
      safelySetHtml(root, '<ul><li>Item 1<ul><li>Nested item</li></ul></li></ul>');
      const nestedItem = root.querySelector('ul ul li')! as HTMLElement;
      setCursorInElement(nestedItem, 0, selectionService);

      const outdentEvent = createDentureEvent(true);
      const result = listIndentationService.handleDentures(outdentEvent);

      expect(result).toBe(true);
      expect(outdentEvent.preventDefault).toHaveBeenCalled();

      // Check that the list item was outdented
      const listItems = root.querySelectorAll('li');
      expect(listItems.length).toBe(2);
      expect(listItems[0].textContent).toBe('Item 1');
      expect(listItems[1].textContent).toBe('Nested item');
    });

    test('handles Shift+Tab for outdentation in list item and all sibbling list items after it become its children', () => {
      safelySetHtml(
        root,
        '<ul><li>Item 1<ul><li>item 2</li><li>item 3</li><li>item 4</li><li>item 5</li></ul></li></ul>',
      );
      const nestedItem = root.querySelector('ul ul li:nth-child(1)')! as HTMLElement;
      setCursorInElement(nestedItem, 0, selectionService);

      const outdentEvent = createDentureEvent(true);
      const result = listIndentationService.handleDentures(outdentEvent);

      expect(result).toBe(true);
      expect(outdentEvent.preventDefault).toHaveBeenCalled();

      // Check that the list item was outdented
      expect(root.innerHTML).toEqual(
        '<ul><li>Item 1<ul></ul></li><li>item 2<ul><li>item 3</li><li>item 4</li><li>item 5</li></ul></li></ul>',
      );
    });

    test('returns early from outdentation if there is no target list element', () => {
      safelySetHtml(root, '<div><p>Item 1</p></div>');
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

      // @ts-expect-error private method
      listIndentationService.outdentListItem(selectionService.getRangeAtStartOfSelection());

      expect(getSelectionSpy).toHaveBeenCalled();
      expect(fakeSelection.getRangeAt).toHaveBeenCalledWith(0);
      expect(arrayFromSpy).not.toHaveBeenCalled();
    });

    test('returns early from outdentation if list item parent is the outermost list', () => {
      safelySetHtml(root, '<ul><li>Item 1</li></ul>');
      const item = root.querySelector('ul li')! as HTMLElement;
      setCursorInElement(item, 0, selectionService);

      const arrayFromSpy = vi.spyOn(Array, 'from');
      const containsSpy = vi.spyOn(HTMLElement.prototype, 'contains');

      // @ts-expect-error private method
      listIndentationService.outdentListItem(selectionService.getRangeAtStartOfSelection());

      expect(arrayFromSpy).toHaveBeenCalled();
      expect(containsSpy).not.toHaveBeenCalled();
    });

    test('returns early from outdentation if list item parent is not a list', () => {
      safelySetHtml(root, '<div><li>Item 1</li></div>');
      const item = root.querySelector('div li')! as HTMLElement;
      setCursorInElement(item, 0, selectionService);

      const arrayFromSpy = vi.spyOn(Array, 'from');
      const containsSpy = vi.spyOn(HTMLElement.prototype, 'contains');

      // @ts-expect-error private method
      listIndentationService.outdentListItem(selectionService.getRangeAtStartOfSelection());

      expect(arrayFromSpy).toHaveBeenCalled();
      expect(containsSpy).not.toHaveBeenCalled();
    });

    test('returns early from outdentation if root element does not contain list', () => {
      safelySetHtml(root, '<li><ul><li>Item 1</li></ul></li>');
      const item = root.querySelector('li ul li')! as HTMLElement;
      setCursorInElement(item, 0, selectionService);

      const arrayFromSpy = vi.spyOn(Array, 'from');
      const arrayIncludesSpy = vi.spyOn(Array.prototype, 'includes').mockReturnValue(true);
      const containsSpy = vi.spyOn(HTMLElement.prototype, 'contains').mockReturnValue(false);
      const insertBeforeSpy = vi.spyOn(HTMLElement.prototype, 'insertBefore');

      // @ts-expect-error private method
      listIndentationService.outdentListItem(selectionService.getRangeAtStartOfSelection());

      expect(arrayFromSpy).toHaveBeenCalled();
      expect(arrayIncludesSpy).toHaveBeenCalled();
      expect(arrayIncludesSpy).toHaveReturnedWith(true);
      expect(containsSpy).toHaveReturnedWith(false);
      expect(insertBeforeSpy).not.toHaveBeenCalled();
    });
  });

  describe('indentListItem', () => {
    test('returns early when no list item is found', () => {
      root.innerHTML = '<p>Paragraph</p>';
      const p = root.querySelector('p')!;
      setCursorInElement(p, 0, selectionService);
      // @ts-expect-error private method
      listIndentationService.indentListItem(selectionService.getRangeAtStartOfSelection());
      expect(root.innerHTML).toBe('<p>Paragraph</p>');
    });

    test('returns early when no previous list item exists', () => {
      root.innerHTML = '<ul><li>Only item</li></ul>';
      const li = root.querySelector('li')!;
      setCursorInElement(li, 0, selectionService);
      // @ts-expect-error private method
      listIndentationService.indentListItem(selectionService.getRangeAtStartOfSelection());
      expect(root.innerHTML).toBe('<ul><li>Only item</li></ul>');
    });

    test('should return early when the list item has no parent list', () => {
      // Create a detached li element with no parent
      const li = document.createElement('li');
      li.textContent = 'Detached list item';

      // Create a mock text node that will return the detached li
      const mockTextNode = document.createTextNode('test');

      // Mock the parentElement.closest method to return the detached li
      Object.defineProperty(mockTextNode, 'parentElement', {
        value: {
          closest: vi.fn().mockReturnValue(li),
        },
      });

      // Create a range that will return our mock text node
      const range = selectionService.createRange();
      Object.defineProperty(range, 'startContainer', {
        value: mockTextNode,
      });

      // Mock getCurrentSelection to return a selection with the range
      const mockSelection = {
        rangeCount: 1,
        getRangeAt: vi.fn().mockReturnValue(range),
      } as unknown as Selection;
      vi.spyOn(selectionService, 'getCurrentSelection').mockReturnValue(mockSelection);

      // Store initial DOM state
      const initialHTML = root.innerHTML;

      // Call indentListItem (should return early due to no parent element)
      // @ts-expect-error private method
      listIndentationService.indentListItem(selectionService.getRangeAtStartOfSelection());

      // Verify DOM hasn't changed (method returned early)
      expect(root.innerHTML).toBe(initialHTML);

      // Verify the li element has no parent (parentElement is null)
      expect(li.parentElement).toBeNull();
    });
  });
});
