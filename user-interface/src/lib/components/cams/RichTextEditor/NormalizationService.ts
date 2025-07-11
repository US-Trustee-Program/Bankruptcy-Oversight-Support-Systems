import { SelectionService } from './SelectionService.humble';
import { ZERO_WIDTH_SPACE_REGEX } from './Editor.constants';

const INLINE_TAGS = ['strong', 'em'];
const CLASS_BASED_SPANS = ['underline'];

export class NormalizationService {
  private root: HTMLElement;
  private selectionService: SelectionService;

  constructor(root: HTMLElement, selectionService: SelectionService) {
    this.root = root;
    this.selectionService = selectionService;
  }

  public normalizeInlineFormatting(iterations: number = 3): void {
    // Run multiple iterations for thorough normalization
    for (let i = 0; i < iterations; i++) {
      // Collect all elements first before making any modifications
      const elementsToNormalize: Element[] = [];
      const walker = this.selectionService.createTreeWalker(this.root, NodeFilter.SHOW_ELEMENT);

      let current: Node | null = walker.currentNode;
      while (current) {
        elementsToNormalize.push(current as Element);
        current = walker.nextNode();
      }

      // Now normalize each element after we've collected them all
      elementsToNormalize.forEach((element) => {
        this.normalizeElement(element);
      });

      // Apply deep nesting normalization (more aggressive)
      this.normalizeDeepNesting();
    }
  }

  /**
   * More aggressive normalization specifically targeting deeply nested formatting elements
   */
  private normalizeDeepNesting(): void {
    // First, handle deeply nested strong tags
    this.normalizeDeepTagNesting('strong');

    // Then handle deeply nested em tags
    this.normalizeDeepTagNesting('em');

    // Finally, handle underlines
    this.normalizeDeepTagNesting('span.underline');
  }

  /**
   * Aggressively normalizes deeply nested tags of the same type
   */
  private normalizeDeepTagNesting(selector: string): void {
    // Get all elements of this type in the document
    const elements = Array.from(this.root.querySelectorAll(selector));

    // Process each element to check for nesting issues
    elements.forEach((element) => {
      // Check ancestors for same tag type
      let parent = element.parentElement;
      let foundNestedParent = false;

      while (parent && !foundNestedParent) {
        if (
          (selector === 'span.underline' &&
            parent.tagName === 'SPAN' &&
            parent.classList.contains('underline')) ||
          (selector !== 'span.underline' && parent.tagName.toLowerCase() === selector)
        ) {
          foundNestedParent = true;

          // Found nesting issue - move this element's children to parent
          while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
          }

          // Remove the redundant element
          parent.removeChild(element);
        }

        parent = parent.parentElement;
      }
    });
  }

  private normalizeElement(node: Element): void {
    // First flatten nested identical tags throughout the entire subtree
    this.flattenNestedIdenticalTags(node);

    // Remove non-formatting spans and merge their text content
    this.unwrapNonFormattingSpans(node);

    this.removeEmptyFormattingElements(node);

    // Then merge adjacent similar elements
    this.mergeAdjacentSimilarElements(node);

    this.removeEmptyFormattingElements(node);

    // Remove zero-width spaces from text nodes
    this.removeZeroWidthSpaces(node);

    node.normalize();
  }

  private shouldMerge(a: Element, b: Element): boolean {
    if (a.tagName === b.tagName && INLINE_TAGS.includes(a.tagName.toLowerCase())) {
      return true;
    }
    return (
      a.tagName === 'SPAN' &&
      b.tagName === 'SPAN' &&
      CLASS_BASED_SPANS.some((cls) => a.classList.contains(cls) && b.classList.contains(cls))
    );
  }

  private flattenNestedIdenticalTags(rootElement: Element): void {
    // More thorough approach for deeply nested tags

    // Define a recursive function that will crawl through the DOM tree
    const processElement = (element: Element): boolean => {
      let madeChanges = false;

      // Process each child element first (depth-first)
      const children = Array.from(element.children);
      for (const child of children) {
        // Skip if the element was removed during processing
        if (!child.parentElement) continue;

        // Process this child (recurse)
        const childChanges = processElement(child);
        madeChanges = madeChanges || childChanges;
      }

      // Now handle this element's direct children for identical adjacent tags
      // This catches siblings that should be merged
      let i = 0;
      while (i < element.children.length - 1) {
        const current = element.children[i];
        const next = element.children[i + 1];

        if (this.shouldMerge(current, next)) {
          // Move all children from next to current
          while (next.firstChild) {
            current.appendChild(next.firstChild);
          }

          // Remove the now-empty next element
          next.remove();
          madeChanges = true;

          // Don't increment i, so we check the new next element
        } else {
          i++;
        }
      }

      // Now check for nesting between this element and its children
      for (i = 0; i < element.children.length; i++) {
        const child = element.children[i];

        if (this.shouldMerge(element, child)) {
          // This is a nested tag of the same type
          // Move all child's children directly to element
          while (child.firstChild) {
            element.insertBefore(child.firstChild, child);
          }

          // Remove the redundant child element
          element.removeChild(child);
          i--; // Adjust index as we removed an element
          madeChanges = true;
        }
      }

      return madeChanges;
    };

    // Run multiple passes to ensure thorough normalization
    for (let pass = 0; pass < 3; pass++) {
      const changes = processElement(rootElement);
      if (!changes) break; // Stop if no changes were made
    }
  }

  private removeEmptyFormattingElements(node: Element): void {
    Array.from(node.childNodes).forEach((child) => {
      if (
        child.nodeType === Node.ELEMENT_NODE &&
        (INLINE_TAGS.includes((child as Element).tagName.toLowerCase()) ||
          (child as Element).tagName === 'SPAN') &&
        (!child.textContent || child.textContent.length === 0)
      ) {
        node.removeChild(child);
      }
    });
  }

  private mergeAdjacentSimilarElements(node: Element): void {
    // Iterate forward through child nodes with decrement on merge
    for (let i = 0; i < node.childNodes.length - 1; i++) {
      const current = node.childNodes[i];
      const next = node.childNodes[i + 1];

      if (
        current.nodeType === Node.ELEMENT_NODE &&
        next.nodeType === Node.ELEMENT_NODE &&
        this.shouldMerge(current as Element, next as Element)
      ) {
        // Move all children from next element to current element
        while (next.firstChild) {
          current.appendChild(next.firstChild);
        }
        // Remove the now-empty next element
        next.remove();

        // Decrement i so we recheck the current position with the new next element
        i--;
      }
    }
  }

  private removeZeroWidthSpaces(node: Element): void {
    const walker = this.selectionService.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];

    let current: Node | null = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) {
        textNodes.push(current as Text);
      }
      current = walker.nextNode();
    }

    textNodes.forEach((textNode) => {
      if (textNode.textContent) {
        textNode.textContent = textNode.textContent.replace(ZERO_WIDTH_SPACE_REGEX, '');
      }
    });
  }

  private unwrapNonFormattingSpans(node: Element): void {
    // Find all span elements that don't have formatting classes
    const spansToUnwrap: Element[] = [];
    Array.from(node.querySelectorAll('span')).forEach((span) => {
      const hasFormattingClass = CLASS_BASED_SPANS.some((cls) => span.classList.contains(cls));
      if (!hasFormattingClass) {
        spansToUnwrap.push(span);
      }
    });

    // Unwrap each non-formatting span
    spansToUnwrap.forEach((span) => {
      const parent = span.parentNode;
      if (parent) {
        // Move all child nodes of the span to the parent
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        // Remove the now-empty span
        parent.removeChild(span);
      }
    });
  }
}
