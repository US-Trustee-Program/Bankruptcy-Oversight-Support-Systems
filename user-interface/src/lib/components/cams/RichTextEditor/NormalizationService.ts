import { SelectionService } from './SelectionService.humble';

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

    this.removeEmptyFormattingElements(node);

    // Then merge adjacent similar elements
    this.mergeAdjacentSimilarElements(node);

    this.removeEmptyFormattingElements(node);

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
          ((child as Element).tagName === 'SPAN' &&
            CLASS_BASED_SPANS.some((cls) => (child as Element).classList.contains(cls)))) &&
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
}
