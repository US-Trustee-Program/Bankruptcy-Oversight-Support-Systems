import {
  RichTextFormat,
  ZERO_WIDTH_SPACE,
  ZERO_WIDTH_SPACE_REGEX,
} from '@/lib/components/cams/RichTextEditor/Editor.constants';
import editorUtilities from './Editor.utilities';
import { SelectionService } from './SelectionService.humble';
import { ListService } from './ListService';
import { FormattingService } from './FormattingService';

export class Editor {
  private root: HTMLElement;
  private selectionService: SelectionService;
  private listService: ListService;
  private formattingService: FormattingService;

  constructor(root: HTMLElement, selectionService: SelectionService) {
    this.root = root;
    this.selectionService = selectionService;
    this.listService = new ListService(root, selectionService);
    this.formattingService = new FormattingService(root, selectionService);

    // Initialize with empty paragraph if the root is empty
    this.initializeContent();
  }

  private initializeContent(): void {
    if (!this.root.hasChildNodes() || this.root.innerHTML.trim() === '') {
      const p = this.selectionService.createElement('p');
      p.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));
      this.root.appendChild(p);

      // Position cursor in the new paragraph
      editorUtilities.positionCursorInEmptyParagraph(this.selectionService, p);
    }
  }

  public toggleSelection(tagName: RichTextFormat): void {
    return this.formattingService.toggleSelection(tagName);
  }

  public handleDentures(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    return this.listService.handleDentures(e);
  }

  public handleDeleteKeyOnList(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    return this.listService.handleDeleteKeyOnList(e);
  }

  public handleEnterKey(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    // TODO we should consider whether we want something called ListService
    // handling ALL enter key behavior, or only that within a list.
    return this.listService.handleEnterKey(e);
  }

  public toggleList(type: 'ul' | 'ol'): void {
    return this.listService.toggleList(type);
  }

  public handleCtrlKey(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          this.formattingService.toggleSelection('strong');
          return true;
        case 'i':
          e.preventDefault();
          this.formattingService.toggleSelection('em');
          return true;
        case 'u':
          e.preventDefault();
          this.formattingService.toggleSelection('u');
          return true;
      }
    }
    return false;
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
    const currentParagraph = editorUtilities.findClosestAncestor<HTMLParagraphElement>(
      this.root,
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
        editorUtilities.positionCursorInEmptyParagraph(this.selectionService, currentParagraph);
        return true;
      }
    } else if (currentParagraph.textContent === ZERO_WIDTH_SPACE) {
      e.preventDefault();
      const { previousSibling } = currentParagraph;
      if (previousSibling && previousSibling.nodeType === Node.ELEMENT_NODE) {
        const { firstChild } = previousSibling;
        if (firstChild) {
          range.setStart(firstChild, previousSibling.textContent?.length ?? 0);
          currentParagraph.remove();
          return true;
        }
      }
    }

    return false;
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
    const currentParagraph = editorUtilities.findClosestAncestor<HTMLParagraphElement>(
      this.root,
      range.startContainer,
      'p',
    );

    if (currentParagraph && editorUtilities.isEmptyContent(this.root)) {
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
        !editorUtilities.findClosestAncestor(this.root, container, 'p,li,ul,ol');

      if (isInRootWithoutBlock) {
        e.preventDefault();

        const p = this.selectionService.createElement('p');
        editorUtilities.stripFormatting(p);
        p.textContent = e.key;

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
}
