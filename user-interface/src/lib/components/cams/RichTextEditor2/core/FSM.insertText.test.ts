import { describe, beforeEach, test, expect, vi } from 'vitest';
import { FSM } from './FSM';
import { EditorState, VDOMNode, VDOMSelection } from './types';
import * as VDOMSelectionModule from './model/VDOMSelection';

describe('FSM handleInsertText', () => {
  let fsm: FSM;

  beforeEach(() => {
    fsm = new FSM();
    vi.restoreAllMocks();
  });

  test('should insert text in a plain text node', () => {
    // Setup VDOM with text content
    const textNode: VDOMNode = {
      type: 'text',
      path: [0],
      content: 'Hello World',
    };

    const vdom: VDOMNode[] = [textNode];
    const selection: VDOMSelection = {
      start: { node: textNode, offset: 5 },
      end: { node: textNode, offset: 5 },
      isCollapsed: true,
    };

    const currentState: EditorState = {
      vdom,
      selection,
      canUndo: false,
      canRedo: false,
      formatToggleState: {
        bold: 'inactive',
        italic: 'inactive',
        underline: 'inactive',
      },
    };

    // Mock getFormattingAtSelection to return inactive formatting
    const getFormattingSpy = vi.spyOn(VDOMSelectionModule, 'getFormattingAtSelection');
    getFormattingSpy.mockReturnValue({
      bold: 'inactive',
      italic: 'inactive',
      underline: 'inactive',
    });

    const result = fsm.processCommand({ type: 'INSERT_TEXT', payload: ' there' }, currentState);

    // Verify text was inserted in the plain text node
    expect(result.newVDOM[0].content).toBe('Hello there World');
    expect(result.newSelection.start.offset).toBe(11);
    expect(result.didChange).toBe(true);
    expect(result.isPersistent).toBe(true);

    // Verify getFormattingAtSelection was called
    expect(getFormattingSpy).toHaveBeenCalledWith(vdom, selection);
  });

  test('should insert text in a bold section', () => {
    // Setup VDOM with text in a strong node
    const textNode: VDOMNode = {
      type: 'text',
      path: [0, 0],
      content: 'bold text',
    };

    const boldNode: VDOMNode = {
      type: 'strong',
      path: [0],
      children: [textNode],
    };

    const vdom: VDOMNode[] = [boldNode];
    const selection: VDOMSelection = {
      start: { node: textNode, offset: 4 },
      end: { node: textNode, offset: 4 },
      isCollapsed: true,
    };

    const currentState: EditorState = {
      vdom,
      selection,
      canUndo: false,
      canRedo: false,
      formatToggleState: {
        bold: 'inactive',
        italic: 'inactive',
        underline: 'inactive',
      },
    };

    // Mock getFormattingAtSelection to return active bold formatting
    const getFormattingSpy = vi.spyOn(VDOMSelectionModule, 'getFormattingAtSelection');
    getFormattingSpy.mockReturnValue({
      bold: 'active',
      italic: 'inactive',
      underline: 'inactive',
    });

    const result = fsm.processCommand({ type: 'INSERT_TEXT', payload: ' very' }, currentState);

    // Verify text was inserted in the bold section
    expect(result.newVDOM[0].type).toBe('strong');
    expect((result.newVDOM[0] as VDOMNode).children![0].content).toBe('bold very text');
    expect(result.newSelection.start.offset).toBe(9);
    expect(result.didChange).toBe(true);
    expect(result.isPersistent).toBe(true);

    // Verify getFormattingAtSelection was called
    expect(getFormattingSpy).toHaveBeenCalledWith(vdom, selection);
  });

  test('should insert text with active bold formatting toggle state', () => {
    // Setup VDOM with text content
    const textNode: VDOMNode = {
      type: 'text',
      path: [0],
      content: 'Hello World',
    };

    const vdom: VDOMNode[] = [textNode];
    const selection: VDOMSelection = {
      start: { node: textNode, offset: 5 },
      end: { node: textNode, offset: 5 },
      isCollapsed: true,
    };

    const currentState: EditorState = {
      vdom,
      selection,
      canUndo: false,
      canRedo: false,
      formatToggleState: {
        bold: 'active', // Bold toggle is active
        italic: 'inactive',
        underline: 'inactive',
      },
    };

    // Mock getFormattingAtSelection to return inactive formatting
    const getFormattingSpy = vi.spyOn(VDOMSelectionModule, 'getFormattingAtSelection');
    getFormattingSpy.mockReturnValue({
      bold: 'inactive',
      italic: 'inactive',
      underline: 'inactive',
    });

    const result = fsm.processCommand({ type: 'INSERT_TEXT', payload: ' there' }, currentState);

    // Verify text was inserted with bold formatting
    expect(result.newVDOM.length).toBe(1);

    // The result should have a structure like:
    // [text "Hello"][strong [text " there"]][text " World"]
    const paragraph = result.newVDOM[0];
    expect(paragraph.type).toBe('paragraph');
    expect(paragraph.children!.length).toBe(3);

    // First child should be "Hello"
    expect(paragraph.children![0].type).toBe('text');
    expect(paragraph.children![0].content).toBe('Hello');

    // Second child should be a strong node with " there"
    expect(paragraph.children![1].type).toBe('strong');
    expect(paragraph.children![1].children![0].type).toBe('text');
    expect(paragraph.children![1].children![0].content).toBe(' there');

    // Third child should be " World"
    expect(paragraph.children![2].type).toBe('text');
    expect(paragraph.children![2].content).toBe(' World');

    // Selection should be at the end of the inserted text
    expect(result.newSelection.start.node).toBe(paragraph.children![1].children![0]);
    expect(result.newSelection.start.offset).toBe(6); // Length of " there"

    expect(result.didChange).toBe(true);
    expect(result.isPersistent).toBe(true);

    // Verify getFormattingAtSelection was called
    expect(getFormattingSpy).toHaveBeenCalledWith(vdom, selection);
  });

  test('should insert text with active italic formatting toggle state', () => {
    // Setup VDOM with text content
    const textNode: VDOMNode = {
      type: 'text',
      path: [0],
      content: 'Hello World',
    };

    const vdom: VDOMNode[] = [textNode];
    const selection: VDOMSelection = {
      start: { node: textNode, offset: 5 },
      end: { node: textNode, offset: 5 },
      isCollapsed: true,
    };

    const currentState: EditorState = {
      vdom,
      selection,
      canUndo: false,
      canRedo: false,
      formatToggleState: {
        bold: 'inactive',
        italic: 'active', // Italic toggle is active
        underline: 'inactive',
      },
    };

    // Mock getFormattingAtSelection to return inactive formatting
    const getFormattingSpy = vi.spyOn(VDOMSelectionModule, 'getFormattingAtSelection');
    getFormattingSpy.mockReturnValue({
      bold: 'inactive',
      italic: 'inactive',
      underline: 'inactive',
    });

    const result = fsm.processCommand({ type: 'INSERT_TEXT', payload: ' there' }, currentState);

    // Verify text was inserted with italic formatting
    expect(result.newVDOM.length).toBe(1);

    // The result should have a structure like:
    // [text "Hello"][em [text " there"]][text " World"]
    const paragraph = result.newVDOM[0];
    expect(paragraph.type).toBe('paragraph');
    expect(paragraph.children!.length).toBe(3);

    // First child should be "Hello"
    expect(paragraph.children![0].type).toBe('text');
    expect(paragraph.children![0].content).toBe('Hello');

    // Second child should be an em node with " there"
    expect(paragraph.children![1].type).toBe('em');
    expect(paragraph.children![1].children![0].type).toBe('text');
    expect(paragraph.children![1].children![0].content).toBe(' there');

    // Third child should be " World"
    expect(paragraph.children![2].type).toBe('text');
    expect(paragraph.children![2].content).toBe(' World');

    // Selection should be at the end of the inserted text
    expect(result.newSelection.start.node).toBe(paragraph.children![1].children![0]);
    expect(result.newSelection.start.offset).toBe(6); // Length of " there"

    expect(result.didChange).toBe(true);
    expect(result.isPersistent).toBe(true);

    // Verify getFormattingAtSelection was called
    expect(getFormattingSpy).toHaveBeenCalledWith(vdom, selection);
  });

  test('should insert text with active underline formatting toggle state', () => {
    // Setup VDOM with text content
    const textNode: VDOMNode = {
      type: 'text',
      path: [0],
      content: 'Hello World',
    };

    const vdom: VDOMNode[] = [textNode];
    const selection: VDOMSelection = {
      start: { node: textNode, offset: 5 },
      end: { node: textNode, offset: 5 },
      isCollapsed: true,
    };

    const currentState: EditorState = {
      vdom,
      selection,
      canUndo: false,
      canRedo: false,
      formatToggleState: {
        bold: 'inactive',
        italic: 'inactive',
        underline: 'active', // Underline toggle is active
      },
    };

    // Mock getFormattingAtSelection to return inactive formatting
    const getFormattingSpy = vi.spyOn(VDOMSelectionModule, 'getFormattingAtSelection');
    getFormattingSpy.mockReturnValue({
      bold: 'inactive',
      italic: 'inactive',
      underline: 'inactive',
    });

    const result = fsm.processCommand({ type: 'INSERT_TEXT', payload: ' there' }, currentState);

    // Verify text was inserted with underline formatting
    expect(result.newVDOM.length).toBe(1);

    // The result should have a structure like:
    // [text "Hello"][u [text " there"]][text " World"]
    const paragraph = result.newVDOM[0];
    expect(paragraph.type).toBe('paragraph');
    expect(paragraph.children!.length).toBe(3);

    // First child should be "Hello"
    expect(paragraph.children![0].type).toBe('text');
    expect(paragraph.children![0].content).toBe('Hello');

    // Second child should be a u node with " there"
    expect(paragraph.children![1].type).toBe('u');
    expect(paragraph.children![1].children![0].type).toBe('text');
    expect(paragraph.children![1].children![0].content).toBe(' there');

    // Third child should be " World"
    expect(paragraph.children![2].type).toBe('text');
    expect(paragraph.children![2].content).toBe(' World');

    // Selection should be at the end of the inserted text
    expect(result.newSelection.start.node).toBe(paragraph.children![1].children![0]);
    expect(result.newSelection.start.offset).toBe(6); // Length of " there"

    expect(result.didChange).toBe(true);
    expect(result.isPersistent).toBe(true);

    // Verify getFormattingAtSelection was called
    expect(getFormattingSpy).toHaveBeenCalledWith(vdom, selection);
  });

  test('should insert text with multiple active formatting toggle states', () => {
    // Setup VDOM with text content
    const textNode: VDOMNode = {
      type: 'text',
      path: [0],
      content: 'Hello World',
    };

    const vdom: VDOMNode[] = [textNode];
    const selection: VDOMSelection = {
      start: { node: textNode, offset: 5 },
      end: { node: textNode, offset: 5 },
      isCollapsed: true,
    };

    const currentState: EditorState = {
      vdom,
      selection,
      canUndo: false,
      canRedo: false,
      formatToggleState: {
        bold: 'active',
        italic: 'active',
        underline: 'inactive',
      },
    };

    // Mock getFormattingAtSelection to return inactive formatting
    const getFormattingSpy = vi.spyOn(VDOMSelectionModule, 'getFormattingAtSelection');
    getFormattingSpy.mockReturnValue({
      bold: 'inactive',
      italic: 'inactive',
      underline: 'inactive',
    });

    const result = fsm.processCommand({ type: 'INSERT_TEXT', payload: ' there' }, currentState);

    // Verify text was inserted with both bold and italic formatting
    expect(result.newVDOM.length).toBe(1);

    // The result should have a structure like:
    // [text "Hello"][strong [em [text " there"]]][text " World"]
    const paragraph = result.newVDOM[0];
    expect(paragraph.type).toBe('paragraph');
    expect(paragraph.children!.length).toBe(3);

    // First child should be "Hello"
    expect(paragraph.children![0].type).toBe('text');
    expect(paragraph.children![0].content).toBe('Hello');

    // Second child should be an em node containing a strong node with " there"
    expect(paragraph.children![1].type).toBe('em');
    expect(paragraph.children![1].children![0].type).toBe('strong');
    expect(paragraph.children![1].children![0].children![0].type).toBe('text');
    expect(paragraph.children![1].children![0].children![0].content).toBe(' there');

    // Third child should be " World"
    expect(paragraph.children![2].type).toBe('text');
    expect(paragraph.children![2].content).toBe(' World');

    // Selection should be at the end of the inserted text
    expect(result.newSelection.start.node).toBe(paragraph.children![1].children![0].children![0]);
    expect(result.newSelection.start.offset).toBe(6); // Length of " there"

    expect(result.didChange).toBe(true);
    expect(result.isPersistent).toBe(true);

    // Verify getFormattingAtSelection was called
    expect(getFormattingSpy).toHaveBeenCalledWith(vdom, selection);
  });
});
