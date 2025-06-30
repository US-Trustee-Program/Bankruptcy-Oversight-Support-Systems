/**
 * FormattingRemovalService - Pure functions for removing formatting from DOM selections
 *
 * This service provides utilities to remove existing formatting from selected text,
 * which is essential for toggle functionality in the rich text editor.
 *
 * NOTE: This is currently a DOM-based implementation and will be refactored
 * to a pure VDOM-based service in a future phase.
 */

import { FormatType, findFormattingElement } from './FormattingDetectionService';

/**
 * Removes formatting from a specific element by unwrapping its content
 * @param formattingElement - The formatting element to remove
 * @returns Array of nodes that replaced the formatting element
 */
export function unwrapFormattingElement(formattingElement: Element): Node[] {
  const parent = formattingElement.parentNode;
  if (!parent) {
    return [];
  }

  const childNodes = Array.from(formattingElement.childNodes);
  const replacementNodes: Node[] = [];

  // Move all child nodes to replace the formatting element
  childNodes.forEach((child) => {
    parent.insertBefore(child, formattingElement);
    replacementNodes.push(child);
  });

  // Remove the now-empty formatting element
  parent.removeChild(formattingElement);

  return replacementNodes;
}

/**
 * Removes formatting from all elements within a selection range
 * @param selection - The current DOM selection
 * @param formatType - The type of formatting to remove
 * @param rootElement - The root element of the editor
 * @returns true if any formatting was removed, false otherwise
 */
export function removeFormattingFromSelection(
  selection: Selection,
  formatType: FormatType,
  rootElement: Element,
): boolean {
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  let formattingRemoved = false;

  // Handle collapsed selection (cursor position)
  if (range.collapsed) {
    const container = range.startContainer;
    const element =
      container.nodeType === Node.TEXT_NODE ? container.parentElement : (container as Element);

    if (element) {
      const formattingElement = findFormattingElement(element, formatType, rootElement);
      if (formattingElement) {
        unwrapFormattingElement(formattingElement);
        formattingRemoved = true;
      }
    }
  } else {
    // Handle text selection - find all formatting elements that intersect with the range
    const formattingElements = findFormattingElementsInRange(range, formatType, rootElement);

    if (formattingElements.length > 0) {
      // Process elements from deepest to shallowest to avoid DOM structure issues
      formattingElements
        .sort((a, b) => getElementDepth(b) - getElementDepth(a))
        .forEach((element) => {
          unwrapFormattingElement(element);
        });
      formattingRemoved = true;
    }
  }

  return formattingRemoved;
}

/**
 * Finds all formatting elements of a specific type within a range
 * @param range - The DOM range to search within
 * @param formatType - The type of formatting to find
 * @param rootElement - The root element of the editor
 * @returns Array of formatting elements found in the range
 */
export function findFormattingElementsInRange(
  range: Range,
  formatType: FormatType,
  rootElement: Element,
): Element[] {
  const formattingElements: Element[] = [];
  const processedElements = new Set<Element>();

  // Create a tree walker to find all text nodes in the range
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  let node = walker.nextNode();
  while (node) {
    const element = node.parentElement;
    if (element && !processedElements.has(element)) {
      const formattingElement = findFormattingElement(element, formatType, rootElement);
      if (formattingElement && !processedElements.has(formattingElement)) {
        formattingElements.push(formattingElement);
        processedElements.add(formattingElement);
      }
      processedElements.add(element);
    }
    node = walker.nextNode();
  }

  return formattingElements;
}

/**
 * Gets the depth of an element in the DOM tree
 * @param element - The element to measure depth for
 * @returns The depth of the element (0 for document root)
 */
function getElementDepth(element: Element): number {
  let depth = 0;
  let current = element.parentElement;

  while (current) {
    depth++;
    current = current.parentElement;
  }

  return depth;
}

/**
 * Splits a formatting element at the selection boundaries
 * This is used when only part of a formatted element should have its formatting removed
 * @param formattingElement - The formatting element to split
 * @param range - The range that defines the split boundaries
 * @returns Object containing the split elements
 */
export function splitFormattingElement(
  formattingElement: Element,
  range: Range,
): {
  before: Element | null;
  middle: DocumentFragment;
  after: Element | null;
} {
  const parent = formattingElement.parentNode;
  if (!parent) {
    return { before: null, middle: document.createDocumentFragment(), after: null };
  }

  // Clone the formatting element for before and after parts
  const beforeElement = formattingElement.cloneNode(false) as Element;
  const afterElement = formattingElement.cloneNode(false) as Element;
  const middleFragment = document.createDocumentFragment();

  // Determine which child nodes fall into each section
  const childNodes = Array.from(formattingElement.childNodes);
  const beforeNodes: Node[] = [];
  const middleNodes: Node[] = [];
  const afterNodes: Node[] = [];

  childNodes.forEach((child) => {
    if (range.isPointInRange(child, 0)) {
      // Node is at the start of the range
      if (range.intersectsNode(child)) {
        middleNodes.push(child);
      } else {
        beforeNodes.push(child);
      }
    } else if (range.intersectsNode(child)) {
      middleNodes.push(child);
    } else {
      // Determine if this node comes before or after the range
      const position = range.comparePoint(child, 0);
      if (position < 0) {
        beforeNodes.push(child);
      } else {
        afterNodes.push(child);
      }
    }
  });

  // Populate the split elements
  beforeNodes.forEach((node) => beforeElement.appendChild(node.cloneNode(true)));
  middleNodes.forEach((node) => middleFragment.appendChild(node.cloneNode(true)));
  afterNodes.forEach((node) => afterElement.appendChild(node.cloneNode(true)));

  return {
    before: beforeNodes.length > 0 ? beforeElement : null,
    middle: middleFragment,
    after: afterNodes.length > 0 ? afterElement : null,
  };
}
