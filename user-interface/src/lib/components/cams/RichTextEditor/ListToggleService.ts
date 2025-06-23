import editorUtilities from './Editor.utilities';
import { SelectionService } from './SelectionService.humble';
import { ListUtilities } from './ListUtilities';

export class ListToggleService {
  private root: HTMLElement;
  private selectionService: SelectionService;
  private listUtilities: ListUtilities;

  constructor(root: HTMLElement, selectionService: SelectionService, listUtilities: ListUtilities) {
    this.root = root;
    this.selectionService = selectionService;
    this.listUtilities = listUtilities;
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
        this.listUtilities.unwrapListItem(li, list, range);
      }
    } else {
      this.insertList(type, range);
    }
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

    const list = this.listUtilities.createListWithEmptyItem(listType);
    if (paragraph.firstChild && (paragraph.textContent?.trim() || paragraph.querySelector('*'))) {
      while (paragraph.firstChild) {
        list.firstChild?.appendChild(paragraph.firstChild);
      }
    }
    paragraph.replaceWith(list);

    // Restore cursor position in the new list item
    if (list.children.length) {
      this.listUtilities.setCursorInListItem(list.children[0] as HTMLLIElement, cursorOffset);
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
}
