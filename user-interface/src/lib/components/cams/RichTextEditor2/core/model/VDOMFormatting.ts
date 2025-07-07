import { VDOMNode, RichTextFormatState, FORMAT_TO_VDOM_TYPE } from '../types';
import { RichTextFormat } from '../../RichTextEditor.constants';

/**
 * Get formatting state for a node
 */
export function getNodeFormatState(node: VDOMNode): Partial<RichTextFormatState> {
  const formatState: Partial<RichTextFormatState> = {};

  // Check direct node type for formatting
  if (node.type === 'strong') {
    formatState.bold = 'active';
  } else if (node.type === 'em') {
    formatState.italic = 'active';
  } else if (node.type === 'u') {
    formatState.underline = 'active';
  }

  return formatState;
}

/**
 * Checks if a node is within a formatting container
 */
export function isNodeWithinFormattingContainer(node: VDOMNode, format: RichTextFormat): boolean {
  // Convert the RichTextFormat to its corresponding VDOMNodeType before comparing
  const vdomNodeType = FORMAT_TO_VDOM_TYPE[format];

  if (node.type === vdomNodeType) {
    return true;
  }

  // If the node has a parent of the format type, it's within that format
  return false; // Will be implemented when parent-child relationships are tracked
}

/**
 * Get formatting state for a selection
 */
export function getFormattingAtSelection(selectedNodes: VDOMNode[]): RichTextFormatState {
  if (!selectedNodes.length) {
    // Default state when no nodes are selected
    return {
      bold: 'inactive',
      italic: 'inactive',
      underline: 'inactive',
    };
  }

  // Initialize with default inactive state
  const result: RichTextFormatState = {
    bold: 'inactive',
    italic: 'inactive',
    underline: 'inactive',
  };

  // Track if we've seen each format type
  const formatFound: Record<RichTextFormat, boolean> = {
    bold: false,
    italic: false,
    underline: false,
  };

  // Track if all nodes have each format
  const allNodesHaveFormat: Record<RichTextFormat, boolean> = {
    bold: true,
    italic: true,
    underline: true,
  };

  // Check each selected node
  selectedNodes.forEach((node) => {
    // Check direct node formatting
    const nodeFormatState = getNodeFormatState(node);

    // Update tracked state for each format
    (['bold', 'italic', 'underline'] as const).forEach((format) => {
      if (nodeFormatState[format] === 'active') {
        formatFound[format] = true;
      } else {
        // If we find any node without the format, not all nodes have it
        allNodesHaveFormat[format] = false;
      }
    });
  });

  // Determine final state for each format
  (['bold', 'italic', 'underline'] as const).forEach((format) => {
    if (formatFound[format]) {
      // If some nodes have format but not all, it's mixed
      result[format] = allNodesHaveFormat[format] ? 'active' : 'mixed';
    }
  });

  return result;
}

/**
 * Get all nodes within a selection range
 * (This is a simplified placeholder - a real implementation would use the selection range)
 */
export function getNodesInSelection(
  _vdom: VDOMNode[],
  _startOffset: number,
  _endOffset: number,
): VDOMNode[] {
  // This is a simplified implementation that just returns text nodes
  // A real implementation would traverse the VDOM and find nodes within the selection range
  const nodes: VDOMNode[] = [];

  // We'll implement this with real selection traversal logic later
  // For now, just return an empty array as a placeholder
  return nodes;
}
