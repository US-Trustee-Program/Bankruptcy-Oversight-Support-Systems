/**
 * Case-insensitive string comparison for sorting.
 * Uses locale-aware comparison with base sensitivity.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
export function caseInsensitiveCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

/**
 * Normalize a yes/no string flag to a canonical lowercase value.
 * Trims whitespace and lowercases. Returns undefined when the input is absent.
 *
 * @param value - Raw string value (e.g. 'Y', 'N', ' y ', undefined)
 * @returns 'y', 'n', or undefined
 */
export function parseYesNo(value: string | undefined): 'y' | 'n' | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'y') return 'y';
  if (normalized === 'n') return 'n';
  return undefined;
}
