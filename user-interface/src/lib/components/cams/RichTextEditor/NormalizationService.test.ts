import { NormalizationService } from './NormalizationService';
import { MockSelectionService } from './SelectionService.humble';
import editorUtilities from './utilities';

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
    editorUtilities.safelySetHtml(
      container,
      '<p>one <strong><strong>two</strong></strong> three</p>',
    );
    normalizationService.normalizeInlineFormatting();
    expect(editorUtilities.safelyGetHtml(container)).toBe('<p>one <strong>two</strong> three</p>');
  });

  test('normalizeInlineFormatting preserves different nested tags', () => {
    editorUtilities.safelySetHtml(container, '<p>one <strong><em>two</em></strong> three</p>');
    normalizationService.normalizeInlineFormatting();
    expect(editorUtilities.safelyGetHtml(container)).toBe(
      '<p>one <strong><em>two</em></strong> three</p>',
    );
  });

  test('normalizeInlineFormatting merges adjacent identical tags', () => {
    editorUtilities.safelySetHtml(
      container,
      '<p>one <strong>two</strong><strong>three</strong> four</p>',
    );
    normalizationService.normalizeInlineFormatting();
    expect(editorUtilities.safelyGetHtml(container)).toBe(
      '<p>one <strong>twothree</strong> four</p>',
    );
  });

  test('normalizeInlineFormatting merges adjacent span tags with same class', () => {
    editorUtilities.safelySetHtml(
      container,
      '<p>one <span class="underline">two</span><span class="underline">three</span> four</p>',
    );
    normalizationService.normalizeInlineFormatting();
    expect(editorUtilities.safelyGetHtml(container)).toBe(
      '<p>one <span class="underline">twothree</span> four</p>',
    );
  });
});
