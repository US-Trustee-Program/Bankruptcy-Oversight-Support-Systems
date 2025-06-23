import editorUtilities from './Editor.utilities';
import { SelectionService } from './SelectionService.humble';

export class ListIndentationService {
  private root: HTMLElement;
  private selectionService: SelectionService;

  constructor(root: HTMLElement, selectionService: SelectionService) {
    this.root = root;
    this.selectionService = selectionService;
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
}
