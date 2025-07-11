import editorUtilities, { safelySetHtml } from './Editor.utilities';
import { SelectionService } from './SelectionService.humble';
import {
  RichTextFormat,
  ZERO_WIDTH_SPACE,
  HTTP_REG_PATTERN,
  DOMPURIFY_CONFIG,
} from './Editor.constants';
import { NormalizationService } from './NormalizationService';
import { FormattingRemovalService } from './FormattingRemovalService';
import DOMPurify from 'dompurify';

export class FormattingService {
  private root: HTMLElement;
  private selectionService: SelectionService;
  private normalizationService: NormalizationService;
  private formattingRemovalService: FormattingRemovalService;
  private lastInsertedFormatElement: HTMLElement | null = null;
  private lastInsertedFormatRange: Range | null = null;

  constructor(root: HTMLElement, selectionService: SelectionService) {
    this.root = root;
    this.selectionService = selectionService;
    this.normalizationService = new NormalizationService(root, selectionService);
    this.formattingRemovalService = new FormattingRemovalService();
  }

  /**
   * Public wrapper for FormattingRemovalService.removeFormatFromFragment
   * Exposed for testing purposes
   */
  public removeFormatFromFragment(fragment: DocumentFragment, tagName: RichTextFormat): void {
    this.formattingRemovalService.removeFormatFromFragment(fragment, tagName);
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
      this.toggleFormattingAtCursor(range, tagName);
      return;
    }

    this.toggleFormattingForSelection(range, tagName);

    this.normalizationService.normalizeInlineFormatting();
    this.selectionService.getCurrentSelection()?.removeAllRanges();
  }

  /**
   * Handles applying or removing formatting for a non-collapsed selection
   * @param range The current selection range (non-collapsed)
   * @param tagName The formatting to toggle
   */
  private toggleFormattingForSelection(range: Range, tagName: RichTextFormat): void {
    // First, clone the range to work with a copy
    const clonedRange = range.cloneRange();

    // Check if selection encompasses the entire paragraph content
    const paragraphElement = editorUtilities.findClosestAncestor<HTMLParagraphElement>(
      this.root,
      range.commonAncestorContainer,
      'p',
    );

    // If this is a full paragraph selection or if the common ancestor is the paragraph itself,
    // we'll create a paragraph-level range for processing
    const isFullParagraphSelection =
      paragraphElement &&
      (range.commonAncestorContainer === paragraphElement ||
        (range.startContainer === paragraphElement &&
          range.startOffset === 0 &&
          range.endContainer === paragraphElement &&
          range.endOffset === paragraphElement.childNodes.length));

    // We'll use the same consistent logic for all selections:
    // If the selection is entirely formatted with the target format, remove it
    // Otherwise, apply the format to the selection

    // To determine this, we extract a clone of the content and analyze it
    const tempRange = clonedRange.cloneRange();
    const fragment = tempRange.cloneContents();

    // Check if we're selecting inside an element with this formatting
    const commonFormatElement = editorUtilities.findClosestAncestor<Element>(
      this.root,
      range.commonAncestorContainer,
      tagName === 'u' ? 'span.underline' : tagName,
    );

    // Get all text content in the selection that already has the formatting
    const formattedTextLength = this.getFormattedTextLength(fragment, tagName);
    const totalTextLength = fragment.textContent?.length || 0;

    // Selection is "entirely formatted" if:
    // 1. All text has the format (allowing small variations for whitespace)
    // 2. OR if we're selecting within an element that already has this format
    const isEntirelyFormatted =
      (totalTextLength > 0 &&
        formattedTextLength > 0 &&
        formattedTextLength >= totalTextLength * 0.99) ||
      (commonFormatElement && FormattingService.isMatchingElement(commonFormatElement, tagName));

    if (isEntirelyFormatted) {
      // For removing formatting when the selection is entirely formatted
      const rangeToProcess = isFullParagraphSelection
        ? this.createRangeForEntireParagraph(paragraphElement!)
        : clonedRange;

      // Special handling for complex cases where selection spans multiple elements
      // and contains nested formatting structures
      const isComplexSelection =
        range.startContainer !== range.endContainer || commonFormatElement !== null;

      // Handle removing formatting from the selection
      this.removeFormattingFromRange(rangeToProcess, tagName, isComplexSelection);
    } else {
      // For applying formatting when the selection is not entirely formatted
      // First, check if this would create redundant nesting
      const existingFormats = this.getActiveFormatAtSelection(range);

      if (existingFormats.includes(tagName)) {
        // We already have this format at the selection level - don't create redundant nesting
        // Instead, we'll need to split and reapply formatting more carefully
        this.splitAndToggleFormat(range, tagName);
      } else {
        // Extract the content, preserve nested formatting, and apply the new format
        const contents = clonedRange.extractContents();

        // Process the content to flatten any redundant nesting that might exist
        const tempFragment = document.createDocumentFragment();
        tempFragment.appendChild(contents);
        this.formattingRemovalService.flattenNestedElements(tempFragment, tagName);

        // Now wrap and insert
        const wrapper = this.createRichTextElement(tagName);
        if (wrapper) {
          while (tempFragment.firstChild) {
            wrapper.appendChild(tempFragment.firstChild);
          }
          clonedRange.insertNode(wrapper);
        }
      }
    }
  }

  /**
   * Applies formatting to a paragraph, being careful not to create redundant nesting.
   * This method ensures that content already formatted with the target format isn't wrapped again.
   * @deprecated This method is now deprecated in favor of the unified formatting approach.
   * It is kept for backward compatibility but should not be used in new code.
   */
  private applyFormatToParagraph(
    paragraphElement: HTMLParagraphElement,
    tagName: RichTextFormat,
  ): void {
    // Standard approach to apply formatting to paragraph content
    const selector = tagName === 'u' ? 'span.underline' : tagName;

    // First, identify any existing elements of the target format
    const existingFormatElements = Array.from(paragraphElement.querySelectorAll(selector));

    // Then, get all top-level nodes in the paragraph that are not already in the target format
    const topLevelNodes = Array.from(paragraphElement.childNodes);

    // Create a document fragment to hold the updated content
    const fragment = document.createDocumentFragment();

    // Process each top-level node
    for (const node of topLevelNodes) {
      // Check if this node is already a format element or is inside one
      const isAlreadyFormatted = existingFormatElements.some(
        (formatEl) => formatEl === node || formatEl.contains(node),
      );

      if (isAlreadyFormatted) {
        // If already formatted, just move to the fragment as-is
        fragment.appendChild(node);
      } else {
        // If not formatted, wrap in the target format
        const wrapper = this.createRichTextElement(tagName);
        wrapper.appendChild(node.cloneNode(true));
        fragment.appendChild(wrapper);
      }
    }

    // Replace the paragraph content with the updated fragment
    paragraphElement.innerHTML = '';
    paragraphElement.appendChild(fragment);

    this.normalizationService.normalizeInlineFormatting();
    this.selectionService.getCurrentSelection()?.removeAllRanges();
  }

  /**
   * Creates a range that encompasses the entire content of a paragraph
   * This is useful for processing entire paragraphs in complex formatting scenarios
   */
  private createRangeForEntireParagraph(paragraphElement: HTMLParagraphElement): Range {
    const range = this.selectionService.createRange();
    range.selectNodeContents(paragraphElement);
    return range;
  }

  /**
   * Checks if a paragraph contains formatting of the specified type
   */
  private isParagraphFormatted(
    paragraphElement: HTMLParagraphElement,
    tagName: RichTextFormat,
  ): boolean {
    const selector = tagName === 'u' ? 'span.underline' : tagName;
    return paragraphElement.querySelectorAll(selector).length > 0;
  }

  public handlePaste(e: React.ClipboardEvent<HTMLDivElement>): boolean {
    const { clipboardData } = e;
    if (!clipboardData) {
      return false;
    }

    const pastedTextRaw = DOMPurify.sanitize(clipboardData.getData('text/plain'), DOMPURIFY_CONFIG);
    if (!pastedTextRaw) {
      return false;
    }

    // Apply URL processing to the entire pasted content first
    // Create a new RegExp with global flag to prevent lastIndex mutation issues
    const urlRegex = new RegExp(HTTP_REG_PATTERN.source, 'g');
    const urlMatches = Array.from(pastedTextRaw.matchAll(urlRegex));

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
    safelySetHtml(tempDiv, firstLine);

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
      safelySetHtml(tempDiv, line);

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

  /**
   * Handles toggling formatting when the cursor is at a specific position (no selection)
   * @param range The current range (collapsed)
   * @param tagName The formatting to toggle
   */
  private toggleFormattingAtCursor(range: Range, tagName: RichTextFormat): void {
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
      // Clear any previously saved format state to avoid issues
      this.lastInsertedFormatElement = null;
      this.lastInsertedFormatRange = null;

      // We're not in a formatting element - toggle it on by creating one
      const el = this.createRichTextElement(tagName);
      if (el) {
        el.appendChild(this.selectionService.createTextNode(ZERO_WIDTH_SPACE));
        range.insertNode(el);

        // Position cursor inside the new formatting element
        const newRange = this.selectionService.createRange();
        newRange.setStart(el.firstChild!, 0); // Before the zero-width space
        newRange.collapse(true);
        this.selectionService.setSelectionRange(newRange);

        // Store the range for future restoration if needed
        this.lastInsertedFormatRange = newRange.cloneRange();
        this.lastInsertedFormatElement = el;
      }
    }
  }

  /**
   * Handles exiting a formatting element when the cursor is inside it
   * This is called when the user presses the formatting shortcut while inside that format
   */
  private exitFormattingElement(formatElement: Element, range: Range): void {
    // Get the parent of the formatting element
    const { parentElement } = formatElement;
    if (!parentElement) {
      return;
    }

    // Get information about the selection
    const { startOffset } = range;
    const startNode = range.startContainer;

    // Reset lastInsertedFormatElement to avoid conflicts with future typing
    this.lastInsertedFormatElement = null;
    this.lastInsertedFormatRange = null;

    // For the simple case where we're in a text node
    if (startNode.nodeType === Node.TEXT_NODE) {
      // Get the text content
      const text = startNode.textContent || '';

      // Split the text at cursor position
      const beforeCursor = text.substring(0, startOffset);
      const afterCursor = text.substring(startOffset);

      // Update the text node with just the "before cursor" text
      startNode.textContent = beforeCursor || ZERO_WIDTH_SPACE;

      // Create a text node for the after-cursor content
      const afterTextNode = document.createTextNode(afterCursor || ZERO_WIDTH_SPACE);

      // Insert after the formatting element
      // Simply insert it to the parent which may already have other formatting
      // This ensures we don't create redundant formatting elements
      parentElement.insertBefore(afterTextNode, formatElement.nextSibling);

      // Position the cursor at the beginning of the new text
      const newRange = this.selectionService.createRange();
      newRange.setStart(afterTextNode, 0);
      newRange.collapse(true);
      this.selectionService.setSelectionRange(newRange);

      return;
    }

    // For the case where we're at an element boundary
    // Create a text node with zero-width space
    const afterTextNode = document.createTextNode(ZERO_WIDTH_SPACE);

    // Insert after the format element within the parent element
    // which maintains any existing formatting from parent elements
    parentElement.insertBefore(afterTextNode, formatElement.nextSibling);

    // Position cursor after the zero-width space
    const newRange = this.selectionService.createRange();
    newRange.setStart(afterTextNode, 1);
    newRange.collapse(true);
    this.selectionService.setSelectionRange(newRange);
  }

  /**
   * Checks if an element is an underline span element
   */
  private isUnderlineElement(element: Element): boolean {
    return element.tagName === 'SPAN' && element.classList.contains('underline');
  }

  /**
   * Checks if two elements are the same formatting type (e.g., both <strong>)
   */
  private isSameFormatType(element1: Element, element2: Element): boolean {
    if (this.isUnderlineElement(element1)) {
      return this.isUnderlineElement(element2);
    }
    return element1.tagName === element2.tagName;
  }

  /**
   * Gets the total length of text content that has the specified formatting
   * Used to determine if a selection should have formatting added or removed
   * This method examines each character in the fragment to ensure accurate detection
   */
  private getFormattedTextLength(fragment: DocumentFragment, tagName: RichTextFormat): number {
    // Create a character-by-character map of formatting
    const textContent = fragment.textContent || '';
    if (textContent.length === 0) {
      return 0;
    }

    // Create a temporary div to operate on
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(fragment.cloneNode(true));

    // Get all text nodes in order of appearance
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null);
    let node: Text | null;
    while ((node = walker.nextNode() as Text)) {
      textNodes.push(node);
    }

    // Count characters with formatting
    let formattedCount = 0;

    for (const textNode of textNodes) {
      // Check if this text node has the target formatting
      let parent: Node | null = textNode.parentNode;
      let hasTargetFormat = false;

      while (parent && parent !== tempDiv) {
        if (parent.nodeType === Node.ELEMENT_NODE) {
          const element = parent as Element;
          if (
            (tagName === 'strong' && element.tagName === 'STRONG') ||
            (tagName === 'em' && element.tagName === 'EM') ||
            (tagName === 'u' &&
              element.tagName === 'SPAN' &&
              element.classList.contains('underline'))
          ) {
            hasTargetFormat = true;
            break;
          }
        }
        parent = parent.parentNode;
      }

      if (hasTargetFormat) {
        formattedCount += textNode.textContent?.length || 0;
      }
    }

    return formattedCount;
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
      // If we found a different format element of the same type, check if it
      // and startFormatElement together cover the entire selection
      if (
        current.nodeType === Node.ELEMENT_NODE &&
        FormattingService.isMatchingElement(current as Element, tagName)
      ) {
        // This is more complex and would need to check if there are any text nodes
        // between the format elements that aren't formatted
        // For simplicity, we'll assume it's not fully formatted
        return false;
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

  /**
   * Gets all active formatting types at the current selection or cursor position
   * This helps prevent redundant nesting of the same format type
   */
  private getActiveFormatAtSelection(range: Range): RichTextFormat[] {
    const formats: RichTextFormat[] = [];
    const container = range.commonAncestorContainer;

    let current: Node | null =
      container.nodeType === Node.TEXT_NODE ? container.parentNode : container;

    while (current && current !== this.root) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const element = current as Element;
        if (element.tagName === 'STRONG') {
          formats.push('strong');
        } else if (element.tagName === 'EM') {
          formats.push('em');
        } else if (element.tagName === 'SPAN' && element.classList.contains('underline')) {
          formats.push('u');
        }
      }
      current = current.parentNode;
    }

    return formats;
  }

  /**
   * Splits the selection and toggles formatting without creating redundant nesting
   * This is called when we detect we're trying to apply a format that's already active
   */
  private splitAndToggleFormat(range: Range, tagName: RichTextFormat): void {
    // Find the closest element of the target format type
    const formattingElement = editorUtilities.findClosestAncestor<Element>(
      this.root,
      range.commonAncestorContainer,
      tagName === 'u' ? 'span.underline' : tagName,
    );

    if (!formattingElement || !formattingElement.parentNode) {
      // Fallback if we can't find the formatting element
      return;
    }

    // Extract the selected content
    const selectedContent = range.extractContents();

    // If the formatting element is now empty, remove it entirely
    if (!formattingElement.textContent && formattingElement.parentNode) {
      formattingElement.parentNode.removeChild(formattingElement);
    }

    // Insert the selection content without the formatting we're toggling
    // but preserving other formatting that might be present
    this.formattingRemovalService.removeFormatFromFragment(selectedContent, tagName);

    // Insert the processed content at the range
    range.insertNode(selectedContent);
    range.collapse(false);

    // Normalize the structure
    this.normalizationService.normalizeInlineFormatting();
  }

  /**
   * Creates a nested structure of formatting elements
   * For example, formats ['strong', 'em', 'u'] creates <strong><em><span class="underline">content</span></em></strong>
   */
  public createNestedFormatStructure(formats: RichTextFormat[]): Element {
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

  /**
   * Removes formatting from the given range
   * This handles both partial selections and full paragraph content,
   * including complex cases where the selection crosses format boundaries
   * @param range The range to remove formatting from
   * @param tagName The formatting to remove
   * @param isComplexSelection Whether this is a complex selection that spans multiple elements
   */
  private removeFormattingFromRange(
    range: Range,
    tagName: RichTextFormat,
    isComplexSelection: boolean = false,
  ): void {
    // Clone the range to work with
    const clonedRange = range.cloneRange();

    // Find the containing paragraph (if any)
    const paragraphElement = editorUtilities.findClosestAncestor<HTMLParagraphElement>(
      this.root,
      range.commonAncestorContainer,
      'p',
    );

    // Handle partial selection within a formatting element
    // This handles the case where user selects part of a formatted text
    const formattingElement =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE &&
      range.commonAncestorContainer.parentElement &&
      FormattingService.isMatchingElement(range.commonAncestorContainer.parentElement, tagName)
        ? range.commonAncestorContainer.parentElement
        : null;

    // Check if we have a text node selection within a formatting element
    if (
      formattingElement &&
      range.startContainer === range.endContainer &&
      range.startContainer.nodeType === Node.TEXT_NODE &&
      range.startContainer === formattingElement.firstChild
    ) {
      const textNode = range.startContainer as Text;
      const text = textNode.textContent || '';

      // Check if this is a partial selection within the text (not the whole text)
      if (range.startOffset !== 0 || range.endOffset !== text.length) {
        // Split the text into three parts: before selection, selection, after selection
        const beforeText = text.substring(0, range.startOffset);
        const selectedText = text.substring(range.startOffset, range.endOffset);
        const afterText = text.substring(range.endOffset);

        // Only proceed if we're actually selecting some text
        if (selectedText) {
          const fragment = document.createDocumentFragment();

          // Handle text before selection (remains formatted)
          if (beforeText) {
            const beforeElement = this.createRichTextElement(tagName);
            beforeElement.appendChild(document.createTextNode(beforeText));
            fragment.appendChild(beforeElement);
          }

          // Add the selected text without formatting
          fragment.appendChild(document.createTextNode(selectedText));

          // Handle text after selection (remains formatted)
          if (afterText) {
            const afterElement = this.createRichTextElement(tagName);
            afterElement.appendChild(document.createTextNode(afterText));
            fragment.appendChild(afterElement);
          }

          // Replace the formatting element with our new structure
          if (formattingElement.parentNode) {
            formattingElement.parentNode.insertBefore(fragment, formattingElement);
            formattingElement.parentNode.removeChild(formattingElement);
            this.normalizationService.normalizeInlineFormatting();
            return;
          }
        }
      }
    }

    // For complex selections or paragraph-level processing, use our more thorough approach
    // This handles complex nesting much better
    if (isComplexSelection || paragraphElement) {
      // For complex selections that cross boundaries, we need to be more thorough
      const elementToProcess =
        paragraphElement ||
        editorUtilities.findClosestAncestor<HTMLElement>(
          this.root,
          range.commonAncestorContainer,
          '*',
        );

      if (elementToProcess) {
        // Create a clone of the element to work with
        const clone = elementToProcess.cloneNode(true) as HTMLElement;

        // Create a new document fragment for processing
        const tempFragment = document.createDocumentFragment();

        // Copy content to the fragment
        while (clone.firstChild) {
          tempFragment.appendChild(clone.firstChild);
        }

        // Process the fragment to remove all instances of the format
        this.formattingRemovalService.removeFormatFromFragment(tempFragment, tagName);

        // Replace the element's content with the processed fragment
        elementToProcess.innerHTML = '';
        elementToProcess.appendChild(tempFragment);

        // Normalize the structure
        this.normalizationService.normalizeInlineFormatting();
        return;
      }
    }

    // For simple cases with exact selection of a format element
    const parentElement =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : (range.commonAncestorContainer as Element);

    // Special case for selections that exactly match a formatting element
    if (
      parentElement &&
      FormattingService.isMatchingElement(parentElement, tagName) &&
      range.startOffset === 0 &&
      range.endOffset === parentElement.childNodes.length
    ) {
      // This is a direct selection of exactly one formatting element
      const fragment = document.createDocumentFragment();

      // Extract all children from the format element
      while (parentElement.firstChild) {
        fragment.appendChild(parentElement.firstChild);
      }

      // Replace the formatting element with its content
      if (parentElement.parentNode) {
        parentElement.parentNode.insertBefore(fragment, parentElement);
        parentElement.parentNode.removeChild(parentElement);

        // Normalize the structure
        this.normalizationService.normalizeInlineFormatting();
        return;
      }
    }

    // For partial selections - extract, process, and reinsert
    const content = clonedRange.extractContents();

    // Process the extracted content
    this.formattingRemovalService.removeFormatFromFragment(content, tagName);

    // Insert the processed content back
    clonedRange.insertNode(content);

    // Clean up the document structure
    this.normalizationService.normalizeInlineFormatting();
  }

  /**
   * Positions the cursor inside the innermost text node of a formatting structure
   * This is used after creating a new formatting element to position the cursor properly
   * @param structure The formatting structure to place the cursor in
   */
  public positionCursorInNewStructure(structure: Element): void {
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

  /**
   * Checks if the element has formatting that requires special cursor handling
   * This is used to prevent cursor jumping when typing after applying formatting
   */
  public isTypingInFormatElement(node: Node, offset: number): boolean {
    // Check if this is a text node with exactly the zero-width space
    if (node.nodeType === Node.TEXT_NODE && node.textContent === ZERO_WIDTH_SPACE && offset === 1) {
      // Check if the parent is a formatting element (strong, em, or span.underline)
      const parent = node.parentElement;
      if (
        parent &&
        (parent.tagName === 'STRONG' ||
          parent.tagName === 'EM' ||
          (parent.tagName === 'SPAN' && parent.classList.contains('underline')))
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Handles splitting formatting elements when pressing Enter inside a formatting element
   * @param e The enter key event
   * @returns True if the event was handled, false otherwise
   */
  public handleEnterInFormatting(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    if (e.key !== 'Enter') {
      return false;
    }

    const range = this.selectionService.getRangeAtStartOfSelection();
    if (!range || !range.collapsed) {
      return false;
    }

    // Check if we're inside a formatting element with a zero-width space
    if (
      range.startContainer.nodeType === Node.TEXT_NODE &&
      range.startContainer.textContent === ZERO_WIDTH_SPACE
    ) {
      // Check if the parent is a formatting element (strong, em, or span.underline)
      const parent = range.startContainer.parentElement;
      if (
        parent &&
        (parent.tagName === 'STRONG' ||
          parent.tagName === 'EM' ||
          (parent.tagName === 'SPAN' && parent.classList.contains('underline')))
      ) {
        e.preventDefault();

        // Find the paragraph containing the formatting element
        const paragraph = editorUtilities.findClosestAncestor<HTMLParagraphElement>(
          this.root,
          range.startContainer,
          'p',
        );

        if (!paragraph || !paragraph.parentNode) {
          return false;
        }

        // Create a new paragraph
        const newParagraph = this.selectionService.createElement('p');

        // Insert the new paragraph after the current one
        paragraph.parentNode.insertBefore(newParagraph, paragraph.nextSibling);

        // Clear the zero-width space from the format element
        range.startContainer.textContent = '';

        // Create a new formatting element of the same type in the new paragraph
        const formatElement = parent.cloneNode(false) as HTMLElement;
        const textNode = this.selectionService.createTextNode(ZERO_WIDTH_SPACE);

        // Add the zero-width space to the new formatting element
        formatElement.appendChild(textNode);
        newParagraph.appendChild(formatElement);

        // Position cursor inside the new formatting element
        const newRange = this.selectionService.createRange();
        newRange.setStart(textNode, 0);
        newRange.collapse(true);
        this.selectionService.setSelectionRange(newRange);

        // Update tracking state
        this.lastInsertedFormatElement = formatElement;
        this.lastInsertedFormatRange = newRange.cloneRange();

        return true;
      }
    }

    return false;
  }
}
