import editorUtilities from './Editor.utilities';
import { SelectionService } from './SelectionService.humble';
import { ListUtilities } from './ListUtilities';
import { ZERO_WIDTH_SPACE } from './Editor.constants';

export class ListNavigationService {
  private root: HTMLElement;
  private selectionService: SelectionService;
  private listUtilities: ListUtilities;

  constructor(root: HTMLElement, selectionService: SelectionService, listUtilities: ListUtilities) {
    this.root = root;
    this.selectionService = selectionService;
    this.listUtilities = listUtilities;
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

        const p = this.createEmptyParagraph();

        const list = editorUtilities.findClosestAncestor<HTMLOListElement | HTMLUListElement>(
          this.root,
          listItem,
          'ol,ul',
        );

        // Find the root list (outermost list that's a direct child of this.root)
        const rootList = this.listUtilities.findRootList(list);
        if (rootList && rootList.parentNode === this.root) {
          // Insert paragraph after the root list
          this.root.insertBefore(p, rootList.nextSibling);
        } else {
          // Fallback to original behavior
          list?.parentNode?.insertBefore(p, list.nextSibling);
        }

        listItem.remove();

        this.focusParagraph(p);

        this.removeIfEmpty(list);

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

    const newParagraph = this.createEmptyParagraph();

    if (currentParagraph?.parentNode) {
      // Bisect the current text at the cursor location.
      const nodeWithCursor = selection.anchorNode!;
      // split nodeWithCursor into two nodes, one with the text before the cursor, one with the text after the cursor
      let leftSide = nodeWithCursor.cloneNode(true);
      let rightSide = nodeWithCursor.cloneNode(true);
      leftSide.textContent = nodeWithCursor.textContent?.slice(0, range.startOffset) ?? '';
      // TODO we may lose any formatting fully contained on the right side.
      rightSide.textContent = nodeWithCursor.textContent?.slice(range.startOffset) ?? '';

      // TODO anchor tag is a special case, handle it

      // Make the left side node a descendent of currentParagraph. If nodeWithCursor has n ancestors between it and currentParagraph,
      // then ensure leftSide has n ancestors of the respective types between it and currentParagraph.
      let hasNonParagraphAncestor = true;
      let currentAncestorNode = nodeWithCursor.parentNode;
      let lastVisitedNode;
      while (hasNonParagraphAncestor) {
        if (currentAncestorNode && currentAncestorNode.nodeName !== 'P') {
          // make left side a child of a new node of the same type as currentAncestorNode
          const newLeftNode = this.selectionService.createElement(
            currentAncestorNode.nodeName as keyof HTMLElementTagNameMap,
          );
          newLeftNode.appendChild(leftSide);
          leftSide = newLeftNode;
          const newRightNode = this.selectionService.createElement(
            currentAncestorNode.nodeName as keyof HTMLElementTagNameMap,
          );
          newRightNode.appendChild(rightSide);
          rightSide = newRightNode;
          hasNonParagraphAncestor = true;
          lastVisitedNode = currentAncestorNode;
          currentAncestorNode = currentAncestorNode.parentNode;
        } else if (lastVisitedNode) {
          // we've reached the nearest ancestor that is a paragraph, make left side a child and be done

          // Get all child of the p nodes to the right of the cursor
          const rightSideNodes: ChildNode[] = [];
          let x = lastVisitedNode.nextSibling;
          while (x) {
            rightSideNodes.push(x);
            x = x.nextSibling;
          }

          currentParagraph.replaceChild(leftSide, lastVisitedNode);
          newParagraph.append(rightSide, ...rightSideNodes);
          currentParagraph.parentNode.insertBefore(newParagraph, currentParagraph.nextSibling);
          hasNonParagraphAncestor = false;
        }
      }
    } else {
      range.collapse(false);
      range.insertNode(newParagraph);
    }

    this.focusParagraph(newParagraph);
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

    const grandMammi = this.listUtilities.getAncestorIfLastLeaf(parentList);
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
        const p = this.createEmptyParagraph();
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
    this.cleanupEmptyParentList(parentList);

    this.focusParagraph(p);

    this.removeIfEmpty(parentList);

    return true;
  }

  private createEmptyParagraph(): HTMLParagraphElement {
    const p = this.selectionService.createElement('p');
    editorUtilities.stripFormatting(p);
    p.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));
    return p;
  }

  private focusParagraph(paragraph: HTMLParagraphElement): void {
    const newRange = this.selectionService.createRange();
    newRange.setStart(paragraph.firstChild! ?? paragraph, 0);
    newRange.collapse(true);
    this.selectionService.setSelectionRange(newRange);
  }

  private removeIfEmpty(element: Element | null): boolean {
    if (!element) {
      return false;
    }
    if ([...element.children].every((child) => child.textContent?.trim() === '')) {
      element.remove();
      return true;
    }
    return false;
  }

  private cleanupEmptyParentList(listElement: Element | null): void {
    if (listElement && listElement.childNodes.length === 0) {
      listElement.remove();
    }
  }
}
