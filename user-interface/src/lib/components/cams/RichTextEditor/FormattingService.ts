import editorUtilities from './Editor.utilities';
import { SelectionService } from './SelectionService.humble';
import { RichTextFormat, ZERO_WIDTH_SPACE, HTTP_REG } from './Editor.constants';
import { NormalizationService } from './NormalizationService';

export class FormattingService {
  private root: HTMLElement;
  private selectionService: SelectionService;
  private normalizationService: NormalizationService;

  constructor(root: HTMLElement, selectionService: SelectionService) {
    this.root = root;
    this.selectionService = selectionService;
    this.normalizationService = new NormalizationService(root, selectionService);
  }

  public toggleSelection(tagName: RichTextFormat): void {
    const selection = this.selectionService.getCurrentSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (editorUtilities.isRangeAcrossBlocks(this.root, range)) {
      // TODO: We should probably tell the user they can't change formatting across paragraphs or lists
      return;
    }

    if (range.collapsed) {
      // Check if we're already inside a formatting element of the target type
      const existingFormatElement = editorUtilities.findClosestAncestor<Element>(
        this.root,
        range.startContainer,
        tagName === 'u' ? 'span.underline' : tagName,
      );

      if (
        existingFormatElement &&
        FormattingService.isMatchingElement(existingFormatElement, tagName)
      ) {
        // We're inside a formatting element - toggle it off by moving cursor outside
        this.exitFormattingElement(existingFormatElement, range);
      } else {
        // We're not in a formatting element - toggle it on by creating one
        const el = this.createRichTextElement(tagName);
        if (el) {
          el.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));
          range.insertNode(el);

          // Position cursor inside the new formatting element
          const newRange = this.selectionService.createRange();
          newRange.setStart(el.firstChild!, 1); // After the zero-width space
          newRange.collapse(true);
          this.selectionService.setSelectionRange(newRange);
        }
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
      if (wrapper) {
        wrapper.appendChild(contents);
        range.insertNode(wrapper);
      }
    }

    this.normalizationService.normalizeInlineFormatting();
    this.selectionService.getCurrentSelection()?.removeAllRanges();
  }

  public handlePaste(e: React.ClipboardEvent<HTMLDivElement>): boolean {
    const { clipboardData } = e;
    if (!clipboardData) {
      return false;
    }

    const pastedTextRaw = clipboardData.getData('text/plain');
    if (!pastedTextRaw) {
      return false;
    }

    // Apply URL processing to the entire pasted content first
    const urlMatches = Array.from(pastedTextRaw.matchAll(HTTP_REG));

    let processedText = pastedTextRaw;
    if (urlMatches.length > 0) {
      // Sort matches by position
      const sortedUrls = urlMatches
        .map((match) => ({
          text: match[0],
          index: match.index!,
        }))
        .sort((a, b) => a.index - b.index);

      // Build the processed content with URLs converted to anchor tags
      let processedContent = '';
      let lastIndex = 0;

      for (const match of sortedUrls) {
        // Add text before the match
        processedContent += pastedTextRaw.slice(lastIndex, match.index);
        // Add the anchor tag for the match
        processedContent += `<a href="${match.text}" target="_blank" rel="noopener noreferrer">${match.text}</a>`;
        lastIndex = match.index + match.text.length;
      }

      // Add any remaining text after the last match
      processedContent += pastedTextRaw.slice(lastIndex);
      processedText = processedContent;
    }

    // If no URLs found and single line, allow default paste behavior
    const lines = processedText.split('\n');
    if (!urlMatches.length && lines.length <= 1) {
      return false;
    }

    const range = this.selectionService.getRangeAtStartOfSelection();
    if (!range) {
      return true;
    }

    // Find the current paragraph context
    const currentParagraph = editorUtilities.findClosestAncestor<HTMLParagraphElement>(
      this.root,
      range.startContainer,
      'p',
    );

    if (!currentParagraph) {
      return false;
    }

    // Prevent default paste since we'll handle it
    e.preventDefault();

    // Split current paragraph if there's content after cursor
    let afterCursorContent = '';
    const currentParagraphRange = this.selectionService.createRange();
    currentParagraphRange.setStart(range.endContainer, range.endOffset);
    currentParagraphRange.setEndAfter(currentParagraph);

    if (!currentParagraphRange.collapsed) {
      const afterFragment = currentParagraphRange.extractContents();
      afterCursorContent = afterFragment.textContent || '';
    }

    // Delete the selected content
    range.deleteContents();

    // Create elements for the paste content
    const firstLine = lines[0];
    const remainingLines = lines.slice(1);

    // Insert first line content at cursor position
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = firstLine;

    const fragment = document.createDocumentFragment();
    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild);
    }

    range.insertNode(fragment);
    range.collapse(false);

    // Create new paragraphs for remaining lines
    const newParagraphs: HTMLParagraphElement[] = [];

    for (const line of remainingLines) {
      const newP = this.selectionService.createElement('p');
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = line;

      while (tempDiv.firstChild) {
        newP.appendChild(tempDiv.firstChild);
      }
      newParagraphs.push(newP);
    }

    // If there was content after cursor, add it as the final paragraph
    if (afterCursorContent) {
      const finalP = this.selectionService.createElement('p');
      finalP.textContent = afterCursorContent;
      newParagraphs.push(finalP);
    }

    // Insert new paragraphs after current paragraph
    const parent = currentParagraph.parentNode;
    if (parent && newParagraphs.length > 0) {
      let insertAfter = currentParagraph;
      for (const newP of newParagraphs) {
        parent.insertBefore(newP, insertAfter.nextSibling);
        insertAfter = newP;
      }

      // Position cursor at the end of the last inserted paragraph
      const lastP = newParagraphs[newParagraphs.length - 1];
      const newRange = this.selectionService.createRange();
      newRange.selectNodeContents(lastP);
      newRange.collapse(false);
      this.selectionService.setSelectionRange(newRange);
    }

    this.normalizationService.normalizeInlineFormatting();
    return true;
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

  private exitFormattingElement(formatElement: Element, range: Range): void {
    // Find all active formatting elements at the current cursor position, excluding the one being toggled off
    const activeFormats = this.getActiveFormatsExcluding(range.startContainer, formatElement);

    // Create the new nested structure with the remaining formats
    const newFormatStructure = this.createNestedFormatStructure(activeFormats);

    // Insert the new structure after the current formatting element
    if (formatElement.parentNode) {
      formatElement.parentNode.insertBefore(newFormatStructure, formatElement.nextSibling);
    }

    // Position cursor in the innermost element of the new structure
    this.positionCursorInNewStructure(newFormatStructure);
  }

  private isEntireSelectionFormatted(range: Range, tagName: RichTextFormat): boolean {
    const { startContainer, endContainer } = range;

    // Find the formatted element that contains the start
    let startFormatElement: Element | null = null;
    let current: Node | null =
      startContainer.nodeType === Node.TEXT_NODE ? startContainer.parentNode : startContainer;

    while (current && current !== this.root) {
      if (
        current.nodeType === Node.ELEMENT_NODE &&
        FormattingService.isMatchingElement(current as Element, tagName)
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

  private removeFormattingFromRange(range: Range, tagName: RichTextFormat): void {
    // Find the closest ancestor formatting element for both start and end
    const startFormat = editorUtilities.findClosestAncestor<Element>(
      this.root,
      range.startContainer,
      tagName === 'u' ? 'span.underline' : tagName,
    );
    const endFormat = editorUtilities.findClosestAncestor<Element>(
      this.root,
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
        if (FormattingService.isMatchingElement(element, tagName)) {
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
}
