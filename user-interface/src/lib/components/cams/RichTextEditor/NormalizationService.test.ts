import { DOMPURIFY_CONFIG } from './editor.constants';
import { NormalizationService } from './NormalizationService';
import { MockSelectionService } from './SelectionService.humble';
import DOMPurify from 'dompurify';

function safelySetInnerHTML(element: HTMLElement, html: string): void {
  element.innerHTML = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
}

describe('FormattingService: normalizeInlineFormatting', () => {
  let normalizationService: NormalizationService;
  let container: HTMLDivElement;
  let selectionService: MockSelectionService;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    selectionService = new MockSelectionService();
    normalizationService = new NormalizationService(container, selectionService);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('normalizeInlineFormatting flattens nested identical tags', () => {
    safelySetInnerHTML(container, '<p>one <strong><strong>two</strong></strong> three</p>');
    normalizationService.normalizeInlineFormatting();
    expect(container.innerHTML).toBe('<p>one <strong>two</strong> three</p>');
  });

  test('normalizeInlineFormatting preserves different nested tags', () => {
    safelySetInnerHTML(container, '<p>one <strong><em>two</em></strong> three</p>');
    normalizationService.normalizeInlineFormatting();
    expect(container.innerHTML).toBe('<p>one <strong><em>two</em></strong> three</p>');
  });

  test('normalizeInlineFormatting merges adjacent identical tags', () => {
    safelySetInnerHTML(container, '<p>one <strong>two</strong><strong>three</strong> four</p>');
    normalizationService.normalizeInlineFormatting();
    expect(container.innerHTML).toBe('<p>one <strong>twothree</strong> four</p>');
  });

  test('normalizeInlineFormatting merges adjacent span tags with same class', () => {
    container.innerHTML =
      '<p>one <span class="underline">two</span><span class="underline">three</span> four</p>';
    normalizationService.normalizeInlineFormatting();
    expect(container.innerHTML).toBe('<p>one <span class="underline">twothree</span> four</p>');
  });
});
