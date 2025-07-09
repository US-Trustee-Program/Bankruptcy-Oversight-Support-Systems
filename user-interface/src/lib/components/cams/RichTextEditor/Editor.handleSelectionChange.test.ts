import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Editor } from './Editor';
import { FormatState } from './FormatDetectionService';

// Mock the FormatDetectionService class
vi.mock('./FormatDetectionService', () => {
  return {
    FormatDetectionService: vi.fn().mockImplementation(() => ({
      getFormatState: vi.fn().mockReturnValue({
        bold: false,
        italic: false,
        underline: false,
        orderedList: false,
        unorderedList: false,
      }),
    })),
  };
});

describe('Editor.handleSelectionChange', () => {
  let editor: Editor;
  const mockRoot = document.createElement('div');

  // Create a paragraph with content to avoid initialization issues
  mockRoot.innerHTML = '<p>Test content</p>';

  const mockSelection = {
    getRangeAt: vi.fn(),
    rangeCount: 1,
  };
  const mockRange = {
    startContainer: document.createElement('p'),
    endContainer: document.createElement('p'),
    collapsed: true,
    commonAncestorContainer: document.createElement('p'),
  };

  // Create a more complete mock of the SelectionService
  const mockSelectionService = {
    getCurrentSelection: vi.fn().mockReturnValue(mockSelection),
    getRangeAtStartOfSelection: vi.fn(),
    getSelectedText: vi.fn(),
    createElement: vi.fn().mockReturnValue(document.createElement('p')),
    createTextNode: vi.fn().mockReturnValue(document.createTextNode('')),
    createRange: vi.fn().mockReturnValue(mockRange),
    setSelectionRange: vi.fn(),
    selectNodeContents: vi.fn(),
    createDocumentFragment: vi.fn().mockReturnValue(document.createDocumentFragment()),
    createTreeWalker: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelection.getRangeAt.mockReturnValue(mockRange);

    // Create editor with pre-populated root to avoid initialization issues
    editor = new Editor(mockRoot, mockSelectionService);
  });

  it('should call getFormatState when handleSelectionChange is called', () => {
    // Create a spy on getFormatState
    const getFormatStateSpy = vi.spyOn(editor, 'getFormatState');

    // Mock getFormatState to return a specific format state
    const mockFormatState: FormatState = {
      bold: true,
      italic: false,
      underline: false,
      orderedList: false,
      unorderedList: false,
    };
    getFormatStateSpy.mockReturnValue(mockFormatState);

    // Call handleSelectionChange
    const result = editor.handleSelectionChange();

    // Verify getFormatState was called
    expect(getFormatStateSpy).toHaveBeenCalledTimes(1);

    // Verify the result is the format state from getFormatState
    expect(result).toBe(mockFormatState);
    expect(result.bold).toBe(true);
  });

  it('should return the current format state', () => {
    // Create a spy on getFormatState
    const getFormatStateSpy = vi.spyOn(editor, 'getFormatState');

    // Create mock format state
    const mockFormatState: FormatState = {
      bold: false,
      italic: true,
      underline: false,
      orderedList: false,
      unorderedList: false,
    };

    // Mock getFormatState to return our mock format state
    getFormatStateSpy.mockReturnValue(mockFormatState);

    // Call handleSelectionChange
    const result = editor.handleSelectionChange();

    // Verify getFormatState was called and the result is correct
    expect(getFormatStateSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockFormatState);
  });
});
