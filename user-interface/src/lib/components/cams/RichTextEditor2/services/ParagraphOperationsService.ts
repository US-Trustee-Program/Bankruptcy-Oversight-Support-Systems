/**
 * Pure functions for paragraph operations in the virtual DOM
 * Following CAMS guidelines for service architecture with dependency inversion
 */

import {
  VNode,
  ElementNode,
  isElementNode,
  isTextNode,
  isFormattingNode,
} from '../virtual-dom/VNode';
import {
  createElementNode,
  createTextNode,
  createFormattingNode,
} from '../virtual-dom/VNodeFactory';

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
 * Interface for element split result
 */
export interface ElementSplitResult {
  firstElement: VNode | null;
  secondElement: VNode | null;
}

/**
 * Split an element node at the given position
 * Returns two new element nodes with content split at the position
 */
export function splitElementAtPosition(element: VNode, position: number): ElementSplitResult {
  if (isTextNode(element)) {
    // For text nodes, split the content
    const firstText = element.content.substring(0, position);
    const secondText = element.content.substring(position);

    return {
      firstElement: firstText ? createTextNode(firstText) : null,
      secondElement: secondText ? createTextNode(secondText) : null,
    };
  }

  if (isElementNode(element)) {
    // For element nodes, create two new elements with the same tag and attributes
    const firstElement = createElementNode(element.tagName, { attributes: element.attributes });
    const secondElement = createElementNode(element.tagName, { attributes: element.attributes });

    // Split the children at the given position
    let currentPosition = 0;
    let splitFound = false;

    for (const child of element.children) {
      if (splitFound) {
        // All remaining children go to second element
        secondElement.children.push(child);
        child.parent = secondElement;
      } else {
        const childLength = getElementContentLength(child);

        if (currentPosition + childLength <= position) {
          // Entire child goes to first element
          firstElement.children.push(child);
          child.parent = firstElement;
          currentPosition += childLength;
        } else if (currentPosition >= position) {
          // Entire child goes to second element
          secondElement.children.push(child);
          child.parent = secondElement;
          splitFound = true;
        } else {
          // Split this child
          const childSplitPosition = position - currentPosition;
          const childSplitResult = splitElementAtPosition(child, childSplitPosition);

          if (childSplitResult.firstElement) {
            firstElement.children.push(childSplitResult.firstElement);
            childSplitResult.firstElement.parent = firstElement;
          }

          if (childSplitResult.secondElement) {
            secondElement.children.push(childSplitResult.secondElement);
            childSplitResult.secondElement.parent = secondElement;
          }

          splitFound = true;
        }

        currentPosition += childLength;
      }
    }

    return {
      firstElement: firstElement.children.length > 0 ? firstElement : null,
      secondElement: secondElement.children.length > 0 ? secondElement : null,
    };
  }

  if (isFormattingNode(element)) {
    // For formatting nodes, create two new formatting nodes with the same tag and format type
    const firstElement = createFormattingNode(element.formatType);
    const secondElement = createFormattingNode(element.formatType);

    // Split the children at the given position
    let currentPosition = 0;
    let splitFound = false;

    for (const child of element.children) {
      if (splitFound) {
        // All remaining children go to second element
        secondElement.children.push(child);
        child.parent = secondElement;
      } else {
        const childLength = getElementContentLength(child);

        if (currentPosition + childLength <= position) {
          // Entire child goes to first element
          firstElement.children.push(child);
          child.parent = firstElement;
          currentPosition += childLength;
        } else if (currentPosition >= position) {
          // Entire child goes to second element
          secondElement.children.push(child);
          child.parent = secondElement;
          splitFound = true;
        } else {
          // Split this child
          const childSplitPosition = position - currentPosition;
          const childSplitResult = splitElementAtPosition(child, childSplitPosition);

          if (childSplitResult.firstElement) {
            firstElement.children.push(childSplitResult.firstElement);
            childSplitResult.firstElement.parent = firstElement;
          }

          if (childSplitResult.secondElement) {
            secondElement.children.push(childSplitResult.secondElement);
            childSplitResult.secondElement.parent = secondElement;
          }

          splitFound = true;
        }

        currentPosition += childLength;
      }
    }

    return {
      firstElement: firstElement.children.length > 0 ? firstElement : null,
      secondElement: secondElement.children.length > 0 ? secondElement : null,
    };
  }

  // For other node types, return as-is (shouldn't happen in normal cases)
  return {
    firstElement: element,
    secondElement: null,
  };
}

/**
 * Split a paragraph at the given cursor position
 * Returns two new paragraph nodes with content split at the cursor
 */
export function splitParagraphAtCursor(
  paragraph: ElementNode,
  cursorPosition: number,
): ParagraphSplitResult {
  const firstParagraph = createParagraphNode(paragraph.attributes);
  const secondParagraph = createParagraphNode(paragraph.attributes);

  let currentPosition = 0;
  let splitFound = false;

  for (const child of paragraph.children) {
    if (splitFound) {
      secondParagraph.children.push(child);
      child.parent = secondParagraph;
    } else {
      const childLength = getElementContentLength(child);

      if (currentPosition + childLength <= cursorPosition) {
        firstParagraph.children.push(child);
        child.parent = firstParagraph;
        currentPosition += childLength;
      } else if (currentPosition >= cursorPosition) {
        secondParagraph.children.push(child);
        child.parent = secondParagraph;
        splitFound = true;
      } else {
        const splitPosition = cursorPosition - currentPosition;
        const splitResult = splitElementAtPosition(child, splitPosition);

        if (splitResult.firstElement) {
          firstParagraph.children.push(splitResult.firstElement);
          splitResult.firstElement.parent = firstParagraph;
        }
        if (splitResult.secondElement) {
          secondParagraph.children.push(splitResult.secondElement);
          splitResult.secondElement.parent = secondParagraph;
        }
        splitFound = true;
      }
    }
  }

  return { firstParagraph, secondParagraph };
}

/**
 * Get the total content length of a node and its descendants
 */
function getElementContentLength(node: VNode): number {
  if (isTextNode(node)) {
    return node.content.length;
  }

  return node.children.reduce((total, child) => total + getElementContentLength(child), 0);
}

/**
 * Merge two adjacent paragraphs into a single paragraph
 */
export function mergeParagraphs(
  firstParagraph: ElementNode,
  secondParagraph: ElementNode,
): ElementNode {
  const mergedParagraph = createParagraphNode(firstParagraph.attributes);

  for (const child of firstParagraph.children) {
    mergedParagraph.children.push(child);
    child.parent = mergedParagraph;
  }

  for (const child of secondParagraph.children) {
    mergedParagraph.children.push(child);
    child.parent = mergedParagraph;
  }

  return mergedParagraph;
}

/**
 * Insert a new paragraph after an existing paragraph
 */
export function insertParagraphAfter(
  existingParagraph: ElementNode,
  textContent?: string,
): ElementNode {
  const newParagraph = createParagraphNode({}, textContent);

  if (existingParagraph.parent) {
    const parent = existingParagraph.parent;
    const index = parent.children.indexOf(existingParagraph);
    parent.children.splice(index + 1, 0, newParagraph);
    newParagraph.parent = parent;
  }

  return newParagraph;
}

/**
 * Move the cursor to the start of a paragraph
 */
export function moveCursorToParagraphStart(paragraph: ElementNode): number {
  return paragraph.startOffset;
}

/**
 * Move the cursor to the end of a paragraph
 */
export function moveCursorToParagraphEnd(paragraph: ElementNode): number {
  return paragraph.endOffset;
}

/**
 * Get the relative cursor position within a paragraph
 */
export function getCursorPositionInParagraph(
  paragraph: ElementNode,
  absolutePosition: number,
): number {
  return absolutePosition - paragraph.startOffset;
}

/**
 * Set the absolute cursor position from a relative position within a paragraph
 */
export function setCursorPositionInParagraph(
  paragraph: ElementNode,
  relativePosition: number,
): number {
  return paragraph.startOffset + relativePosition;
}

/**
 * Find the paragraph at the given cursor position
 */
export function findParagraphAtCursor(root: VNode, cursorPosition: number): ElementNode | null {
  function searchNode(node: VNode): ElementNode | null {
    if (isParagraphNode(node)) {
      if (cursorPosition >= node.startOffset && cursorPosition <= node.endOffset) {
        return node;
      }
    }

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
 * Preserve cursor position during paragraph updates
 * Tries to map cursor position from original to updated paragraph
 */
export function preserveCursorPositionDuringUpdate(
  originalParagraph: ElementNode,
  updatedParagraph: ElementNode,
  originalCursorPosition: number,
): number {
  // Simple implementation: keep the same relative position
  const relativePosition = originalCursorPosition - originalParagraph.startOffset;
  return updatedParagraph.startOffset + relativePosition;
}

/**
 * Apply formatting to an entire paragraph
 */
export function applyFormattingToParagraph(
  paragraph: ElementNode,
  formatType: FormatType,
): ElementNode {
  const newParagraph = createParagraphNode(paragraph.attributes);

  for (const child of paragraph.children) {
    const newChild = createFormattingNode(formatType);
    newChild.children.push(child);
    child.parent = newChild;
    newChild.parent = newParagraph;
    newParagraph.children.push(newChild);
  }

  return newParagraph;
}

/**
 * Remove formatting from a paragraph
 */
export function removeFormattingFromParagraph(
  paragraph: ElementNode,
  formatType: FormatType,
): ElementNode {
  function removeFormattingFromNode(node: VNode): VNode[] {
    if (isFormattingNode(node) && node.formatType === formatType) {
      // If this is the formatting node to remove, return its children
      return node.children.flatMap(removeFormattingFromNode);
    } else {
      // Otherwise, process children recursively
      const newChildren = node.children.flatMap(removeFormattingFromNode);
      const newNode = { ...node, children: newChildren };
      newChildren.forEach((child) => (child.parent = newNode));
      return [newNode];
    }
  }

  const newParagraph = createParagraphNode(paragraph.attributes);
  newParagraph.children = paragraph.children.flatMap(removeFormattingFromNode);
  newParagraph.children.forEach((child) => (child.parent = newParagraph));
  return newParagraph;
}

/**
 * Apply formatting to multiple paragraphs
 */
export function applyFormattingToMultipleParagraphs(
  paragraphs: ElementNode[],
  formatType: FormatType,
): ElementNode[] {
  return paragraphs.map((p) => applyFormattingToParagraph(p, formatType));
}
