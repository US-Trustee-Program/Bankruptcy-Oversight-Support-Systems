import { DOMPURIFY_CONFIG, EMPTY_TAG_REGEX, ZERO_WIDTH_SPACE_REGEX } from './editor.constants';
import { SelectionService } from './SelectionService.humble';
import DOMPurify from 'dompurify';
function stripFormatting(node: Node): void {
  if (!(node instanceof HTMLElement)) {
    return;
  }

  const inlineTags = ['strong', 'b', 'em', 'i', 'u', 'span', 'font'];

  inlineTags.forEach((tag) => {
    node.querySelectorAll(tag).forEach((el) => {
      while (el.firstChild) {
        el.parentNode?.insertBefore(el.firstChild, el);
      }
      el.remove();
    });
  });
}

function isEditorInRange(root: HTMLElement, selectionService: SelectionService): boolean {
  const selection = selectionService.getCurrentSelection();
  if (!selection?.rangeCount) {
    return false;
  }
  const range = selection.getRangeAt(0);
  return root.contains(range.startContainer);
}

function findClosestAncestor<T extends Element = Element>(
  root: HTMLElement,
  node: Node | null,
  selector: string,
): T | null {
  let current: Node | null = node;
  while (current) {
    if (current === root.parentNode) {
      return null;
    }
    if (current instanceof Element) {
      if (current.matches(selector)) {
        return current as T;
      }
      if (current === root) {
        return null;
      }
    }
    current = current.parentNode;
  }
  return null;
}

function isEmptyContent(root: HTMLElement): boolean {
  const children = Array.from(root.children);

  if (children.length === 0) {
    return true;
  }

  for (const child of children) {
    const textContent = child.textContent || '';
    const cleanedContent = textContent.replace(ZERO_WIDTH_SPACE_REGEX, '').trim();
    if (cleanedContent !== '') {
      return false;
    }
  }

  return true;
}

function isRangeAcrossBlocks(root: HTMLElement, range: Range): boolean {
  const blockTags = ['P', 'LI', 'DIV'];
  const getBlockAncestor = (node: Node): HTMLElement | null => {
    let current: Node | null = node;
    while (current && current !== root) {
      if (
        current.nodeType === Node.ELEMENT_NODE &&
        blockTags.includes((current as Element).tagName)
      ) {
        return current as HTMLElement;
      }
      current = current.parentNode;
    }
    return null;
  };
  const startBlock = getBlockAncestor(range.startContainer);
  const endBlock = getBlockAncestor(range.endContainer);
  return !!startBlock && !!endBlock && startBlock !== endBlock;
}

function positionCursorInEmptyParagraph(
  selectionService: SelectionService,
  paragraph: HTMLParagraphElement,
): void {
  const selection = selectionService.getCurrentSelection();
  if (selection && paragraph.firstChild) {
    const range = selectionService.createRange();
    range.setStart(paragraph.firstChild, paragraph.firstChild.textContent?.length || 0); // After the zero-width space
    range.collapse(true);
    selectionService.setSelectionRange(range);
  }
}

function getCursorOffsetInParagraph(
  selectionService: SelectionService,
  paragraph: HTMLParagraphElement,
  range: Range,
): number {
  const walker = selectionService.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT, null);

  let offset = 0;
  let node: Text | null;

  while ((node = walker.nextNode() as Text)) {
    if (node === range.startContainer) {
      return offset + range.startOffset;
    }
    offset += node.textContent?.length || 0;
  }

  return offset;
}

function cleanZeroWidthSpaces(html: string): string {
  return html.replace(ZERO_WIDTH_SPACE_REGEX, '');
}

function cleanEmptyTags(html: string): string {
  return html.replace(EMPTY_TAG_REGEX, '');
}

function cleanHtml(html: string) {
  return cleanEmptyTags(cleanZeroWidthSpaces(html));
}

export const safelySetHtml = (element: HTMLElement, html: string | Node): void => {
  element.innerHTML = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
};

export const safelyGetHtml = (element: HTMLElement | null): string => {
  if (!element) {
    return '';
  }
  return DOMPurify.sanitize(element.innerHTML, DOMPURIFY_CONFIG);
};

export default {
  cleanHtml,
  findClosestAncestor,
  getCursorOffsetInParagraph,
  isEditorInRange,
  isEmptyContent,
  isRangeAcrossBlocks,
  positionCursorInEmptyParagraph,
  safelyGetHtml,
  safelySetHtml,
  stripFormatting,
};
