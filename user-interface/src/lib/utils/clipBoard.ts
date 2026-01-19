export function copyStringToClipboard(str: string): void {
  navigator.clipboard?.writeText(str).catch(() => {
    // Silently fail - clipboard API may be unavailable or reject (non-HTTPS, older browsers, etc.)
  });
}
