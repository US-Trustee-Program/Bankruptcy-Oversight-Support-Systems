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

  const createEvent = (key: string, ctrlKey = true): React.KeyboardEvent<HTMLDivElement> =>
    ({
      key,
      ctrlKey,
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
    const e = createEvent('b', false);
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
