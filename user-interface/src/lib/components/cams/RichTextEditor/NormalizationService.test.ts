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

  test('normalizeInlineFormatting merges three consecutive identical tags', () => {
    editorUtilities.safelySetHtml(
      container,
      '<p>one <strong>two</strong><strong>three</strong><strong>four</strong> five</p>',
    );
    normalizationService.normalizeInlineFormatting();
    expect(editorUtilities.safelyGetHtml(container)).toBe(
      '<p>one <strong>twothreefour</strong> five</p>',
    );
  });

  test('normalizeInlineFormatting merges four consecutive identical tags', () => {
    editorUtilities.safelySetHtml(
      container,
      '<p><strong>A</strong><strong>B</strong><strong>C</strong><strong>D</strong></p>',
    );
    normalizationService.normalizeInlineFormatting();
    expect(editorUtilities.safelyGetHtml(container)).toBe('<p><strong>ABCD</strong></p>');
  });

  test('normalizeInlineFormatting merges multiple consecutive span tags with same class', () => {
    editorUtilities.safelySetHtml(
      container,
      '<p><span class="underline">one</span><span class="underline">two</span><span class="underline">three</span></p>',
    );
    normalizationService.normalizeInlineFormatting();
    expect(editorUtilities.safelyGetHtml(container)).toBe(
      '<p><span class="underline">onetwothree</span></p>',
    );
  });

  test('normalizeInlineFormatting handles mixed consecutive tags', () => {
    editorUtilities.safelySetHtml(
      container,
      '<p><strong>A</strong><strong>B</strong><em>C</em><em>D</em><strong>E</strong></p>',
    );
    normalizationService.normalizeInlineFormatting();
    expect(editorUtilities.safelyGetHtml(container)).toBe(
      '<p><strong>AB</strong><em>CD</em><strong>E</strong></p>',
    );
  });

  test('normalizeInlineFormatting preserves text nodes between similar elements', () => {
    editorUtilities.safelySetHtml(
      container,
      '<p><strong>A</strong> <strong>B</strong><strong>C</strong></p>',
    );
    normalizationService.normalizeInlineFormatting();
    expect(editorUtilities.safelyGetHtml(container)).toBe(
      '<p><strong>A</strong> <strong>BC</strong></p>',
    );
  });

  test('normalizeInlineFormatting handles complex nested and adjacent scenarios', () => {
    editorUtilities.safelySetHtml(
      container,
      '<p><strong><strong>nested</strong></strong><strong>adjacent1</strong><strong>adjacent2</strong></p>',
    );
    normalizationService.normalizeInlineFormatting();
    expect(editorUtilities.safelyGetHtml(container)).toBe(
      '<p><strong>nestedadjacent1adjacent2</strong></p>',
    );
  });

  test('normalizeInlineFormatting handles stress test with many consecutive elements', () => {
    editorUtilities.safelySetHtml(
      container,
      '<p><strong>1</strong><strong>2</strong><strong>3</strong><strong>4</strong><strong>5</strong><strong>6</strong><strong>7</strong><strong>8</strong></p>',
    );
    normalizationService.normalizeInlineFormatting();
    expect(editorUtilities.safelyGetHtml(container)).toBe('<p><strong>12345678</strong></p>');
  });
});
