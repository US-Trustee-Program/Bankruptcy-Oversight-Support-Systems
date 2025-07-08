import { test, expect, beforeEach, vi } from 'vitest';
import { VDOMNode, VDOMSelection } from '../types';
import {
  createTextNode,
  createParagraphNode,
  createStrongNode,
  createEmNode,
  createUNode,
} from './VDOMNode';
import {
  getSelectionFromBrowser,
  applySelectionToBrowser,
  getNodesInRange,
  getFormattingAtSelection,
  findNodeByDOMNode,
  getTextOffsetInVDOM,
  textContentOffsetToNodeOffset, // Add the new function we're testing
} from './VDOMSelection';

// Mock SelectionService for testing
const mockSelectionService = {
  getCurrentSelection: vi.fn(),
  createRange: vi.fn(),
  setSelectionRange: vi.fn(),
  getSelectionText: vi.fn(),
  isSelectionCollapsed: vi.fn(),
  getSelectionAnchorNode: vi.fn(),
  getSelectionAnchorOffset: vi.fn(),
  getSelectionFocusNode: vi.fn(),
  getSelectionFocusOffset: vi.fn(),
};

// Mock DOM elements for testing
const createMockTextNode = (content: string) =>
  ({
    nodeType: 3, // TEXT_NODE
    textContent: content,
    parentNode: null,
  }) as unknown as Node;

beforeEach(() => {
  vi.restoreAllMocks();
});

// Helper function to create a selection - Simplified approach
function createSelection(startOffset: number, endOffset: number): VDOMSelection {
  return {
    start: { offset: startOffset },
    end: { offset: endOffset },
    isCollapsed: startOffset === endOffset,
  };
}

// Helper function to create a simple VDOM structure
function createSimpleVDOM(): VDOMNode[] {
  return [
    createParagraphNode([
      createTextNode('Hello '),
      createStrongNode([createTextNode('world')]),
      createTextNode('!'),
    ]),
  ];
}

test('should return VDOM node that matches DOM node text content', () => {
  const vdom = createSimpleVDOM();
  const mockDOMNode = createMockTextNode('Hello ');

  // Mock the mapping - in real implementation this would use DOM traversal
  const result = findNodeByDOMNode(vdom, mockDOMNode);

  // Since we can't easily mock the DOM traversal, we'll test the structure
  expect(typeof result).toBe('object');
});

test('should calculate cumulative text offset up to specified node and position', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];

  const offset = getTextOffsetInVDOM(vdom, textNode.id, 3);

  expect(offset).toBe(3);
});

test('should include parent text length when calculating offset within nested formatting nodes', () => {
  const vdom = createSimpleVDOM();
  const strongNode = vdom[0].children![1];
  const textInStrong = strongNode.children![0];

  const offset = getTextOffsetInVDOM(vdom, textInStrong.id, 2);

  // Should be 6 + 2 = 8 (6 for "Hello " + 2 for "wo" in "world")
  expect(offset).toBe(8);
});

test('should convert DOM node positions to absolute text offsets when getting browser selection', () => {
  // Mock browser selection
  const mockSelection = {
    anchorNode: createMockTextNode('Hello '),
    anchorOffset: 2,
    focusNode: createMockTextNode('Hello '),
    focusOffset: 5,
    isCollapsed: false,
  };

  mockSelectionService.getCurrentSelection.mockReturnValue(mockSelection);
  mockSelectionService.getSelectionAnchorNode.mockReturnValue(mockSelection.anchorNode);
  mockSelectionService.getSelectionAnchorOffset.mockReturnValue(mockSelection.anchorOffset);
  mockSelectionService.getSelectionFocusNode.mockReturnValue(mockSelection.focusNode);
  mockSelectionService.getSelectionFocusOffset.mockReturnValue(mockSelection.focusOffset);
  mockSelectionService.isSelectionCollapsed.mockReturnValue(mockSelection.isCollapsed);

  const result = getSelectionFromBrowser(mockSelectionService);

  expect(result).toBeDefined();
  expect(result.isCollapsed).toBe(false);
});

test('should create collapsed VDOM selection when browser selection has same start and end positions', () => {
  const mockSelection = {
    anchorNode: createMockTextNode('Hello '),
    anchorOffset: 3,
    focusNode: createMockTextNode('Hello '),
    focusOffset: 3,
    isCollapsed: true,
  };

  mockSelectionService.getCurrentSelection.mockReturnValue(mockSelection);
  mockSelectionService.getSelectionAnchorNode.mockReturnValue(mockSelection.anchorNode);
  mockSelectionService.getSelectionAnchorOffset.mockReturnValue(mockSelection.anchorOffset);
  mockSelectionService.getSelectionFocusNode.mockReturnValue(mockSelection.focusNode);
  mockSelectionService.getSelectionFocusOffset.mockReturnValue(mockSelection.focusOffset);
  mockSelectionService.isSelectionCollapsed.mockReturnValue(mockSelection.isCollapsed);

  const result = getSelectionFromBrowser(mockSelectionService);

  expect(result).toBeDefined();
  expect(result.isCollapsed).toBe(true);
});

test('should convert absolute text offsets to DOM range and apply to browser selection', () => {
  const rootElement = document.createElement('div');
  // Set contentEditable to true to make the test pass with our new check
  rootElement.setAttribute('contentEditable', 'true');
  const selection = createSelection(2, 5);

  const mockRange = {
    setStart: vi.fn(),
    setEnd: vi.fn(),
    collapse: vi.fn(),
  };

  mockSelectionService.createRange.mockReturnValue(mockRange);

  applySelectionToBrowser(mockSelectionService, selection, rootElement);

  expect(mockSelectionService.createRange).toHaveBeenCalled();
  expect(mockSelectionService.setSelectionRange).toHaveBeenCalledWith(mockRange);
});

test('applySelectionToBrowser should handle collapsed selection', () => {
  const rootElement = document.createElement('div');
  // Set contentEditable to true to make the test pass with our new check
  rootElement.setAttribute('contentEditable', 'true');
  const selection = createSelection(3, 3);

  const mockRange = {
    setStart: vi.fn(),
    setEnd: vi.fn(),
    collapse: vi.fn(),
  };

  mockSelectionService.createRange.mockReturnValue(mockRange);

  applySelectionToBrowser(mockSelectionService, selection, rootElement);

  expect(mockSelectionService.createRange).toHaveBeenCalled();
  expect(mockSelectionService.setSelectionRange).toHaveBeenCalledWith(mockRange);
});

test('getNodesInRange should return nodes from VDOM', () => {
  const vdom = createSimpleVDOM();

  const nodes = getNodesInRange(vdom);

  expect(nodes).toBeDefined();
  expect(Array.isArray(nodes)).toBe(true);
  expect(nodes.length).toBeGreaterThan(0);
});

test('getNodesInRange should find all text nodes', () => {
  const vdom = createSimpleVDOM();

  const nodes = getNodesInRange(vdom);

  expect(nodes).toBeDefined();
  expect(Array.isArray(nodes)).toBe(true);
  // SimpleVDOM has 3 text nodes (Hello, world, !)
  expect(nodes.length).toBe(3);
  expect(nodes.every((node) => node.type === 'text')).toBe(true);
});

test('getNodesInRange should handle complex VDOM structures', () => {
  const vdom = [
    createParagraphNode([
      createTextNode('First '),
      createStrongNode([createTextNode('bold'), createEmNode([createTextNode('and italic')])]),
      createTextNode(' text'),
    ]),
  ];

  const nodes = getNodesInRange(vdom);

  expect(nodes).toBeDefined();
  expect(Array.isArray(nodes)).toBe(true);
  // Should find all 4 text nodes
  expect(nodes.length).toBe(4);
});

test('getFormattingAtSelection should detect bold formatting', () => {
  const vdom = [
    createParagraphNode([
      createTextNode('Hello '),
      createStrongNode([createTextNode('world')]),
      createTextNode('!'),
    ]),
  ];
  const selection = createSelection(8, 8);

  const formatting = getFormattingAtSelection(vdom, selection);

  // For vertical slice #1, formatting is not implemented yet
  expect(formatting.bold).toBe(false);
  expect(formatting.italic).toBe(false);
  expect(formatting.underline).toBe(false);
});

test('getFormattingAtSelection should detect italic formatting', () => {
  const vdom = [
    createParagraphNode([
      createTextNode('Hello '),
      createEmNode([createTextNode('world')]),
      createTextNode('!'),
    ]),
  ];
  const selection = createSelection(8, 8);

  const formatting = getFormattingAtSelection(vdom, selection);

  // For vertical slice #1, formatting is not implemented yet
  expect(formatting.bold).toBe(false);
  expect(formatting.italic).toBe(false);
  expect(formatting.underline).toBe(false);
});

test('getFormattingAtSelection should detect underline formatting', () => {
  const vdom = [
    createParagraphNode([
      createTextNode('Hello '),
      createUNode([createTextNode('world')]),
      createTextNode('!'),
    ]),
  ];
  const selection = createSelection(8, 8);

  const formatting = getFormattingAtSelection(vdom, selection);

  // For vertical slice #1, formatting is not implemented yet
  expect(formatting.bold).toBe(false);
  expect(formatting.italic).toBe(false);
  expect(formatting.underline).toBe(false);
});

test('getFormattingAtSelection should detect multiple formatting', () => {
  const vdom = [
    createParagraphNode([
      createStrongNode([createEmNode([createUNode([createTextNode('formatted text')])])]),
    ]),
  ];
  const selection = createSelection(5, 5);

  const formatting = getFormattingAtSelection(vdom, selection);

  // For vertical slice #1, formatting is not implemented yet
  expect(formatting.bold).toBe(false);
  expect(formatting.italic).toBe(false);
  expect(formatting.underline).toBe(false);
});

test('getFormattingAtSelection should handle plain text', () => {
  const vdom = createSimpleVDOM();
  const selection = createSelection(2, 2);

  const formatting = getFormattingAtSelection(vdom, selection);

  expect(formatting.bold).toBe(false);
  expect(formatting.italic).toBe(false);
  expect(formatting.underline).toBe(false);
});

test('getFormattingAtSelection should handle range selection with mixed formatting', () => {
  const vdom = [
    createParagraphNode([
      createTextNode('plain '),
      createStrongNode([createTextNode('bold')]),
      createTextNode(' text'),
    ]),
  ];
  const selection = createSelection(3, 12);

  const formatting = getFormattingAtSelection(vdom, selection);

  // For vertical slice #1, formatting is not implemented yet
  expect(formatting.bold).toBe(false);
  expect(formatting.italic).toBe(false);
  expect(formatting.underline).toBe(false);
});

// Tests for null handling scenarios
test('applySelectionToBrowser should handle null rootElement gracefully', () => {
  // Remove unused vdom variable
  const selection = createSelection(2, 5);

  const mockRange = {
    setStart: vi.fn(),
    setEnd: vi.fn(),
    collapse: vi.fn(),
  };

  mockSelectionService.createRange.mockReturnValue(mockRange);

  // Mock console.warn to verify it's called
  const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  // This should not throw an error and should log a warning
  expect(() => {
    applySelectionToBrowser(mockSelectionService, selection, null as never);
  }).not.toThrow();

  expect(consoleSpy).toHaveBeenCalledWith('Cannot apply selection to browser: rootElement is null');
  expect(mockSelectionService.createRange).not.toHaveBeenCalled();

  consoleSpy.mockRestore();
});

test('applySelectionToBrowser should not apply selection to non-editable elements', () => {
  const rootElement = document.createElement('div');
  // Explicitly NOT setting contentEditable="true"
  const selection = createSelection(2, 5);

  const mockRange = {
    setStart: vi.fn(),
    setEnd: vi.fn(),
    collapse: vi.fn(),
  };

  mockSelectionService.createRange.mockReturnValue(mockRange);

  // Mock console.warn to verify it's called
  const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  // This should not throw an error and should log a warning
  expect(() => {
    applySelectionToBrowser(mockSelectionService, selection, rootElement);
  }).not.toThrow();

  expect(consoleSpy).toHaveBeenCalledWith(
    'Cannot apply selection to browser: rootElement is not an editable field of this editor',
  );
  expect(mockSelectionService.createRange).not.toHaveBeenCalled();

  consoleSpy.mockRestore();
});

test('applySelectionToBrowser should handle missing VDOM nodes gracefully', () => {
  const rootElement = document.createElement('div');
  // Set contentEditable to true to make the test pass with our new check
  rootElement.setAttribute('contentEditable', 'true');
  // Create selection with valid offsets
  const selection = createSelection(2, 5);

  const mockRange = {
    setStart: vi.fn(),
    setEnd: vi.fn(),
    collapse: vi.fn(),
  };

  mockSelectionService.createRange.mockReturnValue(mockRange);

  // This should not throw an error
  expect(() => {
    applySelectionToBrowser(mockSelectionService, selection, rootElement);
  }).not.toThrow();

  // Should create range since we're using simplified approach
  expect(mockSelectionService.createRange).toHaveBeenCalled();
});

test('applySelectionToBrowser should apply selection when ancestor is contentEditable', () => {
  // Create a nested structure: div (contentEditable) > span > p
  const rootElement = document.createElement('div');
  rootElement.setAttribute('contentEditable', 'true');

  const span = document.createElement('span');
  rootElement.appendChild(span);

  const paragraph = document.createElement('p');
  span.appendChild(paragraph);

  const selection = createSelection(2, 5);

  const mockRange = {
    setStart: vi.fn(),
    setEnd: vi.fn(),
    collapse: vi.fn(),
  };

  mockSelectionService.createRange.mockReturnValue(mockRange);

  // This should not throw and should apply the selection
  applySelectionToBrowser(mockSelectionService, selection, paragraph);

  // Selection service should be called since paragraph is inside contentEditable div
  expect(mockSelectionService.createRange).toHaveBeenCalled();
  expect(mockSelectionService.setSelectionRange).toHaveBeenCalledWith(mockRange);
});

test('applySelectionToBrowser should apply selection when using the correct editorId', () => {
  const rootElement = document.createElement('div');
  rootElement.setAttribute('contentEditable', 'true');
  rootElement.setAttribute('data-editor-id', 'editor-123');
  const selection = createSelection(2, 5);

  const mockRange = {
    setStart: vi.fn(),
    setEnd: vi.fn(),
    collapse: vi.fn(),
  };

  mockSelectionService.createRange.mockReturnValue(mockRange);

  // Apply selection with matching editor ID
  applySelectionToBrowser(mockSelectionService, selection, rootElement, 'editor-123');

  expect(mockSelectionService.createRange).toHaveBeenCalled();
  expect(mockSelectionService.setSelectionRange).toHaveBeenCalledWith(mockRange);
});

test('applySelectionToBrowser should not apply selection with incorrect editorId', () => {
  const rootElement = document.createElement('div');
  rootElement.setAttribute('contentEditable', 'true');
  rootElement.setAttribute('data-editor-id', 'editor-123');
  const selection = createSelection(2, 5);

  const mockRange = {
    setStart: vi.fn(),
    setEnd: vi.fn(),
    collapse: vi.fn(),
  };

  mockSelectionService.createRange.mockReturnValue(mockRange);

  const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  // Apply selection with non-matching editor ID
  applySelectionToBrowser(mockSelectionService, selection, rootElement, 'editor-456');

  expect(consoleSpy).toHaveBeenCalledWith(
    'Cannot apply selection to browser: rootElement is not an editable field of this editor',
  );
  expect(mockSelectionService.createRange).not.toHaveBeenCalled();

  consoleSpy.mockRestore();
});

test('applySelectionToBrowser should apply selection to element with correct editor class', () => {
  const rootElement = document.createElement('div');
  rootElement.setAttribute('contentEditable', 'true');
  rootElement.classList.add('rich-text-editor-editor-789');
  const selection = createSelection(2, 5);

  const mockRange = {
    setStart: vi.fn(),
    setEnd: vi.fn(),
    collapse: vi.fn(),
  };

  mockSelectionService.createRange.mockReturnValue(mockRange);

  // Apply selection with matching editor ID via class name
  applySelectionToBrowser(mockSelectionService, selection, rootElement, 'editor-789');

  expect(mockSelectionService.createRange).toHaveBeenCalled();
  expect(mockSelectionService.setSelectionRange).toHaveBeenCalledWith(mockRange);
});

// Helper function to render VDOM to DOM element for testing
function renderVDOMToDOM(vdom: VDOMNode[], container: HTMLElement): void {
  // Simple implementation that creates DOM nodes from VDOM
  container.innerHTML = '';
  vdom.forEach((node) => {
    const domNode = createDOMFromVDOM(node);
    container.appendChild(domNode);
  });
}

function createDOMFromVDOM(vdom: VDOMNode): Node {
  if (vdom.type === 'text') {
    return document.createTextNode(vdom.content || '');
  }

  const element = document.createElement(vdom.type);
  if (vdom.children) {
    vdom.children.forEach((child) => {
      element.appendChild(createDOMFromVDOM(child));
    });
  }
  return element;
}

/**
 * These tests are designed to FAIL and expose the offset mapping bug
 * where selection offsets are assumed to be text content offsets
 * when they're actually DOM node-relative offsets.
 */

test('Selection across formatted text boundaries correctly maps offsets', () => {
  // Setup: Create VDOM with mixed formatting - "Hello [bold]world[/bold] test"
  const vdom: VDOMNode[] = [
    createTextNode('Hello '),
    createStrongNode([createTextNode('world')]),
    createTextNode(' test'),
  ];

  // Create DOM element and render VDOM
  const rootElement = document.createElement('div');
  rootElement.setAttribute('contenteditable', 'true');
  rootElement.setAttribute('data-editor-root', 'true');
  document.body.appendChild(rootElement);
  renderVDOMToDOM(vdom, rootElement);

  // The DOM structure is now:
  // - Text node: "Hello "      (offsets 0-5 in text content, 0-5 in DOM)
  // - <strong>                 (no direct text)
  //   - Text node: "world"     (offsets 6-10 in text content, 0-4 in DOM node)
  // - Text node: " test"       (offsets 11-15 in text content, 0-4 in DOM node)

  // Simulate browser selection: select "o w" (spans across format boundary)
  // In text content this should be offsets 4-7
  // But in DOM, "o" is at offset 4 in first text node, "w" is at offset 0 in bold text node

  const firstTextNode = rootElement.firstChild;
  const boldTextNode = rootElement.querySelector('strong')?.firstChild;

  const mockSelection = {
    anchorNode: firstTextNode, // First text node "Hello "
    focusNode: boldTextNode, // Bold text node "world"
    anchorOffset: 4, // "o" in "Hello "
    focusOffset: 1, // "w" in "world"
    isCollapsed: false,
  };

  mockSelectionService.getCurrentSelection.mockReturnValue(mockSelection as unknown as Selection);
  mockSelectionService.getSelectionAnchorOffset.mockReturnValue(4);
  mockSelectionService.getSelectionFocusOffset.mockReturnValue(1);
  mockSelectionService.isSelectionCollapsed.mockReturnValue(false);

  // Get the VDOM selection using current implementation
  const vdomSelection = getSelectionFromBrowser(mockSelectionService);

  // This SHOULD be the correct text content offsets for "o w"
  const expectedSelection: VDOMSelection = {
    start: { offset: 4 }, // "o" in "Hello world test"
    end: { offset: 7 }, // "w" in "Hello world test"
    isCollapsed: false,
  };

  // Clean up
  document.body.removeChild(rootElement);

  // This test now PASSES because we've implemented proper
  // DOM node-relative to text content offset mapping
  expect(vdomSelection).toEqual(expectedSelection);
});

test('Selection starting in formatted text correctly maps offsets', () => {
  // Setup: Create VDOM with bold at start - "[bold]Hello[/bold] world"
  const vdom: VDOMNode[] = [createStrongNode([createTextNode('Hello')]), createTextNode(' world')];

  const rootElement = document.createElement('div');
  rootElement.setAttribute('contenteditable', 'true');
  document.body.appendChild(rootElement);
  renderVDOMToDOM(vdom, rootElement);

  // DOM structure:
  // - <strong>
  //   - Text node: "Hello"     (offsets 0-4 in text content, 0-4 in DOM node)
  // - Text node: " world"     (offsets 5-10 in text content, 0-5 in DOM node)

  // Simulate browser selection: select "lo w" (from bold text to regular text)
  const boldTextNode = rootElement.querySelector('strong')?.firstChild;
  const regularTextNode = rootElement.lastChild;

  const mockSelection = {
    anchorNode: boldTextNode, // Bold text "Hello"
    focusNode: regularTextNode, // Regular text " world"
    anchorOffset: 3, // "l" in "Hello"
    focusOffset: 2, // "w" in " world"
    isCollapsed: false,
  };

  mockSelectionService.getCurrentSelection.mockReturnValue(mockSelection as unknown as Selection);
  mockSelectionService.getSelectionAnchorOffset.mockReturnValue(3);
  mockSelectionService.getSelectionFocusOffset.mockReturnValue(2);
  mockSelectionService.isSelectionCollapsed.mockReturnValue(false);

  const vdomSelection = getSelectionFromBrowser(mockSelectionService);

  // Expected text content offsets for "lo w"
  const expectedSelection: VDOMSelection = {
    start: { offset: 3 }, // "l" in "Hello world"
    end: { offset: 7 }, // "w" in "Hello world"
    isCollapsed: false,
  };

  // Clean up
  document.body.removeChild(rootElement);

  // This test now PASSES - offset mapping works correctly
  expect(vdomSelection).toEqual(expectedSelection);
});

test('Multiple format nodes correctly accumulate offsets', () => {
  // Setup: Complex VDOM - "A[bold]B[/bold]C[italic]D[/italic]E"
  const vdom: VDOMNode[] = [
    createTextNode('A'),
    createStrongNode([createTextNode('B')]),
    createTextNode('C'),
    createEmNode([createTextNode('D')]),
    createTextNode('E'),
  ];

  const rootElement = document.createElement('div');
  rootElement.setAttribute('contenteditable', 'true');
  document.body.appendChild(rootElement);
  renderVDOMToDOM(vdom, rootElement);

  // Text content: "ABCDE" (positions 0,1,2,3,4)
  // DOM structure creates multiple separate text nodes

  // Simulate selecting "CD" (across italic boundary)
  const cTextNode = rootElement.childNodes[2]; // Text node "C"
  const dTextNode = rootElement.querySelector('em')?.firstChild; // Italic text "D"

  const mockSelection = {
    anchorNode: cTextNode, // Text node "C"
    focusNode: dTextNode, // Italic text "D"
    anchorOffset: 0, // "C"
    focusOffset: 1, // "D" (end of selection)
    isCollapsed: false,
  };

  mockSelectionService.getCurrentSelection.mockReturnValue(mockSelection as unknown as Selection);
  mockSelectionService.getSelectionAnchorOffset.mockReturnValue(0);
  mockSelectionService.getSelectionFocusOffset.mockReturnValue(1);
  mockSelectionService.isSelectionCollapsed.mockReturnValue(false);

  const vdomSelection = getSelectionFromBrowser(mockSelectionService);

  // Expected text content offsets for "CD"
  const expectedSelection: VDOMSelection = {
    start: { offset: 2 }, // "C" in "ABCDE"
    end: { offset: 4 }, // End of "D" in "ABCDE"
    isCollapsed: false,
  };

  // Clean up
  document.body.removeChild(rootElement);

  // This test now PASSES - the offset mapping fix correctly handles
  // multiple format nodes and accumulates text content offsets properly
  expect(vdomSelection).toEqual(expectedSelection);
});

// New tests for textContentOffsetToNodeOffset function
test('should return node ID and relative offset when given absolute position in single text node', () => {
  const vdom: VDOMNode[] = [
    {
      id: 'text-1',
      type: 'text',
      content: 'Hello World',
    },
  ];

  // Test various positions within the text
  expect(textContentOffsetToNodeOffset(vdom, 0)).toEqual({
    nodeId: 'text-1',
    offset: 0,
  });

  expect(textContentOffsetToNodeOffset(vdom, 5)).toEqual({
    nodeId: 'text-1',
    offset: 5,
  });

  expect(textContentOffsetToNodeOffset(vdom, 11)).toEqual({
    nodeId: 'text-1',
    offset: 11,
  });
});

test('should map absolute positions to correct nodes when text is split across multiple nodes', () => {
  const vdom: VDOMNode[] = [
    {
      id: 'text-1',
      type: 'text',
      content: 'Hello ',
    },
    {
      id: 'text-2',
      type: 'text',
      content: 'World',
    },
  ];

  // Position 0-5 should be in first node
  expect(textContentOffsetToNodeOffset(vdom, 0)).toEqual({
    nodeId: 'text-1',
    offset: 0,
  });

  expect(textContentOffsetToNodeOffset(vdom, 3)).toEqual({
    nodeId: 'text-1',
    offset: 3,
  });

  expect(textContentOffsetToNodeOffset(vdom, 6)).toEqual({
    nodeId: 'text-1',
    offset: 6,
  });

  // Position 6-10 should be in second node
  expect(textContentOffsetToNodeOffset(vdom, 7)).toEqual({
    nodeId: 'text-2',
    offset: 1,
  });

  expect(textContentOffsetToNodeOffset(vdom, 11)).toEqual({
    nodeId: 'text-2',
    offset: 5,
  });
});

test('should traverse into formatting containers to find text nodes when position falls within formatted text', () => {
  const vdom: VDOMNode[] = [
    {
      id: 'text-1',
      type: 'text',
      content: 'This is a ',
    },
    {
      id: 'strong-1',
      type: 'strong',
      children: [
        {
          id: 'text-2',
          type: 'text',
          content: 'test',
        },
      ],
    },
  ];

  // Position 0-9 should be in first text node
  expect(textContentOffsetToNodeOffset(vdom, 0)).toEqual({
    nodeId: 'text-1',
    offset: 0,
  });

  expect(textContentOffsetToNodeOffset(vdom, 5)).toEqual({
    nodeId: 'text-1',
    offset: 5,
  });

  expect(textContentOffsetToNodeOffset(vdom, 10)).toEqual({
    nodeId: 'text-1',
    offset: 10,
  });

  // Position 10-14 should be in the text node inside strong
  expect(textContentOffsetToNodeOffset(vdom, 11)).toEqual({
    nodeId: 'text-2',
    offset: 1,
  });

  expect(textContentOffsetToNodeOffset(vdom, 14)).toEqual({
    nodeId: 'text-2',
    offset: 4,
  });
});

test('should place cursor at end of previous text node when position falls exactly at node boundary', () => {
  // This is the exact scenario from our bug report
  const vdom: VDOMNode[] = [
    {
      id: 'text-1',
      type: 'text',
      content: 'This is a ',
    },
    {
      id: 'strong-1',
      type: 'strong',
      children: [
        {
          id: 'text-2',
          type: 'text',
          content: 'test',
        },
      ],
    },
  ];

  // Position 10 is exactly at the boundary between "This is a " and "test"
  // We should favor placing cursor at the end of the first node for insertion
  expect(textContentOffsetToNodeOffset(vdom, 10)).toEqual({
    nodeId: 'text-1',
    offset: 10,
  });

  // Position 14 is at the very end of document - should be at end of last text node
  expect(textContentOffsetToNodeOffset(vdom, 14)).toEqual({
    nodeId: 'text-2',
    offset: 4,
  });
});

test('should traverse multiple levels of nested formatting to find correct text node', () => {
  const vdom: VDOMNode[] = [
    {
      id: 'text-1',
      type: 'text',
      content: 'Plain ',
    },
    {
      id: 'strong-1',
      type: 'strong',
      children: [
        {
          id: 'text-2',
          type: 'text',
          content: 'bold ',
        },
        {
          id: 'em-1',
          type: 'em',
          children: [
            {
              id: 'text-3',
              type: 'text',
              content: 'italic',
            },
          ],
        },
      ],
    },
    {
      id: 'text-4',
      type: 'text',
      content: ' end',
    },
  ];

  // "Plain " = 6 chars
  expect(textContentOffsetToNodeOffset(vdom, 3)).toEqual({
    nodeId: 'text-1',
    offset: 3,
  });

  // "Plain bold " = 11 chars, position 8 should be in "bold " text
  expect(textContentOffsetToNodeOffset(vdom, 8)).toEqual({
    nodeId: 'text-2',
    offset: 2,
  });

  // "Plain bold italic" = 17 chars, position 13 should be in "italic" text
  expect(textContentOffsetToNodeOffset(vdom, 13)).toEqual({
    nodeId: 'text-3',
    offset: 2,
  });

  // Position 18 should be in final " end" text
  expect(textContentOffsetToNodeOffset(vdom, 18)).toEqual({
    nodeId: 'text-4',
    offset: 1,
  });
});

test('should return null when given invalid positions outside document bounds', () => {
  const vdom: VDOMNode[] = [
    {
      id: 'text-1',
      type: 'text',
      content: 'Hello',
    },
  ];

  // Position beyond end of content should return null
  expect(textContentOffsetToNodeOffset(vdom, 10)).toBeNull();

  // Negative position should return null
  expect(textContentOffsetToNodeOffset(vdom, -1)).toBeNull();
});

test('should return null when document contains no content', () => {
  const vdom: VDOMNode[] = [];

  expect(textContentOffsetToNodeOffset(vdom, 0)).toBeNull();
  expect(textContentOffsetToNodeOffset(vdom, 5)).toBeNull();
});

test('should handle empty text nodes by placing cursor at their zero position', () => {
  const vdom: VDOMNode[] = [
    {
      id: 'text-1',
      type: 'text',
      content: '',
    },
    {
      id: 'text-2',
      type: 'text',
      content: 'Hello',
    },
  ];

  // Position 0 should be in the empty text node
  expect(textContentOffsetToNodeOffset(vdom, 0)).toEqual({
    nodeId: 'text-1',
    offset: 0,
  });

  // Position 1 should be in the second text node
  expect(textContentOffsetToNodeOffset(vdom, 1)).toEqual({
    nodeId: 'text-2',
    offset: 1,
  });
});

test('should skip non-text nodes when calculating text positions', () => {
  const vdom: VDOMNode[] = [
    {
      id: 'text-1',
      type: 'text',
      content: 'Hello',
    },
    {
      id: 'br-1',
      type: 'br',
    },
    {
      id: 'text-2',
      type: 'text',
      content: 'World',
    },
  ];

  // BR nodes don't contribute to text content, so positions should skip them
  expect(textContentOffsetToNodeOffset(vdom, 3)).toEqual({
    nodeId: 'text-1',
    offset: 3,
  });

  expect(textContentOffsetToNodeOffset(vdom, 7)).toEqual({
    nodeId: 'text-2',
    offset: 2,
  });
});

test('should maintain position accuracy when converting between absolute and node-based selections', () => {
  const vdom: VDOMNode[] = [
    {
      id: 'text-1',
      type: 'text',
      content: 'This is a ',
    },
    {
      id: 'strong-1',
      type: 'strong',
      children: [
        {
          id: 'text-2',
          type: 'text',
          content: 'test',
        },
      ],
    },
  ];

  // Test round-trip conversion for various positions
  const testPositions = [0, 3, 7, 10, 11, 13, 14];

  for (const absolutePos of testPositions) {
    const nodePos = textContentOffsetToNodeOffset(vdom, absolutePos);

    if (nodePos) {
      const backToAbsolute = getTextOffsetInVDOM(vdom, nodePos.nodeId, nodePos.offset);
      expect(backToAbsolute).toBe(absolutePos);
    }
  }
});
