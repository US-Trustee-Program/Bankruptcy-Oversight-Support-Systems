import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { ListService } from './ListService';
import { MockSelectionService } from './SelectionService.humble';
import { DOMPURIFY_CONFIG } from './editor.constants';
import DOMPurify from 'dompurify';

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
      safelySetInnerHTML(
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
      safelySetInnerHTML(
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

  describe('indentListItem', () => {
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
      listService.indentListItem(selectionService.getRangeAtStartOfSelection());

      // Verify DOM hasn't changed (method returned early)
      expect(root.innerHTML).toBe(initialHTML);

      // Verify the li element has no parent (parentElement is null)
      expect(li.parentElement).toBeNull();
    });
  });
});
