export const ZERO_WIDTH_SPACE = '​';
export const ZERO_WIDTH_SPACE_REGEX = new RegExp(ZERO_WIDTH_SPACE, 'g');
export type RichTextFormat = 'strong' | 'em' | 'u';

export const EDITOR_CONTENT_SELECTOR = '.editor-content';

export class Editor {
  private root: HTMLElement;
  private window: Window;
  private document: Document;

  constructor(root: HTMLElement) {
    this.root = root;
    this.window = this.root.ownerDocument.defaultView!;
    this.document = this.root.ownerDocument;
  }

  // --- STATIC ---
  public static cleanZeroWidthSpaces(html: string): string {
    return html.replace(ZERO_WIDTH_SPACE_REGEX, '');
  }

  // --- PUBLIC API ---

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

    const contents = range.cloneContents();
    const { startContainer, endContainer, startOffset, endOffset } = range;

    if (
      startContainer.parentNode &&
      (startContainer === endContainer || startContainer.parentNode === endContainer.parentNode)
    ) {
      const parent = startContainer.parentNode as HTMLElement;

      if (
        parent.nodeType === Node.ELEMENT_NODE &&
        Editor.isMatchingElement(parent, tagName) &&
        parent.textContent === contents.textContent &&
        startOffset === 0 &&
        endOffset ===
          (endContainer.nodeType === Node.TEXT_NODE
            ? endContainer.textContent?.length || 0
            : endContainer.childNodes.length)
      ) {
        const grandParent = parent.parentNode;
        if (!grandParent) {
          return;
        }

        while (parent.firstChild) {
          grandParent.insertBefore(parent.firstChild, parent);
        }

        grandParent.removeChild(parent);
        this.normalizeInlineFormatting();
        return;
      }
    }

    const containsTargetTag = contents.querySelector(tagName) !== null;

    if (containsTargetTag) {
      const nodesToWrap: Node[] = [];
      const processNode = (node: Node) => {
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          Editor.isMatchingElement(node as Element, tagName)
        ) {
          Array.from(node.childNodes).forEach(processNode);
        } else {
          nodesToWrap.push(node);
        }
      };

      Array.from(contents.childNodes).forEach(processNode);

      const wrapper = Editor.createRichTextElement(tagName);
      nodesToWrap.forEach((node) => wrapper.appendChild(node));
      range.deleteContents();
      range.insertNode(wrapper);
    } else {
      const wrapper = Editor.createRichTextElement(tagName);
      wrapper.appendChild(contents);
      range.deleteContents();
      range.insertNode(wrapper);
    }

    this.normalizeInlineFormatting();
    selection.removeAllRanges();
  }

  // --- PRIVATE HELPERS ---

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
      const firstChild = listItem.firstChild;
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

    const normalizeElement = (node: Element) => {
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

  // --- STATIC HELPERS ---

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
