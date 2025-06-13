export const ZERO_WIDTH_SPACE = '​';
export const ZERO_WIDTH_SPACE_REGEX = new RegExp(ZERO_WIDTH_SPACE, 'g');
export type RichTextFormat = 'strong' | 'em' | 'u';

export class Editor {
  private root: HTMLElement;
  private window: Window;
  private document: Document;

  constructor(root: HTMLElement) {
    this.root = root;
    this.window = this.root.ownerDocument.defaultView!;
    this.document = this.root.ownerDocument;
  }

  public static cleanZeroWidthSpaces(html: string): string {
    return html.replace(ZERO_WIDTH_SPACE_REGEX, '');
  }

  public handleCtrlKey(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    if (e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          this.toggleSelection('strong');
          return true;
        case 'i':
          e.preventDefault();
          this.toggleSelection('em');
          return true;
        case 'u':
          e.preventDefault();
          this.toggleSelection('u');
          return true;
      }
    }
    return false;
  }

  public handleDentures(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    if (e.key === 'Tab') {
      const selection = this.window.getSelection();
      if (!selection?.rangeCount) {
        return false;
      }

      const range = selection.getRangeAt(0);
      const listItem = this.findClosestAncestor<HTMLLIElement>(range.startContainer, 'li');

      if (!listItem) {
        return false;
      }

      e.preventDefault();
      if (e.shiftKey) {
        this.outdentListItem();
      } else {
        this.indentListItem();
      }
      return true;
    }
    return false;
  }

  public handleEnterKey(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    const selection = this.window.getSelection();
    if (!selection || !selection.rangeCount) {
      return false;
    }

    if (e.key === 'Enter') {
      const range = selection.getRangeAt(0);
      const listItem = this.findClosestAncestor<HTMLLIElement>(range.startContainer, 'li');

      if (listItem) {
        const isEmpty = listItem.textContent?.trim() === '';
        if (isEmpty) {
          e.preventDefault();

          const p = this.document.createElement('p');
          Editor.stripFormatting(p);
          p.appendChild(this.document.createTextNode(ZERO_WIDTH_SPACE));

          const list = this.findClosestAncestor<HTMLOListElement | HTMLUListElement>(
            listItem,
            'ol,ul',
          );
          list?.parentNode?.insertBefore(p, list.nextSibling);

          listItem.remove();

          const newRange = this.document.createRange();
          newRange.setStart(p.firstChild!, 1);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);

          if (list && [...list.children].every((child) => child.textContent?.trim() === '')) {
            list.remove();
          }

          return true;
        }
        return false;
      }

      e.preventDefault();

      const currentParagraph = this.findClosestAncestor<HTMLParagraphElement>(
        range.startContainer,
        'p',
      );

      const newParagraph = this.document.createElement('p');
      Editor.stripFormatting(newParagraph);
      newParagraph.appendChild(this.document.createTextNode(ZERO_WIDTH_SPACE));

      if (currentParagraph?.parentNode) {
        currentParagraph.parentNode.insertBefore(newParagraph, currentParagraph.nextSibling);
      } else {
        range.collapse(false);
        range.insertNode(newParagraph);
      }

      const newRange = this.document.createRange();
      newRange.setStart(newParagraph.firstChild!, 1);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
      return true;
    }

    return false;
  }

  public handlePrintableKey(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    const isPrintableKey = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!isPrintableKey) {
      return false;
    }

    const selection = this.window.getSelection();
    if (!selection || !selection.rangeCount) {
      return false;
    }

    const range = selection.getRangeAt(0);

    if (this.root.contains(range.startContainer)) {
      const container =
        range.startContainer instanceof Element
          ? range.startContainer
          : range.startContainer.parentElement;

      const isInRootWithoutBlock =
        container &&
        this.root.contains(container) &&
        !this.findClosestAncestor(container, 'p,li,ul,ol') &&
        container.parentElement === this.root;

      if (isInRootWithoutBlock) {
        e.preventDefault();

        const p = this.document.createElement('p');
        Editor.stripFormatting(p);
        const char = e.key.length === 1 ? e.key : '';
        p.textContent = char || ZERO_WIDTH_SPACE;

        range.insertNode(p);

        const newRange = this.document.createRange();
        const textNode = p.firstChild;
        const offset = textNode instanceof Text ? textNode.length : 1;

        newRange.setStart(textNode!, offset);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        return true;
      }
    }
    return false;
  }

  public toggleList(type: 'ul' | 'ol'): void {
    if (!this.isEditorInRange()) {
      return;
    }

    const selection = this.window.getSelection();
    if (!selection?.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    const li = this.findClosestAncestor<HTMLLIElement>(range.startContainer, 'li');
    const list = this.findClosestAncestor<HTMLOListElement | HTMLUListElement>(
      range.startContainer,
      'ol,ul',
    );

    if (li && list?.tagName.toLowerCase() === type) {
      this.unwrapList();
    } else {
      this.insertList(type);
    }
  }

  public toggleSelection(tagName: RichTextFormat): void {
    const selection = this.window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);

    if (range.collapsed) {
      const el = Editor.createRichTextElement(tagName);
      el.appendChild(this.document.createTextNode(ZERO_WIDTH_SPACE));
      range.insertNode(el);
      return;
    }

    // First normalize to clean up any nested identical tags
    this.normalizeInlineFormatting();

    // Check if the entire selection is formatted with the target format
    const isFullyFormatted = this.isEntireSelectionFormatted(range, tagName);

    if (isFullyFormatted) {
      // Handle removing formatting - entire selection is formatted
      this.removeFormattingFromRange(range, tagName);
    } else {
      // Either not formatted at all, or only partially formatted
      // In both cases, we want to add/expand formatting to cover the entire selection
      const contents = range.extractContents();
      const wrapper = Editor.createRichTextElement(tagName);
      wrapper.appendChild(contents);
      range.insertNode(wrapper);
    }

    this.normalizeInlineFormatting();
    selection.removeAllRanges();
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
        Editor.isMatchingElement(current as Element, tagName)
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

  private removeFormattingFromRange(range: Range, tagName: RichTextFormat): void {
    // This handles the complex case of removing formatting from a partial selection
    // The browser automatically splits text nodes when we extract, which is what we want

    // First, we need to preserve any ancestor formatting that should remain
    const ancestorFormats: Element[] = [];
    let current: Node | null = range.startContainer;

    // Walk up to find formatting elements that aren't the target format
    while (current && current !== this.root) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const element = current as Element;
        if (
          !Editor.isMatchingElement(element, tagName) &&
          (element.tagName === 'STRONG' ||
            element.tagName === 'EM' ||
            (element.tagName === 'SPAN' && element.classList.contains('underline')))
        ) {
          ancestorFormats.unshift(element.cloneNode(false) as Element);
        }
      }
      current = current.parentNode;
    }

    // Extract the content (this automatically splits text nodes)
    const extractedContent = range.extractContents();

    // Remove the target formatting from extracted content
    this.removeFormatFromFragment(extractedContent, tagName);

    // Wrap the extracted content in the preserved ancestor formatting
    let wrappedContent: Node = extractedContent;
    ancestorFormats.forEach((ancestorElement) => {
      const wrapper = ancestorElement.cloneNode(false) as Element;
      wrapper.appendChild(wrappedContent);
      wrappedContent = wrapper;
    });

    // Fix the insertion point - after extraction, we need to determine the correct position
    // Check if the extracted content was from the beginning of the formatted element
    let insertionPoint: Node | null = range.startContainer;

    // If we're inside a text node, check its parent
    if (insertionPoint.nodeType === Node.TEXT_NODE) {
      insertionPoint = insertionPoint.parentNode;
    }

    // Walk up to find the target formatted element
    while (insertionPoint && insertionPoint !== this.root) {
      if (
        insertionPoint.nodeType === Node.ELEMENT_NODE &&
        Editor.isMatchingElement(insertionPoint as Element, tagName)
      ) {
        // Check if the range is at the beginning of the formatted element
        // If so, position before the element; otherwise, after it
        const isAtBeginning =
          range.startOffset === 0 && range.startContainer === insertionPoint.firstChild;

        if (isAtBeginning) {
          range.setStartBefore(insertionPoint);
        } else {
          range.setStartAfter(insertionPoint);
        }
        range.collapse(true);
        break;
      }
      insertionPoint = insertionPoint.parentNode;
    }

    // Insert the properly formatted content back
    range.insertNode(wrappedContent);
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
        if (Editor.isMatchingElement(element, tagName)) {
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

  private findClosestAncestor<T extends Element = Element>(
    node: Node | null,
    selector: string,
  ): T | null {
    let current: Node | null = node;
    while (current) {
      if (current === this.root.parentNode) {
        return null;
      }
      if (current instanceof Element) {
        if (current.matches(selector)) {
          return current as T;
        }
        if (current === this.root) {
          return null;
        }
      }
      current = current.parentNode;
    }
    return null;
  }

  private indentListItem(): void {
    const selection = this.window.getSelection();
    if (!selection?.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    const li = node instanceof Element ? node.closest?.('li') : node.parentElement?.closest('li');
    if (!li) {
      return;
    }

    const parentList = li.parentElement;
    if (!parentList) {
      return;
    }

    const prevLi = li.previousElementSibling;
    if (!prevLi || prevLi.tagName !== 'LI') {
      return;
    }

    let nestedList = prevLi.querySelector('ul, ol');
    if (!nestedList) {
      nestedList = this.document.createElement(parentList.tagName.toLowerCase());
      prevLi.appendChild(nestedList);
    }

    const offsetNode = range.startContainer;
    const offset = range.startOffset;

    nestedList.appendChild(li);

    const newRange = this.document.createRange();
    newRange.setStart(offsetNode, Math.min(offset, offsetNode.textContent?.length ?? offset));
    newRange.collapse(true);

    selection.removeAllRanges();
    selection.addRange(newRange);
  }

  private insertList(type: 'ul' | 'ol'): void {
    if (!this.isEditorInRange()) {
      return;
    }

    const selection = this.window.getSelection();
    if (!selection || !selection.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!this.root.contains(range.startContainer)) {
      return;
    }

    const currentParagraph = this.findClosestAncestor<HTMLParagraphElement>(
      range.startContainer,
      'p',
    );
    const isParagraphEmpty =
      currentParagraph &&
      Editor.cleanZeroWidthSpaces(currentParagraph.textContent || '') === '' &&
      currentParagraph.parentNode === this.root;

    const list = Editor.createListWithEmptyItem(type);
    const listItem = list.querySelector('li');

    const parent = currentParagraph?.parentNode || this.root;
    let extractedContent: DocumentFragment | null = null;

    if (!range.collapsed) {
      extractedContent = range.extractContents();
    } else if (currentParagraph) {
      const afterRange = this.document.createRange();
      afterRange.setStart(range.endContainer, range.endOffset);
      afterRange.setEndAfter(currentParagraph.lastChild!);
      if (!afterRange.collapsed) {
        extractedContent = afterRange.extractContents();
      }
    }

    if (listItem && extractedContent && extractedContent.hasChildNodes()) {
      listItem.innerHTML = '';
      listItem.appendChild(extractedContent);
    }

    if (currentParagraph && parent) {
      if (isParagraphEmpty) {
        currentParagraph.replaceWith(list);
      } else {
        parent.insertBefore(list, currentParagraph.nextSibling);
      }

      if (!currentParagraph.textContent?.trim()) {
        currentParagraph.remove();
      }
    } else {
      range.deleteContents();
      range.insertNode(list);
    }

    if (listItem?.firstChild) {
      const newRange = this.document.createRange();
      const { firstChild } = listItem;
      newRange.setStart(firstChild, firstChild.nodeType === Node.TEXT_NODE ? 1 : 0);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }

  private isEditorInRange(): boolean {
    const selection = this.window.getSelection();
    if (!selection?.rangeCount) {
      return false;
    }
    const range = selection.getRangeAt(0);
    return this.root.contains(range.startContainer);
  }

  private normalizeInlineFormatting(): void {
    const walker = this.document.createTreeWalker(this.root, NodeFilter.SHOW_ELEMENT);
    const inlineTags = ['strong', 'em'];
    const classBasedSpans = ['underline'];

    const shouldMerge = (a: Element, b: Element): boolean => {
      if (a.tagName === b.tagName && inlineTags.includes(a.tagName.toLowerCase())) {
        return true;
      }
      if (
        a.tagName === 'SPAN' &&
        b.tagName === 'SPAN' &&
        classBasedSpans.some((cls) => a.classList.contains(cls) && b.classList.contains(cls))
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

      // Remove empty formatting elements
      Array.from(node.childNodes).forEach((child) => {
        if (
          child.nodeType === Node.ELEMENT_NODE &&
          (inlineTags.includes((child as Element).tagName.toLowerCase()) ||
            ((child as Element).tagName === 'SPAN' &&
              classBasedSpans.some((cls) => (child as Element).classList.contains(cls)))) &&
          !child.textContent?.trim()
        ) {
          node.removeChild(child);
        }
      });

      node.normalize();
    };

    let current: Node | null = walker.currentNode;
    while (current) {
      normalizeElement(current as Element);
      current = walker.nextNode();
    }
  }

  private outdentListItem(): void {
    const selection = this.window.getSelection();
    if (!selection?.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    const targetLi =
      node instanceof Element ? node.closest?.('li') : node.parentElement?.closest('li');
    if (!targetLi) {
      return;
    }

    const allChildrenOfLiParent = Array.from(targetLi.parentElement?.children || []);
    const liNextSiblings = allChildrenOfLiParent.slice(allChildrenOfLiParent.indexOf(targetLi) + 1);

    const parentList = targetLi.parentElement;
    const grandparentLi = parentList?.parentElement;

    if (!parentList || !grandparentLi) {
      return;
    }
    if (!this.root.contains(grandparentLi) || this.root === grandparentLi) {
      return;
    }

    const offsetNode = range.startContainer;
    const offset = range.startOffset;

    grandparentLi.parentElement?.insertBefore(targetLi, grandparentLi.nextSibling);

    if (parentList.children.length === 0) {
      parentList.remove();
    }

    if (liNextSiblings.length > 0) {
      const newUl = this.document.createElement('ul');
      liNextSiblings.forEach((sibling) => {
        newUl.appendChild(sibling);
      });
      targetLi.appendChild(newUl);
    }

    const newRange = this.document.createRange();
    newRange.setStart(offsetNode, Math.min(offset, offsetNode.textContent?.length ?? offset));
    newRange.collapse(true);

    selection.removeAllRanges();
    selection.addRange(newRange);
  }

  private unwrapList(): void {
    const selection = this.window.getSelection();
    if (!selection || !selection.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    const list = this.findClosestAncestor<HTMLUListElement | HTMLOListElement>(
      range.startContainer,
      'ul,ol',
    );
    if (!list) {
      return;
    }

    if (!this.root.contains(list)) {
      return;
    }

    const parent = list.parentNode!;
    const paragraphFragments: HTMLParagraphElement[] = [];

    list.querySelectorAll('li').forEach((li) => {
      const p = this.document.createElement('p');
      Editor.stripFormatting(p);
      const span = this.document.createElement('span');

      span.innerHTML = li.innerHTML || ZERO_WIDTH_SPACE;
      p.appendChild(span);
      paragraphFragments.push(p);
    });

    paragraphFragments.forEach((p) => parent.insertBefore(p, list));
    list.remove();

    const firstSpan = paragraphFragments[0].querySelector('span');
    if (firstSpan?.firstChild?.nodeType === Node.TEXT_NODE) {
      const textNode = firstSpan.firstChild as Text;
      const newRange = this.document.createRange();
      newRange.setStart(textNode, textNode.length);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }

  private static createListWithEmptyItem(type: 'ul' | 'ol'): HTMLElement {
    const list = document.createElement(type);
    const li = document.createElement('li');
    li.appendChild(document.createTextNode(ZERO_WIDTH_SPACE));
    list.appendChild(li);
    return list;
  }

  private static createRichTextElement(format: RichTextFormat): HTMLElement {
    switch (format) {
      case 'strong':
        return document.createElement('strong');
      case 'em':
        return document.createElement('em');
      case 'u': {
        const span = document.createElement('span');
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

  private static stripFormatting(node: Node): void {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    const inlineTags = ['strong', 'b', 'em', 'i', 'u', 'span', 'font'];

    inlineTags.forEach((tag) => {
      node.querySelectorAll(tag).forEach((el) => {
        while (el.firstChild) {
          el.parentNode?.insertBefore(el.firstChild, el);
        }
        el.remove();
      });
    });
  }
}
