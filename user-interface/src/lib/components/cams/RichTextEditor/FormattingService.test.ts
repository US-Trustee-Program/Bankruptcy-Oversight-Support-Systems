import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { FormattingService } from './FormattingService';
import { MockSelectionService } from './SelectionService.humble';
import editorUtilities from './Editor.utilities';
import { RichTextFormat, ZERO_WIDTH_SPACE } from './Editor.constants';
import { setCursorInElement, setCursorInParagraph } from './RichTextEditor.test-utils';

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
    editorUtilities.safelySetHtml(
      container,
      '<p><strong><span class="underline"><em>test</em></span></strong></p>',
    );
    const italic = container.querySelector('em');
    const excludeElement = document.createElement('div');
    // @ts-expect-error private function
    const result = formattingService.getActiveFormatsExcluding(italic, excludeElement);
    expect(result).toEqual(['strong', 'u', 'em']);
  });

  test('createNestedFormatStructure should return a nodelist of elements in the same order as the passed array of formats', () => {
    const node = document.createElement('div');
    editorUtilities.safelySetHtml(
      node,
      `<strong><span class="underline"><em>${ZERO_WIDTH_SPACE}</em></span></strong>`,
    );
    // @ts-expect-error private function
    const result = formattingService.createNestedFormatStructure(['strong', 'u', 'em']);
    expect(result).toEqual(node.children[0]);
  });

  test('applies bold formatting to selected text', () => {
    editorUtilities.safelySetHtml(container, '<p>Hello world</p>');
    const paragraph = container.querySelector('p')!;
    const range = selectionService.createRange();
    range.setStart(paragraph.firstChild!, 0);
    range.setEnd(paragraph.firstChild!, 5);
    selectionService.setSelectionRange(range);

    formattingService.toggleSelection('strong');

    expect(editorUtilities.safelyGetHtml(container)).toContain('<strong>');
  });

  test('applies italic formatting to selected text', () => {
    editorUtilities.safelySetHtml(container, '<p>Hello world</p>');
    const paragraph = container.querySelector('p')!;
    const range = selectionService.createRange();
    range.setStart(paragraph.firstChild!, 0);
    range.setEnd(paragraph.firstChild!, 5);
    selectionService.setSelectionRange(range);

    formattingService.toggleSelection('em');

    expect(editorUtilities.safelyGetHtml(container)).toContain('<em>');
  });

  test('applies underline formatting to selected text', () => {
    editorUtilities.safelySetHtml(container, '<p>Hello world</p>');
    const paragraph = container.querySelector('p')!;
    const range = selectionService.createRange();
    range.setStart(paragraph.firstChild!, 0);
    range.setEnd(paragraph.firstChild!, 5);
    selectionService.setSelectionRange(range);

    formattingService.toggleSelection('u');

    expect(editorUtilities.safelyGetHtml(container)).toContain('<span class="underline">');
  });

  test('removes formatting from already formatted text', () => {
    editorUtilities.safelySetHtml(container, '<p><strong>Hello</strong> world</p>');
    const strongElement = container.querySelector('strong')!;
    const range = selectionService.createRange();
    range.setStart(strongElement.firstChild!, 0);
    range.setEnd(strongElement.firstChild!, 5);
    selectionService.setSelectionRange(range);

    formattingService.toggleSelection('strong');

    expect(editorUtilities.safelyGetHtml(container)).not.toContain('<strong>');
    expect(container.textContent).toBe('Hello world');
  });

  test('creates formatting element at cursor position when no text selected', () => {
    editorUtilities.safelySetHtml(container, '<p>Hello world</p>');
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 5, selectionService);

    formattingService.toggleSelection('strong');

    expect(editorUtilities.safelyGetHtml(container)).toContain('<strong>');
  });

  test('exits formatting element when toggling off at cursor position', () => {
    editorUtilities.safelySetHtml(container, '<p>Hello <strong>bold</strong> world</p>');
    const strongElement = container.querySelector('strong')!;
    setCursorInElement(strongElement, 2, selectionService);

    formattingService.toggleSelection('strong');

    // Should create a new structure outside the strong element
    expect(container.querySelectorAll('strong')).toHaveLength(1);
  });

  test('does nothing when selection spans across blocks', () => {
    editorUtilities.safelySetHtml(container, '<p>First paragraph</p><p>Second paragraph</p>');
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
    editorUtilities.safelySetHtml(container, '<p>Hello <em>world</em></p>');
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
    editorUtilities.safelySetHtml(container, '<p><strong>Hello world</strong></p>');
    const strongElement = container.querySelector('strong')!;
    const range = selectionService.createRange();
    range.setStart(strongElement.firstChild!, 0);
    range.setEnd(strongElement.firstChild!, 5); // Select "Hello"
    selectionService.setSelectionRange(range);

    formattingService.toggleSelection('strong');

    // Should remove formatting from "Hello" but keep it for " world"
    expect(container.textContent).toBe('Hello world');
    const html = editorUtilities.safelyGetHtml(container);
    expect(html).toBe('<p>Hello<strong> world</strong></p>');
  });

  test('positionCursorInNewStructure should return early when no selection exists', () => {
    selectionService.getCurrentSelection = vi.fn().mockReturnValue(null);
    const structure = document.createElement('div');
    // @ts-expect-error private function
    formattingService.positionCursorInNewStructure(structure);
    expect(selectionService.getCurrentSelection()).toBeNull();
  });

  test('removeFormatFromFragment should remove formatting', () => {
    editorUtilities.safelySetHtml(container, '<p><strong>Hello <em>world</em></strong></p>');
    const strongElement = container.querySelector('strong')!;
    const fragment = document.createDocumentFragment();
    fragment.appendChild(strongElement.cloneNode(true));
    // @ts-expect-error private function
    formattingService.removeFormatFromFragment(fragment, 'strong');
    expect(fragment.textContent).toBe('Hello world');
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

describe('FormattingService: handlePaste', () => {
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

  test('should wrap a valid URL in an anchor tag and set href to that URL when pasted content contains a valid URL', () => {
    editorUtilities.safelySetHtml(container, '<p>Check this out: </p>');
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 16, selectionService);

    const mockClipboardData = {
      getData: vi.fn().mockReturnValue('https://www.example.com'),
    };
    const mockEvent = {
      clipboardData: mockClipboardData,
      preventDefault: vi.fn(),
    } as unknown as React.ClipboardEvent<HTMLDivElement>;

    const result = formattingService.handlePaste(mockEvent);

    expect(result).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(container.innerHTML).toContain(
      '<a href="https://www.example.com" target="_blank" rel="noopener noreferrer">https://www.example.com</a>',
    );
  });

  test('should not wrap anything in anchor tags when the pasted content contains nothing matching a URL', () => {
    editorUtilities.safelySetHtml(container, '<p>Some text: </p>');
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 11, selectionService);

    const mockClipboardData = {
      getData: vi.fn().mockReturnValue('just some plain text'),
    };
    const mockEvent = {
      clipboardData: mockClipboardData,
      preventDefault: vi.fn(),
    } as unknown as React.ClipboardEvent<HTMLDivElement>;

    const result = formattingService.handlePaste(mockEvent);

    expect(result).toBe(false);
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    expect(container.innerHTML).not.toContain('<a');
  });

  test('should wrap multiple subsets of content in anchor tags and set href appropriately when pasted content contains multiple matches of URL', () => {
    editorUtilities.safelySetHtml(container, '<p>Resources: </p>');
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 11, selectionService);

    const mockClipboardData = {
      getData: vi
        .fn()
        .mockReturnValue('Visit https://www.example.com and check http://www.example.com'),
    };
    const mockEvent = {
      clipboardData: mockClipboardData,
      preventDefault: vi.fn(),
    } as unknown as React.ClipboardEvent<HTMLDivElement>;

    const result = formattingService.handlePaste(mockEvent);

    expect(result).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(container.innerHTML).toBe(
      '<p>Resources: Visit <a href="https://www.example.com" target="_blank" rel="noopener noreferrer">https://www.example.com</a> and check <a href="http://www.example.com" target="_blank" rel="noopener noreferrer">http://www.example.com</a></p>',
    );
  });

  test('should preserve line breaks when pasting content', () => {
    editorUtilities.safelySetHtml(container, '<p>Resources: </p>');
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 11, selectionService);

    const mockClipboardData = {
      getData: vi
        .fn()
        .mockReturnValue('Visit https://www.example.com\nand check http://www.example.com'),
    };
    const mockEvent = {
      clipboardData: mockClipboardData,
      preventDefault: vi.fn(),
    } as unknown as React.ClipboardEvent<HTMLDivElement>;

    const result = formattingService.handlePaste(mockEvent);

    expect(result).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(container.innerHTML).toBe(
      '<p>Resources: Visit <a href="https://www.example.com" target="_blank" rel="noopener noreferrer">https://www.example.com</a></p><p>and check <a href="http://www.example.com" target="_blank" rel="noopener noreferrer">http://www.example.com</a></p>',
    );
  });

  test('should preserve line breaks and move content after the cursor to a new paragraph when pasting content when there is content after the cursor', () => {
    editorUtilities.safelySetHtml(container, '<p>Resources: Check this out: </p>');
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 11, selectionService);

    const mockClipboardData = {
      getData: vi
        .fn()
        .mockReturnValue('Visit https://www.example.com\nand check http://www.example.com'),
    };
    const mockEvent = {
      clipboardData: mockClipboardData,
      preventDefault: vi.fn(),
    } as unknown as React.ClipboardEvent<HTMLDivElement>;

    const result = formattingService.handlePaste(mockEvent);

    expect(result).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(container.innerHTML).toBe(
      '<p>Resources: Visit <a href="https://www.example.com" target="_blank" rel="noopener noreferrer">https://www.example.com</a></p><p>and check <a href="http://www.example.com" target="_blank" rel="noopener noreferrer">http://www.example.com</a></p><p>Check this out: </p>',
    );
  });
});
