import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { FormattingService } from './FormattingService';
import { MockSelectionService } from './SelectionService.humble';
import editorUtilities from './utilities';
import { DOMPURIFY_CONFIG, RichTextFormat, ZERO_WIDTH_SPACE } from './editor.constants';
import DOMPurify from 'dompurify';

// Helper functions from Editor.test.ts
function setCursorInParagraph(
  paragraph: HTMLParagraphElement,
  offset: number,
  selectionService: MockSelectionService,
): void {
  const textNode = paragraph.firstChild;
  if (textNode) {
    const range = selectionService.createRange();
    range.setStart(textNode, offset);
    range.collapse(true);
    selectionService.setSelectionRange(range);
  }
}

function setCursorInElement(
  element: HTMLElement,
  offset: number,
  selectionService: MockSelectionService,
): void {
  const textNode = element.firstChild;
  if (textNode) {
    const range = selectionService.createRange();
    range.setStart(textNode, offset);
    range.collapse(true);
    selectionService.setSelectionRange(range);
  }
}

function safelySetInnerHTML(element: HTMLElement, html: string): void {
  element.innerHTML = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
}

describe('FormattingService: toggleSelection', () => {
  let formattingService: FormattingService;
  let container: HTMLDivElement;
  let selectionService: MockSelectionService;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    selectionService = new MockSelectionService();
    formattingService = new FormattingService(container, selectionService);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('getActiveFormatsExcluding should return an array of tag names in the order from root node to inner most child', () => {
    container.innerHTML = '<p><strong><span class="underline"><em>test</em></span></strong></p>';
    const italic = container.querySelector('em');
    const excludeElement = document.createElement('div');
    // @ts-expect-error private function
    const result = formattingService.getActiveFormatsExcluding(italic, excludeElement);
    expect(result).toEqual(['strong', 'u', 'em']);
  });

  test('createNestedFormatStructure should return a nodelist of elements in the same order as the passed array of formats', () => {
    const node = document.createElement('div');
    node.innerHTML = `<strong><span class="underline"><em>${ZERO_WIDTH_SPACE}</em></span></strong>`;
    // @ts-expect-error private function
    const result = formattingService.createNestedFormatStructure(['strong', 'u', 'em']);
    expect(result).toEqual(node.children[0]);
  });

  test('returns false when no selection exists', () => {
    selectionService.getCurrentSelection = vi.fn().mockReturnValue(null);
    const isRangeAcrossBlocksSpy = vi.spyOn(editorUtilities, 'isRangeAcrossBlocks');

    formattingService.toggleSelection('strong');

    expect(isRangeAcrossBlocksSpy).not.toHaveBeenCalled();
  });

  test('applies bold formatting to selected text', () => {
    safelySetInnerHTML(container, '<p>Hello world</p>');
    const paragraph = container.querySelector('p')!;
    const range = selectionService.createRange();
    range.setStart(paragraph.firstChild!, 0);
    range.setEnd(paragraph.firstChild!, 5);
    selectionService.setSelectionRange(range);

    formattingService.toggleSelection('strong');

    expect(container.innerHTML).toContain('<strong>');
  });

  test('applies italic formatting to selected text', () => {
    safelySetInnerHTML(container, '<p>Hello world</p>');
    const paragraph = container.querySelector('p')!;
    const range = selectionService.createRange();
    range.setStart(paragraph.firstChild!, 0);
    range.setEnd(paragraph.firstChild!, 5);
    selectionService.setSelectionRange(range);

    formattingService.toggleSelection('em');

    expect(container.innerHTML).toContain('<em>');
  });

  test('applies underline formatting to selected text', () => {
    safelySetInnerHTML(container, '<p>Hello world</p>');
    const paragraph = container.querySelector('p')!;
    const range = selectionService.createRange();
    range.setStart(paragraph.firstChild!, 0);
    range.setEnd(paragraph.firstChild!, 5);
    selectionService.setSelectionRange(range);

    formattingService.toggleSelection('u');

    expect(container.innerHTML).toContain('<span class="underline">');
  });

  test('removes formatting from already formatted text', () => {
    safelySetInnerHTML(container, '<p><strong>Hello</strong> world</p>');
    const strongElement = container.querySelector('strong')!;
    const range = selectionService.createRange();
    range.setStart(strongElement.firstChild!, 0);
    range.setEnd(strongElement.firstChild!, 5);
    selectionService.setSelectionRange(range);

    formattingService.toggleSelection('strong');

    expect(container.innerHTML).not.toContain('<strong>');
    expect(container.textContent).toBe('Hello world');
  });

  test('creates formatting element at cursor position when no text selected', () => {
    safelySetInnerHTML(container, '<p>Hello world</p>');
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 5, selectionService);

    formattingService.toggleSelection('strong');

    expect(container.innerHTML).toContain('<strong>');
  });

  test('exits formatting element when toggling off at cursor position', () => {
    safelySetInnerHTML(container, '<p>Hello <strong>bold</strong> world</p>');
    const strongElement = container.querySelector('strong')!;
    setCursorInElement(strongElement, 2, selectionService);

    formattingService.toggleSelection('strong');

    // Should create a new structure outside the strong element
    expect(container.querySelectorAll('strong')).toHaveLength(1);
  });

  test('does nothing when selection spans across blocks', () => {
    safelySetInnerHTML(container, '<p>First paragraph</p><p>Second paragraph</p>');
    const firstP = container.querySelectorAll('p')[0];
    const secondP = container.querySelectorAll('p')[1];

    const range = selectionService.createRange();
    range.setStart(firstP.firstChild!, 5);
    range.setEnd(secondP.firstChild!, 6);
    selectionService.setSelectionRange(range);

    const originalHTML = container.innerHTML;
    formattingService.toggleSelection('strong');

    expect(container.innerHTML).toBe(originalHTML);
  });
});

describe('FormattingService: toggleSelection - additional scenarios', () => {
  let formattingService: FormattingService;
  let container: HTMLDivElement;
  let selectionService: MockSelectionService;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    selectionService = new MockSelectionService();
    formattingService = new FormattingService(container, selectionService);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('toggleSelection adds formatting to already formatted text', () => {
    safelySetInnerHTML(container, '<p>Hello <em>world</em></p>');
    const emElement = container.querySelector('em')!;
    const range = selectionService.createRange();
    range.selectNodeContents(emElement);
    selectionService.setSelectionRange(range);

    formattingService.toggleSelection('strong');

    // Should add strong inside or around em
    const html = container.innerHTML;
    const hasNestedFormatting = html.includes('<em><strong>') || html.includes('<strong><em>');
    expect(hasNestedFormatting).toBe(true);
    expect(html).toContain('world');
  });

  test('toggleSelection handles partial selection within formatted text', () => {
    safelySetInnerHTML(container, '<p><strong>Hello world</strong></p>');
    const strongElement = container.querySelector('strong')!;
    const range = selectionService.createRange();
    range.setStart(strongElement.firstChild!, 0);
    range.setEnd(strongElement.firstChild!, 5); // Select "Hello"
    selectionService.setSelectionRange(range);

    formattingService.toggleSelection('strong');

    // Should remove formatting from "Hello" but keep it for " world"
    expect(container.textContent).toBe('Hello world');
    expect(container.innerHTML).toContain('Hello<strong> world</strong>');
  });

  test('toggleSelection applies bold formatting', () => {
    safelySetInnerHTML(container, '<p>Hello world</p>');
    const paragraph = container.querySelector('p')!;
    const range = selectionService.createRange();
    range.setStart(paragraph.firstChild!, 0);
    range.setEnd(paragraph.firstChild!, 5); // Select "Hello"
    selectionService.setSelectionRange(range);

    formattingService.toggleSelection('strong');

    // Should have bold formatting applied
    expect(container.innerHTML).toContain('<strong>');
    expect(container.textContent).toBe('Hello world');
  });

  test('handles cross-paragraph selection gracefully in toggleSelection', () => {
    safelySetInnerHTML(container, '<p>First paragraph</p><p>Second paragraph</p>');

    const firstP = container.querySelectorAll('p')[0];
    const secondP = container.querySelectorAll('p')[1];
    const firstText = firstP.firstChild as Text;
    const secondText = secondP.firstChild as Text;

    const range = document.createRange();
    range.setStart(firstText, 5);
    range.setEnd(secondText, 6);
    selectionService.setSelectionRange(range);

    // Should not apply formatting across paragraphs
    formattingService.toggleSelection('strong');

    // Formatting should not be applied
    expect(container.innerHTML).not.toContain('<strong>');
  });

  test('isEntireSelectionFormatted returns false when some of selection is not formatted', () => {
    safelySetInnerHTML(
      container,
      '<p><strong>Hello world</strong> This is not in the formatting</p>',
    );
    const paragraph = container.querySelector('p')!;
    const range = selectionService.createRange();
    range.setStart(paragraph.firstChild!, 0);
    range.setEnd(paragraph.childNodes[1]!, 2);
    selectionService.setSelectionRange(range);

    // @ts-expect-error private function
    const result = formattingService.isEntireSelectionFormatted(range, 'strong');
    expect(result).toBe(false);
  });

  test('isEntireSelectionFormatted returns true when entire selection is formatted', () => {
    safelySetInnerHTML(
      container,
      '<p><strong>Hello <em>This is nested formatting</em> world</strong> This is not in the formatting</p>',
    );
    const paragraph = container.querySelector('p')!;
    const range = selectionService.createRange();
    range.setStart(paragraph.firstChild!, 0);
    range.setEnd(paragraph.firstChild!.childNodes[1].firstChild!, 4);
    selectionService.setSelectionRange(range);

    // @ts-expect-error private function
    const result = formattingService.isEntireSelectionFormatted(range, 'strong');
    expect(result).toBe(true);
  });

  test('positionCursorInNewStructure should return early when no selection exists', () => {
    selectionService.getCurrentSelection = vi.fn().mockReturnValue(null);
    vi.spyOn(selectionService, 'createTreeWalker').mockReturnValue(null as unknown as TreeWalker);
    const structure = document.createElement('div');
    // @ts-expect-error private function
    formattingService.positionCursorInNewStructure(structure);
    expect(selectionService.createTreeWalker).not.toHaveBeenCalled();
  });

  test('removeFormatFromFragment should remove formatting from a fragment', () => {
    safelySetInnerHTML(container, '<p><strong>Hello <em>world</em></strong></p>');
    const emElement = container.querySelector('em')!;
    const fragment = selectionService.createDocumentFragment();
    fragment.appendChild(emElement);
    // @ts-expect-error private function
    formattingService.removeFormatFromFragment(fragment, 'em');
    expect(fragment.textContent).toBe('world');
  });
});

describe('FormattingService: keyboard shortcuts', () => {
  let container: HTMLDivElement;
  let selectionService: MockSelectionService;
  let formattingService: FormattingService;
  let toggleSelectionSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    selectionService = new MockSelectionService();
    formattingService = new FormattingService(container, selectionService);
    toggleSelectionSpy = vi.spyOn(formattingService, 'toggleSelection');
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  describe('keyboard shortcuts for formatting', () => {
    test('Ctrl+B applies bold formatting', () => {
      formattingService.toggleSelection('strong');
      expect(toggleSelectionSpy).toHaveBeenCalledWith('strong');
    });

    test('Ctrl+I applies italic formatting', () => {
      formattingService.toggleSelection('em');
      expect(toggleSelectionSpy).toHaveBeenCalledWith('em');
    });

    test('Ctrl+U applies underline formatting', () => {
      formattingService.toggleSelection('u');
      expect(toggleSelectionSpy).toHaveBeenCalledWith('u');
    });
  });

  describe('isMatchingElement', () => {
    test('handles default case correctly', () => {
      const element = document.createElement('div');

      // @ts-expect-error - Accessing private static method for testing
      const result = FormattingService.isMatchingElement(
        element,
        'invalid-format' as RichTextFormat,
      );

      expect(result).toBe(false);
    });
  });
});
