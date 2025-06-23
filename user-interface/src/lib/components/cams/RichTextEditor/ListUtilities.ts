import editorUtilities from './Editor.utilities';
import { SelectionService } from './SelectionService.humble';
import { ZERO_WIDTH_SPACE } from './Editor.constants';

export class ListUtilities {
  private root: HTMLElement;
  private selectionService: SelectionService;

  constructor(root: HTMLElement, selectionService: SelectionService) {
    this.root = root;
    this.selectionService = selectionService;
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

  public setCursorInListItem(listItem: HTMLLIElement, targetOffset: number): void {
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

  public findRootList(
    list: HTMLOListElement | HTMLUListElement | null,
  ): HTMLOListElement | HTMLUListElement | null {
    if (!list) {
      return null;
    }

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

    return rootList;
  }

  public getAncestorIfLastLeaf(
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
