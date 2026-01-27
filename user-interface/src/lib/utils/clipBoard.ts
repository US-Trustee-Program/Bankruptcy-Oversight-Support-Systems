export function copyStringToClipboard(str: string): void {
  try {
    navigator.clipboard.writeText(str);
  } catch (_e) {
    // Silently fail - clipboard API may be unavailable or reject (non-HTTPS, older browsers, etc.)
  }
}

/**
 * Copies an HTMLElement's content to the clipboard with both HTML and plain text formats.
 * Core utility that operates directly on an element.
 *
 * @param element - The HTMLElement to copy
 * @param options - Configuration options
 * @param options.inner - If true, copies innerHTML; if false, copies outerHTML (default: true)
 */
export async function copyElementHTMLToClipboard(
  element: HTMLElement,
  { inner = true }: { inner?: boolean } = {},
): Promise<void> {
  try {
    // Get the HTML and plain text versions
    const htmlContent = inner ? element.innerHTML : element.outerHTML;
    const plainText = element.innerText;

    // Convert content to Blobs
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    const textBlob = new Blob([plainText], { type: 'text/plain' });

    // Create the ClipboardItem
    // Providing both types allows the pasting application to choose (e.g., Word uses HTML, Notepad uses Text)
    const data = [
      new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      }),
    ];

    await navigator.clipboard.write(data);
  } catch (_e) {
    // Silently fail - clipboard API may be unavailable or reject (non-HTTPS, older browsers, etc.)
  }
}

/**
 * Convenience wrapper that finds an element by class name and copies its content to clipboard.
 *
 * @param className - The class name to search for (without the leading dot)
 * @param options - Configuration options
 * @param options.inner - If true, copies innerHTML; if false, copies outerHTML (default: true)
 */
export async function copyHTMLToClipboard(
  className: string,
  options: { inner?: boolean } = {},
): Promise<void> {
  const element = document.querySelector<HTMLElement>(`.${className}`);
  if (!element) return;

  await copyElementHTMLToClipboard(element, options);
}
