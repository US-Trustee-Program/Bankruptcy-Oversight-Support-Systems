export function copyStringToClipboard(str: string): void {
  try {
    navigator.clipboard.writeText(str);
  } catch (_e) {
    // Silently fail - clipboard API may be unavailable or reject (non-HTTPS, older browsers, etc.)
  }
}

export async function copyHTMLToClipboard(className: string, inner: boolean = true): Promise<void> {
  const element = document.querySelector<HTMLElement>(`.${className}`);
  if (!element) return;

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
