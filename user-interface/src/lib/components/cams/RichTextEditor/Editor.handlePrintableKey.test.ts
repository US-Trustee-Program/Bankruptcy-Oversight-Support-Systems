import { Editor } from './Editor';
import { MockSelectionService } from './SelectionService.humble';
import editorUtilities from './Editor.utilities';
import { ZERO_WIDTH_SPACE } from './Editor.constants';

describe('Editor: handlePrintableKey', () => {
  let editor: Editor;
  let container: HTMLDivElement;
  let selectionService: MockSelectionService;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    selectionService = new MockSelectionService();
    editor = new Editor(container, selectionService);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  test('should replace zero-width space with typed character in empty paragraph', () => {
    // Setup an empty paragraph with zero-width space
    const p = document.createElement('p');
    const textNode = document.createTextNode(ZERO_WIDTH_SPACE);
    p.appendChild(textNode);
    container.innerHTML = ''; // Clear any existing content
    container.appendChild(p);

    // Create a real range for testing
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 1);
    range.collapse(true);

    // Setup the mock selection service
    vi.spyOn(selectionService, 'getCurrentSelection').mockImplementation(() => {
      return {
        rangeCount: 1,
        getRangeAt: () => range,
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
        toString: () => '',
      } as unknown as Selection;
    });

    // Create a mock for setSelectionRange that doesn't actually try to call removeAllRanges
    vi.spyOn(selectionService, 'setSelectionRange').mockImplementation(() => {
      // Do nothing
    });

    // Mock isEmptyContent to return true
    vi.spyOn(editorUtilities, 'isEmptyContent').mockReturnValue(true);

    // Create a mock keyboard event for a printable character 'a'
    const keyEvent = {
      key: 'a',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLDivElement>;

    // Call handlePrintableKey
    const result = editor.handlePrintableKey(keyEvent);

    // Assert that the method returned true (handled the event)
    expect(result).toBe(true);

    // Assert that preventDefault was called
    expect(keyEvent.preventDefault).toHaveBeenCalled();

    // Assert that the text content was updated
    expect(textNode.textContent).toBe('a');
  });

  test('should remove zero-width space when typing next to it', () => {
    // Setup a paragraph with text containing zero-width space
    const p = document.createElement('p');
    const textNode = document.createTextNode(`Hello${ZERO_WIDTH_SPACE}World`);
    p.appendChild(textNode);
    container.innerHTML = ''; // Clear any existing content
    container.appendChild(p);

    // Create a real range for testing
    const range = document.createRange();
    range.setStart(textNode, 5); // After "Hello"
    range.setEnd(textNode, 5);
    range.collapse(true);

    // Setup the mock selection service
    vi.spyOn(selectionService, 'getCurrentSelection').mockImplementation(() => {
      return {
        rangeCount: 1,
        getRangeAt: () => range,
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
        toString: () => '',
      } as unknown as Selection;
    });

    // Create a mock for setSelectionRange that doesn't actually try to call removeAllRanges
    vi.spyOn(selectionService, 'setSelectionRange').mockImplementation(() => {
      // Do nothing
    });

    // Mock isEmptyContent to return false
    vi.spyOn(editorUtilities, 'isEmptyContent').mockReturnValue(false);

    // Create a mock keyboard event for a printable character ' '
    const keyEvent = {
      key: ' ',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLDivElement>;

    // Call handlePrintableKey
    const result = editor.handlePrintableKey(keyEvent);

    // Assert that the method returned true (handled the event)
    expect(result).toBe(true);

    // Assert that preventDefault was called
    expect(keyEvent.preventDefault).toHaveBeenCalled();

    // Assert that the text content was updated without the zero-width space
    expect(textNode.textContent).toBe('Hello World');
  });

  test('should handle subsequent character typing after zero-width space removal', () => {
    // Setup a paragraph with zero-width space initially
    const p = document.createElement('p');
    const textNode = document.createTextNode(ZERO_WIDTH_SPACE);
    p.appendChild(textNode);
    container.innerHTML = ''; // Clear any existing content
    container.appendChild(p);

    // First character typing: 'H'
    const range1 = document.createRange();
    range1.setStart(textNode, 0);
    range1.setEnd(textNode, 1);
    range1.collapse(true);

    vi.spyOn(selectionService, 'getCurrentSelection').mockImplementation(() => {
      return {
        rangeCount: 1,
        getRangeAt: () => range1,
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
        toString: () => '',
      } as unknown as Selection;
    });

    vi.spyOn(selectionService, 'setSelectionRange').mockImplementation(() => {
      // Do nothing
    });

    vi.spyOn(editorUtilities, 'isEmptyContent').mockReturnValue(true);

    const keyEvent1 = {
      key: 'H',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLDivElement>;

    // First character should replace the zero-width space
    const result1 = editor.handlePrintableKey(keyEvent1);
    expect(result1).toBe(true);
    expect(keyEvent1.preventDefault).toHaveBeenCalled();
    expect(textNode.textContent).toBe('H');

    // Reset mocks for next character
    vi.clearAllMocks();

    // Second character typing: 'e'
    // Now the paragraph is not empty anymore, and there's no zero-width space
    const range2 = document.createRange();
    range2.setStart(textNode, 1); // Cursor after 'H'
    range2.setEnd(textNode, 1);
    range2.collapse(true);

    vi.spyOn(selectionService, 'getCurrentSelection').mockImplementation(() => {
      return {
        rangeCount: 1,
        getRangeAt: () => range2,
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
        toString: () => '',
      } as unknown as Selection;
    });

    vi.spyOn(editorUtilities, 'isEmptyContent').mockReturnValue(false);

    const keyEvent2 = {
      key: 'e',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLDivElement>;

    // Second character should be handled naturally by the browser
    const result2 = editor.handlePrintableKey(keyEvent2);
    expect(result2).toBe(false); // Should let the browser handle it naturally
    expect(keyEvent2.preventDefault).not.toHaveBeenCalled();
  });
});
