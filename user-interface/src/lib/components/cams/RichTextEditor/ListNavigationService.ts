import editorUtilities, { safelySetHtml } from './Editor.utilities';
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

    const newParagraph = this.selectionService.createElement('p');

    if (currentParagraph?.parentNode) {
      const { leftFragment, rightFragment } = this.splitParagraphAtCursor(currentParagraph, range);

      // Clear the current paragraph and append the left fragment
      safelySetHtml(currentParagraph, '');
      currentParagraph.appendChild(leftFragment);

      // Clear the new paragraph and append the right fragment
      newParagraph.appendChild(rightFragment);

      // Insert the new paragraph after the current one
      currentParagraph.parentNode.insertBefore(newParagraph, currentParagraph.nextSibling);
    } else {
      range.collapse(false);
      range.insertNode(newParagraph);
    }

    this.focusParagraph(newParagraph);
    return true;
  }

  /**
   * Split a paragraph at the cursor position while preserving all formatting
   */
  private splitParagraphAtCursor(
    paragraph: HTMLParagraphElement,
    range: Range,
  ): { leftFragment: DocumentFragment; rightFragment: DocumentFragment } {
    const leftFragment = this.selectionService.createDocumentFragment();
    const rightFragment = this.selectionService.createDocumentFragment();

    // Clone the original paragraph for safe manipulation
    const paragraphClone = paragraph.cloneNode(true) as HTMLParagraphElement;

    // Create ranges for the left and right parts within the cloned paragraph
    const leftRange = this.selectionService.createRange();
    const rightRange = this.selectionService.createRange();

    // Find the corresponding cursor position in the cloned paragraph
    const cursorNodeInClone = this.findEquivalentNode(
      range.startContainer,
      paragraph,
      paragraphClone,
    );

    const endCursorNodeInClone = this.findEquivalentNode(
      range.endContainer,
      paragraph,
      paragraphClone,
    );

    if (!cursorNodeInClone || !endCursorNodeInClone) {
      // Fallback: put everything in left fragment
      leftFragment.appendChild(paragraphClone);
      return { leftFragment, rightFragment };
    }

    // Set up the left range (from start of paragraph to cursor)
    leftRange.setStart(paragraphClone, 0);
    leftRange.setEnd(cursorNodeInClone, range.startOffset);

    // Set up the right range (from cursor to end of paragraph)
    rightRange.setStart(endCursorNodeInClone, range.endOffset);
    rightRange.setEnd(paragraphClone, paragraphClone.childNodes.length);

    // Extract the content
    const leftContent = leftRange.cloneContents();
    const rightContent = rightRange.cloneContents();

    leftFragment.appendChild(leftContent);
    rightFragment.appendChild(rightContent);

    // Ensure both fragments have content (at least a zero-width space)
    if (!leftFragment.textContent) {
      leftFragment.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));
    }
    if (!rightFragment.textContent) {
      rightFragment.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));
    }

    return { leftFragment, rightFragment };
  }

  /**
   * Find the equivalent node in a cloned tree
   */
  private findEquivalentNode(targetNode: Node, originalRoot: Node, clonedRoot: Node): Node | null {
    if (targetNode === originalRoot) {
      return clonedRoot;
    }

    // Build path from original root to target node
    const path: number[] = [];
    let current = targetNode;

    while (current && current !== originalRoot) {
      const parent = current.parentNode;
      if (!parent) break;

      const index = Array.from(parent.childNodes).indexOf(current as ChildNode);
      path.unshift(index);
      current = parent;
    }

    // Follow the same path in the cloned tree
    let clonedNode: Node = clonedRoot;
    for (const index of path) {
      if (clonedNode.childNodes[index]) {
        clonedNode = clonedNode.childNodes[index];
      } else {
        return null;
      }
    }

    return clonedNode;
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
