import editorUtilities from './utilities';
import { SelectionService } from './SelectionService.humble';
import { ZERO_WIDTH_SPACE } from './editor.constants';

export class ListService {
  private root: HTMLElement;
  private selectionService: SelectionService;

  constructor(root: HTMLElement, selectionService: SelectionService) {
    this.root = root;
    this.selectionService = selectionService;
  }

  public toggleList(type: 'ul' | 'ol'): void {
    if (!editorUtilities.isEditorInRange(this.root, this.selectionService)) {
      return;
    }

    const range = this.selectionService.getRangeAtStartOfSelection();
    if (!range) {
      return;
    }

    const li = editorUtilities.findClosestAncestor<HTMLLIElement>(
      this.root,
      range.startContainer,
      'li',
    );
    const list = editorUtilities.findClosestAncestor<HTMLOListElement | HTMLUListElement>(
      this.root,
      range.startContainer,
      'ol,ul',
    );

    if (li && list) {
      // Check if we're toggling between different list types
      const currentListType = list.tagName.toLowerCase() as 'ul' | 'ol';
      if (currentListType !== type) {
        // Convert the list to the new type
        this.convertListType(list, type);
      } else {
        // Same list type, so unwrap the list item
        this.unwrapListItem(li, list, range);
      }
    } else {
      this.insertList(type, range);
    }
  }

  public handleDentures(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    if (e.key === 'Tab') {
      const range = this.selectionService.getRangeAtStartOfSelection();
      if (!range) {
        return false;
      }

      const listItem = editorUtilities.findClosestAncestor<HTMLLIElement>(
        this.root,
        range.startContainer,
        'li',
      );

      if (!listItem) {
        return false;
      }

      e.preventDefault();
      if (e.shiftKey) {
        this.outdentListItem(range);
      } else {
        this.indentListItem(range);
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
    const listItem = editorUtilities.findClosestAncestor<HTMLLIElement>(
      this.root,
      range.startContainer,
      'li',
    );

    if (listItem) {
      const isEmpty = listItem.textContent?.trim() === '';
      if (isEmpty) {
        e.preventDefault();

        const p = this.selectionService.createElement('p');
        editorUtilities.stripFormatting(p);
        p.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));

        const list = editorUtilities.findClosestAncestor<HTMLOListElement | HTMLUListElement>(
          this.root,
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

    const currentParagraph = editorUtilities.findClosestAncestor<HTMLParagraphElement>(
      this.root,
      range.startContainer,
      'p',
    );

    const newParagraph = this.selectionService.createElement('p');
    editorUtilities.stripFormatting(newParagraph);
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

  public handleDeleteKeyOnList(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    if (e.key !== 'Backspace' && e.key !== 'Delete') {
      return false;
    }

    const range = this.selectionService.getRangeAtStartOfSelection();

    if (!range || !range.collapsed || range.startOffset !== 0) {
      return false;
    }

    const parentList = editorUtilities.findClosestAncestor<HTMLUListElement | HTMLOListElement>(
      this.root,
      range.startContainer,
      'ul, ol',
    );
    if (!parentList) {
      return false;
    }

    const currentListItem = editorUtilities.findClosestAncestor<HTMLLIElement>(
      this.root,
      range.startContainer,
      'li',
    );
    if (!currentListItem) {
      return false;
    }

    const isLastItem = parentList?.children[parentList.children.length - 1] === currentListItem;
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
    // Check if the list item is empty or contains only a BR element
    if (
      !listItemContents.length ||
      (listItemContents.length === 1 &&
        listItemContents[0].nodeType === Node.ELEMENT_NODE &&
        (listItemContents[0] as Element).tagName === 'BR')
    ) {
      currentListItem.remove();
      if (parentList.childNodes.length === 0) {
        parentList.remove();
        const p = this.selectionService.createElement('p');
        p.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));
        this.root.appendChild(p);
        editorUtilities.positionCursorInEmptyParagraph(this.selectionService, p);
      }
      return true;
    }

    const p = this.selectionService.createElement('p');
    editorUtilities.stripFormatting(p);
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

  private outdentListItem(range: Range): void {
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

    if (
      !parentList ||
      !grandparentLi ||
      !['UL', 'LI'].includes(parentList.tagName) ||
      grandparentLi.tagName !== 'LI'
    ) {
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

  public unwrapListItem(
    li: HTMLLIElement,
    list: HTMLOListElement | HTMLUListElement,
    range: Range,
  ): void {
    const offset = range.startOffset;

    // Create paragraph from list item content
    const p = this.selectionService.createElement('p');
    editorUtilities.stripFormatting(p);

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
    let parentLi = editorUtilities.findClosestAncestor<HTMLLIElement>(
      this.root,
      list.parentNode,
      'li',
    );
    while (parentLi) {
      const nextRootList = editorUtilities.findClosestAncestor<HTMLOListElement | HTMLUListElement>(
        this.root,
        parentLi.parentNode,
        'ol,ul',
      );
      if (nextRootList && this.root.contains(nextRootList)) {
        rootList = nextRootList;
        parentLi = editorUtilities.findClosestAncestor<HTMLLIElement>(
          this.root,
          nextRootList.parentNode,
          'li',
        );
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

  public createListWithEmptyItem(type: 'ul' | 'ol'): HTMLElement {
    const list = this.selectionService.createElement(type);
    const li = this.selectionService.createElement('li');
    li.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));
    list.appendChild(li);
    return list;
  }

  private indentListItem(range: Range): void {
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

  private insertList(type: 'ul' | 'ol', range: Range): void {
    if (!editorUtilities.isEditorInRange(this.root, this.selectionService)) {
      return;
    }

    const currentParagraph = editorUtilities.findClosestAncestor<HTMLParagraphElement>(
      this.root,
      range.startContainer,
      'p',
    );

    // If we're in a paragraph with content, convert the paragraph to a list item
    if (currentParagraph && currentParagraph.parentNode === this.root) {
      this.convertParagraphToList(currentParagraph, type, range);
    }
  }

  private convertParagraphToList(
    paragraph: HTMLParagraphElement,
    listType: 'ul' | 'ol',
    currentRange: Range,
  ): void {
    // Store cursor position relative to paragraph content
    const cursorOffset = editorUtilities.getCursorOffsetInParagraph(
      this.selectionService,
      paragraph,
      currentRange,
    );

    const list = this.createListWithEmptyItem(listType);
    if (paragraph.firstChild && (paragraph.textContent?.trim() || paragraph.querySelector('*'))) {
      while (paragraph.firstChild) {
        list.firstChild?.appendChild(paragraph.firstChild);
      }
    }
    paragraph.replaceWith(list);

    // Restore cursor position in the new list item
    if (list.children.length) {
      this.setCursorInListItem(list.children[0] as HTMLLIElement, cursorOffset);
    }
  }

  private setCursorInListItem(listItem: HTMLLIElement, targetOffset: number): void {
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

  private convertListType(list: HTMLOListElement | HTMLUListElement, newType: 'ul' | 'ol'): void {
    // Create a new list of the desired type
    const newList = this.selectionService.createElement(newType);

    // Move all list items from the old list to the new list
    while (list.firstChild) {
      newList.appendChild(list.firstChild);
    }

    // Replace the old list with the new list
    if (list.parentNode) {
      list.parentNode.replaceChild(newList, list);
    }
  }

  private getAncestorIfLastLeaf(
    parentList: HTMLUListElement | HTMLOListElement,
  ): HTMLOListElement | HTMLUListElement | false {
    const grandParentListItem = editorUtilities.findClosestAncestor<HTMLLIElement>(
      this.root,
      parentList,
      'li',
    );
    if (!grandParentListItem) {
      return parentList;
    }

    const grandParentList = editorUtilities.findClosestAncestor<
      HTMLUListElement | HTMLOListElement
    >(this.root, grandParentListItem, 'ul, ol');
    if (!grandParentList) {
      return parentList;
    }

    if (grandParentList.children[grandParentList.children.length - 1] !== grandParentListItem) {
      return false;
    }

    return this.getAncestorIfLastLeaf(grandParentList);
  }
}
