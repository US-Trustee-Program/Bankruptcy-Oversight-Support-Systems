import {
  RichTextFormat,
  ZERO_WIDTH_SPACE,
  ZERO_WIDTH_SPACE_REGEX,
} from '@/lib/components/cams/RichTextEditor/Editor.constants';
import editorUtilities from './Editor.utilities';
import { SelectionService } from './SelectionService.humble';
import { ListService } from './ListService';
import { FormattingService } from './FormattingService';
import { FormatDetectionService, FormatState } from './FormatDetectionService';

export type { FormatState };

export class Editor {
  private root: HTMLElement;
  private selectionService: SelectionService;
  private listService: ListService;
  private formattingService: FormattingService;
  public formatDetectionService: FormatDetectionService;

  constructor(root: HTMLElement, selectionService: SelectionService) {
    this.root = root;
    this.selectionService = selectionService;
    this.listService = new ListService(root, selectionService);
    this.formattingService = new FormattingService(root, selectionService);
    this.formatDetectionService = new FormatDetectionService(root, selectionService);

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
    // First check if we're inside a formatting element with zero-width space
    if (this.formattingService.handleEnterInFormatting(e)) {
      return true;
    }

    // If not in a formatting element, let the list service handle it
    // TODO we should consider whether we want something called ListService
    // handling ALL enter key behavior, or only that within a list.
    return this.listService.handleEnterKey(e);
  }

  public handlePaste(e: React.ClipboardEvent<HTMLDivElement>): boolean {
    return this.formattingService.handlePaste(e);
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
        // Find the last text node in the previous sibling to position cursor properly
        const lastTextNode = this.findLastTextNode(previousSibling);
        if (lastTextNode) {
          range.setStart(lastTextNode, lastTextNode.textContent?.length ?? 0);
          range.collapse(true);
          this.selectionService.setSelectionRange(range);
        }
        currentParagraph.remove();
        return true;
      }
    }

    return false;
  }

  /**
   * Handles printable key events in the editor.
   *
   * Special behaviors:
   * 1. When typing in an empty paragraph (with only a zero-width space), replaces the zero-width space with the typed character
   * 2. When typing next to a zero-width space in non-empty content, removes the zero-width space and inserts the character
   * 3. When typing directly in the root (without a block element), creates a new paragraph with the typed character
   *
   * This is a normalization feature to prevent zero-width spaces from accumulating in the editor
   * and ensures they're automatically removed as soon as the user starts typing actual content.
   *
   * @param e - The keyboard event
   * @returns true if the event was handled, false otherwise
   */
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

    // Handle typing after formatting was applied
    // This fixes the issue where cursor jumps to wrong position after applying formatting
    if (this.formattingService.isTypingInFormatElement(range.startContainer, range.startOffset)) {
      // We're typing directly in a formatting element with zero-width space
      e.preventDefault();

      // Replace the zero-width space with the typed character
      range.startContainer.textContent = e.key;

      // Position cursor after the newly typed character
      const newRange = this.selectionService.createRange();
      newRange.setStart(range.startContainer, 1);
      newRange.collapse(true);
      this.selectionService.setSelectionRange(newRange);

      return true;
    }

    if (currentParagraph && editorUtilities.isEmptyContent(this.root)) {
      // We're typing in the empty paragraph that contains only zero-width space
      // Let's replace the zero-width space with the actual character
      if (
        range.startContainer.nodeType === Node.TEXT_NODE &&
        range.startContainer.textContent === ZERO_WIDTH_SPACE
      ) {
        e.preventDefault();
        range.startContainer.textContent = e.key;

        // Position cursor after the newly typed character
        const newRange = this.selectionService.createRange();
        newRange.setStart(range.startContainer, 1);
        newRange.collapse(true);
        this.selectionService.setSelectionRange(newRange);

        return true;
      }

      // For any other case, let the browser handle it naturally
      return false;
    }

    // Check if we're typing next to a zero-width space and remove it
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = range.startContainer as Text;
      if (textNode.textContent && textNode.textContent.includes(ZERO_WIDTH_SPACE)) {
        e.preventDefault();

        // Replace the zero-width space with empty string
        const newText = textNode.textContent.replace(ZERO_WIDTH_SPACE_REGEX, '');

        // Insert the character at the right position
        const cursorPosition = range.startOffset;
        const beforeCursor = newText.substring(0, cursorPosition);
        const afterCursor = newText.substring(cursorPosition);
        textNode.textContent = beforeCursor + e.key + afterCursor;

        // Position cursor after the newly typed character
        const newRange = this.selectionService.createRange();
        newRange.setStart(textNode, cursorPosition + 1);
        newRange.collapse(true);
        this.selectionService.setSelectionRange(newRange);

        return true;
      }
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

  /**
   * Find the last text node within an element for proper cursor positioning
   */
  private findLastTextNode(element: Node): Text | null {
    if (element.nodeType === Node.TEXT_NODE) {
      return element as Text;
    }

    // Traverse children in reverse order to find the last text node
    for (let i = element.childNodes.length - 1; i >= 0; i--) {
      const child = element.childNodes[i];
      const lastTextNode = this.findLastTextNode(child);
      if (lastTextNode) {
        return lastTextNode;
      }
    }

    return null;
  }

  // No need for a wrapper method since formatDetectionService is now public
}
