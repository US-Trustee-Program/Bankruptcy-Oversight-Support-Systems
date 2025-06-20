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
    const walker = this.selectionService.createTreeWalker(this.root, NodeFilter.SHOW_ELEMENT);

    const shouldMerge = (a: Element, b: Element): boolean => {
      if (a.tagName === b.tagName && INLINE_TAGS.includes(a.tagName.toLowerCase())) {
        return true;
      }
      if (
        a.tagName === 'SPAN' &&
        b.tagName === 'SPAN' &&
        CLASS_BASED_SPANS.some((cls) => a.classList.contains(cls) && b.classList.contains(cls))
      ) {
        return true;
      }
      return false;
    };

    const flattenNestedIdenticalTags = (rootElement: Element) => {
      // Find all elements with the same tag name as any of their ancestors
      const findNestedIdenticalElements = (element: Element): Element[] => {
        const nestedElements: Element[] = [];

        const checkElement = (el: Element, ancestors: Element[] = []) => {
          // Check if this element matches any ancestor
          const matchingAncestor = ancestors.find((ancestor) => shouldMerge(el, ancestor));
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
    };

    const normalizeElement = (node: Element) => {
      // First flatten nested identical tags throughout the entire subtree
      flattenNestedIdenticalTags(node);

      this.removeEmptyFormattingElements(node);

      // Then merge adjacent similar elements
      for (let i = node.childNodes.length - 1; i > 0; i--) {
        const current = node.childNodes[i];
        const prev = node.childNodes[i - 1];

        if (
          current.nodeType === Node.ELEMENT_NODE &&
          prev.nodeType === Node.ELEMENT_NODE &&
          shouldMerge(current as Element, prev as Element)
        ) {
          while (current.firstChild) {
            prev.appendChild(current.firstChild);
          }
          current.remove();
        }
      }

      this.removeEmptyFormattingElements(node);

      node.normalize();
    };

    let current: Node | null = walker.currentNode;
    while (current) {
      normalizeElement(current as Element);
      current = walker.nextNode();
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
}
