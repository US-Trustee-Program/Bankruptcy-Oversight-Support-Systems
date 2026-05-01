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
