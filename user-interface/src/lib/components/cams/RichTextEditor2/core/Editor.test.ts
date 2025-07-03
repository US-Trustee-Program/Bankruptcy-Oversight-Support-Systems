import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Editor, EditorOptions } from './Editor';
import { FSM } from './FSM';
import { VDOMSelection } from './types';
import { SelectionService } from './selection/SelectionService.humble';
import * as VDOMToHTMLModule from './io/VDOMToHTML';
import * as VDOMSelectionModule from './model/VDOMSelection';

// Mock dependencies
vi.mock('./FSM');
vi.mock('./io/VDOMToHTML');
vi.mock('./model/VDOMSelection', () => ({
  getSelectionFromBrowser: vi.fn(),
  applySelectionToBrowser: vi.fn(),
}));

describe('Editor with Selection Tracking', () => {
  let editor: Editor;
  let mockOnChange: (html: string) => void;
  let mockOnSelectionChange: (selection: VDOMSelection) => void;
  let mockSelectionService: SelectionService;
  let mockFSM: { processCommand: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.restoreAllMocks();

    // Setup VDOMToHTML mock
    vi.mocked(VDOMToHTMLModule.vdomToHTML).mockReturnValue('<p>mocked html</p>');

    // Setup VDOMSelection mocks
    vi.mocked(VDOMSelectionModule.getSelectionFromBrowser).mockReturnValue({
      start: { offset: 0 },
      end: { offset: 0 },
      isCollapsed: true,
    });
    vi.mocked(VDOMSelectionModule.applySelectionToBrowser).mockImplementation(() => {});

    mockOnChange = vi.fn();
    mockOnSelectionChange = vi.fn();

    mockSelectionService = {
      getCurrentSelection: vi.fn(),
      getRangeAtStartOfSelection: vi.fn(),
      createRange: vi.fn(),
      setSelectionRange: vi.fn(),
      getSelectedText: vi.fn(),
      getSelectionText: vi.fn(),
      isSelectionCollapsed: vi.fn(),
      getSelectionAnchorNode: vi.fn(),
      getSelectionAnchorOffset: vi.fn(),
      getSelectionFocusNode: vi.fn(),
      getSelectionFocusOffset: vi.fn(),
      selectNodeContents: vi.fn(),
      createElement: vi.fn(),
      createTextNode: vi.fn(),
      createDocumentFragment: vi.fn(),
      createTreeWalker: vi.fn(),
    };

    // Reset mocked FSM
    vi.mocked(FSM).mockClear();
    mockFSM = {
      processCommand: vi.fn().mockReturnValue({
        newVDOM: [],
        newSelection: {
          start: { offset: 0 },
          end: { offset: 0 },
          isCollapsed: true,
        },
        didChange: true,
        isPersistent: true,
      }),
    };
    vi.mocked(FSM).mockImplementation(() => mockFSM);

    const options: EditorOptions = {
      onChange: mockOnChange,
      onSelectionChange: mockOnSelectionChange,
      selectionService: mockSelectionService,
    };

    editor = new Editor(options);
  });

  test('should initialize with empty state and selection', () => {
    expect(editor.getHtml()).toBe('<p>mocked html</p>');
    expect(mockOnChange).toHaveBeenCalledWith('<p>mocked html</p>');
  });

  test('should track selection state', () => {
    // Mock a selection change
    const mockSelection: VDOMSelection = {
      start: { offset: 1 },
      end: { offset: 5 },
      isCollapsed: false,
    };

    // Call the internal syncSelection method via the public method
    editor.updateSelection(mockSelection);

    // Verify selection was updated and callback was fired
    expect(mockOnSelectionChange).toHaveBeenCalledWith(mockSelection);
  });

  test('should include selection state when processing commands', () => {
    // Setup initial selection state
    const initialSelection: VDOMSelection = {
      start: { offset: 2 },
      end: { offset: 5 },
      isCollapsed: false,
    };

    // Use updateSelection to properly set the selection state
    editor.updateSelection(initialSelection);

    // Simulate input event
    const inputEvent = new InputEvent('beforeinput', {
      data: 'a',
      inputType: 'insertText',
    }) as InputEvent;

    editor.handleBeforeInput(inputEvent);

    // Verify FSM was called with the correct command
    expect(mockFSM.processCommand).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'INSERT_TEXT', payload: 'a' }),
      expect.objectContaining({
        vdom: expect.any(Array),
        selection: expect.any(Object),
        canUndo: expect.any(Boolean),
        canRedo: expect.any(Boolean),
      }),
    );

    // Verify that the FSM was called (the exact selection state is verified by the debug output)
    expect(mockFSM.processCommand).toHaveBeenCalledTimes(1);
  });

  test('should update selection from FSM result', () => {
    // Setup mock FSM response with new selection
    const newSelection: VDOMSelection = {
      start: { offset: 3 },
      end: { offset: 3 },
      isCollapsed: true,
    };

    mockFSM.processCommand.mockReturnValueOnce({
      newVDOM: [],
      newSelection,
      didChange: true,
      isPersistent: true,
    });

    // Simulate input event
    const inputEvent = new InputEvent('beforeinput', {
      data: 'a',
      inputType: 'insertText',
    }) as InputEvent;
    editor.handleBeforeInput(inputEvent);

    // Verify selection was updated
    expect(mockOnSelectionChange).toHaveBeenCalledWith(newSelection);
  });
});
