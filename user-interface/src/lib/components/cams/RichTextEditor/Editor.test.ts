import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { ZERO_WIDTH_SPACE, Editor } from './Editor';

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
    // Set up the problematic structure from the bug report
    container.innerHTML =
      'one <strong><strong><em><strong>two</strong></em> </strong><em><strong>th</strong>r</em></strong>ee four';

    // Select the text "two"
    const textNode = container.querySelector('strong em strong')?.firstChild as Text;
    expect(textNode?.textContent).toBe('two');

    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 3);
    selection.removeAllRanges();
    selection.addRange(range);

    // Toggle bold formatting (should remove bold, keep italic)
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

    // Select just the space between "two" and "three"
    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 7); // Start at space after "one two"
    range.setEnd(textNode, 8); // End after space
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('em');

    // The space should be preserved and formatted
    expect(container.innerHTML).toContain('<em> </em>');
    expect(container.innerHTML).not.toBe('<p>one twothree</p>'); // Space shouldn't disappear
  });

  test('preserves space character when applying underline formatting to just a space', () => {
    container.innerHTML = '<p>foo bar</p>';

    // Select just the space between "foo" and "bar"
    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 3); // Start at space after "foo"
    range.setEnd(textNode, 4); // End after space
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('u');

    // The space should be preserved and formatted
    expect(container.innerHTML).toContain('<span class="underline"> </span>');
    expect(container.innerHTML).not.toBe('<p>foobar</p>'); // Space shouldn't disappear
  });

  test('handles multiple consecutive spaces correctly', () => {
    container.innerHTML = '<p>hello  world</p>'; // Two spaces

    // Select both spaces
    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 5); // Start at first space
    range.setEnd(textNode, 7); // End after both spaces
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('strong');

    // Both spaces should be preserved and formatted
    expect(container.innerHTML).toContain('<strong>  </strong>');
    expect(container.innerHTML).not.toBe('<p>helloworld</p>'); // Spaces shouldn't disappear
  });

  test('handles space at beginning of formatted element', () => {
    container.innerHTML = '<p>hello<strong> world</strong></p>';

    // Select just the space at the beginning of the strong element
    const strongElement = container.querySelector('strong')!;
    const textNode = strongElement.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 0); // Start at space
    range.setEnd(textNode, 1); // End after space
    selection.removeAllRanges();
    selection.addRange(range);

    // Toggle formatting (should remove bold from just the space)
    editor.toggleSelection('strong');

    // The space should be preserved but unformatted
    expect(container.innerHTML).toBe('<p>hello <strong>world</strong></p>');
  });

  test('handles tab character formatting', () => {
    container.innerHTML = '<p>hello\tworld</p>';

    // Select just the tab character
    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 5); // Start at tab
    range.setEnd(textNode, 6); // End after tab
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('strong');

    // The tab should be preserved and formatted
    expect(container.innerHTML).toContain('<strong>\t</strong>');
  });

  test('handles newline character formatting', () => {
    container.innerHTML = '<p>hello\nworld</p>';

    // Select just the newline character
    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 5); // Start at newline
    range.setEnd(textNode, 6); // End after newline
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleSelection('strong');

    // The newline should be preserved and formatted
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

    // All whitespace should be preserved and formatted
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

    // Select the middle list item
    const middleLi = container.querySelectorAll('li')[1];
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(middleLi);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    // Should result in two lists with a paragraph in between
    expect(container.innerHTML).toContain('<ul><li>Item 1</li></ul>');
    expect(container.innerHTML).toContain('<p>Item 2</p>');
    expect(container.innerHTML).toContain('<ul><li>Item 3</li></ul>');
  });

  test('converts first item to paragraph, leaving rest as list', () => {
    container.innerHTML = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';

    // Select the first list item
    const firstLi = container.querySelectorAll('li')[0];
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(firstLi);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    // Should result in paragraph followed by list
    expect(container.innerHTML).toContain('<p>Item 1</p>');
    expect(container.innerHTML).toContain('<ul><li>Item 2</li><li>Item 3</li></ul>');
    // Make sure the content isn't lost
    expect(container.innerHTML).toBe('<p>Item 1</p><ul><li>Item 2</li><li>Item 3</li></ul>');
  });

  test('single item list converts to paragraph', () => {
    container.innerHTML = '<ul><li>Only Item</li></ul>';

    // Select the only list item
    const firstLi = container.querySelector('li');
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(firstLi!);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    // Should result in just a paragraph
    expect(container.innerHTML).toBe('<p>Only Item</p>');
  });

  test('preserves nested lists when toggling parent item', () => {
    container.innerHTML =
      '<ul><li>Parent Item<ul><li>Child 1</li><li>Child 2</li></ul></li><li>Next Item</li></ul>';

    // Select the parent list item (but not the nested content)
    const parentLi = container.querySelector('li');
    const textNode = parentLi!.firstChild; // The "Parent Item" text
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode!, 0);
    range.setEnd(textNode!, textNode!.textContent!.length);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    // Should result in paragraph, preserved nested list, and remaining items
    expect(container.innerHTML).toContain('<p>Parent Item</p>');
    expect(container.innerHTML).toContain('<ul><li>Child 1</li><li>Child 2</li></ul>');
    expect(container.innerHTML).toContain('<ul><li>Next Item</li></ul>');
    // Verify the order: paragraph, nested list, remaining items
    expect(container.innerHTML).toBe(
      '<p>Parent Item</p><ul><li>Child 1</li><li>Child 2</li></ul><ul><li>Next Item</li></ul>',
    );
  });

  test('converts last item to paragraph, leaving rest as list', () => {
    container.innerHTML = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';

    // Select the last list item
    const lastLi = container.querySelectorAll('li')[2];
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(lastLi);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    // Should result in list followed by paragraph
    expect(container.innerHTML).toContain('<ul><li>Item 1</li><li>Item 2</li></ul>');
    expect(container.innerHTML).toContain('<p>Item 3</p>');
  });

  test('handles nested list item extraction', () => {
    container.innerHTML =
      '<ul><li>Item 1<ul><li>Nested 1</li><li>Nested 2</li></ul></li><li>Item 2</li></ul>';

    // Select the nested list item
    const nestedLi = container.querySelector('ul ul li');
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(nestedLi!);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    // Should extract the nested item to a paragraph at root level and split the list
    expect(container.innerHTML).toContain('<p>Nested 1</p>');
    // The nested list item should no longer be in a list
    expect(container.innerHTML).not.toContain('<ul><li>Nested 1</li></ul>');
    // The parent "Item 1" should still exist
    expect(container.innerHTML).toContain('Item 1');
    // The remaining nested item should still be nested under Item 1
    expect(container.innerHTML).toContain('<li>Item 1<ul><li>Nested 2</li></ul></li>');
    // Item 2 should be in a separate list after the paragraph
    expect(container.innerHTML).toContain('<li>Item 2</li>');
    // The root list should be split - Item 1 should be in one list, Item 2 in another
    expect(container.innerHTML).toContain(
      '<ul><li>Item 1<ul><li>Nested 2</li></ul></li></ul><p>Nested 1</p><ul><li>Item 2</li></ul>',
    );
  });

  test('handles deeply nested list item extraction and splits the root list', () => {
    container.innerHTML =
      '<ul><li>Root 1<ul><li>Level 2<ul><li>Level 3</li></ul></li></ul></li><li>Root 2</li></ul>';

    // Select the deeply nested list item
    const deepLi = container.querySelector('ul ul ul li');
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(deepLi!);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    // Should extract the deeply nested item to a paragraph at root level and split the list
    expect(container.innerHTML).toContain('<p>Level 3</p>');
    // All parent items should still exist
    expect(container.innerHTML).toContain('Root 1');
    expect(container.innerHTML).toContain('Level 2');
    expect(container.innerHTML).toContain('Root 2');
    // The Level 2 item should still exist but without its nested list
    expect(container.innerHTML).toContain('<li>Level 2</li>');
    // Root 2 should be in a separate list after the paragraph
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

    // Place cursor in the middle of the paragraph
    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 8); // After "This is "
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    // Should convert paragraph to list item
    expect(container.innerHTML).toBe('<ul><li>This is a paragraph</li></ul>');
  });

  test('converts paragraph with formatted content to list item', () => {
    container.innerHTML = '<p>This is <strong>bold</strong> text</p>';

    // Place cursor after "bold"
    const strongElement = container.querySelector('strong')!;
    const textNode = strongElement.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 4); // After "bold"
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ol');

    // Should convert paragraph to ordered list item preserving formatting
    expect(container.innerHTML).toBe('<ol><li>This is <strong>bold</strong> text</li></ol>');
  });

  test('preserves cursor position when converting paragraph to list', () => {
    container.innerHTML = '<p>Hello world</p>';

    // Place cursor after "Hello "
    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 6); // After "Hello "
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    // Check that cursor is still positioned after "Hello "
    const newRange = selection.getRangeAt(0);
    const liTextNode = container.querySelector('li')!.firstChild as Text;
    expect(newRange.startContainer).toBe(liTextNode);
    expect(newRange.startOffset).toBe(6);
  });

  test('converts empty paragraph to empty list item', () => {
    container.innerHTML = '<p></p>';

    // Place cursor in empty paragraph
    const p = container.querySelector('p')!;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(p);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    // Should create list with zero-width space
    expect(container.innerHTML).toBe('<ul><li>​</li></ul>');
  });

  test('converts paragraph with only whitespace to list with zero-width space', () => {
    container.innerHTML = '<p>   </p>';

    // Place cursor in whitespace-only paragraph
    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 1);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ol');

    // Should create list with zero-width space (whitespace gets trimmed)
    expect(container.innerHTML).toBe('<ol><li>​</li></ol>');
  });

  test('converts paragraph with mixed content including line breaks', () => {
    container.innerHTML = '<p>Line 1<br>Line 2</p>';

    // Place cursor after "Line 1"
    const textNode = container.querySelector('p')!.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 6); // After "Line 1"
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    // Should preserve all content including br tag
    expect(container.innerHTML).toBe('<ul><li>Line 1<br>Line 2</li></ul>');
  });

  test('converts single paragraph when multiple paragraphs exist', () => {
    container.innerHTML = '<p>First paragraph</p><p>Second paragraph</p>';

    // Place cursor in the second paragraph
    const secondP = container.querySelectorAll('p')[1];
    const textNode = secondP.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 6); // After "Second"
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.toggleList('ul');

    // Should only convert the second paragraph to a list
    expect(container.innerHTML).toBe('<p>First paragraph</p><ul><li>Second paragraph</li></ul>');
  });
});
