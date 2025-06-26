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

  public normalizeInlineFormatting(): void {
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
    // Find all elements with the same tag name as any of their ancestors
    const findNestedIdenticalElements = (element: Element): Element[] => {
      const nestedElements: Element[] = [];

      const checkElement = (el: Element, ancestors: Element[] = []) => {
        // Check if this element matches any ancestor
        const matchingAncestor = ancestors.find((ancestor) => this.shouldMerge(el, ancestor));
        if (matchingAncestor) {
          nestedElements.push(el);
        }

        // Recursively check children
        Array.from(el.children).forEach((child) => {
          checkElement(child as Element, [...ancestors, el]);
        });
      };

      checkElement(element);
      return nestedElements;
    };

    // Keep flattening until no more nested elements are found
    let foundNested = true;
    while (foundNested) {
      const nestedElements = findNestedIdenticalElements(rootElement);
      foundNested = nestedElements.length > 0;

      // Unwrap each nested element
      nestedElements.forEach((element) => {
        const parent = element.parentNode;
        if (parent) {
          // Move all children of the nested element to the parent
          while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
          }
          // Remove the now-empty nested element
          parent.removeChild(element);
        }
      });
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
