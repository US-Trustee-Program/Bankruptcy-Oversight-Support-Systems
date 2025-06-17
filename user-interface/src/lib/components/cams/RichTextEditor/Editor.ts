import {
  EMPTY_TAG_REGEX,
  RichTextFormat,
  ZERO_WIDTH_SPACE,
  ZERO_WIDTH_SPACE_REGEX,
} from '@/lib/components/cams/RichTextEditor/editor.constants';
import { SelectionService } from './SelectionService.humble';

const INLINE_TAGS = ['strong', 'em'];
const CLASS_BASED_SPANS = ['underline'];

export class Editor {
  private root: HTMLElement;
  private selectionService: SelectionService;

  constructor(root: HTMLElement, selectionService: SelectionService) {
    this.root = root;
    this.selectionService = selectionService;

    // Initialize with empty paragraph if the root is empty
    this.initializeContent();
  }

  private initializeContent(): void {
    if (!this.root.hasChildNodes() || this.root.innerHTML.trim() === '') {
      const p = this.selectionService.createElement('p');
      p.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));
      this.root.appendChild(p);

      // Position cursor in the new paragraph
      this.positionCursorInEmptyParagraph(p);
    }
  }

  private positionCursorInEmptyParagraph(paragraph: HTMLParagraphElement): void {
    const selection = this.selectionService.getCurrentSelection();
    if (selection && paragraph.firstChild) {
      const range = this.selectionService.createRange();
      range.setStart(paragraph.firstChild, paragraph.firstChild.textContent?.length || 0); // After the zero-width space
      range.collapse(true);
      this.selectionService.setSelectionRange(range);
    }
  }

  public isEmptyContent(): boolean {
    const children = Array.from(this.root.children);

    if (children.length === 0) {
      return true;
    }

    for (const child of children) {
      const textContent = child.textContent || '';
      const cleanedContent = textContent.replace(ZERO_WIDTH_SPACE_REGEX, '').trim();
      if (cleanedContent !== '') {
        return false;
      }
    }

    return true;
  }

  public static cleanZeroWidthSpaces(html: string): string {
    return html.replace(ZERO_WIDTH_SPACE_REGEX, '');
  }

  public static cleanEmptyTags(html: string): string {
    return html.replace(EMPTY_TAG_REGEX, '');
  }

  public static cleanHtml = (html: string) => {
    return Editor.cleanEmptyTags(Editor.cleanZeroWidthSpaces(html));
  };

  public handleCtrlKey(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    if (e.metaKey) {
      e.preventDefault();
      return false;
    }
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
      const selection = this.selectionService.getCurrentSelection();
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
    const selection = this.selectionService.getCurrentSelection();
    if (!selection || !selection.rangeCount) {
      return false;
    }

    if (e.key !== 'Enter') {
      return false;
    }

    const range = selection.getRangeAt(0);
    const listItem = this.findClosestAncestor<HTMLLIElement>(range.startContainer, 'li');

    if (listItem) {
      const isEmpty = listItem.textContent?.trim() === '';
      if (isEmpty) {
        e.preventDefault();

        const p = this.selectionService.createElement('p');
        Editor.stripFormatting(p);
        p.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));

        const list = this.findClosestAncestor<HTMLOListElement | HTMLUListElement>(
          listItem,
          'ol,ul',
        );
        list?.parentNode?.insertBefore(p, list.nextSibling);

        listItem.remove();

        const newRange = this.selectionService.createRange();
        newRange.setStart(p.firstChild!, 1);
        newRange.collapse(true);
        this.selectionService.setSelectionRange(newRange);

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

    const newParagraph = this.selectionService.createElement('p');
    Editor.stripFormatting(newParagraph);
    newParagraph.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));

    if (currentParagraph?.parentNode) {
      currentParagraph.parentNode.insertBefore(newParagraph, currentParagraph.nextSibling);
    } else {
      range.collapse(false);
      range.insertNode(newParagraph);
    }

    const newRange = this.selectionService.createRange();
    newRange.setStart(newParagraph.firstChild!, 1);
    newRange.collapse(true);
    this.selectionService.setSelectionRange(newRange);
    return true;
  }

  public handleBackspaceOnEmptyContent(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    if (e.key !== 'Backspace') {
      return false;
    }

    const selection = this.selectionService.getCurrentSelection();
    if (!selection || !selection.rangeCount) {
      return false;
    }

    const range = selection.getRangeAt(0);

    // Check if we're in a paragraph
    const currentParagraph = this.findClosestAncestor<HTMLParagraphElement>(
      range.startContainer,
      'p',
    );

    if (!currentParagraph) {
      return false;
    }

    // Check if this is the only paragraph and if it contains only zero-width space or br
    const allParagraphs = this.root.querySelectorAll('p');
    const allLists = this.root.querySelectorAll('ul, ol');

    // If this is the only block element (paragraph) and it's empty or nearly empty, prevent deletion
    if (allParagraphs.length === 1 && allLists.length === 0) {
          const paragraphText = currentParagraph.textContent
            ?.replace(ZERO_WIDTH_SPACE_REGEX, '')
            .trim();
          const isEmpty = !paragraphText || paragraphText === '';

          const hasOnlyZeroWidthSpace = currentParagraph.textContent === ZERO_WIDTH_SPACE;

          if (hasOnlyZeroWidthSpace || isEmpty) {
            e.preventDefault();
            this.positionCursorInEmptyParagraph(currentParagraph);
            return true;
          }
        }
    else if (currentParagraph.textContent === ZERO_WIDTH_SPACE) {
            e.preventDefault();
            const previousSibling = currentParagraph.previousSibling!;
            if (previousSibling) {
              range.setStart(previousSibling.firstChild!, previousSibling.textContent?.length ?? 0);
              currentParagraph.remove();
              return true;
            }
          }


    return false;
  }

  public handleDeleteKeyOnList(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    if (e.key !== 'Backspace' && e.key !== 'Delete') {
      return false;
    }

    const selection = this.selectionService.getCurrentSelection();
    if (!selection || !selection.rangeCount) {
      return false;
    }

    const range = selection.getRangeAt(0);

    if (!range.collapsed || range.startOffset !== 0) {
      return false;
    }

    const parentList = this.findClosestAncestor<HTMLUListElement | HTMLOListElement>(
      range.startContainer,
      'ul, ol',
    );
    if (!parentList) {
      return false;
    }

    const currentListItem = this.findClosestAncestor<HTMLLIElement>(range.startContainer, 'li');
    if (!currentListItem) {
      return false;
    }

    const isLastItem = parentList?.childNodes[parentList.childNodes.length - 1] === currentListItem;
    if (!isLastItem) {
      return false;
    }

    if (currentListItem.querySelector('ul, ol, li')) {
      return false;
    }

    const grandMammi = this.getAncestorIfLastLeaf(parentList);
    if (!grandMammi) {
      return false;
    }

    e.preventDefault();

    const listItemContents = currentListItem.childNodes;
    if (!listItemContents || (listItemContents[0] as Element).tagName === 'BR') {
      currentListItem.remove();
      if (parentList.childNodes.length === 0) {
        parentList.remove();
        const p = this.selectionService.createElement('p');
        p.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));
        this.root.appendChild(p);
        this.positionCursorInEmptyParagraph(p);
      }
      return true;
    }

    const p = this.selectionService.createElement('p');
    Editor.stripFormatting(p);
    while (currentListItem.firstChild) {
      p.appendChild(currentListItem.firstChild);
    }
    grandMammi?.parentNode?.insertBefore(p, grandMammi.nextSibling);

    currentListItem.remove();
    if (parentList.childNodes.length === 0) {
      parentList.remove();
    }

    const newRange = this.selectionService.createRange();
    newRange.setStart(p.firstChild!, 1);
    newRange.collapse(true);
    this.selectionService.setSelectionRange(newRange);

    if (parentList && [...parentList.children].every((child) => child.textContent?.trim() === '')) {
      parentList.remove();
    }

    return true;
  }

  public handlePrintableKey(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    const isPrintableKey = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!isPrintableKey) {
      return false;
    }

    const selection = this.selectionService.getCurrentSelection();
    if (!selection || !selection.rangeCount) {
      return false;
    }

    const range = selection.getRangeAt(0);

    // Check if we're typing in an empty paragraph (our initialized state)
    const currentParagraph = this.findClosestAncestor<HTMLParagraphElement>(
      range.startContainer,
      'p',
    );

    if (currentParagraph && this.isEmptyContent()) {
      // We're typing in the empty paragraph - let the browser handle it naturally
      // The zero-width space will be replaced by the typed character
      return false;
    }

    if (this.root.contains(range.startContainer)) {
      const container =
        range.startContainer instanceof Element
          ? range.startContainer
          : range.startContainer.parentElement;

      const isInRootWithoutBlock =
        container &&
        this.root.contains(container) &&
        !this.findClosestAncestor(container, 'p,li,ul,ol');

      if (isInRootWithoutBlock) {
        e.preventDefault();

        const p = this.selectionService.createElement('p');
        Editor.stripFormatting(p);
        const char = e.key.length === 1 ? e.key : '';
        p.textContent = char || ZERO_WIDTH_SPACE;

        range.insertNode(p);

        const newRange = this.selectionService.createRange();
        const textNode = p.firstChild;
        const offset = textNode instanceof Text ? textNode.length : 1;

        newRange.setStart(textNode!, offset);
        newRange.collapse(true);
        this.selectionService.setSelectionRange(newRange);

        return true;
      }
    }
    return false;
  }

  public toggleList(type: 'ul' | 'ol'): void {
    if (!this.isEditorInRange()) {
      return;
    }

    const selection = this.selectionService.getCurrentSelection();
    if (!selection?.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    const li = this.findClosestAncestor<HTMLLIElement>(range.startContainer, 'li');
    const list = this.findClosestAncestor<HTMLOListElement | HTMLUListElement>(
      range.startContainer,
      'ol,ul',
    );

    if (li && list) {
      this.unwrapListItem(li, list, selection);
    } else {
      this.insertList(type);
    }
  }

  public toggleSelection(tagName: RichTextFormat): void {
    const selection = this.selectionService.getCurrentSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (this.isRangeAcrossBlocks(range)) {
      // TODO: We should probably tell the user they can't change formatting across paragraphs or lists
      return;
    }

    if (range.collapsed) {
      // Check if we're already inside a formatting element of the target type
      const existingFormatElement = this.findClosestAncestor<Element>(
        range.startContainer,
        tagName === 'u' ? 'span.underline' : tagName,
      );

      if (existingFormatElement && Editor.isMatchingElement(existingFormatElement, tagName)) {
        // We're inside a formatting element - toggle it off by moving cursor outside
        this.exitFormattingElement(existingFormatElement, range);
      } else {
        // We're not in a formatting element - toggle it on by creating one
        const el = this.createRichTextElement(tagName);
        el.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));
        range.insertNode(el);

        // Position cursor inside the new formatting element
        const newRange = this.selectionService.createRange();
        newRange.setStart(el.firstChild!, 1); // After the zero-width space
        newRange.collapse(true);
        this.selectionService.setSelectionRange(newRange);
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
      wrapper.appendChild(contents);
      range.insertNode(wrapper);
    }

    this.normalizeInlineFormatting();
    this.selectionService.getCurrentSelection()?.removeAllRanges();
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

  private isRangeAcrossBlocks(range: Range): boolean {
    const blockTags = ['P', 'LI', 'DIV'];
    const getBlockAncestor = (node: Node): HTMLElement | null => {
      let current: Node | null = node;
      while (current && current !== this.root) {
        if (
          current.nodeType === Node.ELEMENT_NODE &&
          blockTags.includes((current as Element).tagName)
        ) {
          return current as HTMLElement;
        }
        current = current.parentNode;
      }
      return null;
    };
    const startBlock = getBlockAncestor(range.startContainer);
    const endBlock = getBlockAncestor(range.endContainer);
    return !!startBlock && !!endBlock && startBlock !== endBlock;
  }

  private getAncestorIfLastLeaf(
    parentList: HTMLUListElement | HTMLOListElement,
  ): HTMLOListElement | HTMLUListElement | false {
    const grandParentListItem = this.findClosestAncestor<HTMLLIElement>(parentList, 'li');
    if (!grandParentListItem) {
      return parentList;
    }

    const grandParentList = this.findClosestAncestor<HTMLUListElement | HTMLOListElement>(
      grandParentListItem,
      'ul, ol',
    );
    if (!grandParentList) {
      return parentList;
    }

    if (
      grandParentList &&
      grandParentList.childNodes[grandParentList.childNodes.length - 1] !== grandParentListItem
    ) {
      return false;
    }

    return this.getAncestorIfLastLeaf(grandParentList);
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
    // Find the closest ancestor formatting element for both start and end
    const startFormat = this.findClosestAncestor<Element>(
      range.startContainer,
      tagName === 'u' ? 'span.underline' : tagName,
    );
    const endFormat = this.findClosestAncestor<Element>(
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
    const selection = this.selectionService.getCurrentSelection();
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
      nestedList = this.selectionService.createElement(
        parentList.tagName.toLowerCase() as keyof HTMLElementTagNameMap,
      );
      prevLi.appendChild(nestedList);
    }

    const offsetNode = range.startContainer;
    const offset = range.startOffset;

    nestedList.appendChild(li);

    const newRange = this.selectionService.createRange();
    newRange.setStart(offsetNode, Math.min(offset, offsetNode.textContent?.length ?? offset));
    newRange.collapse(true);

    this.selectionService.setSelectionRange(newRange);
  }

  private insertList(type: 'ul' | 'ol'): void {
    if (!this.isEditorInRange()) {
      return;
    }

    const selection = this.selectionService.getCurrentSelection();
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

    // If we're in a paragraph with content, convert the paragraph to a list item
    if (currentParagraph && currentParagraph.parentNode === this.root) {
      const paragraphHasContent =
        currentParagraph.textContent?.trim() || currentParagraph.querySelector('*');

      if (paragraphHasContent) {
        // Convert paragraph to list
        this.convertParagraphToList(currentParagraph, type, range);
        return;
      }
    }

    // Default behavior: create a new empty list
    const list = this.createListWithEmptyItem(type);
    const listItem = list.querySelector('li');

    if (currentParagraph && currentParagraph.parentNode === this.root) {
      // Replace empty paragraph with list
      currentParagraph.replaceWith(list);
    } else {
      // Insert list at cursor position
      range.deleteContents();
      range.insertNode(list);
    }

    // Position cursor in the new list item
    if (listItem?.firstChild) {
      const newRange = this.selectionService.createRange();
      const { firstChild } = listItem;
      newRange.setStart(firstChild, firstChild.nodeType === Node.TEXT_NODE ? 1 : 0);
      newRange.collapse(true);
      this.selectionService.setSelectionRange(newRange);
    }
  }

  private convertParagraphToList(
    paragraph: HTMLParagraphElement,
    listType: 'ul' | 'ol',
    currentRange: Range,
  ): void {
    const selection = this.selectionService.getCurrentSelection();
    if (!selection) {
      return;
    }

    // Store cursor position relative to paragraph content
    const cursorOffset = this.getCursorOffsetInParagraph(paragraph, currentRange);

    // Create new list with the paragraph content
    const list = this.selectionService.createElement(listType);
    const listItem = this.selectionService.createElement('li');

    // Move all paragraph content to the list item
    while (paragraph.firstChild) {
      listItem.appendChild(paragraph.firstChild);
    }

    // Ensure list item has some content
    if (!listItem.textContent?.trim() && !listItem.querySelector('*')) {
      listItem.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));
    }

    list.appendChild(listItem);
    paragraph.replaceWith(list);

    // Restore cursor position in the new list item
    this.setCursorInListItem(listItem, cursorOffset);
  }

  private getCursorOffsetInParagraph(paragraph: HTMLParagraphElement, range: Range): number {
    const walker = this.selectionService.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT, null);

    let offset = 0;
    let node: Text | null;

    while ((node = walker.nextNode() as Text)) {
      if (node === range.startContainer) {
        return offset + range.startOffset;
      }
      offset += node.textContent?.length || 0;
    }

    return offset;
  }

  private setCursorInListItem(listItem: HTMLLIElement, targetOffset: number): void {
    const selection = this.selectionService.getCurrentSelection();
    if (!selection) {
      return;
    }

    const walker = this.selectionService.createTreeWalker(listItem, NodeFilter.SHOW_TEXT, null);

    let currentOffset = 0;
    let node: Text | null;

    while ((node = walker.nextNode() as Text)) {
      const nodeLength = node.textContent?.length || 0;
      if (currentOffset + nodeLength >= targetOffset) {
        const range = this.selectionService.createRange();
        range.setStart(node, Math.min(targetOffset - currentOffset, nodeLength));
        range.collapse(true);
        this.selectionService.setSelectionRange(range);
        return;
      }
      currentOffset += nodeLength;
    }

    // Fallback: position at the end of the list item
    if (listItem.lastChild) {
      const range = this.selectionService.createRange();
      range.setStartAfter(listItem.lastChild);
      range.collapse(true);
      this.selectionService.setSelectionRange(range);
    }
  }

  private isEditorInRange(): boolean {
    const selection = this.selectionService.getCurrentSelection();
    if (!selection?.rangeCount) {
      return false;
    }
    const range = selection.getRangeAt(0);
    return this.root.contains(range.startContainer);
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

  private outdentListItem(): void {
    const selection = this.selectionService.getCurrentSelection();
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
      const newUl = this.selectionService.createElement('ul');
      liNextSiblings.forEach((sibling) => {
        newUl.appendChild(sibling);
      });
      targetLi.appendChild(newUl);
    }

    const newRange = this.selectionService.createRange();
    newRange.setStart(offsetNode, Math.min(offset, offsetNode.textContent?.length ?? offset));
    newRange.collapse(true);

    this.selectionService.setSelectionRange(newRange);
  }

  private unwrapListItem(
    li: HTMLLIElement,
    list: HTMLOListElement | HTMLUListElement,
    selection: Selection,
  ): void {
    const range = selection.getRangeAt(0);
    const offset = range.startOffset;

    // Create paragraph from list item content
    const p = this.selectionService.createElement('p');
    Editor.stripFormatting(p);

    // Extract content from the list item, separating text/inline elements from nested lists
    const textContent = this.selectionService.createDocumentFragment();
    const nestedLists: (HTMLUListElement | HTMLOListElement)[] = [];

    Array.from(li.childNodes).forEach((child) => {
      if (
        child.nodeType === Node.TEXT_NODE ||
        (child.nodeType === Node.ELEMENT_NODE && !['UL', 'OL'].includes((child as Element).tagName))
      ) {
        textContent.appendChild(child.cloneNode(true));
      } else if (
        child.nodeType === Node.ELEMENT_NODE &&
        ['UL', 'OL'].includes((child as Element).tagName)
      ) {
        nestedLists.push(child.cloneNode(true) as HTMLUListElement | HTMLOListElement);
      }
    });

    if (textContent.textContent?.trim() || textContent.querySelector('*')) {
      p.appendChild(textContent);
    } else {
      p.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));
    }

    // Find the root list (not nested within another list item) for insertion point
    let rootList = list;
    let parentLi = this.findClosestAncestor<HTMLLIElement>(list.parentNode, 'li');
    while (parentLi) {
      const nextRootList = this.findClosestAncestor<HTMLOListElement | HTMLUListElement>(
        parentLi.parentNode,
        'ol,ul',
      );
      if (nextRootList && this.root.contains(nextRootList)) {
        rootList = nextRootList;
        parentLi = this.findClosestAncestor<HTMLLIElement>(nextRootList.parentNode, 'li');
      } else {
        break;
      }
    }

    if (!this.root.contains(rootList) || rootList.parentNode !== this.root) {
      return;
    }

    // Find which root-level item contains our target item BEFORE removing it
    const allRootItems = Array.from(rootList.children);
    let splitIndex = -1;

    // Find which root-level item contains our target item
    for (let i = 0; i < allRootItems.length; i++) {
      const rootItem = allRootItems[i] as HTMLElement;
      if (rootItem.contains(li)) {
        splitIndex = i;
        break;
      }
    }

    if (splitIndex === -1) {
      // Fallback: just append after the root list
      const listParent = rootList.parentNode!;
      listParent.insertBefore(p, rootList.nextSibling);
      return;
    }

    // Store references before removing anything
    const listParent = rootList.parentNode!;
    const immediateParentList = li.parentElement!;

    // Split the root list at the found index
    // For root-level items, exclude the item being extracted
    // For nested items, include the parent item that contains the nested item
    const isRootLevelExtraction = allRootItems[splitIndex] === li;
    const beforeItems = allRootItems.slice(0, isRootLevelExtraction ? splitIndex : splitIndex + 1);
    const afterItems = allRootItems.slice(splitIndex + 1);

    // Special case: if this is the only item in the list, just replace the list with the paragraph
    if (allRootItems.length === 1 && isRootLevelExtraction) {
      listParent.replaceChild(p, rootList);

      // Insert any nested lists after the paragraph
      nestedLists.forEach((nestedList) => {
        listParent.insertBefore(nestedList, p.nextSibling);
      });

      // Restore cursor position
      const newRange = this.selectionService.createRange();
      if (p.firstChild) {
        const textNode =
          p.firstChild.nodeType === Node.TEXT_NODE
            ? (p.firstChild as Text)
            : (p.firstChild.firstChild as Text);
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          const newOffset = Math.min(offset, textNode.textContent?.length || 0);
          newRange.setStart(textNode, newOffset);
          newRange.collapse(true);
          this.selectionService.setSelectionRange(newRange);
        }
      }
      return;
    }

    // Remove the target item from its immediate parent list
    li.remove();

    // If the immediate parent list is now empty, remove it
    if (immediateParentList.children.length === 0) {
      immediateParentList.remove();
    }

    // Create before list if there are items before the split
    if (beforeItems.length > 0) {
      const beforeList = this.selectionService.createElement(
        rootList.tagName.toLowerCase() as keyof HTMLElementTagNameMap,
      );
      beforeItems.forEach((item) => beforeList.appendChild(item));
      listParent.insertBefore(beforeList, rootList);
    }

    // Insert the paragraph
    listParent.insertBefore(p, rootList);

    // Insert any nested lists after the paragraph
    nestedLists.forEach((nestedList) => {
      listParent.insertBefore(nestedList, rootList);
    });

    // Create after list if there are items after the split
    if (afterItems.length > 0) {
      const afterList = this.selectionService.createElement(
        rootList.tagName.toLowerCase() as keyof HTMLElementTagNameMap,
      );
      afterItems.forEach((item) => afterList.appendChild(item));
      listParent.insertBefore(afterList, rootList);
    }

    // Remove the original root list
    rootList.remove();

    // Restore cursor position in the new paragraph
    const newRange = this.selectionService.createRange();
    if (p.firstChild) {
      const textNode =
        p.firstChild.nodeType === Node.TEXT_NODE
          ? (p.firstChild as Text)
          : (p.firstChild.firstChild as Text);
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const newOffset = Math.min(offset, textNode.textContent?.length || 0);
        newRange.setStart(textNode, newOffset);
        newRange.collapse(true);
        this.selectionService.setSelectionRange(newRange);
      }
    }
  }

  private createListWithEmptyItem(type: 'ul' | 'ol'): HTMLElement {
    const list = this.selectionService.createElement(type);
    const li = this.selectionService.createElement('li');
    li.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));
    list.appendChild(li);
    return list;
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
