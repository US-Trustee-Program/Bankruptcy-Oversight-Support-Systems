import { CONTENT_INPUT_SELECTOR, DOMPURIFY_CONFIG } from './editor.constants';
import DOMPurify from 'dompurify';

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
  element.innerHTML = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
};

export const safelyGetTestHtml = (element: HTMLElement): string => {
  return DOMPurify.sanitize(element.innerHTML, DOMPURIFY_CONFIG);
};

export const createTestEvent = <T extends keyof WindowEventMap>(
  eventType: T,
  options: Partial<WindowEventMap[T]> = {},
): WindowEventMap[T] => {
  return new Event(eventType, { bubbles: true, cancelable: true, ...options }) as WindowEventMap[T];
};
