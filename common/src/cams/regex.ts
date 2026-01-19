export function escapeRegExCharacters(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const EMAIL_REGEX =
  /^(?:[a-z0-9+_-]+(?:\.[a-z0-9+_-]+)*)@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/i;

// Matches phone numbers with optional country code (1-) and optional extension
// Examples: 123-456-7890, 1-123-456-7890, 123-456-7890 x123, 1-123-456-7890 ext. 12345
export const PHONE_REGEX =
  /^(?:1-)?\d{3}-\d{3}-\d{4}(?:\s+(?:x|ext\.?|extension[:.]?)\s*\d{1,6})?$/i;
export const EXTENSION_REGEX = /^\d{1,6}$/;

// Matches Zoom meeting IDs (9 to 11 digits)
export const ZOOM_MEETING_ID_REGEX = /^\d{9,11}$/;

export const ZIP_REGEX = /^(\d{5}|\d{5}-\d{4})$/;

export const WEBSITE_REGEX =
  /^https?:\/\/(?:(?!-)[-a-zA-Z0-9]{1,63}(?<!-)\.)+[a-zA-Z]{2,63}(?::\d+)?(?:\/[-a-zA-Z0-9()@:%_+.~#?&=/]*)?$/;

// Relaxed website regex that allows URLs without protocols for client-side validation
export const WEBSITE_RELAXED_REGEX =
  /^(?:https?:\/\/)?(?:(?!-)[-a-zA-Z0-9]{1,63}(?<!-)\.)+[a-zA-Z]{2,63}(?::\d+)?(?:\/[-a-zA-Z0-9()@:%_+.~#?&=/]*)?$/;

export const CASE_NUMBER_REGEX = /^\d{2}-\d{5}$/;

/**
 * Checks if a string contains any protocol pattern (e.g., ftp:, mailto:, etc.)
 * @param str - The string to check
 * @returns true if a protocol pattern is found, false otherwise
 */
function hasProtocol(str: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(str);
}

/**
 * Normalizes a website URL by adding https:// protocol if it doesn't exist
 * @param url - The URL to normalize
 * @returns The normalized URL with protocol, or empty string if input was empty/invalid or has unsupported protocol
 */
export function normalizeWebsiteUrl(url: string | undefined): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return '';
  }

  // Check if it starts with exactly http:// or https:// (and nothing else before it)
  if (/^https?:\/\//.test(trimmedUrl)) {
    // Additional validation: ensure there are no other protocols embedded after http://
    // Look for any other protocol patterns after the initial http(s)://
    const afterProtocol = trimmedUrl.substring(trimmedUrl.indexOf('://') + 3);
    if (hasProtocol(afterProtocol)) {
      // Found another protocol after http://, this is invalid
      return '';
    }
    return trimmedUrl;
  }

  // Check if it has any other protocol at all (e.g., ftp://, mailto:, etc.)
  if (hasProtocol(trimmedUrl)) {
    // Has an unsupported protocol, return empty string to indicate invalid input
    return '';
  }

  // No protocol found, add https://
  return `https://${trimmedUrl}`;
}
