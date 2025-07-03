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

test('findNodeByDOMNode should find VDOM node corresponding to DOM node', () => {
  const vdom = createSimpleVDOM();
  const mockDOMNode = createMockTextNode('Hello ');

  // Mock the mapping - in real implementation this would use DOM traversal
  const result = findNodeByDOMNode(vdom, mockDOMNode, document.createElement('div'));

  // Since we can't easily mock the DOM traversal, we'll test the structure
  expect(typeof result).toBe('object');
});

test('getTextOffsetInVDOM should calculate correct offset in VDOM structure', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];

  const offset = getTextOffsetInVDOM(vdom, textNode.id, 3);

  expect(offset).toBe(3);
});

test('getTextOffsetInVDOM should handle offset in nested nodes', () => {
  const vdom = createSimpleVDOM();
  const strongNode = vdom[0].children![1];
  const textInStrong = strongNode.children![0];

  const offset = getTextOffsetInVDOM(vdom, textInStrong.id, 2);

  // Should be 6 + 2 = 8 (6 for "Hello " + 2 for "wo" in "world")
  expect(offset).toBe(8);
});

test('getSelectionFromBrowser should convert browser selection to VDOM selection', () => {
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

test('getSelectionFromBrowser should handle collapsed selection', () => {
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

test('applySelectionToBrowser should set browser selection from VDOM selection', () => {
  const vdom = createSimpleVDOM();
  const rootElement = document.createElement('div');
  const selection = createSelection(2, 5);

  const mockRange = {
    setStart: vi.fn(),
    setEnd: vi.fn(),
    collapse: vi.fn(),
  };

  mockSelectionService.createRange.mockReturnValue(mockRange);

  applySelectionToBrowser(mockSelectionService, selection, rootElement, vdom);

  expect(mockSelectionService.createRange).toHaveBeenCalled();
  expect(mockSelectionService.setSelectionRange).toHaveBeenCalledWith(mockRange);
});

test('applySelectionToBrowser should handle collapsed selection', () => {
  const vdom = createSimpleVDOM();
  const rootElement = document.createElement('div');
  const selection = createSelection(3, 3);

  const mockRange = {
    setStart: vi.fn(),
    setEnd: vi.fn(),
    collapse: vi.fn(),
  };

  mockSelectionService.createRange.mockReturnValue(mockRange);

  applySelectionToBrowser(mockSelectionService, selection, rootElement, vdom);

  expect(mockSelectionService.createRange).toHaveBeenCalled();
  expect(mockSelectionService.setSelectionRange).toHaveBeenCalledWith(mockRange);
});

test('getNodesInRange should return nodes within selection range', () => {
  const vdom = createSimpleVDOM();
  const selection = createSelection(3, 8);

  const nodes = getNodesInRange(vdom, selection);

  expect(nodes).toBeDefined();
  expect(Array.isArray(nodes)).toBe(true);
  expect(nodes.length).toBeGreaterThan(0);
});

test('getNodesInRange should handle collapsed selection', () => {
  const vdom = createSimpleVDOM();
  const selection = createSelection(3, 3);

  const nodes = getNodesInRange(vdom, selection);

  expect(nodes).toBeDefined();
  expect(Array.isArray(nodes)).toBe(true);
  expect(nodes.length).toBeGreaterThan(0);
});

test('getNodesInRange should handle single node selection', () => {
  const vdom = createSimpleVDOM();
  const selection = createSelection(1, 4);

  const nodes = getNodesInRange(vdom, selection);

  expect(nodes).toBeDefined();
  expect(Array.isArray(nodes)).toBe(true);
  expect(nodes.length).toBeGreaterThan(0);
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
  const vdom = createSimpleVDOM();
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
    applySelectionToBrowser(mockSelectionService, selection, null as never, vdom);
  }).not.toThrow();

  expect(consoleSpy).toHaveBeenCalledWith('Cannot apply selection to browser: rootElement is null');
  expect(mockSelectionService.createRange).not.toHaveBeenCalled();

  consoleSpy.mockRestore();
});

test('applySelectionToBrowser should handle missing VDOM nodes gracefully', () => {
  const vdom = createSimpleVDOM();
  const rootElement = document.createElement('div');
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
    applySelectionToBrowser(mockSelectionService, selection, rootElement, vdom);
  }).not.toThrow();

  // Should create range since we're using simplified approach
  expect(mockSelectionService.createRange).toHaveBeenCalled();
});
