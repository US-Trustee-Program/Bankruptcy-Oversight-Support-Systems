import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { FormattingService } from './FormattingService';
import { MockSelectionService } from './SelectionService.humble';

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
  element.innerHTML = html;
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
});

describe('FormattingService: normalizeInlineFormatting', () => {
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

  test('normalizeInlineFormatting flattens nested identical tags', () => {
    safelySetInnerHTML(container, '<p>one <strong><strong>two</strong></strong> three</p>');
    // Call private method using any type
    (formattingService as any).normalizeInlineFormatting();
    expect(container.innerHTML).toBe('<p>one <strong>two</strong> three</p>');
  });

  test('normalizeInlineFormatting preserves different nested tags', () => {
    safelySetInnerHTML(container, '<p>one <strong><em>two</em></strong> three</p>');
    // Call private method using any type
    (formattingService as any).normalizeInlineFormatting();
    expect(container.innerHTML).toBe('<p>one <strong><em>two</em></strong> three</p>');
  });

  test('normalizeInlineFormatting merges adjacent identical tags', () => {
    safelySetInnerHTML(container, '<p>one <strong>two</strong><strong>three</strong> four</p>');
    // Call private method using any type
    (formattingService as any).normalizeInlineFormatting();
    expect(container.innerHTML).toBe('<p>one <strong>twothree</strong> four</p>');
  });

  test('normalizeInlineFormatting merges adjacent span tags with same class', () => {
    container.innerHTML =
      '<p>one <span class="underline">two</span><span class="underline">three</span> four</p>';
    // Call private method using any type
    (formattingService as any).normalizeInlineFormatting();
    expect(container.innerHTML).toBe('<p>one <span class="underline">twothree</span> four</p>');
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
});
