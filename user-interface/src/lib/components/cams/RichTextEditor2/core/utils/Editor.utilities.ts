import DOMPurify from 'dompurify';
import {
  DOMPURIFY_CONFIG,
  ZERO_WIDTH_SPACE,
  ZERO_WIDTH_SPACE_REGEX,
  EMPTY_TAG_REGEX,
} from '../../RichTextEditor.constants';

/**
 * Cleans HTML content using DOMPurify with the configured settings
 * @param html - The HTML string to clean
 * @returns Sanitized HTML string
 */
export function cleanHtml(html: string | null | undefined): string {
  // Handle null, undefined, or non-string inputs
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Sanitize the HTML using DOMPurify with our configuration
  const cleaned = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);

  // Remove empty tags that might have been left behind
  return cleaned.replace(EMPTY_TAG_REGEX, '');
}

/**
 * Safely gets HTML content from an element, handling null/undefined cases
 * @param element - The HTML element to get content from
 * @returns The innerHTML of the element or empty string if element is null/undefined
 */
export function safelyGetHtml(element: HTMLElement | null | undefined): string {
  if (!element) {
    return '';
  }

  try {
    return element.innerHTML || '';
  } catch (error) {
    console.warn('Error getting HTML content:', error);
    return '';
  }
}

/**
 * Safely sets HTML content on an element, handling null/undefined cases and sanitizing content
 * @param element - The HTML element to set content on
 * @param html - The HTML string to set
 */
export function safelySetHtml(element: HTMLElement | null | undefined, html: string): void {
  if (!element) {
    return;
  }

  try {
    element.innerHTML = cleanHtml(html);
  } catch (error) {
    console.warn('Error setting HTML content:', error);
  }
}

/**
 * Checks if the content is empty or contains only whitespace/zero-width spaces
 * @param content - The content to check (can be HTML string or text content)
 * @returns True if the content is considered empty
 */
export function isEmptyContent(content: string | null | undefined): boolean {
  // Handle null, undefined, or non-string inputs
  if (!content || typeof content !== 'string') {
    return true;
  }

  // Remove zero-width spaces
  const cleaned = content.replace(ZERO_WIDTH_SPACE_REGEX, '');

  // Remove HTML tags and get text content
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = cleaned;
  const textContent = tempDiv.textContent || tempDiv.innerText || '';

  // Check if the remaining text content is empty or only whitespace
  return textContent.trim().length === 0;
}

/**
 * Checks if an HTML element contains only empty content
 * @param element - The HTML element to check
 * @returns True if the element is considered empty
 */
export function isElementEmpty(element: HTMLElement | null | undefined): boolean {
  if (!element) {
    return true;
  }

  const html = safelyGetHtml(element);
  return isEmptyContent(html);
}

/**
 * Normalizes HTML content by ensuring proper paragraph structure and handling empty content
 * @param html - The HTML string to normalize
 * @returns Normalized HTML string
 */
export function normalizeHtml(html: string): string {
  if (isEmptyContent(html)) {
    // Return a paragraph with zero-width space for empty content
    return `<p>${ZERO_WIDTH_SPACE}</p>`;
  }

  let normalized = cleanHtml(html);

  // If the content doesn't start with a block element, wrap it in a paragraph
  // TODO: Move regex to the constants file
  const blockElementRegex = /^\s*<(p|div|h[1-6]|ul|ol|li|blockquote)/i;
  if (!blockElementRegex.test(normalized)) {
    normalized = `<p>${normalized}</p>`;
  }

  return normalized;
}

/**
 * Extracts plain text from HTML content
 * @param html - The HTML string to extract text from
 * @returns Plain text content
 */
export function extractTextFromHtml(html: string | null | undefined): string {
  // Handle null, undefined, or non-string inputs
  if (!html || typeof html !== 'string') {
    return '';
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = cleanHtml(html);
  const textContent = tempDiv.textContent || tempDiv.innerText || '';

  // Remove zero-width spaces from the text content
  return textContent.replace(ZERO_WIDTH_SPACE_REGEX, '');
}

/**
 * Checks if a string contains only zero-width spaces
 * @param content - The content to check
 * @returns True if content contains only zero-width spaces
 */
export function isOnlyZeroWidthSpaces(content: string | null | undefined): boolean {
  // Handle null, undefined, or non-string inputs
  if (!content || typeof content !== 'string') {
    return false;
  }

  const withoutZws = content.replace(ZERO_WIDTH_SPACE_REGEX, '');
  return withoutZws.length === 0 && content.length > 0;
}

// Export all utilities as a single object for easier importing
export const editorUtilities = {
  cleanHtml,
  safelyGetHtml,
  safelySetHtml,
  isEmptyContent,
  isElementEmpty,
  normalizeHtml,
  extractTextFromHtml,
  isOnlyZeroWidthSpaces,
};
