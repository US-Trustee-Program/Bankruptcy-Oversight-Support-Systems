import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { ListToggleService } from './ListToggleService';
import { ListUtilities } from './ListUtilities';
import { MockSelectionService } from './SelectionService.humble';
import editorUtilities, { safelySetHtml, safelyGetHtml } from './utilities';
import { ZERO_WIDTH_SPACE } from './editor.constants';
import { setCursorInElement, setCursorInParagraph } from './test-utils';

describe('ListToggleService', () => {
  let root: HTMLDivElement;
  let listToggleService: ListToggleService;
  let listUtilities: ListUtilities;
  let selectionService: MockSelectionService;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    selectionService = new MockSelectionService();
    listUtilities = new ListUtilities(root, selectionService);
    listToggleService = new ListToggleService(root, selectionService, listUtilities);
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

      listToggleService.toggleList('ul');

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

      listToggleService.toggleList('ol');

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

      listToggleService.toggleList('ul');

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

      listToggleService.toggleList('ul');

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
      listToggleService.toggleList('ul');

      expect(root.innerHTML).toBe(originalHTML);

      document.body.removeChild(outsideElement);
    });

    test('toggleList handles nested lists correctly', () => {
      safelySetHtml(root, '<ul><li>Item 1<ul><li>Nested item</li></ul></li></ul>');
      const nestedItem = root.querySelector('ul ul li')!;
      setCursorInElement(nestedItem as HTMLElement, 3, selectionService);

      listToggleService.toggleList('ul');

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

      listToggleService.toggleList('ol');

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
      listToggleService.toggleList('ul');
      expect(root.querySelector('ul')).toBeTruthy();
      expect(root.querySelector('ol')).toBeFalsy();

      // Then convert it to an ordered list
      const listItem = root.querySelector('li')!;
      setCursorInElement(listItem, 1, selectionService);
      listToggleService.toggleList('ol');

      expect(root.querySelector('ul')).toBeFalsy();
      expect(root.querySelector('ol')).toBeTruthy();
    });

    test('toggleList handles empty paragraphs correctly', () => {
      safelySetHtml(root, '<p></p>');
      const paragraph = root.querySelector('p')!;
      setCursorInParagraph(paragraph, 0, selectionService);

      listToggleService.toggleList('ul');

      expect(root.querySelector('ul')).toBeTruthy();
      expect(root.querySelector('li')).toBeTruthy();
    });
  });

  describe('insertList', () => {
    test('returns early when isEditorInRange is false', () => {
      // Mock isEditorInRange to return false
      vi.spyOn(editorUtilities, 'isEditorInRange').mockReturnValue(false);
      // Spy on getCurrentSelection to ensure it is not called
      const range = selectionService.getRangeAtStartOfSelection();
      const getRangeAtStartOfSelection = vi.spyOn(selectionService, 'getRangeAtStartOfSelection');
      // @ts-expect-error private method
      listToggleService.insertList('ul', range!);
      expect(root.innerHTML).toBe('');
      expect(getRangeAtStartOfSelection).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });
});
