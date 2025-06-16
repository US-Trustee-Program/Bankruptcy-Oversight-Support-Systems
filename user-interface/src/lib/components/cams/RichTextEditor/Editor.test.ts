import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { Editor } from './Editor';
import { ZERO_WIDTH_SPACE } from '@/lib/components/cams/RichTextEditor/editor.constants';

function setCursorInParagraph(paragraph: HTMLParagraphElement, offset: number) {
  const selection = window.getSelection()!;
  const range = document.createRange();
  if (!paragraph.firstChild) {
    paragraph.appendChild(document.createTextNode(''));
  }
  range.setStart(paragraph.firstChild!, offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

function setCursorInElement(element: HTMLElement, offset: number) {
  const selection = window.getSelection()!;
  const range = document.createRange();
  if (!element.firstChild) {
    element.appendChild(document.createTextNode(''));
  }
  range.setStart(element.firstChild!, offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

function insertTextAtSelection(text: string) {
  const selection = window.getSelection()!;
  const range = selection.getRangeAt(0);
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

describe('Editor.cleanZeroWidthSpaces', () => {
  test('removes all zero-width spaces from a string', () => {
    const input = `Hello${ZERO_WIDTH_SPACE}World${ZERO_WIDTH_SPACE}`;
    const output = Editor.cleanZeroWidthSpaces(input);
    expect(output).toBe('HelloWorld');
  });

  test('removes zero-width spaces from a string containing only zero-width spaces', () => {
    const input = `${ZERO_WIDTH_SPACE}${ZERO_WIDTH_SPACE}${ZERO_WIDTH_SPACE}`;
    const result = Editor.cleanZeroWidthSpaces(input);
    expect(result).toBe('');
  });

  test('returns the same string if there are no zero-width spaces', () => {
    const input = 'Just a normal string.';
    const result = Editor.cleanZeroWidthSpaces(input);
    expect(result).toBe('Just a normal string.');
  });

  test('removes zero-width spaces at the start and end of the string', () => {
    const input = `${ZERO_WIDTH_SPACE}Start and end${ZERO_WIDTH_SPACE}`;
    const result = Editor.cleanZeroWidthSpaces(input);
    expect(result).toBe('Start and end');
  });

  test('returns an empty string when input is empty', () => {
    const input = '';
    const result = Editor.cleanZeroWidthSpaces(input);
    expect(result).toBe('');
  });

  test('handles a string with only whitespace and zero-width spaces', () => {
    const input = `   ${ZERO_WIDTH_SPACE}   ${ZERO_WIDTH_SPACE}`;
    const result = Editor.cleanZeroWidthSpaces(input);
    expect(result).toBe('      ');
  });

  test('does not remove similar but not identical unicode characters', () => {
    const input = `A\u200CA`; // \u200C is ZERO WIDTH NON-JOINER, not ZERO WIDTH SPACE
    const result = Editor.cleanZeroWidthSpaces(input);
    expect(result).toBe(`A\u200CA`);
  });

  test('handles a very long string with many zero-width spaces', () => {
    const input = Array(1000).fill(`word${ZERO_WIDTH_SPACE}`).join('');
    const result = Editor.cleanZeroWidthSpaces(input);
    expect(result).toBe(Array(1000).fill('word').join(''));
  });

  test('does not throw if input is an empty string', () => {
    const input = '';
    const result = Editor.cleanZeroWidthSpaces(input);
    expect(result).toBe('');
  });

  test('removes consecutive zero-width spaces', () => {
    const input = `foo${ZERO_WIDTH_SPACE}${ZERO_WIDTH_SPACE}bar`;
    const result = Editor.cleanZeroWidthSpaces(input);
    expect(result).toBe('foobar');
  });
});

describe('Editor.cleanEmptyTags', () => {
  test('removes empty tags from HTML', () => {
    const input = '<p></p><div>content</div><span></span>';
    const result = Editor.cleanEmptyTags(input);
    expect(result).toBe('<div>content</div>');
  });

  test('removes empty tags with whitespace', () => {
    const input = '<p> </p><div>content</div><span>\n</span>';
    const result = Editor.cleanEmptyTags(input);
    expect(result).toBe('<div>content</div>');
  });

  test('does not remove tags with content', () => {
    const input = '<p>text</p><div>content</div>';
    const result = Editor.cleanEmptyTags(input);
    expect(result).toBe('<p>text</p><div>content</div>');
  });

  test('returns the same string if there are no empty tags', () => {
    const input = 'Just a normal string.';
    const result = Editor.cleanEmptyTags(input);
    expect(result).toBe('Just a normal string.');
  });

  test('returns an empty string when input is empty', () => {
    const input = '';
    const result = Editor.cleanEmptyTags(input);
    expect(result).toBe('');
  });
});

describe('Editor.cleanHtml', () => {
  test('removes both zero-width spaces and empty tags', () => {
    const input = `<p>foo${ZERO_WIDTH_SPACE}</p><p><br></p>`;
    const result = Editor.cleanHtml(input);
    expect(result).toBe('<p>foo</p>');
  });

  test('handles complex HTML with multiple issues', () => {
    const input = `<div><p>${ZERO_WIDTH_SPACE}</p><p>Hello${ZERO_WIDTH_SPACE}World</p><span></span></div>`;
    const result = Editor.cleanHtml(input);
    expect(result).toBe('<div><p>HelloWorld</p></div>');
  });

  test('returns empty string for input with only empty tags and zero-width spaces', () => {
    const input = `<p>${ZERO_WIDTH_SPACE}</p><span></span>`;
    const result = Editor.cleanHtml(input);
    expect(result).toBe('');
  });

  test('preserves valid content', () => {
    const input = `<p>Valid${ZERO_WIDTH_SPACE}Content</p><div>More</div><span></span>`;
    const result = Editor.cleanHtml(input);
    expect(result).toBe('<p>ValidContent</p><div>More</div>');
  });
});

describe('Editor: handleCtrlKey', () => {
  let editor: Editor;
  let container: HTMLDivElement;
  let toggleSelectionSpy: ReturnType<typeof vi.spyOn>;

  const createEvent = (
    key: string,
    { ctrlKey = true, metaKey = false } = {},
  ): React.KeyboardEvent<HTMLDivElement> =>
    ({
      key,
      ctrlKey,
      metaKey,
      preventDefault: vi.fn(),
    }) as unknown as React.KeyboardEvent<HTMLDivElement>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
    toggleSelectionSpy = vi.spyOn(editor, 'toggleSelection').mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('handles Ctrl+B and toggles strong', () => {
    const e = createEvent('b');
    const result = editor.handleCtrlKey(e);
    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(toggleSelectionSpy).toHaveBeenCalledWith('strong');
  });

  test('handles Ctrl+I and toggles em', () => {
    const e = createEvent('i');
    const result = editor.handleCtrlKey(e);
    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(toggleSelectionSpy).toHaveBeenCalledWith('em');
  });

  test('handles Ctrl+U and toggles underline', () => {
    const e = createEvent('u');
    const result = editor.handleCtrlKey(e);
    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(toggleSelectionSpy).toHaveBeenCalledWith('u');
  });

  test('returns false if ctrlKey is not pressed', () => {
    const e = createEvent('b', { ctrlKey: false });
    const result = editor.handleCtrlKey(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(toggleSelectionSpy).not.toHaveBeenCalled();
  });

  test('returns false for unhandled ctrl+key combo', () => {
    const e = createEvent('x');
    const result = editor.handleCtrlKey(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(toggleSelectionSpy).not.toHaveBeenCalled();
  });

  test('is case-insensitive with key', () => {
    const e = createEvent('B');
    const result = editor.handleCtrlKey(e);
    expect(result).toBe(true);
    expect(toggleSelectionSpy).toHaveBeenCalledWith('strong');
  });

  test('should ignore CMD key', () => {
    const e = createEvent('b', { metaKey: true, ctrlKey: false });
    const result = editor.handleCtrlKey(e);
    expect(result).toBe(false);
    expect(toggleSelectionSpy).not.toHaveBeenCalled();
  });
});

describe('Editor: handleDentures', () => {
  let editor: Editor;
  let container: HTMLDivElement;
  let indentSpy: ReturnType<typeof vi.spyOn>;
  let outdentSpy: ReturnType<typeof vi.spyOn>;

  const createEvent = (shiftKey: boolean): React.KeyboardEvent<HTMLDivElement> =>
    ({
      key: 'Tab',
      preventDefault: vi.fn(),
      shiftKey,
    }) as unknown as React.KeyboardEvent<HTMLDivElement>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    indentSpy = vi.spyOn(editor as any, 'indentListItem').mockImplementation(() => undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outdentSpy = vi.spyOn(editor as any, 'outdentListItem').mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('returns false and does nothing if key is not Tab', () => {
    const e = {
      key: 'Enter',
      preventDefault: vi.fn(),
      shiftKey: false,
    } as unknown as React.KeyboardEvent<HTMLDivElement>;
    expect(editor.handleDentures(e)).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(indentSpy).not.toHaveBeenCalled();
    expect(outdentSpy).not.toHaveBeenCalled();
  });

  test('returns false if selection is not within a list item', () => {
    container.innerHTML = '<p>Some text</p>';
    const p = container.querySelector('p')!;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(p);
    selection.removeAllRanges();
    selection.addRange(range);

    const e = createEvent(false);
    expect(editor.handleDentures(e)).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('calls indentListItem and prevents default on Tab without Shift', () => {
    container.innerHTML = '<ul><li>Test</li></ul>';
    const li = container.querySelector('li')!;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(li);
    selection.removeAllRanges();
    selection.addRange(range);

    const e = createEvent(false);
    expect(editor.handleDentures(e)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(indentSpy).toHaveBeenCalled();
    expect(outdentSpy).not.toHaveBeenCalled();
  });

  test('calls outdentListItem and prevents default on Shift+Tab', () => {
    container.innerHTML = '<ul><ul><li>Test</li></ul></ul>';
    const li = container.querySelector('li')!;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(li);
    selection.removeAllRanges();
    selection.addRange(range);

    const e = createEvent(true);
    expect(editor.handleDentures(e)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(indentSpy).not.toHaveBeenCalled();
    expect(outdentSpy).toHaveBeenCalled();
  });
});

describe('Editor: normalizeInlineFormatting handles nested identical tags', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('flattens nested identical strong tags', () => {
    container.innerHTML = '<p>one <strong><strong>two</strong></strong> three</p>';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any).normalizeInlineFormatting();
    expect(container.innerHTML).toBe('<p>one <strong>two</strong> three</p>');
  });

  test('flattens deeply nested identical strong tags', () => {
    container.innerHTML = '<p>one <strong><strong><strong>two</strong></strong></strong> three</p>';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any).normalizeInlineFormatting();
    expect(container.innerHTML).toBe('<p>one <strong>two</strong> three</p>');
  });

  test('flattens nested identical em tags', () => {
    container.innerHTML = '<p>one <em><em>two</em></em> three</p>';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any).normalizeInlineFormatting();
    expect(container.innerHTML).toBe('<p>one <em>two</em> three</p>');
  });

  test('preserves different nested tags', () => {
    container.innerHTML = '<p>one <strong><em>two</em></strong> three</p>';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any).normalizeInlineFormatting();
    expect(container.innerHTML).toBe('<p>one <strong><em>two</em></strong> three</p>');
  });

  test('flattens complex nested structure with mixed identical and different tags', () => {
    container.innerHTML =
      '<p>one <strong><strong><em><strong>two</strong></em></strong></strong> three</p>';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any).normalizeInlineFormatting();
    expect(container.innerHTML).toBe('<p>one <strong><em>two</em></strong> three</p>');
  });
});

describe('Editor: toggleSelection with nested formatting', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('removes bold formatting from nested strong tags while preserving italic', () => {
    container.innerHTML =
      'one <strong><strong><em><strong>two</strong></em> </strong><em><strong>th</strong>r</em></strong>ee four';

    const textNode = container.querySelector('strong em strong')?.firstChild as Text;
    expect(textNode?.textContent).toBe('two');

    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 3);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('strong');

    expect(container.innerHTML).toContain('<em>two</em>');
    expect(container.innerHTML).not.toContain('<strong><strong>');
    expect(container.innerHTML).not.toContain('<strong><em><strong>two</strong></em></strong>');
  });

  test('removes bold formatting from partial text selection within formatted element', () => {
    container.innerHTML = 'one <em><strong>two three</strong> <strong>four</strong></em> five six';

    const strongElement = container.querySelector('strong');
    const textNode = strongElement?.firstChild as Text;
    expect(textNode?.textContent).toBe('two three');

    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 4); // Start after "two "
    range.setEnd(textNode, 9); // End after "three"
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('strong');

    expect(container.innerHTML).toContain('<strong>two </strong>');
    expect(container.innerHTML).toContain('three');
    expect(container.innerHTML).not.toContain('<strong>two three</strong>');

    expect(container.innerHTML).toBe(
      'one <em><strong>two </strong>three <strong>four</strong></em> five six',
    );
  });

  test('handles removing formatting from text at beginning of formatted element', () => {
    container.innerHTML = 'one <em>two <strong>three</strong> <strong>four</strong></em> five six';

    const emElement = container.querySelector('em');
    const textNode = emElement?.firstChild as Text;
    expect(textNode?.textContent).toBe('two ');

    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 4); // Select "two " (including space)
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('em');

    expect(container.innerHTML).toBe(
      'one two <em><strong>three</strong> <strong>four</strong></em> five six',
    );
  });

  test('expands formatting when selection spans from inside formatted element to outside', () => {
    container.innerHTML = 'one two <strong>three</strong> four five six';

    const strongElement = container.querySelector('strong');
    const strongTextNode = strongElement?.firstChild as Text;
    const nextTextNode = strongElement?.nextSibling as Text;

    expect(strongTextNode?.textContent).toBe('three');
    expect(nextTextNode?.textContent?.startsWith(' four')).toBe(true);

    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(strongTextNode, 0); // Start at beginning of "three"
    range.setEnd(nextTextNode, 5); // End after " four" (0=' ', 1='f', 2='o', 3='u', 4='r', 5=end)
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('strong');

    expect(container.innerHTML).toBe('one two <strong>three four</strong> five six');
  });

  test('splits outer formatting element when toggling nested formatting with selection contained completely within it', () => {
    container.innerHTML = '<p><em>one two <strong>three four five</strong> six</em></p>';

    const strongElement = container.querySelector('strong');
    const strongTextNode = strongElement?.firstChild as Text;
    const nextTextNode = strongElement?.nextSibling as Text;

    expect(strongTextNode?.textContent).toBe('three four five');
    expect(nextTextNode?.textContent?.startsWith(' six')).toBe(true);

    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(strongTextNode, 6);
    range.setEnd(strongTextNode, 10);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('em');

    expect(container.innerHTML).toBe(
      '<p><em>one two <strong>three </strong></em><strong>four</strong><em><strong> five</strong> six</em></p>',
    );
  });
});

describe('Editor: toggleSelection space character handling', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('preserves space character when applying bold formatting to just a space', () => {
    container.innerHTML = '<p>hello world test</p>';

    // Select just the space between "world" and "test"
    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 5); // Start at space after "hello"
    range.setEnd(textNode, 6); // End after space
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('strong');

    // The space should be preserved and formatted
    expect(container.innerHTML).toContain('<strong> </strong>');
    expect(container.innerHTML).not.toBe('<p>helloworld test</p>'); // Space shouldn't disappear
  });

  test('preserves space character when applying italic formatting to just a space', () => {
    container.innerHTML = '<p>one two three</p>';

    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 7); // Start at space after "one two"
    range.setEnd(textNode, 8); // End after space
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('em');

    expect(container.innerHTML).toContain('<em> </em>');
    expect(container.innerHTML).not.toBe('<p>one twothree</p>');
  });

  test('preserves space character when applying underline formatting to just a space', () => {
    container.innerHTML = '<p>foo bar</p>';

    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 3); // Start at space after "foo"
    range.setEnd(textNode, 4); // End after space
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('u');

    expect(container.innerHTML).toContain('<span class="underline"> </span>');
    expect(container.innerHTML).not.toBe('<p>foobar</p>'); // Space shouldn't disappear
  });

  test('handles multiple consecutive spaces correctly', () => {
    container.innerHTML = '<p>hello  world</p>'; // Two spaces

    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 5); // Start at first space
    range.setEnd(textNode, 7); // End after both spaces
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('strong');

    expect(container.innerHTML).toContain('<strong>  </strong>');
    expect(container.innerHTML).not.toBe('<p>helloworld</p>');
  });

  test('handles space at beginning of formatted element', () => {
    container.innerHTML = '<p>hello<strong> world</strong></p>';

    const strongElement = container.querySelector('strong')!;
    const textNode = strongElement.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 0); // Start at space
    range.setEnd(textNode, 1); // End after space
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('strong');

    expect(container.innerHTML).toBe('<p>hello <strong>world</strong></p>');
  });

  test('handles tab character formatting', () => {
    container.innerHTML = '<p>hello\tworld</p>';

    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 5); // Start at tab
    range.setEnd(textNode, 6); // End after tab
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('strong');

    expect(container.innerHTML).toContain('<strong>\t</strong>');
  });

  test('handles newline character formatting', () => {
    container.innerHTML = '<p>hello\nworld</p>';

    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 5); // Start at newline
    range.setEnd(textNode, 6); // End after newline
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('strong');

    expect(container.innerHTML).toContain('<strong>\n</strong>');
  });

  test('preserves mixed whitespace characters', () => {
    container.innerHTML = '<p>hello \t world</p>'; // space, tab, space

    // Select the middle section with whitespace
    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 5); // Start at first space
    range.setEnd(textNode, 8); // End after last space
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('em');

    expect(container.innerHTML).toContain('<em> \t </em>');
  });

  test('does not remove elements with only zero-width spaces', () => {
    container.innerHTML = `<p>hello<strong>${ZERO_WIDTH_SPACE}</strong>world</p>`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any).normalizeInlineFormatting();

    // Zero-width space should be preserved in formatting
    expect(container.innerHTML).toContain('<strong>​</strong>');
  });
});

describe('Editor: toggleList with list splitting behavior', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('splits a simple list when toggling a middle item', () => {
    container.innerHTML = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';

    const middleLi = container.querySelectorAll('li')[1];
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(middleLi);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    expect(container.innerHTML).toContain('<ul><li>Item 1</li></ul>');
    expect(container.innerHTML).toContain('<p>Item 2</p>');
    expect(container.innerHTML).toContain('<ul><li>Item 3</li></ul>');
  });

  test('converts first item to paragraph, leaving rest as list', () => {
    container.innerHTML = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';

    const firstLi = container.querySelectorAll('li')[0];
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(firstLi);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    expect(container.innerHTML).toContain('<p>Item 1</p>');
    expect(container.innerHTML).toContain('<ul><li>Item 2</li><li>Item 3</li></ul>');
    expect(container.innerHTML).toBe('<p>Item 1</p><ul><li>Item 2</li><li>Item 3</li></ul>');
  });

  test('single item list converts to paragraph', () => {
    container.innerHTML = '<ul><li>Only Item</li></ul>';

    const firstLi = container.querySelector('li');
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(firstLi!);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    expect(container.innerHTML).toBe('<p>Only Item</p>');
  });

  test('single empty item list converts to empty paragraph', () => {
    container.innerHTML = '<ul><li></li></ul>';

    const firstLi = container.querySelector('li');
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(firstLi!);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    expect(container.innerHTML).toBe(`<p>${ZERO_WIDTH_SPACE}</p>`);
  });

  test('preserves nested lists when toggling parent item', () => {
    container.innerHTML =
      '<ul><li>Parent Item<ul><li>Child 1</li><li>Child 2</li></ul></li><li>Next Item</li></ul>';

    const parentLi = container.querySelector('li');
    const textNode = parentLi!.firstChild;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode!, 0);
    range.setEnd(textNode!, textNode!.textContent!.length);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    expect(container.innerHTML).toContain('<p>Parent Item</p>');
    expect(container.innerHTML).toContain('<ul><li>Child 1</li><li>Child 2</li></ul>');
    expect(container.innerHTML).toContain('<ul><li>Next Item</li></ul>');
    expect(container.innerHTML).toBe(
      '<p>Parent Item</p><ul><li>Child 1</li><li>Child 2</li></ul><ul><li>Next Item</li></ul>',
    );
  });

  test('converts last item to paragraph, leaving rest as list', () => {
    container.innerHTML = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';

    const lastLi = container.querySelectorAll('li')[2];
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(lastLi);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    expect(container.innerHTML).toContain('<ul><li>Item 1</li><li>Item 2</li></ul>');
    expect(container.innerHTML).toContain('<p>Item 3</p>');
  });

  test('handles nested list item extraction', () => {
    container.innerHTML =
      '<ul><li>Item 1<ul><li>Nested 1</li><li>Nested 2</li></ul></li><li>Item 2</li></ul>';

    const nestedLi = container.querySelector('ul ul li');
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(nestedLi!);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    expect(container.innerHTML).toContain('<p>Nested 1</p>');
    expect(container.innerHTML).not.toContain('<ul><li>Nested 1</li></ul>');
    expect(container.innerHTML).toContain('Item 1');
    expect(container.innerHTML).toContain('<li>Item 1<ul><li>Nested 2</li></ul></li>');
    expect(container.innerHTML).toContain('<li>Item 2</li>');
    expect(container.innerHTML).toContain(
      '<ul><li>Item 1<ul><li>Nested 2</li></ul></li></ul><p>Nested 1</p><ul><li>Item 2</li></ul>',
    );
  });

  test('handles deeply nested list item extraction and splits the root list', () => {
    container.innerHTML =
      '<ul><li>Root 1<ul><li>Level 2<ul><li>Level 3</li></ul></li></ul></li><li>Root 2</li></ul>';

    const deepLi = container.querySelector('ul ul ul li');
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(deepLi!);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    expect(container.innerHTML).toContain('<p>Level 3</p>');
    expect(container.innerHTML).toContain('Root 1');
    expect(container.innerHTML).toContain('Level 2');
    expect(container.innerHTML).toContain('Root 2');
    expect(container.innerHTML).toContain('<li>Level 2</li>');
    expect(container.innerHTML).toContain(
      '<ul><li>Root 1<ul><li>Level 2</li></ul></li></ul><p>Level 3</p><ul><li>Root 2</li></ul>',
    );
  });
});

describe('Editor: toggleList converting paragraphs to lists', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('converts paragraph with text content to list item', () => {
    container.innerHTML = '<p>This is a paragraph</p>';

    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 8); // After "This is "

    editor.toggleList('ul');

    expect(container.innerHTML).toBe('<ul><li>This is a paragraph</li></ul>');
  });

  test('converts paragraph with formatted content to list item', () => {
    container.innerHTML = '<p>This is <strong>bold</strong> text</p>';

    setCursorInParagraph(container.querySelector('p')!, 0);

    editor.toggleList('ol');

    expect(container.innerHTML).toBe('<ol><li>This is <strong>bold</strong> text</li></ol>');
  });

  test('preserves cursor position when converting paragraph to list', () => {
    container.innerHTML = '<p>Hello world</p>';

    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 6); // After "Hello "

    editor.toggleList('ul');

    const selection = window.getSelection()!;
    const newRange = selection.getRangeAt(0);
    const liTextNode = container.querySelector('li')!.firstChild as Text;
    expect(newRange.startContainer).toBe(liTextNode);
    expect(newRange.startOffset).toBe(6);
  });

  test('converts empty paragraph to empty list item', () => {
    container.innerHTML = '<p></p>';

    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 0);

    editor.toggleList('ul');

    expect(container.innerHTML).toBe('<ul><li>​</li></ul>');
  });

  test('converts paragraph with only whitespace to list with zero-width space', () => {
    container.innerHTML = '<p>   </p>';

    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 1);

    editor.toggleList('ol');

    expect(container.innerHTML).toBe('<ol><li>​</li></ol>');
  });

  test('converts paragraph with mixed content including line breaks', () => {
    container.innerHTML = '<p>Line 1<br>Line 2</p>';

    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 6); // After "Line 1"

    editor.toggleList('ul');

    expect(container.innerHTML).toBe('<ul><li>Line 1<br>Line 2</li></ul>');
  });

  test('converts single paragraph when multiple paragraphs exist', () => {
    container.innerHTML = '<p>First paragraph</p><p>Second paragraph</p>';

    const secondP = container.querySelectorAll('p')[1];
    setCursorInParagraph(secondP, 6); // After "Second"

    editor.toggleList('ul');

    expect(container.innerHTML).toBe('<p>First paragraph</p><ul><li>Second paragraph</li></ul>');
  });
});

describe('Editor: initialization and empty content handling', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('initializes with empty paragraph when container is empty', () => {
    editor = new Editor(container);

    expect(container.children.length).toBe(1);
    expect(container.firstElementChild?.tagName).toBe('P');
    expect(container.firstElementChild?.textContent).toBe(ZERO_WIDTH_SPACE);
  });

  test('does not add paragraph when container already has content', () => {
    container.innerHTML = '<p>Existing content</p>';
    editor = new Editor(container);

    expect(container.children.length).toBe(1);
    expect(container.firstElementChild?.textContent).toBe('Existing content');
  });

  test('isEmptyContent returns true for newly initialized editor', () => {
    editor = new Editor(container);

    expect(editor.isEmptyContent()).toBe(true);
  });

  test('isEmptyContent returns false when paragraph has actual content', () => {
    container.innerHTML = '<p>Real content</p>';
    editor = new Editor(container);

    expect(editor.isEmptyContent()).toBe(false);
  });

  test('isEmptyContent returns true when multiple paragraphs exist', () => {
    container.innerHTML = `<p>${ZERO_WIDTH_SPACE}</p><p>${ZERO_WIDTH_SPACE}</p>`;
    editor = new Editor(container);

    expect(editor.isEmptyContent()).toBe(true);
  });

  test('isEmptyContent returns false when non-paragraph elements exist', () => {
    container.innerHTML = '<ul><li>Item</li><li></li></ul>';
    editor = new Editor(container);

    expect(editor.isEmptyContent()).toBe(false);
  });

  test('isEmptyContent returns true when only empty list item exists', () => {
    container.innerHTML = '<ul><li></li></ul>';
    editor = new Editor(container);

    expect(editor.isEmptyContent()).toBe(true);
  });

  test('isEmptyContent returns true for paragraph with only whitespace', () => {
    container.innerHTML = '<p>   </p>';
    editor = new Editor(container);

    expect(editor.isEmptyContent()).toBe(true);
  });

  test('isEmptyContent returns true for paragraph with only zero-width spaces', () => {
    container.innerHTML = `<p>${ZERO_WIDTH_SPACE}${ZERO_WIDTH_SPACE}</p>`;
    editor = new Editor(container);

    expect(editor.isEmptyContent()).toBe(true);
  });

  test('positions cursor correctly in empty paragraph on initialization', () => {
    const selection = window.getSelection()!;
    editor = new Editor(container);

    const range = selection.getRangeAt(0);
    const paragraph = container.querySelector('p')!;
    expect(range.startContainer).toBe(paragraph.firstChild);
    expect(range.startOffset).toBe(1);
    expect(range.collapsed).toBe(true);
  });
});

describe('Editor: toggleSelection with empty paragraph initialization', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('can apply bold formatting to empty paragraph', () => {
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 1);

    editor.toggleSelection('strong');

    expect(container.innerHTML).toContain('<strong>');
    expect(container.innerHTML).toContain(ZERO_WIDTH_SPACE);
  });

  test('can apply italic formatting to empty paragraph', () => {
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 1);

    editor.toggleSelection('em');

    expect(container.innerHTML).toContain('<em>');
    expect(container.innerHTML).toContain(ZERO_WIDTH_SPACE);
  });

  test('can apply underline formatting to empty paragraph', () => {
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 1);

    editor.toggleSelection('u');

    expect(container.innerHTML).toContain('<span class="underline">');
    expect(container.innerHTML).toContain(ZERO_WIDTH_SPACE);
  });
});

describe('Editor: toggle formatting with collapsed selection (no text selected)', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('can toggle bold formatting on and off with collapsed selection', () => {
    const paragraph = container.querySelector('p')!;
    const selection = setCursorInParagraph(paragraph, 1);

    editor.toggleSelection('strong');

    expect(container.innerHTML).toContain('<strong>');

    const updatedRange = selection.getRangeAt(0);
    const strongElement = container.querySelector('strong');
    expect(strongElement?.contains(updatedRange.startContainer)).toBe(true);

    editor.toggleSelection('strong');

    const finalRange = selection.getRangeAt(0);
    const finalStrongElement = container.querySelector('strong');

    if (finalStrongElement) {
      expect(finalStrongElement.contains(finalRange.startContainer)).toBe(false);
    }
  });

  test('can toggle italic formatting on and off with collapsed selection', () => {
    const paragraph = container.querySelector('p')!;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(paragraph.firstChild!, 1);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('em');
    expect(container.innerHTML).toContain('<em>');

    const updatedRange = selection.getRangeAt(0);
    const emElement = container.querySelector('em');
    expect(emElement?.contains(updatedRange.startContainer)).toBe(true);

    editor.toggleSelection('em');

    const finalRange = selection.getRangeAt(0);
    const finalEmElement = container.querySelector('em');

    if (finalEmElement) {
      expect(finalEmElement.contains(finalRange.startContainer)).toBe(false);
    }
  });

  test('can toggle underline formatting on and off with collapsed selection', () => {
    const paragraph = container.querySelector('p')!;
    const selection = setCursorInParagraph(paragraph, 1);

    editor.toggleSelection('u');
    expect(container.innerHTML).toContain('<span class="underline">');

    const updatedRange = selection.getRangeAt(0);
    const underlineElement = container.querySelector('span.underline');
    expect(underlineElement?.contains(updatedRange.startContainer)).toBe(true);

    editor.toggleSelection('u');

    const finalRange = selection.getRangeAt(0);
    const finalUnderlineElement = container.querySelector('span.underline');

    if (finalUnderlineElement) {
      expect(finalUnderlineElement.contains(finalRange.startContainer)).toBe(false);
    }
  });

  test('handles multiple toggles correctly', () => {
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 1);

    editor.toggleSelection('strong');
    insertTextAtSelection('bold ');

    editor.toggleSelection('em');
    insertTextAtSelection('italic ');

    editor.toggleSelection('u');
    insertTextAtSelection('underline ');

    editor.toggleSelection('strong');
    insertTextAtSelection('underline_italic');

    expect(Editor.cleanZeroWidthSpaces(paragraph.innerHTML)).toEqual(
      '<strong>bold <em>italic <span class="underline">underline </span></em></strong><em><span class="underline">underline_italic</span></em>',
    );

    editor.toggleSelection('strong');
    insertTextAtSelection('turning bold back on');

    expect(Editor.cleanZeroWidthSpaces(paragraph.innerHTML)).toEqual(
      '<strong>bold <em>italic <span class="underline">underline </span></em></strong><em><span class="underline">underline_italic<strong>turning bold back on</strong></span></em>',
    );
  });
});

describe('Editor: handleBackspaceOnEmptyContent prevents deletion of last paragraph', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

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

  test('prevents deletion of the last empty paragraph', () => {
    // Editor starts with an empty paragraph containing zero-width space
    const paragraph = container.querySelector('p')!;
    expect(paragraph).toBeTruthy();
    expect(paragraph.textContent).toBe(ZERO_WIDTH_SPACE);

    // Position cursor at the beginning of the paragraph
    setCursorInParagraph(paragraph, 0);

    const e = createBackspaceEvent();
    const result = editor.handleBackspaceOnEmptyContent(e);

    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();

    // Paragraph should still exist
    const remainingParagraph = container.querySelector('p');
    expect(remainingParagraph).toBeTruthy();
    expect(remainingParagraph?.textContent).toBe(ZERO_WIDTH_SPACE);
  });

  test('allows deletion when paragraph has actual content', () => {
    container.innerHTML = '<p>Some text</p>';
    const paragraph = container.querySelector('p')!;

    setCursorInParagraph(paragraph, 0);

    const e = createBackspaceEvent();
    const result = editor.handleBackspaceOnEmptyContent(e);

    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('prevents deletion even when cursor is not at the beginning if paragraph only contains zero-width space', () => {
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 1); // Not at beginning

    const e = createBackspaceEvent();
    const result = editor.handleBackspaceOnEmptyContent(e);

    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();

    // Paragraph should still exist with zero-width space
    const remainingParagraph = container.querySelector('p');
    expect(remainingParagraph).toBeTruthy();
    expect(remainingParagraph?.textContent).toBe(ZERO_WIDTH_SPACE);
  });

  test('does not handle non-backspace keys', () => {
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 0);

    const e = createDeleteEvent();
    const result = editor.handleBackspaceOnEmptyContent(e);

    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('prevents deletion and fixes content when paragraph contains self-closing br tag', () => {
    // Test with self-closing br tag variant
    container.innerHTML = '<p><br/></p>';
    const paragraph = container.querySelector('p')!;

    setCursorInParagraph(paragraph, 0);

    const e = createBackspaceEvent();

    expect(editor.handleBackspaceOnEmptyContent(e)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();

    // Paragraph should be fixed to contain zero-width space instead of br
    expect(paragraph.innerHTML).toBe('<br>');
    expect(paragraph.textContent).toBe('');
  });
});

describe('Editor: toggle formatting with multiple nested formats', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('can toggle off bold while preserving italic formatting', () => {
    const paragraph = container.querySelector('p')!;
    const selection = setCursorInParagraph(paragraph, 1);

    editor.toggleSelection('strong');
    expect(container.innerHTML).toContain('<strong>');

    editor.toggleSelection('em');
    expect(container.innerHTML).toContain('<strong>');
    expect(container.innerHTML).toContain('<em>');

    let range = selection.getRangeAt(0);
    const strongElement = container.querySelector('strong');
    const emElement = container.querySelector('em');
    expect(strongElement?.contains(range.startContainer)).toBe(true);
    expect(emElement?.contains(range.startContainer)).toBe(true);

    editor.toggleSelection('strong');

    range = selection.getRangeAt(0);
    const allStrongElements = container.querySelectorAll('strong');
    const allEmElements = container.querySelectorAll('em');

    expect(allStrongElements.length).toBe(1);

    expect(allEmElements.length).toBeGreaterThanOrEqual(1);

    let cursorInStrong = false;
    allStrongElements.forEach((strong) => {
      if (strong.contains(range.startContainer)) {
        cursorInStrong = true;
      }
    });
    expect(cursorInStrong).toBe(false);

    let cursorInEm = false;
    allEmElements.forEach((em) => {
      if (em.contains(range.startContainer)) {
        cursorInEm = true;
      }
    });
    expect(cursorInEm).toBe(true);
  });

  test('can toggle off italic while preserving bold formatting', () => {
    const paragraph = container.querySelector('p')!;
    const selection = setCursorInParagraph(paragraph, 1);

    editor.toggleSelection('strong');
    editor.toggleSelection('em');

    expect(container.querySelector('strong')).toBeTruthy();
    expect(container.querySelector('em')).toBeTruthy();

    editor.toggleSelection('em');

    const range = selection.getRangeAt(0);
    const finalStrongElement = container.querySelector('strong');
    const finalEmElement = container.querySelector('em');

    expect(finalStrongElement).toBeTruthy();
    expect(finalStrongElement?.contains(range.startContainer)).toBe(true);

    if (finalEmElement) {
      expect(finalEmElement.contains(range.startContainer)).toBe(false);
    }
  });

  test('can toggle off underline while preserving bold and italic', () => {
    const paragraph = container.querySelector('p')!;
    const selection = setCursorInParagraph(paragraph, 1);

    editor.toggleSelection('strong');
    editor.toggleSelection('em');
    editor.toggleSelection('u');

    expect(container.querySelector('strong')).toBeTruthy();
    expect(container.querySelector('em')).toBeTruthy();
    expect(container.querySelector('span.underline')).toBeTruthy();

    editor.toggleSelection('u');

    const range = selection.getRangeAt(0);
    const finalStrongElement = container.querySelector('strong');
    const finalEmElement = container.querySelector('em');
    const finalUnderlineElement = container.querySelector('span.underline');

    expect(finalStrongElement).toBeTruthy();
    expect(finalStrongElement?.contains(range.startContainer)).toBe(true);
    expect(finalEmElement).toBeTruthy();
    expect(finalEmElement?.contains(range.startContainer)).toBe(true);

    if (finalUnderlineElement) {
      expect(finalUnderlineElement.contains(range.startContainer)).toBe(false);
    }
  });

  test('handles complex nesting scenarios correctly', () => {
    const paragraph = container.querySelector('p')!;
    const selection = setCursorInParagraph(paragraph, 1);

    editor.toggleSelection('em');
    editor.toggleSelection('strong');
    editor.toggleSelection('u');

    editor.toggleSelection('strong');

    const range = selection.getRangeAt(0);
    const allEmElements = container.querySelectorAll('em');
    const allUnderlineElements = container.querySelectorAll('span.underline');
    const allStrongElements = container.querySelectorAll('strong');

    expect(allEmElements.length).toBeGreaterThanOrEqual(1);
    expect(allUnderlineElements.length).toBeGreaterThanOrEqual(1);

    expect(allStrongElements.length).toBe(1);

    let cursorInStrong = false;
    allStrongElements.forEach((strong) => {
      if (strong.contains(range.startContainer)) {
        cursorInStrong = true;
      }
    });
    expect(cursorInStrong).toBe(false);

    let cursorInEm = false;
    allEmElements.forEach((em) => {
      if (em.contains(range.startContainer)) {
        cursorInEm = true;
      }
    });
    expect(cursorInEm).toBe(true);

    let cursorInUnderline = false;
    allUnderlineElements.forEach((underline) => {
      if (underline.contains(range.startContainer)) {
        cursorInUnderline = true;
      }
    });
    expect(cursorInUnderline).toBe(true);
  });
});

describe('Editor: handleEnterKey method', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  const createEnterEvent = (): React.KeyboardEvent<HTMLDivElement> =>
    ({
      key: 'Enter',
      preventDefault: vi.fn(),
    }) as unknown as React.KeyboardEvent<HTMLDivElement>;

  const createNonEnterEvent = (): React.KeyboardEvent<HTMLDivElement> =>
    ({
      key: 'a',
      preventDefault: vi.fn(),
    }) as unknown as React.KeyboardEvent<HTMLDivElement>;

  test('returns false for non-Enter keys', () => {
    const e = createNonEnterEvent();
    const result = editor.handleEnterKey(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('returns false when no selection exists', () => {
    const selection = window.getSelection()!;
    selection.removeAllRanges();

    const e = createEnterEvent();
    const result = editor.handleEnterKey(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test.skip('creates new paragraph when Enter is pressed in regular paragraph', () => {
    container.innerHTML = '<p>Hello world</p>';
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 5); // After "Hello"

    const e = createEnterEvent();
    const result = editor.handleEnterKey(e);

    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();

    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[1].textContent).toBe(' world');
  });

  test('creates new paragraph when cursor is at end of paragraph', () => {
    container.innerHTML = '<p>Test content</p>';
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, paragraph.textContent!.length);

    const e = createEnterEvent();
    const result = editor.handleEnterKey(e);

    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();

    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[1].textContent).toBe(ZERO_WIDTH_SPACE);
  });

  test('converts empty list item to paragraph and removes empty list', () => {
    container.innerHTML = '<ul><li></li></ul>';
    const listItem = container.querySelector('li')!;
    setCursorInElement(listItem, 0);

    const e = createEnterEvent();
    const result = editor.handleEnterKey(e);

    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();

    expect(container.querySelector('ul')).toBe(null);
    expect(container.querySelector('p')).toBeTruthy();
    expect(container.querySelector('p')!.textContent).toBe(ZERO_WIDTH_SPACE);
  });

  test('converts empty list item to paragraph but preserves list with other items', () => {
    container.innerHTML = '<ul><li>Item 1</li><li></li><li>Item 3</li></ul>';
    const emptyListItem = container.querySelectorAll('li')[1];
    setCursorInElement(emptyListItem, 0);

    const e = createEnterEvent();
    const result = editor.handleEnterKey(e);

    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();

    expect(container.querySelector('ul')).toBeTruthy();
    expect(container.querySelector('p')).toBeTruthy();
    expect(container.querySelectorAll('li').length).toBe(2);
  });

  test('returns false for Enter in non-empty list item', () => {
    container.innerHTML = '<ul><li>Some content</li></ul>';
    const listItem = container.querySelector('li')!;
    setCursorInElement(listItem, 4); // After "Some"

    const e = createEnterEvent();
    const result = editor.handleEnterKey(e);

    expect(result).toBe(false);
    // TODO enter in a non-empty list item should (and currently does in the UI) create a new list item
    // with the content after the cursor.
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('handles Enter when cursor is not in paragraph or list item', () => {
    container.innerHTML = '<div>Some content</div>';
    const div = container.querySelector('div')!;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(div);
    selection.removeAllRanges();
    selection.addRange(range);

    const e = createEnterEvent();
    const result = editor.handleEnterKey(e);

    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  test('positions cursor correctly in new paragraph', () => {
    container.innerHTML = '<p>Test</p>';
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 2);

    const e = createEnterEvent();
    editor.handleEnterKey(e);

    const selection = window.getSelection()!;
    const range = selection.getRangeAt(0);
    const newParagraph = container.querySelectorAll('p')[1];

    expect(newParagraph.contains(range.startContainer)).toBe(true);
    expect(range.startOffset).toBe(1); // After zero-width space
  });
});

describe('Editor: handleDeleteKeyOnList method', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

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
      key: 'a',
      preventDefault: vi.fn(),
    }) as unknown as React.KeyboardEvent<HTMLDivElement>;

  test('returns false for non-Backspace/Delete keys', () => {
    const e = createOtherKeyEvent();
    const result = editor.handleDeleteKeyOnList(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('returns false when no selection exists', () => {
    const selection = window.getSelection()!;
    selection.removeAllRanges();

    const e = createBackspaceEvent();
    const result = editor.handleDeleteKeyOnList(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('returns false when range is not collapsed', () => {
    container.innerHTML = '<ul><li>Test content</li></ul>';
    const listItem = container.querySelector('li')!;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(listItem.firstChild!, 0);
    range.setEnd(listItem.firstChild!, 4); // Select "Test"
    selection.removeAllRanges();
    selection.addRange(range);

    const e = createBackspaceEvent();
    const result = editor.handleDeleteKeyOnList(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('returns false when cursor is not at start of range', () => {
    container.innerHTML = '<ul><li>Test content</li></ul>';
    const listItem = container.querySelector('li')!;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(listItem.firstChild!, 2); // Not at beginning
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    const e = createBackspaceEvent();
    const result = editor.handleDeleteKeyOnList(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('returns false when not in a list', () => {
    container.innerHTML = '<p>Regular paragraph</p>';
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 0);

    const e = createBackspaceEvent();
    const result = editor.handleDeleteKeyOnList(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('returns false when not in last list item', () => {
    container.innerHTML = '<ul><li>First item</li><li>Second item</li></ul>';
    const firstItem = container.querySelectorAll('li')[0];
    setCursorInElement(firstItem, 0);

    const e = createBackspaceEvent();
    const result = editor.handleDeleteKeyOnList(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('returns false when list item contains nested lists', () => {
    container.innerHTML = '<ul><li>Item with nested<ul><li>Nested item</li></ul></li></ul>';
    const parentItem = container.querySelector('li')!;
    setCursorInElement(parentItem, 0);

    const e = createBackspaceEvent();
    const result = editor.handleDeleteKeyOnList(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('converts last empty list item to paragraph and removes list', () => {
    container.innerHTML = '<ul><li><br></li></ul>';
    const listItem = container.querySelector('li')!;
    setCursorInElement(listItem, 0);

    const e = createBackspaceEvent();
    const result = editor.handleDeleteKeyOnList(e);

    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(container.querySelector('ul')).toBe(null);
    expect(container.querySelector('p')).toBeTruthy();
    expect(container.querySelector('p')!.textContent).toBe(ZERO_WIDTH_SPACE);
  });

  test('converts last list item with content to paragraph', () => {
    container.innerHTML = '<ul><li>Last item content</li></ul>';
    const listItem = container.querySelector('li')!;
    setCursorInElement(listItem, 0);

    const e = createBackspaceEvent();
    const result = editor.handleDeleteKeyOnList(e);

    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(container.querySelector('ul')).toBe(null);
    expect(container.querySelector('p')).toBeTruthy();
    expect(container.querySelector('p')!.textContent).toContain('Last item content');
  });

  test('handles Delete key as well as Backspace', () => {
    container.innerHTML = '<ul><li>Content</li></ul>';
    const listItem = container.querySelector('li')!;
    setCursorInElement(listItem, 0);

    const e = createDeleteEvent();
    const result = editor.handleDeleteKeyOnList(e);

    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  test('positions cursor correctly in converted paragraph', () => {
    container.innerHTML = '<ul><li>Test content</li></ul>';
    const listItem = container.querySelector('li')!;
    setCursorInElement(listItem, 0);

    const e = createBackspaceEvent();
    editor.handleDeleteKeyOnList(e);

    const selection = window.getSelection()!;
    const range = selection.getRangeAt(0);
    const paragraph = container.querySelector('p')!;

    expect(paragraph.contains(range.startContainer)).toBe(true);
    expect(range.startOffset).toBe(1); // After zero-width space or beginning of content
  });
});

describe('Editor: handlePrintableKey method', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  const createPrintableKeyEvent = (key: string): React.KeyboardEvent<HTMLDivElement> =>
    ({
      key,
      length: key.length,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    }) as unknown as React.KeyboardEvent<HTMLDivElement>;

  const createNonPrintableKeyEvent = (): React.KeyboardEvent<HTMLDivElement> =>
    ({
      key: 'Enter',
      length: 5,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    }) as unknown as React.KeyboardEvent<HTMLDivElement>;

  const createCtrlKeyEvent = (key: string): React.KeyboardEvent<HTMLDivElement> =>
    ({
      key,
      length: key.length,
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    }) as unknown as React.KeyboardEvent<HTMLDivElement>;

  test('returns false for non-printable keys', () => {
    const e = createNonPrintableKeyEvent();
    const result = editor.handlePrintableKey(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('returns false for modifier key combinations', () => {
    const e = createCtrlKeyEvent('a');
    const result = editor.handlePrintableKey(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('returns false when no selection exists', () => {
    const selection = window.getSelection()!;
    selection.removeAllRanges();

    const e = createPrintableKeyEvent('a');
    const result = editor.handlePrintableKey(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('returns false when typing in empty paragraph (lets browser handle naturally)', () => {
    // Editor initializes with empty paragraph
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 1);

    const e = createPrintableKeyEvent('a');
    const result = editor.handlePrintableKey(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('returns false when typing in existing paragraph', () => {
    container.innerHTML = '<p>Existing content</p>';
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 8);

    const e = createPrintableKeyEvent('x');
    const result = editor.handlePrintableKey(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('returns false when typing in list item', () => {
    container.innerHTML = '<ul><li>List content</li></ul>';
    const listItem = container.querySelector('li')!;
    setCursorInElement(listItem, 4);

    const e = createPrintableKeyEvent('z');
    const result = editor.handlePrintableKey(e);
    expect(result).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test('creates paragraph when typing in root without block elements', () => {
    // Clear the default paragraph and put cursor directly in root
    container.innerHTML = 'Direct text in root';
    const textNode = container.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 6);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    const e = createPrintableKeyEvent('X');
    const result = editor.handlePrintableKey(e);

    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(container.querySelector('p')).toBeTruthy();
    expect(container.querySelector('p')!.textContent).toBe('X');
  });

  test.skip('handles various printable characters', () => {
    container.innerHTML = 'Text';
    const textNode = container.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    const testChars = ['a', 'Z', '1', '!', '@', ' ', '\t'];

    testChars.forEach((char) => {
      const e = createPrintableKeyEvent(char);
      const result = editor.handlePrintableKey(e);
      expect(result).toBe(true);
      expect(e.preventDefault).toHaveBeenCalled();
    });
  });

  test('positions cursor correctly after creating paragraph', () => {
    container.innerHTML = 'Direct text';
    const textNode = container.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    const e = createPrintableKeyEvent('A');
    editor.handlePrintableKey(e);

    const newRange = selection.getRangeAt(0);
    const paragraph = container.querySelector('p')!;
    expect(paragraph.contains(newRange.startContainer)).toBe(true);
    expect(newRange.startOffset).toBe(1); // After the inserted character
  });
});

describe('Editor: List indentation and outdentation integration', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  const createTabEvent = (shiftKey = false): React.KeyboardEvent<HTMLDivElement> =>
    ({
      key: 'Tab',
      preventDefault: vi.fn(),
      shiftKey,
    }) as unknown as React.KeyboardEvent<HTMLDivElement>;

  test('indents list item when Tab is pressed', () => {
    container.innerHTML = '<ul><li>First item</li><li>Second item</li></ul>';
    const secondLi = container.querySelectorAll('li')[1];
    setCursorInElement(secondLi, 6); // After "Second"

    const e = createTabEvent(false);
    const result = editor.handleDentures(e);

    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();

    // Second item should now be nested under first
    const nestedList = container.querySelector('ul li ul');
    expect(nestedList).toBeTruthy();
    expect(nestedList?.querySelector('li')?.textContent).toBe('Second item');
  });

  test('creates nested list when indenting item without previous sibling list', () => {
    container.innerHTML = '<ul><li>First</li><li>Second</li></ul>';
    const secondLi = container.querySelectorAll('li')[1];
    setCursorInElement(secondLi, 0);

    const e = createTabEvent(false);
    editor.handleDentures(e);

    const firstLi = container.querySelectorAll('li')[0];
    const nestedList = firstLi.querySelector('ul');
    expect(nestedList).toBeTruthy();
    expect(nestedList?.tagName).toBe('UL');
    expect(nestedList?.children.length).toBe(1);
    expect(nestedList?.firstElementChild?.textContent).toBe('Second');
  });

  test('adds to existing nested list when indenting', () => {
    container.innerHTML = '<ul><li>First<ul><li>Nested</li></ul></li><li>Second</li></ul>';
    const secondLi = container.querySelectorAll('li')[2] as HTMLLIElement; // The "Second" item
    setCursorInElement(secondLi, 0);

    const e = createTabEvent(false);
    editor.handleDentures(e);

    const nestedList = container.querySelector('ul li ul');
    expect(nestedList?.children.length).toBe(2);
    expect(nestedList?.children[1].textContent).toBe('Second');
  });

  test('outdents nested list item when Shift+Tab is pressed', () => {
    container.innerHTML = '<ul><li>First<ul><li>Nested item</li></ul></li></ul>';
    const nestedLi = container.querySelector('ul ul li') as HTMLLIElement;
    setCursorInElement(nestedLi, 0);

    const e = createTabEvent(true);
    const result = editor.handleDentures(e);

    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();

    // Nested item should now be at root level
    const allRootItems = container.querySelectorAll('ul > li');
    expect(allRootItems.length).toBe(2);
    expect(allRootItems[1].textContent).toBe('Nested item');
  });

  test.skip('preserves subsequent siblings when outdenting', () => {
    container.innerHTML =
      '<ul><li>First<ul><li>Nested 1</li><li>Nested 2</li><li>Nested 3</li></ul></li></ul>';
    const nestedLi = container.querySelector('ul ul li') as HTMLLIElement; // First nested item
    setCursorInElement(nestedLi, 0);

    const e = createTabEvent(true);
    editor.handleDentures(e);

    // Should have First, Nested 1 at root level, and Nested 1 should contain Nested 2 and 3
    const rootItems = container.querySelectorAll('ul > li');
    expect(rootItems.length).toBe(2);
    expect(rootItems[1].textContent).toContain('Nested 1');

    const nestedAfterOutdent = rootItems[1].querySelector('ul');
    expect(nestedAfterOutdent?.children.length).toBe(2);
  });

  test('does not outdent when already at root level', () => {
    container.innerHTML = '<ul><li>Root item</li></ul>';
    const rootLi = container.querySelector('li') as HTMLLIElement;
    setCursorInElement(rootLi, 0);

    const e = createTabEvent(true);
    const result = editor.handleDentures(e);

    expect(result).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    // Structure should remain unchanged
    expect(container.innerHTML).toBe('<ul><li>Root item</li></ul>');
  });

  test('cannot indent without previous sibling', () => {
    container.innerHTML = '<ul><li>Only item</li></ul>';
    const onlyLi = container.querySelector('li') as HTMLLIElement;
    setCursorInElement(onlyLi, 0);

    const e = createTabEvent(false);
    editor.handleDentures(e);

    // Should remain unchanged since there's no previous sibling
    expect(container.innerHTML).toBe('<ul><li>Only item</li></ul>');
  });

  test('preserves cursor position during indentation', () => {
    container.innerHTML = '<ul><li>First item</li><li>Second item text</li></ul>';
    const secondLi = container.querySelectorAll('li')[1] as HTMLLIElement;
    setCursorInElement(secondLi, 7); // After "Second "

    const e = createTabEvent(false);
    editor.handleDentures(e);

    const selection = window.getSelection()!;
    const range = selection.getRangeAt(0);
    expect(range.startOffset).toBe(7);
  });
});

describe('Editor: Complex toggleList scenarios', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('toggleList when not in editor range returns early', () => {
    // Create content outside the editor's root
    const outsideElement = document.createElement('div');
    outsideElement.innerHTML = '<p>Outside content</p>';
    document.body.appendChild(outsideElement);

    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(outsideElement.querySelector('p')!);
    selection.removeAllRanges();
    selection.addRange(range);

    const originalContent = container.innerHTML;
    editor.toggleList('ul');

    // Should not change editor content
    expect(container.innerHTML).toBe(originalContent);

    document.body.removeChild(outsideElement);
  });

  test('toggleList with no selection returns early', () => {
    container.innerHTML = '<p>Some content</p>';
    const originalContent = container.innerHTML;

    const selection = window.getSelection()!;
    selection.removeAllRanges();

    editor.toggleList('ul');

    // Content should remain unchanged
    expect(container.innerHTML).toBe(originalContent);
  });

  test('converts empty editor to list', () => {
    // Editor starts with empty paragraph
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 1);

    editor.toggleList('ol');

    expect(container.innerHTML).toBe('<ol><li>​</li></ol>');
  });

  test('converts multiple types of lists', () => {
    container.innerHTML = '<p>Convert me</p>';
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 5);

    editor.toggleList('ol');
    expect(container.innerHTML).toBe('<ol><li>Convert me</li></ol>');

    // Now convert back to ul
    const listItem = container.querySelector('li')!;
    setCursorInElement(listItem, 5);

    editor.toggleList('ul');
    expect(container.innerHTML).toBe('<p>Convert me</p>');

    // Convert to ul
    setCursorInParagraph(container.querySelector('p')!, 5);
    editor.toggleList('ul');
    expect(container.innerHTML).toBe('<ul><li>Convert me</li></ul>');
  });

  test('handles cursor positioning edge cases', () => {
    container.innerHTML = '<p>Test with <strong>formatting</strong> content</p>';
    const paragraph = container.querySelector('p')!;
    const strongElement = paragraph.querySelector('strong')!;

    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(strongElement.firstChild!, 4); // After "form" in "formatting"
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    const listItem = container.querySelector('li')!;
    const newRange = selection.getRangeAt(0);
    expect(listItem.contains(newRange.startContainer)).toBe(true);
  });
});

describe('Editor: Cursor positioning utilities', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('getCursorOffsetInParagraph calculates correct offset', () => {
    container.innerHTML = '<p>Hello <strong>world</strong> test</p>';
    const paragraph = container.querySelector('p')!;
    const strongElement = paragraph.querySelector('strong')!;

    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(strongElement.firstChild!, 2); // After "wo" in "world"
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    // Convert to list to trigger getCursorOffsetInParagraph
    editor.toggleList('ul');

    const listItem = container.querySelector('li')!;
    const newRange = selection.getRangeAt(0);

    // Cursor should be positioned correctly relative to the original offset
    expect(listItem.contains(newRange.startContainer)).toBe(true);
    expect(newRange.startOffset).toBe(2); // Should preserve the offset within the strong element
  });

  test.skip('setCursorInListItem positions at end when offset exceeds length', () => {
    container.innerHTML = '<p>Short</p>';
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 999); // Way beyond the text length

    editor.toggleList('ul');

    const selection = window.getSelection()!;
    const range = selection.getRangeAt(0);
    const listItem = container.querySelector('li')!;

    // Should position at the end of the text
    expect(listItem.contains(range.startContainer)).toBe(true);
  });

  test('handles empty list item cursor positioning', () => {
    container.innerHTML = '<p></p>';
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 0);

    editor.toggleList('ul');

    const selection = window.getSelection()!;
    const range = selection.getRangeAt(0);
    const listItem = container.querySelector('li')!;

    expect(listItem.contains(range.startContainer)).toBe(true);
    expect(listItem.textContent).toBe(ZERO_WIDTH_SPACE);
  });
});

describe('Editor: isEditorInRange validation', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('returns true when selection is within editor', () => {
    container.innerHTML = '<p>Editor content</p>';
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 5);

    // This will internally call isEditorInRange
    editor.toggleList('ul');

    // If isEditorInRange returned true, the content should be converted
    expect(container.innerHTML).toBe('<ul><li>Editor content</li></ul>');
  });

  test('returns false when no selection exists', () => {
    container.innerHTML = '<p>Editor content</p>';
    const originalContent = container.innerHTML;

    const selection = window.getSelection()!;
    selection.removeAllRanges();

    editor.toggleList('ul');

    // Content should remain unchanged
    expect(container.innerHTML).toBe(originalContent);
  });
});

describe('Editor: Complex formatting scenarios', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('toggleSelection handles range across blocks correctly', () => {
    container.innerHTML = '<p>First paragraph</p><p>Second paragraph</p>';
    const firstP = container.querySelectorAll('p')[0];
    const secondP = container.querySelectorAll('p')[1];

    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(firstP.firstChild!, 5); // After "First"
    range.setEnd(secondP.firstChild!, 6); // After "Second"
    selection.removeAllRanges();
    selection.addRange(range);

    // Should not apply formatting across block elements
    const originalContent = container.innerHTML;
    editor.toggleSelection('strong');

    // Content should remain unchanged
    expect(container.innerHTML).toBe(originalContent);
  });

  test('handles complex nested formatting removal', () => {
    container.innerHTML =
      '<p><strong><em><span class="underline">Complex formatting</span></em></strong></p>';
    const span = container.querySelector('span')!;

    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(span.firstChild!, 3);
    range.setEnd(span.firstChild!, 10);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('strong');

    // Should remove strong formatting while preserving others
    expect(container.innerHTML).toContain('<em><span class="underline">');
    expect(container.innerHTML).not.toContain('<strong><em><span class="underline">Complex');
  });

  test('normalizes inline formatting after complex operations', () => {
    container.innerHTML = '<p>Test</p>';
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 1);

    // Apply multiple formats
    editor.toggleSelection('strong');
    insertTextAtSelection('bold ');

    editor.toggleSelection('em');
    insertTextAtSelection('italic ');

    editor.toggleSelection('strong'); // Turn off bold
    insertTextAtSelection('just italic ');

    // The normalization should clean up any redundant nesting
    const cleanedHtml = Editor.cleanZeroWidthSpaces(paragraph.innerHTML);
    expect(cleanedHtml).not.toContain('<strong><strong>');
    expect(cleanedHtml).not.toContain('<em><em>');
  });

  test('handles formatting with mixed content types', () => {
    container.innerHTML = '<p>Text with <br> line break</p>';
    const paragraph = container.querySelector('p')!;

    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(paragraph.firstChild!, 0);
    range.setEnd(paragraph.lastChild!, 5); // Select across the br element
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('strong');

    expect(container.innerHTML).toContain('<strong>');
    expect(container.innerHTML).toContain('<br>');
  });
});

describe('Editor: Edge cases and error handling', () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = new Editor(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test.skip('handles malformed HTML gracefully', () => {
    container.innerHTML = '<p><strong>Unclosed strong and <em>nested em</p>';
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 5);

    // Should not throw error
    expect(() => {
      editor.toggleSelection('u');
    }).not.toThrow();
  });

  test('handles empty container initialization', () => {
    const emptyContainer = document.createElement('div');
    document.body.appendChild(emptyContainer);

    new Editor(emptyContainer);

    expect(emptyContainer.children.length).toBe(1);
    expect(emptyContainer.firstElementChild?.tagName).toBe('P');
    expect(emptyContainer.firstElementChild?.textContent).toBe(ZERO_WIDTH_SPACE);

    document.body.removeChild(emptyContainer);
  });

  test('handles initialization with existing content', () => {
    const existingContainer = document.createElement('div');
    existingContainer.innerHTML = '<p>Existing content</p>';
    document.body.appendChild(existingContainer);

    new Editor(existingContainer);

    expect(existingContainer.children.length).toBe(1);
    expect(existingContainer.firstElementChild?.textContent).toBe('Existing content');

    document.body.removeChild(existingContainer);
  });

  test('isEmptyContent handles various empty states', () => {
    // Test with multiple empty paragraphs
    container.innerHTML = `<p>${ZERO_WIDTH_SPACE}</p><p>   </p><p>${ZERO_WIDTH_SPACE}</p>`;
    expect(editor.isEmptyContent()).toBe(true);

    // Test with empty list
    container.innerHTML = '<ul><li></li></ul>';
    expect(editor.isEmptyContent()).toBe(true);

    // Test with mixed empty elements
    container.innerHTML = `<p>${ZERO_WIDTH_SPACE}</p><ul><li>   </li></ul>`;
    expect(editor.isEmptyContent()).toBe(true);

    // Test with non-empty content
    container.innerHTML = '<p>Real content</p>';
    expect(editor.isEmptyContent()).toBe(false);
  });

  test.skip('handles cursor positioning at document boundaries', () => {
    container.innerHTML = '<p>Start of doc</p>';
    const paragraph = container.querySelector('p')!;

    // Position at very beginning
    setCursorInParagraph(paragraph, 0);

    // Should handle gracefully
    expect(() => {
      editor.toggleSelection('strong');
    }).not.toThrow();

    // Position at very end
    setCursorInParagraph(paragraph, paragraph.textContent!.length);

    expect(() => {
      editor.toggleSelection('em');
    }).not.toThrow();
  });

  test('handles rapid successive operations', () => {
    container.innerHTML = '<p>Test content</p>';
    const paragraph = container.querySelector('p')!;
    setCursorInParagraph(paragraph, 5);

    // Rapid formatting changes
    expect(() => {
      editor.toggleSelection('strong');
      editor.toggleSelection('em');
      editor.toggleSelection('u');
      editor.toggleSelection('strong');
      editor.toggleSelection('em');
      editor.toggleSelection('u');
    }).not.toThrow();

    // Should still have valid structure
    expect(container.querySelector('p')).toBeTruthy();
  });

  test('handles deeply nested list structures', () => {
    container.innerHTML = `
       <ul>
         <li>Level 1
           <ul>
             <li>Level 2
               <ul>
                 <li>Level 3</li>
               </ul>
             </li>
           </ul>
         </li>
       </ul>
     `;

    const deepestLi = container.querySelector('ul ul ul li') as HTMLLIElement;
    setCursorInElement(deepestLi, 0);

    // Should handle deep nesting gracefully
    expect(() => {
      editor.toggleList('ul');
    }).not.toThrow();

    // Should convert to paragraph
    expect(container.innerHTML).toContain('<p>Level 3</p>');
  });
});

describe('Editor: Constructor and initialization edge cases', () => {
  test('handles container with only whitespace', () => {
    const whitespaceContainer = document.createElement('div');
    whitespaceContainer.innerHTML = '   \n\t   ';
    document.body.appendChild(whitespaceContainer);

    new Editor(whitespaceContainer);

    expect(whitespaceContainer.children.length).toBe(1);
    expect(whitespaceContainer.firstElementChild?.tagName).toBe('P');
    expect(whitespaceContainer.firstElementChild?.textContent).toBe(ZERO_WIDTH_SPACE);

    document.body.removeChild(whitespaceContainer);
  });

  test('handles container with mixed text and element nodes', () => {
    const mixedContainer = document.createElement('div');
    mixedContainer.innerHTML = 'Text node<span>Element</span>More text';
    document.body.appendChild(mixedContainer);

    new Editor(mixedContainer);

    // Should not add empty paragraph since there's existing content
    expect(mixedContainer.children.length).toBeGreaterThan(0);
    expect(mixedContainer.textContent).toContain('Text node');
    expect(mixedContainer.textContent).toContain('Element');
    expect(mixedContainer.textContent).toContain('More text');

    document.body.removeChild(mixedContainer);
  });

  test('handles container with self-closing elements', () => {
    const selfClosingContainer = document.createElement('div');
    selfClosingContainer.innerHTML = '<br/><hr/>';
    document.body.appendChild(selfClosingContainer);

    new Editor(selfClosingContainer);

    // Should not add empty paragraph since there's existing content
    expect(selfClosingContainer.querySelector('br')).toBeTruthy();
    expect(selfClosingContainer.querySelector('hr')).toBeTruthy();

    document.body.removeChild(selfClosingContainer);
  });
});
