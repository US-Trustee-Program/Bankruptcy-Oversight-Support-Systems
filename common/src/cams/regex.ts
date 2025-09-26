export function escapeRegExCharacters(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const EMAIL_REGEX =
  /^(?:[a-z0-9+_-]+(?:\.[a-z0-9+_-]+)*)@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/i;

export const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;
export const EXTENSION_REGEX = /^\d{1,6}$/;

export const ZIP_REGEX = /^(\d{5}|\d{5}-\d{4})$/;

export const WEBSITE_REGEX =
  /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}(?:\/[-a-zA-Z0-9()@:%_+.~#?&=/]*)?$/;

// Relaxed website regex that allows URLs without protocols for client-side validation
export const WEBSITE_RELAXED_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}(?:\/[-a-zA-Z0-9()@:%_+.~#?&=/]*)?$/;

/**
 * Normalizes a website URL by adding https:// protocol if it doesn't exist
 * @param url - The URL to normalize
 * @returns The normalized URL with protocol, or empty string if input was empty/invalid
 */
export function normalizeWebsiteUrl(url: string | undefined): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return '';
  }

  // If it already has a protocol, return as-is
  if (/^https?:\/\//.test(trimmedUrl)) {
    return trimmedUrl;
  }

  return `https://${trimmedUrl}`;
}
