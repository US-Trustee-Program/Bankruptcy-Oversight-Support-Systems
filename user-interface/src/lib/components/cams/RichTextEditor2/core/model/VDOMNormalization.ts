import { VDOMNode, VDOMSelection } from '../types';
import { ZERO_WIDTH_SPACE } from '../../RichTextEditor.constants';
import { createTextNode, createEmptyParagraphNode } from './VDOMNode';

/**
 * Result type for normalization operations
 */
export interface NormalizationResult {
  newVDOM: VDOMNode[];
  newSelection: VDOMSelection;
}

/**
 * Deep clones a VDOM node
 */
function cloneNode(node: VDOMNode): VDOMNode {
  const cloned: VDOMNode = {
    id: node.id,
    type: node.type,
  };

  if (node.content !== undefined) {
    cloned.content = node.content;
  }

  if (node.children) {
    cloned.children = node.children.map(cloneNode);
  }

  if (node.attributes) {
    cloned.attributes = { ...node.attributes };
  }

  return cloned;
}

/**
 * Deep clones a VDOM array
 */
function cloneVDOM(vdom: VDOMNode[]): VDOMNode[] {
  return vdom.map(cloneNode);
}

/**
 * Checks if a text node is empty or contains only whitespace
 */
function isEmptyText(content: string): boolean {
  return content.trim() === '';
}

/**
 * Checks if a node has meaningful content
 */
function hasContent(node: VDOMNode): boolean {
  if (node.type === 'text') {
    return node.content !== undefined && node.content !== '' && !isEmptyText(node.content);
  }

  if (node.children) {
    return node.children.some(hasContent);
  }

  return false;
}

/**
 * Ensures empty paragraphs have zero-width space for proper cursor positioning
 */
export function ensureEmptyParagraphsHaveZWS(vdom: VDOMNode[]): VDOMNode[] {
  const result = cloneVDOM(vdom);

  function processNode(node: VDOMNode): void {
    if (node.type === 'paragraph') {
      if (!node.children || node.children.length === 0) {
        // Empty paragraph - add ZWS
        node.children = [createTextNode(ZERO_WIDTH_SPACE)];
      } else if (
        node.children.length === 1 &&
        node.children[0].type === 'text' &&
        node.children[0].content !== undefined &&
        isEmptyText(node.children[0].content)
      ) {
        // Paragraph with only whitespace - replace with ZWS
        node.children[0].content = ZERO_WIDTH_SPACE;
      }
    }

    if (node.children) {
      node.children.forEach(processNode);
    }
  }

  result.forEach(processNode);
  return result;
}

/**
 * Removes empty nodes that don't contribute to the document structure
 */
export function removeEmptyNodes(vdom: VDOMNode[]): VDOMNode[] {
  const result = cloneVDOM(vdom);

  function processNode(node: VDOMNode): void {
    if (node.children) {
      // Filter out empty children
      node.children = node.children.filter((child) => {
        // Keep text nodes with content (including ZWS)
        if (child.type === 'text') {
          return child.content !== undefined && child.content !== '';
        }

        // Keep formatting nodes that have content
        if (['strong', 'em', 'u'].includes(child.type)) {
          return hasContent(child);
        }

        // Keep other nodes (paragraphs, lists, etc.)
        return true;
      });

      // Recursively process remaining children
      node.children.forEach(processNode);
    }
  }

  result.forEach(processNode);
  return result;
}

/**
 * Merges adjacent text nodes and updates selection accordingly
 */
export function mergeAdjacentTextNodes(
  vdom: VDOMNode[],
  selection?: VDOMSelection,
): NormalizationResult {
  const result = cloneVDOM(vdom);
  const newSelection = selection
    ? { ...selection }
    : {
        start: { nodeId: '', offset: 0 },
        end: { nodeId: '', offset: 0 },
        isCollapsed: true,
      };

  // Track node ID mappings for selection updates
  const nodeIdMappings = new Map<string, { newId: string; offsetAdjustment: number }>();

  function processNode(node: VDOMNode): void {
    if (node.children) {
      const newChildren: VDOMNode[] = [];
      let i = 0;

      while (i < node.children.length) {
        const child = node.children[i];

        if (child.type === 'text') {
          // Start merging from this text node
          let mergedContent = child.content || '';
          const originalId = child.id;
          let totalLength = mergedContent.length;

          // Look ahead for adjacent text nodes
          let j = i + 1;
          while (j < node.children.length && node.children[j].type === 'text') {
            const nextChild = node.children[j];
            const nextContent = nextChild.content || '';

            // Update mapping for the merged node
            nodeIdMappings.set(nextChild.id, {
              newId: originalId,
              offsetAdjustment: totalLength,
            });

            mergedContent += nextContent;
            totalLength += nextContent.length;
            j++;
          }

          // Create the merged node
          const mergedNode = createTextNode(mergedContent);
          mergedNode.id = originalId; // Keep the original ID
          newChildren.push(mergedNode);

          i = j; // Skip the merged nodes
        } else {
          newChildren.push(child);
          processNode(child); // Recursively process children
          i++;
        }
      }

      node.children = newChildren;
    }
  }

  result.forEach(processNode);

  // Update selection based on node mappings
  if (selection) {
    const startMapping = nodeIdMappings.get(selection.start.nodeId);
    if (startMapping) {
      newSelection.start.nodeId = startMapping.newId;
      newSelection.start.offset += startMapping.offsetAdjustment;
    }

    const endMapping = nodeIdMappings.get(selection.end.nodeId);
    if (endMapping) {
      newSelection.end.nodeId = endMapping.newId;
      newSelection.end.offset += endMapping.offsetAdjustment;
    }
  }

  return { newVDOM: result, newSelection };
}

/**
 * Removes redundant nested formatting (e.g., strong inside strong)
 */
export function removeRedundantFormatting(vdom: VDOMNode[]): VDOMNode[] {
  const result = cloneVDOM(vdom);

  function processNode(node: VDOMNode, parentFormats: Set<string> = new Set()): void {
    const currentFormats = new Set(parentFormats);

    // If this is a formatting node, check for redundancy
    if (['strong', 'em', 'u'].includes(node.type)) {
      if (currentFormats.has(node.type)) {
        // Redundant formatting - flatten this node
        if (node.children && node.children.length === 1) {
          const child = node.children[0];
          // Replace this node with its child
          Object.assign(node, child);
        }
        return;
      }
      currentFormats.add(node.type);
    }

    if (node.children) {
      node.children.forEach((child) => processNode(child, currentFormats));
    }
  }

  result.forEach((node) => processNode(node));
  return result;
}

/**
 * Validates VDOM structure according to content model rules
 */
export function validateVDOMStructure(vdom: VDOMNode[]): boolean {
  function validateNode(node: VDOMNode, parentType?: string): boolean {
    // Check invalid nesting rules
    if (parentType === 'paragraph' && node.type === 'paragraph') {
      return false; // Paragraphs cannot contain paragraphs
    }

    if (parentType === 'li' && ['ul', 'ol'].includes(node.type)) {
      return false; // List items cannot directly contain lists
    }

    // Validate children
    if (node.children) {
      return node.children.every((child) => validateNode(child, node.type));
    }

    return true;
  }

  return vdom.every((node) => validateNode(node));
}

/**
 * Main normalization function that applies all normalization steps
 */
export function normalizeVDOM(vdom: VDOMNode[], selection?: VDOMSelection): NormalizationResult {
  let currentVDOM = vdom;
  let currentSelection = selection;

  // Ensure we have at least one paragraph
  if (currentVDOM.length === 0) {
    currentVDOM = [createEmptyParagraphNode()];
    currentSelection = {
      start: { nodeId: currentVDOM[0].children![0].id, offset: 0 },
      end: { nodeId: currentVDOM[0].children![0].id, offset: 0 },
      isCollapsed: true,
    };
  }

  // Step 1: Remove empty nodes
  currentVDOM = removeEmptyNodes(currentVDOM);

  // Step 2: Merge adjacent text nodes
  const mergeResult = mergeAdjacentTextNodes(currentVDOM, currentSelection);
  currentVDOM = mergeResult.newVDOM;
  currentSelection = mergeResult.newSelection;

  // Step 3: Remove redundant formatting
  currentVDOM = removeRedundantFormatting(currentVDOM);

  // Step 4: Ensure empty paragraphs have ZWS
  currentVDOM = ensureEmptyParagraphsHaveZWS(currentVDOM);

  // Step 5: Validate structure (in development, we might want to log warnings)
  const isValid = validateVDOMStructure(currentVDOM);
  if (!isValid) {
    console.warn('VDOM structure validation failed after normalization');
  }

  return {
    newVDOM: currentVDOM,
    newSelection: currentSelection || {
      start: { nodeId: '', offset: 0 },
      end: { nodeId: '', offset: 0 },
      isCollapsed: true,
    },
  };
}
