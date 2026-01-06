export interface ParsedPhone {
  number: string;
  extension?: string;
}

/**
 * Parses a phone number string that may include an extension.
 * Handles various formats like "x123", "ext 123", "extension 123", etc.
 *
 * @param phone - The phone number string to parse
 * @returns Object with formatted number and optional extension
 *
 * @example
 * parsePhoneNumber('229.606.8381 x7478') // returns { number: '229-606-8381', extension: '7478' }
 * parsePhoneNumber('500-831-6978 ext. 123') // returns { number: '500-831-6978', extension: '123' }
 * parsePhoneNumber('5008316978') // returns { number: '500-831-6978' }
 */
export function parsePhoneNumber(phone: string): ParsedPhone {
  if (!phone) {
    return { number: phone };
  }

  // Split on common extension indicators (case-insensitive)
  // Matches: x, ext, ext., extension followed by optional colon/period and spaces
  const extensionPattern = /\s*[x]|ext\.?|extension[:.]?\s*/i;
  const parts = phone.split(extensionPattern);

  // Extract the base number (first part)
  const baseNumber = parts[0]?.trim() || '';

  // Extract extension if it exists (last part after split)
  const extensionPart = parts.length > 1 ? parts[parts.length - 1]?.trim() : '';

  // Format the base number
  const digitsOnly = baseNumber.replace(/\D/g, '');
  let formattedNumber = baseNumber;

  if (digitsOnly.length === 10) {
    formattedNumber = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }

  // Extract digits from extension
  const extensionDigits = extensionPart.replace(/\D/g, '');

  return {
    number: formattedNumber,
    extension: extensionDigits || undefined,
  };
}

/**
 * Formats a phone number string to match the expected format: 000-000-0000
 * Strips all non-digit characters and reformats if the result is 10 digits.
 * Returns the original string if it doesn't have exactly 10 digits.
 * Note: This function does not handle extensions. Use parsePhoneNumber() for that.
 *
 * @param phone - The phone number string to format
 * @returns Formatted phone number in 000-000-0000 format, or original string if not 10 digits
 *
 * @example
 * formatPhoneNumber('5008316978') // returns '500-831-6978'
 * formatPhoneNumber('500.831.6978') // returns '500-831-6978'
 * formatPhoneNumber('(500) 831-6978') // returns '500-831-6978'
 * formatPhoneNumber('123') // returns '123' (not 10 digits)
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) {
    return phone;
  }

  const digitsOnly = phone.replace(/\D/g, '');

  if (digitsOnly.length === 10) {
    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }

  return phone;
}
