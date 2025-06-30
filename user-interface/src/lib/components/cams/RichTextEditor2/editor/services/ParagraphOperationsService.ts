/**
 * Pure functions for paragraph operations in the virtual DOM
 * Following CAMS guidelines for service architecture with dependency inversion
 */

import { VNode, ElementNode, isElementNode, isTextNode } from '../../virtual-dom/VNode';
import {
  createElementNode,
  createTextNode,
  createFormattingNode,
} from '../../virtual-dom/VNodeFactory';

// Import formatting types from FormattingDetectionService
type FormatType = 'bold' | 'italic' | 'underline';

/**
 * Interface for paragraph boundaries
 */
export interface ParagraphBoundaries {
  start: number;
  end: number;
}

/**
 * Interface for paragraph split result
 */
export interface ParagraphSplitResult {
  firstParagraph: ElementNode;
  secondParagraph: ElementNode;
}

/**
 * Create a paragraph element node with optional attributes and content
 */
export function createParagraphNode(
  attributes: Record<string, string> = {},
  textContent?: string,
): ElementNode {
  const paragraph = createElementNode('p', { attributes });

  if (textContent) {
    const textNode = createTextNode(textContent);
    paragraph.children.push(textNode);
    textNode.parent = paragraph;
  }

  return paragraph;
}

/**
 * Check if a node is a paragraph element
 */
export function isParagraphNode(node: VNode): node is ElementNode {
  return isElementNode(node) && node.tagName === 'p';
}

/**
 * Find the paragraph node that contains the given node
 * Traverses up the parent chain to find the first paragraph ancestor
 */
export function findParagraphNode(node: VNode): ElementNode | null {
  let current: VNode | null = node;

  while (current) {
    if (isParagraphNode(current)) {
      return current;
    }
    current = current.parent;
  }

  return null;
}

/**
 * Find the start and end boundaries of a paragraph
 */
export function findParagraphBoundaries(paragraph: ElementNode): ParagraphBoundaries {
  return {
    start: paragraph.startOffset,
    end: paragraph.endOffset,
  };
}

/**
 * Extract text content from a paragraph, including nested formatting
 */
export function getParagraphContent(paragraph: ElementNode): string {
  function extractTextFromNode(node: VNode): string {
    if (isTextNode(node)) {
      return node.content;
    }

    return node.children.map(extractTextFromNode).join('');
  }

  return paragraph.children.map(extractTextFromNode).join('');
}

/**
 * Split a paragraph at the given cursor position
 * Returns two new paragraph nodes with content split at the cursor
 */
export function splitParagraphAtCursor(
  paragraph: ElementNode,
  cursorPosition: number,
): ParagraphSplitResult {
  const firstParagraph = createParagraphNode();
  const secondParagraph = createParagraphNode();

  // Calculate relative position within paragraph
  const relativePosition = cursorPosition - paragraph.startOffset;

  if (relativePosition <= 0) {
    // Split at beginning - all content goes to second paragraph
    secondParagraph.children = [...paragraph.children];
    secondParagraph.children.forEach((child) => {
      child.parent = secondParagraph;
    });
  } else if (relativePosition >= paragraph.endOffset - paragraph.startOffset) {
    // Split at end - all content goes to first paragraph
    firstParagraph.children = [...paragraph.children];
    firstParagraph.children.forEach((child) => {
      child.parent = firstParagraph;
    });
  } else {
    // Split in middle - need to split content
    let currentPosition = 0;
    let splitFound = false;

    for (const child of paragraph.children) {
      if (splitFound) {
        // All remaining children go to second paragraph
        secondParagraph.children.push(child);
        child.parent = secondParagraph;
      } else if (isTextNode(child)) {
        const childLength = child.content.length;

        if (currentPosition + childLength <= relativePosition) {
          // Entire child goes to first paragraph
          firstParagraph.children.push(child);
          child.parent = firstParagraph;
          currentPosition += childLength;
        } else {
          // Need to split this text node
          const splitIndex = relativePosition - currentPosition;
          const firstText = child.content.substring(0, splitIndex);
          const secondText = child.content.substring(splitIndex);

          if (firstText) {
            const firstTextNode = createTextNode(firstText);
            firstParagraph.children.push(firstTextNode);
            firstTextNode.parent = firstParagraph;
          }

          if (secondText) {
            const secondTextNode = createTextNode(secondText);
            secondParagraph.children.push(secondTextNode);
            secondTextNode.parent = secondParagraph;
          }

          splitFound = true;
        }
      } else {
        // For non-text nodes, we'll put them entirely in one paragraph or the other
        // This is a simplified approach - in a full implementation we might need to split element nodes too
        if (currentPosition < relativePosition) {
          firstParagraph.children.push(child);
          child.parent = firstParagraph;
        } else {
          secondParagraph.children.push(child);
          child.parent = secondParagraph;
          splitFound = true;
        }

        // Estimate the length of element content for positioning
        const elementLength = getElementContentLength(child);
        currentPosition += elementLength;
      }
    }
  }

  return { firstParagraph, secondParagraph };
}

/**
 * Helper function to estimate the content length of an element node
 */
function getElementContentLength(node: VNode): number {
  if (isTextNode(node)) {
    return node.content.length;
  }

  return node.children.reduce((total, child) => total + getElementContentLength(child), 0);
}

/**
 * Merge two paragraphs into one
 * The first paragraph receives all content from both paragraphs
 */
export function mergeParagraphs(
  firstParagraph: ElementNode,
  secondParagraph: ElementNode,
): ElementNode {
  const merged = createParagraphNode();

  // Copy all children from first paragraph
  merged.children = [...firstParagraph.children];
  merged.children.forEach((child) => {
    child.parent = merged;
  });

  // Append all children from second paragraph
  secondParagraph.children.forEach((child) => {
    merged.children.push(child);
    child.parent = merged;
  });

  return merged;
}

/**
 * Insert a new paragraph after an existing paragraph
 * Returns the newly created paragraph
 */
export function insertParagraphAfter(
  existingParagraph: ElementNode,
  textContent?: string,
): ElementNode {
  const newParagraph = createParagraphNode({}, textContent);
  const parent = existingParagraph.parent;

  if (parent) {
    const existingIndex = parent.children.indexOf(existingParagraph);
    if (existingIndex !== -1) {
      parent.children.splice(existingIndex + 1, 0, newParagraph);
      newParagraph.parent = parent;
    }
  }

  return newParagraph;
}

/**
 * Get the cursor position at the start of a paragraph
 */
export function moveCursorToParagraphStart(paragraph: ElementNode): number {
  return paragraph.startOffset;
}

/**
 * Get the cursor position at the end of a paragraph
 */
export function moveCursorToParagraphEnd(paragraph: ElementNode): number {
  return paragraph.endOffset;
}

/**
 * Calculate cursor position relative to paragraph start
 * @param paragraph The paragraph element
 * @param absolutePosition The absolute cursor position in the document
 * @returns The relative position within the paragraph (0-based)
 */
export function getCursorPositionInParagraph(
  paragraph: ElementNode,
  absolutePosition: number,
): number {
  const relativePosition = absolutePosition - paragraph.startOffset;
  const paragraphLength = paragraph.endOffset - paragraph.startOffset;

  // Clamp to paragraph boundaries
  return Math.max(0, Math.min(relativePosition, paragraphLength));
}

/**
 * Convert relative position within paragraph to absolute document position
 * @param paragraph The paragraph element
 * @param relativePosition The position relative to paragraph start
 * @returns The absolute position in the document
 */
export function setCursorPositionInParagraph(
  paragraph: ElementNode,
  relativePosition: number,
): number {
  const paragraphLength = paragraph.endOffset - paragraph.startOffset;
  const clampedRelative = Math.max(0, Math.min(relativePosition, paragraphLength));

  return paragraph.startOffset + clampedRelative;
}

/**
 * Find the paragraph element that contains the given cursor position
 * @param root The root node to search within
 * @param cursorPosition The absolute cursor position
 * @returns The paragraph element containing the cursor, or null if not found
 */
export function findParagraphAtCursor(root: VNode, cursorPosition: number): ElementNode | null {
  function searchNode(node: VNode): ElementNode | null {
    // Check if this is a paragraph that contains the cursor position
    if (isParagraphNode(node)) {
      const paragraph = node as ElementNode;
      if (cursorPosition >= paragraph.startOffset && cursorPosition < paragraph.endOffset) {
        return paragraph;
      }
    }

    // Search children recursively
    for (const child of node.children) {
      const found = searchNode(child);
      if (found) {
        return found;
      }
    }

    return null;
  }

  return searchNode(root);
}

/**
 * Preserve cursor position during virtual DOM updates
 * Maintains the relative position within a paragraph when the paragraph's absolute position changes
 * @param originalParagraph The paragraph before the update
 * @param updatedParagraph The paragraph after the update
 * @param originalCursorPosition The cursor position before the update
 * @returns The adjusted cursor position after the update
 */
export function preserveCursorPositionDuringUpdate(
  originalParagraph: ElementNode,
  updatedParagraph: ElementNode,
  originalCursorPosition: number,
): number {
  // Calculate relative position within the original paragraph
  const relativePosition = getCursorPositionInParagraph(originalParagraph, originalCursorPosition);

  // Convert to absolute position in the updated paragraph
  return setCursorPositionInParagraph(updatedParagraph, relativePosition);
}

/**
 * Apply formatting to an entire paragraph
 * Wraps all paragraph content in a formatting node
 */
export function applyFormattingToParagraph(
  paragraph: ElementNode,
  formatType: FormatType,
): ElementNode {
  const formattedParagraph = createParagraphNode();

  // If paragraph is empty, return empty formatted paragraph
  if (paragraph.children.length === 0) {
    return formattedParagraph;
  }

  // Create formatting node to wrap all content
  const formattingNode = createFormattingNode(formatType);

  // Copy all children from original paragraph to formatting node
  formattingNode.children = [...paragraph.children];
  formattingNode.children.forEach((child) => {
    child.parent = formattingNode;
  });

  // Add formatting node to new paragraph
  formattedParagraph.children.push(formattingNode);
  formattingNode.parent = formattedParagraph;

  return formattedParagraph;
}

/**
 * Remove specific formatting from a paragraph
 * Recursively removes formatting nodes of the specified type
 */
export function removeFormattingFromParagraph(
  paragraph: ElementNode,
  formatType: FormatType,
): ElementNode {
  const unformattedParagraph = createParagraphNode();

  // Helper function to remove formatting recursively
  function removeFormattingFromNode(node: VNode): VNode[] {
    if (isTextNode(node)) {
      return [node];
    }

    if (isElementNode(node)) {
      // Check if this is the formatting we want to remove
      const isTargetFormatting =
        (formatType === 'bold' && (node.tagName === 'strong' || node.tagName === 'b')) ||
        (formatType === 'italic' && (node.tagName === 'em' || node.tagName === 'i')) ||
        (formatType === 'underline' && node.tagName === 'u');

      if (isTargetFormatting) {
        // Remove this formatting node and return its children
        const result: VNode[] = [];
        for (const child of node.children) {
          result.push(...removeFormattingFromNode(child));
        }
        return result;
      } else {
        // Keep this node but process its children
        const processedNode = createElementNode(node.tagName, { attributes: node.attributes });
        for (const child of node.children) {
          const processedChildren = removeFormattingFromNode(child);
          processedChildren.forEach((processedChild) => {
            processedNode.children.push(processedChild);
            processedChild.parent = processedNode;
          });
        }
        return [processedNode];
      }
    }

    return [node];
  }

  // Process all children of the paragraph
  for (const child of paragraph.children) {
    const processedChildren = removeFormattingFromNode(child);
    processedChildren.forEach((processedChild) => {
      unformattedParagraph.children.push(processedChild);
      processedChild.parent = unformattedParagraph;
    });
  }

  return unformattedParagraph;
}

/**
 * Apply formatting to multiple paragraphs
 * Useful for cross-paragraph selections
 */
export function applyFormattingToMultipleParagraphs(
  paragraphs: ElementNode[],
  formatType: FormatType,
): ElementNode[] {
  return paragraphs.map((paragraph) => applyFormattingToParagraph(paragraph, formatType));
}
