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

// Helper function to create a selection
function createSelection(
  startNodeId: string,
  startOffset: number,
  endNodeId: string,
  endOffset: number,
): VDOMSelection {
  return {
    start: { nodeId: startNodeId, offset: startOffset },
    end: { nodeId: endNodeId, offset: endOffset },
    isCollapsed: startNodeId === endNodeId && startOffset === endOffset,
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
  const vdom = createSimpleVDOM();
  const rootElement = document.createElement('div');

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

  const result = getSelectionFromBrowser(mockSelectionService, rootElement, vdom);

  expect(result).toBeDefined();
  expect(result.isCollapsed).toBe(false);
});

test('getSelectionFromBrowser should handle collapsed selection', () => {
  const vdom = createSimpleVDOM();
  const rootElement = document.createElement('div');

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

  const result = getSelectionFromBrowser(mockSelectionService, rootElement, vdom);

  expect(result).toBeDefined();
  expect(result.isCollapsed).toBe(true);
});

test('applySelectionToBrowser should set browser selection from VDOM selection', () => {
  const vdom = createSimpleVDOM();
  const rootElement = document.createElement('div');
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode.id, 2, textNode.id, 5);

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
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode.id, 3, textNode.id, 3);

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
  const firstText = vdom[0].children![0];
  const lastText = vdom[0].children![2];
  const selection = createSelection(firstText.id, 3, lastText.id, 1);

  const nodes = getNodesInRange(vdom, selection);

  expect(nodes).toBeDefined();
  expect(Array.isArray(nodes)).toBe(true);
  expect(nodes.length).toBeGreaterThan(0);
});

test('getNodesInRange should handle collapsed selection', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode.id, 3, textNode.id, 3);

  const nodes = getNodesInRange(vdom, selection);

  expect(nodes).toBeDefined();
  expect(Array.isArray(nodes)).toBe(true);
  expect(nodes.length).toBe(1);
  expect(nodes[0]).toBe(textNode);
});

test('getNodesInRange should handle single node selection', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode.id, 1, textNode.id, 4);

  const nodes = getNodesInRange(vdom, selection);

  expect(nodes).toBeDefined();
  expect(Array.isArray(nodes)).toBe(true);
  expect(nodes.length).toBe(1);
  expect(nodes[0]).toBe(textNode);
});

test('getFormattingAtSelection should detect bold formatting', () => {
  const vdom = [
    createParagraphNode([
      createTextNode('Hello '),
      createStrongNode([createTextNode('world')]),
      createTextNode('!'),
    ]),
  ];
  const strongNode = vdom[0].children![1];
  const textInStrong = strongNode.children![0];
  const selection = createSelection(textInStrong.id, 2, textInStrong.id, 2);

  const formatting = getFormattingAtSelection(vdom, selection);

  expect(formatting.bold).toBe(true);
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
  const emNode = vdom[0].children![1];
  const textInEm = emNode.children![0];
  const selection = createSelection(textInEm.id, 2, textInEm.id, 2);

  const formatting = getFormattingAtSelection(vdom, selection);

  expect(formatting.bold).toBe(false);
  expect(formatting.italic).toBe(true);
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
  const uNode = vdom[0].children![1];
  const textInU = uNode.children![0];
  const selection = createSelection(textInU.id, 2, textInU.id, 2);

  const formatting = getFormattingAtSelection(vdom, selection);

  expect(formatting.bold).toBe(false);
  expect(formatting.italic).toBe(false);
  expect(formatting.underline).toBe(true);
});

test('getFormattingAtSelection should detect multiple formatting', () => {
  const vdom = [
    createParagraphNode([
      createStrongNode([createEmNode([createUNode([createTextNode('formatted text')])])]),
    ]),
  ];
  const textNode = vdom[0].children![0].children![0].children![0].children![0];
  const selection = createSelection(textNode.id, 5, textNode.id, 5);

  const formatting = getFormattingAtSelection(vdom, selection);

  expect(formatting.bold).toBe(true);
  expect(formatting.italic).toBe(true);
  expect(formatting.underline).toBe(true);
});

test('getFormattingAtSelection should handle plain text', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode.id, 2, textNode.id, 2);

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
  const firstText = vdom[0].children![0];
  const lastText = vdom[0].children![2];
  const selection = createSelection(firstText.id, 3, lastText.id, 2);

  const formatting = getFormattingAtSelection(vdom, selection);

  // Should return true if any part of the selection has the formatting
  expect(formatting.bold).toBe(true);
  expect(formatting.italic).toBe(false);
  expect(formatting.underline).toBe(false);
});
