export function escapeRegExCharacters(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const EMAIL_REGEX =
  /^(?:[a-z0-9+_-]+(?:\.[a-z0-9+_-]+)*)@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/i;

export const PHONE_REGEX =
  /^[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*$/;

export const EXTENSION_REGEX = /^\d{1,6}$/;
