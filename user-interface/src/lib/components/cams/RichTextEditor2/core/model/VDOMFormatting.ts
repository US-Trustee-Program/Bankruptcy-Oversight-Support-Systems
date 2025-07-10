import {
  VDOMNode,
  RichTextFormatState,
  FORMAT_TO_VDOM_TYPE,
  VDOMSelection,
  FormatStateValue,
} from '../types';
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
 * For collapsed selections (cursor position), returns nodes containing the character to the left of cursor
 */
export function getNodesInSelection(
  vdom: VDOMNode[],
  startOffset: number,
  endOffset: number,
): VDOMNode[] {
  if (vdom.length === 0) {
    return [];
  }

  // For collapsed selections at position 0, there's no character to the left
  if (startOffset === endOffset && startOffset === 0) {
    return [];
  }

  const { formattingMap } = buildTextContentAndFormattingMap(vdom);

  // For collapsed selections, we want the formatting of the character to the left
  if (startOffset === endOffset) {
    const charIndex = startOffset - 1;
    if (charIndex < 0 || charIndex >= formattingMap.length) {
      return [];
    }

    // Find the node that contains this character
    const nodeId = formattingMap[charIndex].nodeId;
    return findNodesById(vdom, nodeId);
  }

  // For range selections, find all nodes that intersect with the selection
  const selectedNodes: VDOMNode[] = [];
  const seenNodeIds = new Set<string>();

  for (let i = startOffset; i < endOffset && i < formattingMap.length; i++) {
    const nodeId = formattingMap[i].nodeId;
    if (!seenNodeIds.has(nodeId)) {
      seenNodeIds.add(nodeId);
      const nodes = findNodesById(vdom, nodeId);
      selectedNodes.push(...nodes);
    }
  }

  return selectedNodes;
}

/**
 * Helper function to find nodes by ID in the VDOM tree
 */
function findNodesById(vdom: VDOMNode[], targetId: string): VDOMNode[] {
  const result: VDOMNode[] = [];

  function traverse(nodes: VDOMNode[]) {
    for (const node of nodes) {
      if (node.id === targetId) {
        // For formatting context, we want the parent container (strong, em, etc.)
        // If it's a text node inside a formatting container, return the container
        result.push(node);
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(vdom);
  return result;
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
    return toggleBoldEntireContent(vdom);
  }

  // Check if ALL the text in the selection has bold formatting
  // If even one character is not bold, we'll apply bold to the entire selection
  const selectionHasBold = hasFormattingInRange(formattingMap, startOffset, endOffset, 'bold');

  // Apply the toggle operation - if selectionHasBold is true (all chars are bold), remove formatting
  // If selectionHasBold is false (some chars are not bold), apply bold to all
  const shouldApply = !selectionHasBold;

  return applyFormattingToggle(vdom, startOffset, endOffset, 'bold', shouldApply);
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
 * Check if a range has a specific formatting.
 * Returns TRUE if ALL characters in the range have the formatting (so formatting should be removed).
 * Returns FALSE if ANY characters lack the formatting (so formatting should be applied to all).
 *
 * The toggle behavior follows these simple rules:
 * - If ALL text in selection has formatting, remove formatting from all
 * - If ANY text in selection lacks formatting, apply formatting to all
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

  // Check each character in the range
  for (let i = startOffset; i < Math.min(endOffset, formattingMap.length); i++) {
    if (!formattingMap[i][format]) {
      // If ANY character is not formatted, we should apply formatting to all
      return false;
    }
  }

  // If we get here, ALL characters have the formatting
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
 * Get the text length of a VDOM node
 */
function getNodeTextLength(node: VDOMNode): number {
  if (node.type === 'text') {
    return node.content?.length || 0;
  }
  if (node.children) {
    return node.children.reduce((total, child) => total + getNodeTextLength(child), 0);
  }
  return 0;
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

/**
 * Insert text with the current toggle formatting state
 */
export function insertTextWithFormatting(
  vdom: VDOMNode[],
  selection: VDOMSelection,
  text: string,
  toggleState: import('../types').FormatToggleState,
): { newVDOM: VDOMNode[]; newSelection: VDOMSelection } {
  // For collapsed selections, insert text with specified formatting
  if (!selection.isCollapsed) {
    throw new Error('insertTextWithFormatting currently only supports collapsed selections');
  }

  const { textContent, formattingMap } = buildTextContentAndFormattingMap(vdom);
  const clampedOffset = Math.max(0, Math.min(selection.start.offset, textContent.length));

  if (toggleState.bold === 'active') {
    return insertBoldText(vdom, clampedOffset, text, textContent, formattingMap);
  } else {
    return insertPlainText(vdom, clampedOffset, text, textContent);
  }
}

/**
 * Insert plain text, merging with adjacent text nodes when possible
 */
function insertPlainText(
  vdom: VDOMNode[],
  offset: number,
  text: string,
  textContent: string,
): { newVDOM: VDOMNode[]; newSelection: VDOMSelection } {
  // Handle simple case: single text node
  if (vdom.length === 1 && vdom[0].type === 'text') {
    const textNode = vdom[0];
    const newContent = textContent.slice(0, offset) + text + textContent.slice(offset);

    const newTextNode = {
      ...textNode,
      content: newContent,
    };

    return {
      newVDOM: [newTextNode],
      newSelection: {
        start: { node: newTextNode, offset: offset + text.length },
        end: { node: newTextNode, offset: offset + text.length },
        isCollapsed: true,
      },
    };
  }

  // For complex VDOM, check if we can merge with adjacent plain text
  const { formattingMap } = buildTextContentAndFormattingMap(vdom);

  // Check if insertion point is between two plain text characters
  const prevCharIndex = offset - 1;
  const nextCharIndex = offset;
  const prevIsPlain =
    prevCharIndex < 0 ||
    (prevCharIndex < formattingMap.length && !formattingMap[prevCharIndex].bold);
  const nextIsPlain = nextCharIndex >= formattingMap.length || !formattingMap[nextCharIndex].bold;

  // If both adjacent characters are plain text (or we're at boundaries), try to merge
  if (prevIsPlain && nextIsPlain) {
    // Find the position in VDOM where we should insert
    let currentOffset = 0;
    let insertNodeIndex = -1;
    let insertCharOffset = 0;

    for (let i = 0; i < vdom.length; i++) {
      const node = vdom[i];
      const nodeLength = getNodeTextLength(node);

      if (currentOffset <= offset && offset <= currentOffset + nodeLength) {
        insertNodeIndex = i;
        insertCharOffset = offset - currentOffset;
        break;
      }

      currentOffset += nodeLength;
    }

    // If we found a text node to insert into
    if (insertNodeIndex >= 0 && vdom[insertNodeIndex].type === 'text') {
      const targetNode = vdom[insertNodeIndex];
      const newContent =
        (targetNode.content || '').slice(0, insertCharOffset) +
        text +
        (targetNode.content || '').slice(insertCharOffset);

      const newTextNode = {
        ...targetNode,
        content: newContent,
      };

      const newVDOM = [...vdom];
      newVDOM[insertNodeIndex] = newTextNode;

      return {
        newVDOM,
        newSelection: {
          start: { node: newTextNode, offset: offset + text.length },
          end: { node: newTextNode, offset: offset + text.length },
          isCollapsed: true,
        },
      };
    }

    // If we're at the boundary between nodes, try to merge with previous text node
    if (
      insertCharOffset === 0 &&
      insertNodeIndex > 0 &&
      vdom[insertNodeIndex - 1].type === 'text'
    ) {
      const prevNode = vdom[insertNodeIndex - 1];
      const newContent = (prevNode.content || '') + text;

      const newTextNode = {
        ...prevNode,
        content: newContent,
      };

      const newVDOM = [...vdom];
      newVDOM[insertNodeIndex - 1] = newTextNode;

      return {
        newVDOM,
        newSelection: {
          start: { node: newTextNode, offset: offset + text.length },
          end: { node: newTextNode, offset: offset + text.length },
          isCollapsed: true,
        },
      };
    }
  }

  // Fallback: split and rebuild (original behavior)
  const beforeText = textContent.slice(0, offset);
  const afterText = textContent.slice(offset);

  const result: VDOMNode[] = [];

  // Add before text (preserve original formatting)
  if (beforeText) {
    const beforeNodes = extractFormattedTextRange(vdom, 0, offset);
    result.push(...beforeNodes);
  }

  // Add inserted text as plain
  const insertedTextNode = createTextNode(text);
  result.push(insertedTextNode);

  // Add after text (preserve original formatting)
  if (afterText) {
    const afterNodes = extractFormattedTextRange(vdom, offset, textContent.length);
    result.push(...afterNodes);
  }

  return {
    newVDOM: result,
    newSelection: {
      start: { node: insertedTextNode, offset: offset + text.length },
      end: { node: insertedTextNode, offset: offset + text.length },
      isCollapsed: true,
    },
  };
}

/**
 * Insert bold text, extending existing bold formatting when possible
 */
function insertBoldText(
  vdom: VDOMNode[],
  offset: number,
  text: string,
  textContent: string,
  formattingMap: Array<{ bold: boolean }>,
): { newVDOM: VDOMNode[]; newSelection: VDOMSelection } {
  // Check if we're inserting adjacent to bold text
  const prevCharIndex = offset - 1;
  const nextCharIndex = offset;
  const prevIsBold = prevCharIndex >= 0 && formattingMap[prevCharIndex]?.bold;
  const nextIsBold = nextCharIndex < formattingMap.length && formattingMap[nextCharIndex]?.bold;

  // If we're in the middle of bold text OR adjacent to bold text on either side, extend it
  if (prevIsBold || nextIsBold) {
    return extendBoldFormatting(vdom, offset, text, textContent);
  }

  // Otherwise, split and insert new bold formatting
  return splitAndInsertBold(vdom, offset, text, textContent);
}

/**
 * Extend existing bold formatting by inserting text into it
 */
function extendBoldFormatting(
  vdom: VDOMNode[],
  offset: number,
  text: string,
  textContent: string,
): { newVDOM: VDOMNode[]; newSelection: VDOMSelection } {
  // Find the strong node that contains or is adjacent to this position
  let currentOffset = 0;
  let targetNodeIndex = -1;
  let relativeOffset = 0;

  for (let i = 0; i < vdom.length; i++) {
    const node = vdom[i];

    if (node.type === 'strong' && node.children) {
      const strongTextContent = node.children
        .filter((child) => child.type === 'text')
        .map((child) => child.content || '')
        .join('');

      const nodeEndOffset = currentOffset + strongTextContent.length;

      // Check if offset falls within this strong node or right at its end
      if (offset >= currentOffset && offset <= nodeEndOffset) {
        targetNodeIndex = i;
        relativeOffset = offset - currentOffset;
        break;
      }

      currentOffset = nodeEndOffset;
    } else if (node.type === 'text') {
      const nodeEndOffset = currentOffset + (node.content?.length || 0);

      // Check if offset falls right after a strong node (for appending)
      if (offset === currentOffset && i > 0 && vdom[i - 1].type === 'strong') {
        targetNodeIndex = i - 1;
        relativeOffset = (vdom[i - 1] as VDOMNode).children?.[0]?.content?.length || 0;
        break;
      }

      currentOffset = nodeEndOffset;
    }
  }

  if (targetNodeIndex >= 0) {
    const targetNode = vdom[targetNodeIndex];

    if (targetNode.type === 'strong' && targetNode.children) {
      const strongTextContent = targetNode.children
        .filter((child) => child.type === 'text')
        .map((child) => child.content || '')
        .join('');

      const newContent =
        strongTextContent.slice(0, relativeOffset) + text + strongTextContent.slice(relativeOffset);

      const newTextNode = {
        ...targetNode.children[0],
        content: newContent,
      };

      const newStrongNode: VDOMNode = {
        ...targetNode,
        children: [newTextNode],
      };

      // Rebuild VDOM with the extended strong node
      const newVDOM = [...vdom];
      newVDOM[targetNodeIndex] = newStrongNode;

      return {
        newVDOM,
        newSelection: {
          start: { node: newTextNode, offset: offset + text.length },
          end: { node: newTextNode, offset: offset + text.length },
          isCollapsed: true,
        },
      };
    }
  }

  // Fallback to split and insert
  return splitAndInsertBold(vdom, offset, text, textContent);
}

/**
 * Split text and insert new bold formatting
 */
function splitAndInsertBold(
  vdom: VDOMNode[],
  offset: number,
  text: string,
  textContent: string,
): { newVDOM: VDOMNode[]; newSelection: VDOMSelection } {
  // Handle simple case: single text node to split
  if (vdom.length === 1 && vdom[0].type === 'text') {
    const textNode = vdom[0];
    const beforeText = textContent.slice(0, offset);
    const afterText = textContent.slice(offset);

    const result: VDOMNode[] = [];

    if (beforeText) {
      result.push({
        ...textNode,
        content: beforeText,
      });
    }

    const boldTextNode = createTextNode(text);
    const boldNode = {
      type: 'strong' as const,
      path: [], // Will be set properly when VDOM is finalized
      children: [boldTextNode],
    };

    if (beforeText) {
      result.push({
        ...textNode,
        content: beforeText,
      });
    }

    result.push(boldNode);

    if (afterText) {
      result.push(createTextNode(afterText));
    }

    return {
      newVDOM: result,
      newSelection: {
        start: { node: boldTextNode, offset: text.length },
        end: { node: boldTextNode, offset: text.length },
        isCollapsed: true,
      },
    };
  }

  // For complex VDOM, split and rebuild
  const beforeText = textContent.slice(0, offset);
  const afterText = textContent.slice(offset);

  const result: VDOMNode[] = [];

  // Add before text (preserve original formatting)
  if (beforeText) {
    const beforeNodes = extractFormattedTextRange(vdom, 0, offset);
    result.push(...beforeNodes);
  }

  // Add inserted text as bold
  const insertedTextNode = createTextNode(text);
  const strongNode: VDOMNode = {
    type: 'strong',
    path: [], // Will be set properly when VDOM is finalized
    children: [insertedTextNode],
  };
  result.push(strongNode);

  // Add after text (preserve original formatting)
  if (afterText) {
    const afterNodes = extractFormattedTextRange(vdom, offset, textContent.length);
    result.push(...afterNodes);
  }

  return {
    newVDOM: result,
    newSelection: {
      start: { node: insertedTextNode, offset: text.length },
      end: { node: insertedTextNode, offset: text.length },
      isCollapsed: true,
    },
  };
}

/**
 * Get the formatting state at a specific cursor position
 * Returns the formatting of the character immediately to the left of the cursor
 */
export function getFormatStateAtCursorPosition(
  vdom: VDOMNode[],
  selection: VDOMSelection,
  format: RichTextFormat,
): FormatStateValue {
  // If cursor is at position 0 or document is empty, always inactive
  if (selection.start.offset <= 0 || vdom.length === 0) {
    return 'inactive';
  }

  // Build text content and formatting map to find character at position
  const { formattingMap } = buildTextContentAndFormattingMap(vdom);

  // Get the character immediately to the left of cursor (offset - 1)
  const charIndex = selection.start.offset - 1;

  // If index is out of bounds, return inactive
  if (charIndex < 0 || charIndex >= formattingMap.length) {
    return 'inactive';
  }

  // Check the formatting of the character to the left
  const charFormatting = formattingMap[charIndex];

  // Return the appropriate format state based on the format type
  switch (format) {
    case 'bold':
      return charFormatting.bold ? 'active' : 'inactive';
    case 'italic':
      // For now, we only support bold in the formatting map
      // This will need to be extended when italic/underline are implemented
      return 'inactive';
    case 'underline':
      // For now, we only support bold in the formatting map
      // This will need to be extended when italic/underline are implemented
      return 'inactive';
    default:
      return 'inactive';
  }
}
