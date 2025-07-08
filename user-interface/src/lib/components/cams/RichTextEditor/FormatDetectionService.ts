import { SelectionService } from './SelectionService.humble';
import editorUtilities from './Editor.utilities';
import { RichTextFormat } from './Editor.constants';

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  orderedList: boolean;
  unorderedList: boolean;
}

export class FormatDetectionService {
  private root: HTMLElement;
  private selectionService: SelectionService;

  constructor(root: HTMLElement, selectionService: SelectionService) {
    this.root = root;
    this.selectionService = selectionService;
  }

  /**
   * Gets the format state at the current cursor position or selection.
   * For these vertical slices, we implement format detection one by one:
   * - Bold detection (Slice 1)
   * - Italic detection (Slice 2)
   * - Underline detection (Slice 3)
   * - List detection (Slice 4)
   * Other format states will be implemented in subsequent slices.
   */
  public getFormatState(): FormatState {
    // Initialize format state with all values as false
    const formatState: FormatState = {
      bold: false,
      italic: false,
      underline: false,
      orderedList: false,
      unorderedList: false,
    };

    const selection = this.selectionService.getCurrentSelection();
    if (!selection || selection.rangeCount === 0) {
      return formatState;
    }

    const range = selection.getRangeAt(0);
    const startNode = range.startContainer;

    // First check if we're inside a list structure
    formatState.orderedList = this.isWithinList(startNode, 'ol');
    formatState.unorderedList = this.isWithinList(startNode, 'ul');

    // Detect bold, italic, and underline formatting
    formatState.bold = this.isFormatActive(range, 'strong');
    formatState.italic = this.isFormatActive(range, 'em');
    formatState.underline = this.isFormatActive(range, 'u');

    return formatState;
  }

  /**
   * Determines if the specified format is active at the current cursor position.
   * @param range The current range
   * @param format The format to check
   * @param node Optional node to check instead of the range's start container
   * @returns True if the format is active, false otherwise
   */
  private isFormatActive(range: Range, format: RichTextFormat | 'u'): boolean {
    if (range.collapsed) {
      // For collapsed range (cursor position), check if we're within a formatting element
      return this.isWithinFormattingElement(range.startContainer, format);
    }

    // For text selection, we'll check if the start container is within a formatting element
    // This is a simple implementation for Slice 1 that works for bold text
    // A more robust implementation for mixed formatting will be added in Slice 5
    return this.isWithinFormattingElement(range.startContainer, format);
  }

  /**
   * Checks if the node is within a formatting element of the specified type.
   * @param node The node to check
   * @param format The format type
   * @returns True if the node is within the specified formatting element
   */
  private isWithinFormattingElement(node: Node, format: RichTextFormat | 'u'): boolean {
    // For underline, we need to check for span.underline
    const selector = format === 'u' ? 'span.underline' : format;

    // Find the closest ancestor that matches the format
    const formatElement = editorUtilities.findClosestAncestor<Element>(this.root, node, selector);

    return formatElement !== null;
  }

  /**
   * Checks if the node is within a list of the specified type.
   * @param node The node to check
   * @param listType The type of list ('ul' or 'ol')
   * @returns True if the node is within the specified list type
   */
  private isWithinList(node: Node, listType: 'ul' | 'ol'): boolean {
    // First, check if we're in a list item
    const listItemElement = editorUtilities.findClosestAncestor<HTMLLIElement>(
      this.root,
      node,
      'li',
    );

    if (!listItemElement) {
      return false;
    }

    // Then check if the list item is within the specified list type
    // We need to check direct parent first and fallback to ancestor search for nested lists
    const directParent = listItemElement.parentElement;
    let listElement = null;

    // First check if direct parent matches the list type
    if (directParent?.tagName?.toLowerCase() === listType) {
      listElement = directParent;
    } else {
      // Then try to find an ancestor with the specified list type
      listElement = editorUtilities.findClosestAncestor<HTMLElement>(
        this.root,
        listItemElement,
        listType,
      );
    }

    return listElement !== null;
  }
}
