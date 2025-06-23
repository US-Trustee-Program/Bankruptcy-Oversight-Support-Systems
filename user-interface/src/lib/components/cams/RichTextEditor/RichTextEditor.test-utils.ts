import {
  safelyGetHtml,
  safelySetHtml,
} from '@/lib/components/cams/RichTextEditor/Editor.utilities';
import { MockSelectionService } from '@/lib/components/cams/RichTextEditor/SelectionService.humble';

export const safelySetTestHtml = (element: HTMLElement, html: string): void => {
  safelySetHtml(element, html);
};

export const safelyGetTestHtml = (element: HTMLElement): string => {
  return safelyGetHtml(element);
};
// TODO: Reconcile the setCursorInParagraph and setCursorInParagraph functions into a single function.
export function setCursorInParagraph(
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
