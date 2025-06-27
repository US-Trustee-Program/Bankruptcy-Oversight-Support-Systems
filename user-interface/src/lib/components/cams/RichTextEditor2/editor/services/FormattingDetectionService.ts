/**
 * FormattingDetectionService - Pure functions for detecting formatting in DOM selections
 *
 * This service provides utilities to detect existing formatting in selected text,
 * which is essential for toggle functionality in the rich text editor.
 */

export type FormatType = 'bold' | 'italic' | 'underline';

/**
 * Maps format types to their corresponding HTML tag names
 */
const FORMAT_TAG_MAP: Record<FormatType, string[]> = {
  bold: ['strong', 'b'],
  italic: ['em', 'i'],
  underline: ['u'],
};

/**
 * Checks if a DOM element has the specified formatting
 * @param element - The DOM element to check
 * @param formatType - The type of formatting to check for
 * @returns true if the element has the formatting, false otherwise
 */
export function hasFormatting(element: Element, formatType: FormatType): boolean {
  const tagNames = FORMAT_TAG_MAP[formatType];
  return tagNames.includes(element.tagName.toLowerCase());
}

/**
 * Checks if any ancestor element has the specified formatting
 * @param element - The starting DOM element
 * @param formatType - The type of formatting to check for
 * @param rootElement - The root element to stop searching at
 * @returns true if any ancestor has the formatting, false otherwise
 */
export function hasAncestorFormatting(
  element: Element,
  formatType: FormatType,
  rootElement: Element,
): boolean {
  let current = element;

  while (current && current !== rootElement) {
    if (hasFormatting(current, formatType)) {
      return true;
    }
    current = current.parentElement as Element;
  }

  return false;
}

/**
 * Checks if the current selection has the specified formatting
 * This handles cases where:
 * - The selection is within a formatted element
 * - The selection spans multiple elements with mixed formatting
 * - The selection has no formatting
 *
 * @param selection - The current DOM selection
 * @param formatType - The type of formatting to check for
 * @param rootElement - The root element of the editor
 * @returns 'all' if all selected content has formatting, 'partial' if some has formatting, 'none' if no formatting
 */
export function getSelectionFormattingState(
  selection: Selection,
  formatType: FormatType,
  rootElement: Element,
): 'all' | 'partial' | 'none' {
  if (!selection || selection.rangeCount === 0) {
    return 'none';
  }

  const range = selection.getRangeAt(0);

  // If selection is collapsed (no text selected), check the current position
  if (range.collapsed) {
    const container = range.startContainer;
    const element =
      container.nodeType === Node.TEXT_NODE ? container.parentElement : (container as Element);

    if (element && hasAncestorFormatting(element, formatType, rootElement)) {
      return 'all';
    }
    return 'none';
  }

  // For non-collapsed selections, we need to check all elements in the range
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  let hasFormattedText = false;
  let hasUnformattedText = false;
  let node = walker.nextNode();

  while (node) {
    const element = node.parentElement;
    if (element) {
      if (hasAncestorFormatting(element, formatType, rootElement)) {
        hasFormattedText = true;
      } else {
        hasUnformattedText = true;
      }
    }

    // Early exit if we have both formatted and unformatted text
    if (hasFormattedText && hasUnformattedText) {
      return 'partial';
    }

    node = walker.nextNode();
  }

  if (hasFormattedText && !hasUnformattedText) {
    return 'all';
  } else if (hasFormattedText && hasUnformattedText) {
    return 'partial';
  } else {
    return 'none';
  }
}

/**
 * Finds the formatting element that contains the given element
 * @param element - The element to start searching from
 * @param formatType - The type of formatting to find
 * @param rootElement - The root element to stop searching at
 * @returns The formatting element if found, null otherwise
 */
export function findFormattingElement(
  element: Element,
  formatType: FormatType,
  rootElement: Element,
): Element | null {
  let current = element;

  while (current && current !== rootElement) {
    if (hasFormatting(current, formatType)) {
      return current;
    }
    current = current.parentElement as Element;
  }

  return null;
}
