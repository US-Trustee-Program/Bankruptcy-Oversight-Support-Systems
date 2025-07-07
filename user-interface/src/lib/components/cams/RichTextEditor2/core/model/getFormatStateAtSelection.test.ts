import { describe, expect, test, vi, beforeEach } from 'vitest';
import { VDOMNode, VDOMSelection } from '../types';
import { createTextNode, createParagraphNode } from './VDOMNode';
import { getFormatStateAtSelection } from './VDOMSelection';
import * as VDOMFormatting from './VDOMFormatting';

// Mock the entire VDOMFormatting module
vi.mock('./VDOMFormatting');

// Get typed mocks for the functions we use
const getNodesInSelectionMock = vi.mocked(VDOMFormatting.getNodesInSelection);
const getFormattingAtSelectionMock = vi.mocked(VDOMFormatting.getFormattingAtSelection);

describe('getFormatStateAtSelection', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Set default mock return values
    getNodesInSelectionMock.mockReturnValue([{ id: 'test-node', type: 'text', content: 'Test' }]);
  });
  // Helper function to create a selection
  function createSelection(startOffset: number, endOffset: number): VDOMSelection {
    return {
      start: { offset: startOffset },
      end: { offset: endOffset },
      isCollapsed: startOffset === endOffset,
    };
  }

  test('should return inactive states for collapsed selection', () => {
    // Arrange
    const vdom: VDOMNode[] = [createParagraphNode([createTextNode('Hello world')])];
    const selection = createSelection(5, 5); // cursor position

    // Act
    const result = getFormatStateAtSelection(vdom, selection);

    // Assert
    expect(result.bold).toBe('inactive');
    expect(result.italic).toBe('inactive');
    expect(result.underline).toBe('inactive');
    expect(getFormattingAtSelectionMock).not.toHaveBeenCalled();
  });

  test('should use getFormattingAtSelection for non-collapsed selection', () => {
    // Arrange
    const vdom: VDOMNode[] = [createParagraphNode([createTextNode('Hello world')])];
    const selection = createSelection(0, 5); // "Hello"
    const mockFormatState = {
      bold: 'active' as const,
      italic: 'inactive' as const,
      underline: 'mixed' as const,
    };
    // Use a properly typed mock function
    getFormattingAtSelectionMock.mockReturnValueOnce(mockFormatState);

    // Act
    const result = getFormatStateAtSelection(vdom, selection);

    // Assert
    expect(result).toEqual(mockFormatState);
    expect(getFormattingAtSelectionMock).toHaveBeenCalled();
  });

  test('should return default inactive states when no nodes in selection', () => {
    // Arrange
    const vdom: VDOMNode[] = [createParagraphNode([createTextNode('Hello world')])];
    const selection = createSelection(0, 5); // "Hello"

    // Mock getNodesInSelection to return an empty array for this test
    vi.mocked(VDOMFormatting.getNodesInSelection).mockReturnValueOnce([]);

    // Act
    const result = getFormatStateAtSelection(vdom, selection);

    // Assert
    expect(result.bold).toBe('inactive');
    expect(result.italic).toBe('inactive');
    expect(result.underline).toBe('inactive');
    expect(getFormattingAtSelectionMock).not.toHaveBeenCalled();
  });
});
