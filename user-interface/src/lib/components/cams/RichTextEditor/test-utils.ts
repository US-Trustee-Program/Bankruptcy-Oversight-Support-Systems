import { CONTENT_INPUT_SELECTOR } from './editor.constants';
import { safelyGetHtml, safelySetHtml } from '@/lib/components/cams/RichTextEditor/utilities';

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

export const createTestEvent = <T extends keyof WindowEventMap>(
  eventType: T,
  options: Partial<WindowEventMap[T]> = {},
): WindowEventMap[T] => {
  return new Event(eventType, { bubbles: true, cancelable: true, ...options }) as WindowEventMap[T];
};
