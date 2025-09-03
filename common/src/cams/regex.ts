export function escapeRegExCharacters(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const EMAIL_REGEX =
  /^(?:[a-z0-9+_-]+(?:\.[a-z0-9+_-]+)*)@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/i;

export const PHONE_REGEX =
  /^[\s().\-+]*(1)?[\s().\-+]*(\d{3})[\s().\-+]*(\d{3})[\s().\-+]*(\d{4})[\s().\-+]*$/;
export const EXTENSION_REGEX = /^\d{1,6}$/;

export const ZIP_REGEX = /^(\d{5}|\d{5}-\d{4})$/;
