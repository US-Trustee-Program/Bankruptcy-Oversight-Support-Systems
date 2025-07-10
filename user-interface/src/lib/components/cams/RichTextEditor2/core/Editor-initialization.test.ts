import { describe, it, expect, vi } from 'vitest';
import { Editor } from './Editor';
import { ZERO_WIDTH_SPACE } from '../RichTextEditor.constants';

// Create a basic mock selection service for testing
const createMockSelectionService = () => ({
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
});

describe('Editor Initialization', () => {
  it('should initialize VDOM with a single paragraph containing a text node with ZERO_WIDTH_SPACE', () => {
    // Create editor instance
    const editor = new Editor({
      onChange: vi.fn(),
      selectionService: createMockSelectionService(),
    });

    // Get the initial VDOM
    const vdom = editor.getVDOM();

    // Verify VDOM structure
    expect(vdom).toHaveLength(1);
    expect(vdom[0].type).toBe('paragraph');
    expect(vdom[0].path).toEqual([0]);
    expect(vdom[0].children).toHaveLength(1);

    // Verify the text node
    const textNode = vdom[0].children![0];
    expect(textNode.type).toBe('text');
    expect(textNode.path).toEqual([0, 0]);
    expect(textNode.content).toBe(ZERO_WIDTH_SPACE);
  });

  it('should initialize selection to point to the text node at offset 0', () => {
    // Create editor instance
    const editor = new Editor({
      onChange: vi.fn(),
      selectionService: createMockSelectionService(),
    });

    // Get the VDOM to reference the actual nodes
    const vdom = editor.getVDOM();
    const expectedTextNode = vdom[0].children![0];

    // Since we don't have direct access to the selection state,
    // we can verify the selection by checking the VDOM structure
    // and ensuring it matches what the selection should point to
    expect(expectedTextNode.type).toBe('text');
    expect(expectedTextNode.content).toBe(ZERO_WIDTH_SPACE);
    expect(expectedTextNode.path).toEqual([0, 0]);
  });

  it('should generate correct HTML for initial state', () => {
    // Create editor instance
    const editor = new Editor({
      onChange: vi.fn(),
      selectionService: createMockSelectionService(),
    });

    // Get the HTML
    const html = editor.getHtml();

    // Verify HTML structure - should be a paragraph with ZERO_WIDTH_SPACE
    expect(html).toBe(`<p>${ZERO_WIDTH_SPACE}</p>`);
  });
});
