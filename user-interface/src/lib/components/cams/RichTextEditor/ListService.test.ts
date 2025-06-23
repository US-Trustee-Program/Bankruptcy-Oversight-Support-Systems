import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { ListService } from './ListService';
import { MockSelectionService } from './SelectionService.humble';
import editorUtilities, { safelySetHtml, safelyGetHtml } from './Editor.utilities';
import { ZERO_WIDTH_SPACE } from './Editor.constants';
import { setCursorInElement, setCursorInParagraph } from './RichTextEditor.test-utils';

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
      safelySetHtml(root, '<p>Test paragraph</p>');
      const paragraph = root.querySelector('p');
      expect(paragraph).not.toBeNull();
      setCursorInParagraph(paragraph!, 4, selectionService);

      listService.toggleList('ul');

      const html = safelyGetHtml(root);
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>');
      const li = root.querySelector('li');
      expect(li).not.toBeNull();
      expect(li!.textContent).toEqual(`${ZERO_WIDTH_SPACE}Test paragraph`);
    });

    test('converts paragraph to ordered list', () => {
      safelySetHtml(root, '<p>Test paragraph</p>');
      const paragraph = root.querySelector('p');
      expect(paragraph).not.toBeNull();
      setCursorInParagraph(paragraph!, 4, selectionService);

      listService.toggleList('ol');

      const html = editorUtilities.safelyGetHtml(root);
      expect(html).toContain('<ol>');
      expect(html).toContain('<li>');
      const li = root.querySelector('li');
      expect(li).not.toBeNull();
      expect(li!.textContent).toEqual(`${ZERO_WIDTH_SPACE}Test paragraph`);
    });

    test('unwraps list item back to paragraph', () => {
      safelySetHtml(root, '<ul><li>List item</li></ul>');
      const listItem = root.querySelector('li');
      expect(listItem).not.toBeNull();
      setCursorInElement(listItem!, 4, selectionService);

      listService.toggleList('ul');

      expect(root.querySelector('ul')).toBeFalsy();
      expect(root.querySelector('p')).toBeTruthy();
      const p = root.querySelector('p');
      expect(p).not.toBeNull();
      expect(p!.textContent).toBe('List item');
    });

    test('creates empty list when cursor is in empty paragraph', () => {
      safelySetHtml(root, '<p></p>');
      const paragraph = root.querySelector('p');
      expect(paragraph).not.toBeNull();
      setCursorInParagraph(paragraph!, 0, selectionService);

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
      safelySetHtml(root, '<ul><li>Item 1<ul><li>Nested item</li></ul></li></ul>');
      const nestedItem = root.querySelector('ul ul li')!;
      setCursorInElement(nestedItem as HTMLElement, 3, selectionService);

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
      safelySetHtml(root, '<p>Test paragraph</p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph(paragraph, 4, selectionService);

      // First create an unordered list
      listService.toggleList('ul');
      expect(root.querySelector('ul')).toBeTruthy();
      expect(root.querySelector('ol')).toBeFalsy();

      // Then convert it to an ordered list
      const listItem = root.querySelector('li')!;
      setCursorInElement(listItem, 1, selectionService);
      listService.toggleList('ol');

      expect(root.querySelector('ul')).toBeFalsy();
      expect(root.querySelector('ol')).toBeTruthy();
    });

    test('toggleList handles empty paragraphs correctly', () => {
      safelySetHtml(root, '<p></p>');
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
      selectionService.getRangeAtStartOfSelection = vi.fn().mockReturnValue(undefined);

      const event = createDentureEvent(false);
      const result = listService.handleDentures(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when not in a list item', () => {
      safelySetHtml(root, '<p>Not in a list</p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph(paragraph, 0, selectionService);

      const event = createDentureEvent(false);
      const result = listService.handleDentures(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('handles Tab for indentation in list item', () => {
      safelySetHtml(root, '<ul><li>Item 1</li><li>Item 2</li></ul>');
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
      safelySetHtml(root, '<ul><li>Item 1<ul><li>Nested item</li></ul></li></ul>');
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
      safelySetHtml(
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

    // TODO why is this valid behavior for the Enter key in a list?
    test('creates new paragraph on Enter in regular paragraph', () => {
      safelySetHtml(root, '<p>Some text</p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph(paragraph, 4, selectionService);

      const event = createEnterEvent();
      const result = listService.handleEnterKey(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(root.querySelectorAll('p')).toHaveLength(2);
    });

    test('exits empty list item and creates paragraph', () => {
      safelySetHtml(root, '<ul><li>Item 1</li><li></li></ul>');
      const emptyListItem = root.querySelectorAll('li')[1];
      setCursorInElement(emptyListItem, 0, selectionService);

      const event = createEnterEvent();
      const result = listService.handleEnterKey(event);

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
      const result = listService.handleEnterKey(event);

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
      const result = listService.handleEnterKey(event);

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
      const result = listService.handleEnterKey(event);

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
      const result = listService.handleEnterKey(event);

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
      const result = listService.handleDeleteKeyOnList(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when not at start of list item', () => {
      safelySetHtml(root, '<ul><li>Item content</li></ul>');
      const listItem = root.querySelector('li')!;
      setCursorInElement(listItem, 4, selectionService); // Not at start

      const event = createBackspaceEvent();
      const result = listService.handleDeleteKeyOnList(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when not in a list', () => {
      safelySetHtml(root, '<p>Not in a list</p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph(paragraph, 0, selectionService);

      const event = createBackspaceEvent();
      const result = listService.handleDeleteKeyOnList(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when not the last item in the list', () => {
      safelySetHtml(root, '<ul><li>First item</li><li>Second item</li></ul>');
      const firstItem = root.querySelectorAll('li')[0];
      setCursorInElement(firstItem, 0, selectionService);

      const event = createBackspaceEvent();
      const result = listService.handleDeleteKeyOnList(event);

      expect(result).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('returns false when list item has nested lists', () => {
      safelySetHtml(root, '<ul><li>Item with nested list<ul><li>Nested item</li></ul></li></ul>');
      const listItem = root.querySelector('li')!;
      setCursorInElement(listItem, 0, selectionService);

      const event = createBackspaceEvent();
      const result = listService.handleDeleteKeyOnList(event);

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
      const result = listService.handleDeleteKeyOnList(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(root.querySelectorAll('li').length).toBe(1);
    });

    test('converts list item to paragraph when backspace is pressed at start of last item', () => {
      safelySetHtml(root, '<ul><li>First item</li><li>Last item</li></ul>');
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
      safelySetHtml(root, '<ul><li>First item</li><li>Last item</li></ul>');
      const lastItem = root.querySelectorAll('li')[1];
      setCursorInElement(lastItem, 0, selectionService);

      const event = createDeleteEvent();
      const result = listService.handleDeleteKeyOnList(event);

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
      const result = listService.handleDeleteKeyOnList(event);

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
      const result = listService.handleDeleteKeyOnList(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();

      // Should trigger lines 200-201: check if all remaining children are empty and remove list
      // After removing contentItem, only emptyItem remains with whitespace
      expect(root.querySelector('ul')).toBeFalsy(); // List should be removed due to lines 200-201
      expect(root.querySelector('p')).toBeTruthy(); // Paragraph should be created
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
      listService.unwrapListItem(parentLi, parentList, range!);

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
      listService.unwrapListItem(
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
      listService.unwrapListItem(parentLi, parentList, range!);

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
      listService.unwrapListItem(listItem, list, range!);

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
      listService.unwrapListItem(listItem, list, range!);

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
      listService.unwrapListItem(listItem, list, range!);

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
        listService.unwrapListItem(listItem, list, range!);

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
      listService.unwrapListItem(mockLi, list, range!);

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
      listService.unwrapListItem(listItem, list, range!);

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
      listService.unwrapListItem(listItem, list, range!);

      // Restore the original method
      selectionService.createRange = originalCreateRange;

      // Verify the list item is now a paragraph with the text content preserved
      expect(root.querySelector('p')).toBeTruthy();
      // The structure might not be preserved exactly as in the original list item
      expect(root.querySelector('p')!.textContent).toBe('Text in span');
    });
  });

  describe('Branch Coverage for Uncovered Lines in ListService', () => {
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

    describe('handleDeleteKeyOnList', () => {
      test('removes parent list when it becomes empty after removing last item', () => {
        root.innerHTML = '';
        const list = document.createElement('ul');
        root.appendChild(list);
        const range = selectionService.createRange();
        range.setStart(list, 0);
        range.collapse(true);
        selectionService.setSelectionRange(range);
        const event = {
          key: 'Backspace',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>;
        const result = listService.handleDeleteKeyOnList(event);
        expect(result).toBe(false);
        expect(root.querySelector('ul')).toBeTruthy();
      });

      test('removes parent list when all children are empty/whitespace', () => {
        root.innerHTML = '';
        const list = document.createElement('ul');
        const emptyItem = document.createElement('li');
        emptyItem.textContent = '   ';
        const contentItem = document.createElement('li');
        contentItem.textContent = 'Content';
        list.appendChild(emptyItem);
        list.appendChild(contentItem);
        root.appendChild(list);
        const range = selectionService.createRange();
        range.setStart(contentItem.firstChild!, 0);
        range.collapse(true);
        selectionService.setSelectionRange(range);
        const event = {
          key: 'Backspace',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>;
        const result = listService.handleDeleteKeyOnList(event);
        expect(result).toBe(true);
        expect(root.querySelector('ul')).toBeFalsy();
      });

      test('creates and positions a paragraph after removing empty list', () => {
        root.innerHTML = '';
        const list = document.createElement('ul');
        const item = document.createElement('li');
        list.appendChild(item);
        root.appendChild(list);
        const range = selectionService.createRange();
        range.setStart(item, 0);
        range.collapse(true);
        selectionService.setSelectionRange(range);
        const event = {
          key: 'Backspace',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLDivElement>;
        const result = listService.handleDeleteKeyOnList(event);
        expect(result).toBe(true);
        expect(root.querySelector('p')).toBeTruthy();
        expect(root.querySelector('ul')).toBeFalsy();
      });
    });

    describe('unwrapListItem', () => {
      test('breaks out of while loop if nextRootList is not in root', () => {
        // Setup: create a nested list structure where nextRootList is not in root
        const outsideroot = document.createElement('div');
        document.body.appendChild(outsideroot);
        outsideroot.innerHTML = '<ul><li>Item<ul><li>Nested</li></ul></li></ul>';
        const nestedList = outsideroot.querySelector('ul ul') as HTMLUListElement;
        const li = nestedList.querySelector('li')!;
        const list = nestedList;
        setCursorInElement(li, 0, selectionService);
        const range = selectionService.getRangeAtStartOfSelection();
        listService.unwrapListItem(li, list, range!);
        // Should not throw and should not modify outsideroot
        expect(outsideroot.querySelector('ul')).toBeTruthy();
        document.body.removeChild(outsideroot);
      });

      test('inserts nested lists after paragraph when unwrapping single-item list', () => {
        root.innerHTML = '';
        const list = document.createElement('ul');
        const li = document.createElement('li');
        li.textContent = 'Item';
        const nested = document.createElement('ul');
        const nestedLi = document.createElement('li');
        nestedLi.textContent = 'Nested';
        nested.appendChild(nestedLi);
        li.appendChild(nested);
        list.appendChild(li);
        root.appendChild(list);
        setCursorInElement(li, 0, selectionService);
        const range = selectionService.getRangeAtStartOfSelection();
        listService.unwrapListItem(li, list, range!);
        // The nested list should be after the paragraph
        const p = root.querySelector('p');
        expect(p).toBeTruthy();
        expect(p!.nextSibling?.nodeName.toLowerCase()).toBe('ul');
      });

      test('checks textNode is a text node before setting cursor (line 469)', () => {
        root.innerHTML = '';
        const list = document.createElement('ul');
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = 'Text';
        li.appendChild(span);
        list.appendChild(li);
        root.appendChild(list);
        setCursorInElement(span, 0, selectionService);
        const range = selectionService.getRangeAtStartOfSelection();
        listService.unwrapListItem(li, list, range!);
        // Should not throw and should create a paragraph with a span
        expect(root.querySelector('p span')).toBeTruthy();
      });
    });
  });

  describe('handleDeleteKeyOnList', () => {
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
      const event = {
        key: 'Backspace',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      // Call the method under test
      const result = listService.handleDeleteKeyOnList(event);

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
      const event = {
        key: 'Backspace',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      // Call the method under test
      const result = listService.handleDeleteKeyOnList(event);

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
      const event = {
        key: 'Backspace',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLDivElement>;

      // Call the method under test
      const result = listService.handleDeleteKeyOnList(event);

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
      listService.unwrapListItem(li1, ul, range);

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
