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
      const newParagraphText = currentParagraph.textContent?.slice(range.startOffset);
      const currentParagraphText = currentParagraph.textContent?.slice(0, range.startOffset);
      newParagraph.textContent = newParagraphText ? newParagraphText : ZERO_WIDTH_SPACE;
      currentParagraph.textContent = currentParagraphText ? currentParagraphText : ZERO_WIDTH_SPACE;

      currentParagraph.parentNode.insertBefore(newParagraph, currentParagraph.nextSibling);
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
