import { VDOMNode, RichTextFormatState, FORMAT_TO_VDOM_TYPE, VDOMSelection } from '../types';
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

/**
 * Check if a text node is currently bold (wrapped in a strong container)
 */
export function isTextNodeBold(textNode: VDOMNode, vdom: VDOMNode[]): boolean {
  // Find the strong node that contains this text node
  return vdom.some((node) => {
    if (node.type === 'strong' && node.children) {
      return node.children.some((child) => child.id === textNode.id);
    }
    return false;
  });
}

/**
 * Toggle bold formatting for nodes within a selection
 */
export function toggleBoldInSelection(vdom: VDOMNode[], selection: VDOMSelection): VDOMNode[] {
  // Handle empty VDOM
  if (vdom.length === 0) {
    return [];
  }

  // Calculate the overall text content and determine formatting state
  const { textContent, formattingMap } = buildTextContentAndFormattingMap(vdom);

  // Clamp selection to actual content bounds
  const startOffset = Math.max(0, Math.min(selection.start.offset, textContent.length));
  const endOffset = Math.max(startOffset, Math.min(selection.end.offset, textContent.length));

  // If selection is collapsed or at end, toggle entire content (for backward compatibility)
  if (startOffset === endOffset || startOffset === textContent.length) {
    const result = toggleBoldEntireContent(vdom);
    return result;
  }

  // Check if ALL the text in the selection has bold formatting
  // If even one character is not bold, we'll apply bold to the entire selection
  const selectionHasBold = hasFormattingInRange(formattingMap, startOffset, endOffset, 'bold');
  // Apply the toggle operation - if selectionHasBold is true (all chars are bold), remove formatting
  // If selectionHasBold is false (some chars are not bold), apply bold to all
  const result = applyFormattingToggle(vdom, startOffset, endOffset, 'bold', !selectionHasBold);
  return result;
}

/**
 * Build a map of text content to formatting information
 */
function buildTextContentAndFormattingMap(vdom: VDOMNode[]): {
  textContent: string;
  formattingMap: Array<{ bold: boolean; nodeId: string; nodeType: string }>;
} {
  let textContent = '';
  const formattingMap: Array<{ bold: boolean; nodeId: string; nodeType: string }> = [];

  for (const node of vdom) {
    if (node.type === 'text' && node.content) {
      // Plain text node
      for (let i = 0; i < node.content.length; i++) {
        formattingMap.push({
          bold: false,
          nodeId: node.id,
          nodeType: 'text',
        });
      }
      textContent += node.content;
    } else if (node.type === 'strong' && node.children) {
      // Bold text node
      for (const child of node.children) {
        if (child.type === 'text' && child.content) {
          for (let i = 0; i < child.content.length; i++) {
            formattingMap.push({
              bold: true,
              nodeId: node.id, // Use parent strong node id
              nodeType: 'strong',
            });
          }
          textContent += child.content;
        }
      }
    }
  }

  return { textContent, formattingMap };
}

/**
 * Check if a range has a specific formatting
 * Returns true only if ALL characters in the range have the formatting
 * This ensures that partially formatted selections will become fully formatted when toggled
 */
function hasFormattingInRange(
  formattingMap: Array<{ bold: boolean; nodeId: string; nodeType: string }>,
  startOffset: number,
  endOffset: number,
  format: 'bold',
): boolean {
  if (startOffset >= endOffset || startOffset >= formattingMap.length) {
    return false;
  }

  // Check if ALL characters have the formatting
  // If any character doesn't have the format, we'll return false,
  // which means we'll apply the formatting to the entire selection
  for (let i = startOffset; i < Math.min(endOffset, formattingMap.length); i++) {
    if (!formattingMap[i][format]) {
      // Found a character without formatting - return false to apply formatting to all
      return false;
    }
  }

  // All characters have the formatting, so return true to remove formatting
  return true;
}

/**
 * Apply formatting toggle to a specific range
 */
function applyFormattingToggle(
  vdom: VDOMNode[],
  startOffset: number,
  endOffset: number,
  _format: 'bold',
  shouldApply: boolean,
): VDOMNode[] {
  const { textContent } = buildTextContentAndFormattingMap(vdom);

  // Split the content into three parts: before, selected, after
  const beforeText = textContent.slice(0, startOffset);
  const selectedText = textContent.slice(startOffset, endOffset);
  const afterText = textContent.slice(endOffset);

  const result: VDOMNode[] = [];

  // Add before text (preserve original formatting)
  if (beforeText) {
    const beforeNodes = extractFormattedTextRange(vdom, 0, startOffset);
    result.push(...beforeNodes);
  }

  // Add selected text with toggled formatting
  if (selectedText) {
    if (shouldApply) {
      // Apply bold formatting
      const textNode = createTextNode(selectedText);
      const strongNode: VDOMNode = {
        id: `strong-${Date.now()}-${Math.random()}`,
        type: 'strong',
        children: [textNode],
      };
      result.push(strongNode);
    } else {
      // Remove bold formatting (plain text)
      const textNode = createTextNode(selectedText);
      result.push(textNode);
    }
  }

  // Add after text (preserve original formatting)
  if (afterText) {
    const afterNodes = extractFormattedTextRange(vdom, endOffset, textContent.length);
    result.push(...afterNodes);
  }

  return result;
}

/**
 * Extract a range of text while preserving formatting
 */
function extractFormattedTextRange(
  vdom: VDOMNode[],
  startOffset: number,
  endOffset: number,
): VDOMNode[] {
  const { textContent, formattingMap } = buildTextContentAndFormattingMap(vdom);

  if (startOffset >= endOffset || startOffset >= textContent.length) {
    return [];
  }

  const rangeText = textContent.slice(startOffset, endOffset);
  const rangeFormatMap = formattingMap.slice(startOffset, endOffset);

  // Group consecutive characters with the same formatting
  const result: VDOMNode[] = [];
  let currentText = '';
  let currentBold = rangeFormatMap[0]?.bold || false;

  for (let i = 0; i < rangeText.length; i++) {
    const char = rangeText[i];
    const charBold = rangeFormatMap[i]?.bold || false;

    if (charBold === currentBold) {
      // Same formatting, accumulate
      currentText += char;
    } else {
      // Formatting changed, flush current group
      if (currentText) {
        const textNode = createTextNode(currentText);
        if (currentBold) {
          const strongNode: VDOMNode = {
            id: `strong-${Date.now()}-${Math.random()}`,
            type: 'strong',
            children: [textNode],
          };
          result.push(strongNode);
        } else {
          result.push(textNode);
        }
      }

      // Start new group
      currentText = char;
      currentBold = charBold;
    }
  }

  // Flush final group
  if (currentText) {
    const textNode = createTextNode(currentText);
    if (currentBold) {
      const strongNode: VDOMNode = {
        id: `strong-${Date.now()}-${Math.random()}`,
        type: 'strong',
        children: [textNode],
      };
      result.push(strongNode);
    } else {
      result.push(textNode);
    }
  }

  return result;
}

/**
 * Toggle bold for entire content (for backward compatibility with existing tests)
 */
function toggleBoldEntireContent(vdom: VDOMNode[]): VDOMNode[] {
  // Handle simple cases first for backward compatibility
  if (vdom.length === 1) {
    const node = vdom[0];

    if (node.type === 'text') {
      // Plain text node - wrap in strong
      return [
        {
          id: `strong-${Date.now()}-${Math.random()}`,
          type: 'strong',
          children: [node],
        },
      ];
    } else if (
      node.type === 'strong' &&
      node.children?.length === 1 &&
      node.children[0].type === 'text'
    ) {
      // Strong node with single text child - unwrap
      return [node.children[0]];
    }
  }

  // For more complex cases, check if all content is bold
  const { formattingMap } = buildTextContentAndFormattingMap(vdom);
  const allBold = formattingMap.length > 0 && formattingMap.every((char) => char.bold);

  if (allBold) {
    // All content is bold, remove all bold formatting
    return vdom.flatMap((node) => {
      if (node.type === 'strong' && node.children) {
        return node.children;
      }
      return [node];
    });
  } else {
    // Some or no content is bold, make all content bold
    const { textContent } = buildTextContentAndFormattingMap(vdom);
    if (textContent) {
      const textNode = createTextNode(textContent);
      return [
        {
          id: `strong-${Date.now()}-${Math.random()}`,
          type: 'strong',
          children: [textNode],
        },
      ];
    }
    return vdom;
  }
}

/**
 * Helper function to create a text node
 */
function createTextNode(content: string): VDOMNode {
  return {
    id: `text-${Date.now()}-${Math.random()}`,
    type: 'text',
    content,
  };
}
