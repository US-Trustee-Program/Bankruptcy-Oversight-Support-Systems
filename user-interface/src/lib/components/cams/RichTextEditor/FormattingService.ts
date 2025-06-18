import editorUtilities from './utilities';
import { SelectionService } from './SelectionService.humble';
import { RichTextFormat, ZERO_WIDTH_SPACE } from './editor.constants';

const INLINE_TAGS = ['strong', 'em'];
const CLASS_BASED_SPANS = ['underline'];

export class FormattingService {
  private root: HTMLElement;
  private selectionService: SelectionService;

  constructor(root: HTMLElement, selectionService: SelectionService) {
    this.root = root;
    this.selectionService = selectionService;
  }

  public toggleSelection(tagName: RichTextFormat): void {
    const selection = this.selectionService.getCurrentSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (editorUtilities.isRangeAcrossBlocks(this.root, range)) {
      // TODO: We should probably tell the user they can't change formatting across paragraphs or lists
      return;
    }

    if (range.collapsed) {
      // Check if we're already inside a formatting element of the target type
      const existingFormatElement = editorUtilities.findClosestAncestor<Element>(
        this.root,
        range.startContainer,
        tagName === 'u' ? 'span.underline' : tagName,
      );

      if (
        existingFormatElement &&
        FormattingService.isMatchingElement(existingFormatElement, tagName)
      ) {
        // We're inside a formatting element - toggle it off by moving cursor outside
        this.exitFormattingElement(existingFormatElement, range);
      } else {
        // We're not in a formatting element - toggle it on by creating one
        const el = this.createRichTextElement(tagName);
        if (el) {
          el.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));
          range.insertNode(el);

          // Position cursor inside the new formatting element
          const newRange = this.selectionService.createRange();
          newRange.setStart(el.firstChild!, 1); // After the zero-width space
          newRange.collapse(true);
          this.selectionService.setSelectionRange(newRange);
        }
      }
      return;
    }

    // Check if the entire selection is formatted with the target format
    const isFullyFormatted = this.isEntireSelectionFormatted(range, tagName);

    if (isFullyFormatted) {
      // Handle removing formatting - entire selection is formatted
      this.removeFormattingFromRange(range, tagName);
    } else {
      // Either not formatted at all, or only partially formatted
      // In both cases, we want to add/expand formatting to cover the entire selection
      const contents = range.extractContents();
      const wrapper = this.createRichTextElement(tagName);
      if (wrapper) {
        wrapper.appendChild(contents);
        range.insertNode(wrapper);
      }
    }

    this.normalizeInlineFormatting();
    this.selectionService.getCurrentSelection()?.removeAllRanges();
  }

  private createRichTextElement(format: RichTextFormat): HTMLElement {
    switch (format) {
      case 'strong':
        return this.selectionService.createElement('strong');
      case 'em':
        return this.selectionService.createElement('em');
      case 'u': {
        const span = this.selectionService.createElement('span');
        span.className = 'underline';
        return span;
      }
    }
  }

  private static isMatchingElement(el: Element, format: RichTextFormat): boolean {
    switch (format) {
      case 'strong':
        return el.tagName === 'STRONG';
      case 'em':
        return el.tagName === 'EM';
      case 'u':
        return el.tagName === 'SPAN' && el.classList.contains('underline');
      default:
        return false;
    }
  }

  private exitFormattingElement(formatElement: Element, _range: Range): void {
    const selection = this.selectionService.getCurrentSelection();
    if (!selection) {
      return;
    }

    // Find all active formatting elements at the current cursor position, excluding the one being toggled off
    const currentRange = selection.getRangeAt(0);
    const activeFormats = this.getActiveFormatsExcluding(
      currentRange.startContainer,
      formatElement,
    );

    // Create the new nested structure with the remaining formats
    const newFormatStructure = this.createNestedFormatStructure(activeFormats);

    // Insert the new structure after the current formatting element
    if (formatElement.parentNode) {
      formatElement.parentNode.insertBefore(newFormatStructure, formatElement.nextSibling);
    }

    // Position cursor in the innermost element of the new structure
    this.positionCursorInNewStructure(newFormatStructure);
  }

  private isEntireSelectionFormatted(range: Range, tagName: RichTextFormat): boolean {
    // Simple approach: check if both start and end containers are within the same formatted element
    // and if the selection spans the entire content of that element

    const { startContainer, endContainer } = range;

    // Find the formatted element that contains the start
    let startFormatElement: Element | null = null;
    let current: Node | null =
      startContainer.nodeType === Node.TEXT_NODE ? startContainer.parentNode : startContainer;

    while (current && current !== this.root) {
      if (
        current.nodeType === Node.ELEMENT_NODE &&
        FormattingService.isMatchingElement(current as Element, tagName)
      ) {
        startFormatElement = current as Element;
        break;
      }
      current = current.parentNode;
    }

    // If start isn't in a formatted element, it's not entirely formatted
    if (!startFormatElement) {
      return false;
    }

    // Check if end is also in the same formatted element
    current = endContainer.nodeType === Node.TEXT_NODE ? endContainer.parentNode : endContainer;

    while (current && current !== this.root) {
      if (current === startFormatElement) {
        // Both start and end are in the same formatted element
        // Check if the selection spans content that goes outside this element
        return (
          range.startContainer === range.endContainer ||
          startFormatElement.contains(range.endContainer)
        );
      }
      current = current.parentNode;
    }

    // End container is not in the same formatted element as start
    return false;
  }

  private getActiveFormatsExcluding(node: Node, excludeElement: Element): RichTextFormat[] {
    const formats: RichTextFormat[] = [];
    let current: Node | null = node;

    while (current && current !== this.root) {
      if (current.nodeType === Node.ELEMENT_NODE && current !== excludeElement) {
        const element = current as Element;
        if (element.tagName === 'STRONG') {
          formats.unshift('strong');
        } else if (element.tagName === 'EM') {
          formats.unshift('em');
        } else if (element.tagName === 'SPAN' && element.classList.contains('underline')) {
          formats.unshift('u');
        }
      }
      current = current.parentNode;
    }

    return formats;
  }

  private createNestedFormatStructure(formats: RichTextFormat[]): Element {
    if (formats.length === 0) {
      // No remaining formats, just create a text node with zero-width space
      const textNode = this.selectionService.createTextNode(ZERO_WIDTH_SPACE);
      const span = this.selectionService.createElement('span');
      span.appendChild(textNode);
      return span;
    }

    // Create nested structure from outermost to innermost
    const outerElement = this.createRichTextElement(formats[0]);
    let currentElement: Element = outerElement;

    for (let i = 1; i < formats.length; i++) {
      const newElement = this.createRichTextElement(formats[i]);
      currentElement.appendChild(newElement);
      currentElement = newElement;
    }

    // Add zero-width space to the innermost element
    const textNode = this.selectionService.createTextNode(ZERO_WIDTH_SPACE);
    currentElement.appendChild(textNode);

    return outerElement;
  }

  private positionCursorInNewStructure(structure: Element): void {
    const selection = this.selectionService.getCurrentSelection();
    if (!selection) {
      return;
    }

    // Find the innermost text node
    const walker = this.selectionService.createTreeWalker(structure, NodeFilter.SHOW_TEXT, null);

    const textNode = walker.nextNode() as Text;
    if (textNode) {
      const range = this.selectionService.createRange();
      range.setStart(textNode, 1); // After the zero-width space
      range.collapse(true);
      this.selectionService.setSelectionRange(range);
    }
  }

  private removeFormattingFromRange(range: Range, tagName: RichTextFormat): void {
    // Find the closest ancestor formatting element for both start and end
    const startFormat = editorUtilities.findClosestAncestor<Element>(
      this.root,
      range.startContainer,
      tagName === 'u' ? 'span.underline' : tagName,
    );
    const endFormat = editorUtilities.findClosestAncestor<Element>(
      this.root,
      range.endContainer,
      tagName === 'u' ? 'span.underline' : tagName,
    );

    // If both start and end are in the same formatting element, split it at both boundaries
    if (startFormat && startFormat === endFormat) {
      // Split at end first (so indices don't shift)
      const endRange = this.selectionService.createRange();
      endRange.setStart(range.endContainer, range.endOffset);
      endRange.setEndAfter(startFormat);
      const afterFragment = endRange.extractContents();

      // Split at start
      const startRange = this.selectionService.createRange();
      startRange.setStartBefore(startFormat);
      startRange.setEnd(range.startContainer, range.startOffset);
      const beforeFragment = startRange.extractContents();

      // The selected content is now the only child of startFormat
      const selectedFragment = this.selectionService.createDocumentFragment();
      while (startFormat.firstChild) {
        selectedFragment.appendChild(startFormat.firstChild);
      }

      // Remove the formatting from the selected fragment
      this.removeFormatFromFragment(selectedFragment, tagName);

      // Insert back: beforeFragment, unformatted selectedFragment, afterFragment
      const parent = startFormat.parentNode;
      if (parent) {
        parent.insertBefore(beforeFragment, startFormat);
        parent.insertBefore(selectedFragment, startFormat);
        parent.insertBefore(afterFragment, startFormat);
        parent.removeChild(startFormat);
      }
    } else {
      // Fallback: just remove formatting from the extracted content
      const extractedContent = range.extractContents();
      this.removeFormatFromFragment(extractedContent, tagName);
      range.insertNode(extractedContent);
    }
  }

  private removeFormatFromFragment(fragment: DocumentFragment, tagName: RichTextFormat): void {
    // Find all instances of the target format and unwrap them
    const selector = tagName === 'u' ? 'span.underline' : tagName;

    // Keep processing until no more elements are found
    let elementsFound = true;
    while (elementsFound) {
      const elements = fragment.querySelectorAll(selector);
      elementsFound = elements.length > 0;

      elements.forEach((element) => {
        if (FormattingService.isMatchingElement(element, tagName)) {
          // Move children up to replace the formatted element
          const parent = element.parentNode;
          if (parent) {
            while (element.firstChild) {
              parent.insertBefore(element.firstChild, element);
            }
            parent.removeChild(element);
          }
        }
      });
    }
  }

  private normalizeInlineFormatting(): void {
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
