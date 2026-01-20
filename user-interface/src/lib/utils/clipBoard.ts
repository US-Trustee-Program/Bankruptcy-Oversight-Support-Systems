export function copyStringToClipboard(str: string): void {
  try {
    navigator.clipboard.writeText(str);
  } catch (_e) {
    // Silently fail - clipboard API may be unavailable or reject (non-HTTPS, older browsers, etc.)
  }
}
