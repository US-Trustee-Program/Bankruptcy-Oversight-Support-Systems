import { RichTextFormat } from './Editor.constants';

/**
 * This service provides enhanced functionality for removing formatting
 * from HTML content, particularly handling nested formatting elements.
 */
export class FormattingRemovalService {
  /**
   * Removes specified formatting from a document fragment, handling nested elements properly.
   * @param fragment The document fragment to process
   * @param tagName The formatting tag to remove
   */
  public removeFormatFromFragment(fragment: DocumentFragment, tagName: RichTextFormat): void {
    const selector = tagName === 'u' ? 'span.underline' : tagName;

    // First pass: Flatten ALL nested elements of the same type in the entire fragment
    // This removes redundant nesting like <strong><strong>text</strong></strong>
    this.flattenRedundantNesting(fragment, selector);

    // Special handling for extreme nesting cases like problem.html
    if (tagName === 'em') {
      // Get a count of remaining em tags after flattening
      const emTagCount = fragment.querySelectorAll('em').length;

      // If we have a lot of em tags, or if we're dealing with the problem.html case
      if (emTagCount > 3) {
        // Direct removal of all em tags, regardless of structure
        const allEmTags = Array.from(fragment.querySelectorAll('em'));

        // Remove from bottom up to handle nesting correctly
        for (let i = allEmTags.length - 1; i >= 0; i--) {
          const em = allEmTags[i];
          if (em.parentNode) {
            // Move all children before the em tag
            while (em.firstChild) {
              em.parentNode.insertBefore(em.firstChild, em);
            }
            // Remove the empty em tag
            em.parentNode.removeChild(em);
          }
        }
        return;
      }
    }

    // Second pass: Remove ALL elements of the specified format type
    this.unwrapAllFormatElements(fragment, selector, tagName);
  }

  /**
   * Public method to flatten nested elements of the same format type
   * This can be called directly from FormattingService before wrapping content
   * to prevent creating redundant nesting
   * @param fragment The document fragment or element to process
   * @param tagName The formatting tag to flatten
   */
  public flattenNestedElements(
    fragment: DocumentFragment | Element,
    tagName: RichTextFormat,
  ): void {
    const selector = tagName === 'u' ? 'span.underline' : tagName;
    this.flattenRedundantNesting(fragment, selector);
  }

  /**
   * Flattens nested elements of the same format type (e.g., <strong> inside <strong>)
   * This prevents excessive nesting depth and simplifies the DOM structure.
   * Uses a recursive deep-traversal approach to handle complex nesting patterns.
   */
  private flattenRedundantNesting(fragment: DocumentFragment | Element, selector: string): void {
    // First pass: deep traversal to flatten nested elements from the inside out
    this.traverseAndFlattenNested(fragment, selector);

    // Second pass: more thorough check for redundant nesting at all levels
    let foundNestedElements = true;
    let maxIterations = 20; // Safety measure to avoid infinite loops

    while (foundNestedElements && maxIterations > 0) {
      maxIterations--;
      foundNestedElements = false;

      // Get all elements of the target type
      const elements = Array.from(fragment.querySelectorAll(selector));

      // Check each element for redundant parent/child relationships
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];

        // Check if this element has a parent of the same type
        let parent = element.parentElement;
        while (parent) {
          if (this.isElementMatchingSelector(parent, selector)) {
            // We found redundant nesting - parent and element are the same format type
            foundNestedElements = true;

            // Move all children of the redundant element up to its parent
            while (element.firstChild) {
              parent.insertBefore(element.firstChild, element);
            }

            // Remove the now-empty redundant element
            parent.removeChild(element);

            // Restart the process since we modified the DOM
            break;
          }
          parent = parent.parentElement;
        }

        if (foundNestedElements) {
          break;
        }

        // Also check direct children of this element
        const childNodes = Array.from(element.childNodes);
        let hasProcessedChildren = false;

        for (const node of childNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const childElement = node as Element;

            // Check if this child is the same format type
            if (this.isElementMatchingSelector(childElement, selector)) {
              foundNestedElements = true;
              hasProcessedChildren = true;

              // Move all children of the redundant element up to its parent
              while (childElement.firstChild) {
                element.insertBefore(childElement.firstChild, childElement);
              }

              // Remove the now-empty redundant element
              element.removeChild(childElement);
            }
          }
        }

        // If we processed children, we need to restart since the DOM structure changed
        if (hasProcessedChildren) {
          break;
        }
      }
    }
  }

  /**
   * Helper method that checks if an element matches a selector pattern
   * More robust than just checking tag names
   */
  private isElementMatchingSelector(element: Element, selector: string): boolean {
    if (selector === 'span.underline') {
      return element.tagName === 'SPAN' && element.classList.contains('underline');
    }
    return element.tagName.toLowerCase() === selector;
  }

  /**
   * Recursively traverses the DOM tree to flatten nested elements from bottom up
   * This approach is more thorough for complex nesting scenarios
   */
  private traverseAndFlattenNested(node: Node, selector: string): void {
    // First process all children (bottom-up approach)
    const childNodes = Array.from(node.childNodes);
    for (const child of childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        // Recurse to process children first
        this.traverseAndFlattenNested(child, selector);
      }
    }

    // Then process this node if it's an element
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;

      // If this is a matching element, check its children for matching elements
      if (this.isElementMatchingSelector(element, selector)) {
        const childElements = Array.from(element.children);

        for (const childElement of childElements) {
          // If child is also a matching element, move its children up and remove it
          if (this.isElementMatchingSelector(childElement, selector)) {
            // Move all grandchildren up to the parent
            while (childElement.firstChild) {
              element.insertBefore(childElement.firstChild, childElement);
            }

            // Remove the now-empty child element
            element.removeChild(childElement);
          }
        }
      }
    }
  }

  /**
   * Unwraps all elements of a specific format, preserving their content.
   * Uses a more thorough approach to handle complex nested structures.
   */
  private unwrapAllFormatElements(
    fragment: DocumentFragment,
    selector: string,
    tagName: RichTextFormat,
  ): void {
    // First approach: Recursive depth-first traversal (more thorough)
    this.recursivelyUnwrapFormatting(fragment, tagName);

    // Second approach: Iterative bottom-up removal as a fallback
    // This catches any elements that might have been missed
    let elementsFound = true;
    let maxIterations = 20; // Safety against infinite loops

    while (elementsFound && maxIterations > 0) {
      maxIterations--;

      // Get elements - will update on each iteration as DOM changes
      const elements = fragment.querySelectorAll(selector);
      elementsFound = elements.length > 0;

      if (elementsFound) {
        // Process them in reverse order (bottom-up) to handle nesting
        for (let i = elements.length - 1; i >= 0; i--) {
          const element = elements[i];

          // Check if this is an element we want to remove
          if (this.isMatchingElement(element, tagName)) {
            const parent = element.parentNode;

            if (parent) {
              // Move all children outside the element
              while (element.firstChild) {
                parent.insertBefore(element.firstChild, element);
              }

              // Remove the now-empty format element
              parent.removeChild(element);
            }
          }
        }
      }
    }
  }

  /**
   * Recursively scans and unwraps formatting elements in a depth-first manner.
   * This is more effective for complex nested structures.
   */
  private recursivelyUnwrapFormatting(node: Node, tagName: RichTextFormat): void {
    // Direct approach for extreme cases - removes all matching tags in one go
    // This ensures we catch all instances regardless of nesting depth
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE || node.nodeType === Node.ELEMENT_NODE) {
      const rootElement = node as Element | DocumentFragment;
      const selector = tagName === 'u' ? 'span.underline' : tagName;

      // Get all matching format elements in this subtree
      const allFormatElements = Array.from(rootElement.querySelectorAll(selector));

      if (allFormatElements.length > 0) {
        // Process all format elements from bottom up (to handle nested properly)
        // We need to ensure we get them all in one pass
        for (let i = allFormatElements.length - 1; i >= 0; i--) {
          const formatElement = allFormatElements[i];
          if (formatElement.parentNode) {
            // Move all children up to the parent, preserving order
            while (formatElement.firstChild) {
              formatElement.parentNode.insertBefore(formatElement.firstChild, formatElement);
            }

            // Remove the now-empty format element
            formatElement.parentNode.removeChild(formatElement);
          }
        }

        return; // Early exit since we've handled everything
      }
    }

    // Create a copy of childNodes since the collection will be modified
    const childNodes = Array.from(node.childNodes);

    // First, process all children (depth-first)
    for (const child of childNodes) {
      // Skip if the node was removed during processing
      if (!child.parentNode) {
        continue;
      }

      // If this is a format element we need to remove
      if (
        child.nodeType === Node.ELEMENT_NODE &&
        this.isMatchingElement(child as Element, tagName)
      ) {
        const parent = child.parentNode;

        // Move all children of the format element to before the format element
        while (child.firstChild) {
          parent.insertBefore(child.firstChild, child);
        }

        // Remove the now-empty format element
        parent.removeChild(child);

        // Since we've modified the DOM, recursively process the parent again
        this.recursivelyUnwrapFormatting(parent, tagName);
        return; // Exit early since we're restarting from the parent
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        // If not a target format element but still an element, process its children
        this.recursivelyUnwrapFormatting(child, tagName);
      }
    }
  }

  /**
   * Checks if an element matches the specified format type
   */
  public isMatchingElement(element: Element, format: RichTextFormat): boolean {
    switch (format) {
      case 'strong':
        return element.tagName === 'STRONG';
      case 'em':
        return element.tagName === 'EM';
      case 'u':
        return element.tagName === 'SPAN' && element.classList.contains('underline');
      default:
        return false;
    }
  }
}
