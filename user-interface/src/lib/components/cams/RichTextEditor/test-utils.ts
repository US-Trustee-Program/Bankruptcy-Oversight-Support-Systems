import { CONTENT_INPUT_SELECTOR } from './editor.constants';
import { safelyGetHtml, safelySetHtml } from '@/lib/components/cams/RichTextEditor/utilities';
import { MockSelectionService } from '@/lib/components/cams/RichTextEditor/SelectionService.humble';

export const getEditorContent = (): HTMLElement => {
  const content = document.querySelector<HTMLElement>(CONTENT_INPUT_SELECTOR);
  if (!content) {
    throw new Error('Editor content element not found');
  }
  return content;
};

export const expectEditorContent = (): HTMLElement => {
  const content = getEditorContent();
  expect(content).not.toBeNull();
  return content;
};

export const safelySetTestHtml = (element: HTMLElement, html: string): void => {
  safelySetHtml(element, html);
};

export const safelyGetTestHtml = (element: HTMLElement): string => {
  return safelyGetHtml(element);
};
// TODO: Reconcile the setCursorInParagraph and setCursorInParagraph2 functions into a single function.
export function setCursorInParagraph2(
  paragraph: HTMLParagraphElement,
  offset: number,
  selectionService: MockSelectionService,
) {
  const range = selectionService.createRange();
  if (!paragraph.firstChild) {
    paragraph.appendChild(document.createTextNode(''));
  }
  range.setStart(paragraph.firstChild!, offset);
  range.collapse(true);
  selectionService.setSelectionRange(range);
  return selectionService.getCurrentSelection();
}

export function setCursorInParagraph(
  paragraph: HTMLParagraphElement,
  offset: number,
  selectionService: MockSelectionService,
): void {
  const textNode = paragraph.firstChild;
  if (textNode) {
    const range = selectionService.createRange();
    range.setStart(textNode, offset);
    range.collapse(true);
    selectionService.setSelectionRange(range);
  }
}

export function setCursorInElement(
  element: HTMLElement,
  offset: number,
  selectionService: MockSelectionService,
) {
  const range = selectionService.createRange();
  if (!element.firstChild) {
    element.appendChild(document.createTextNode(''));
  }
  range.setStart(element.firstChild!, offset);
  range.collapse(true);
  selectionService.setSelectionRange(range);
  return selectionService.getCurrentSelection();
}
