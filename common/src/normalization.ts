/**
 * Normalizes a value by converting null, undefined, or empty objects to undefined.
 * This ensures consistent representation of "no value" as undefined rather than null or {}.
 *
 * @param value - The value to normalize
 * @returns The normalized value (undefined if null, undefined, or empty object; otherwise the original value)
 *
 * @example
 * normalizeForUndefined(null) // undefined
 * normalizeForUndefined({}) // undefined
 * normalizeForUndefined({ name: 'John' }) // { name: 'John' }
 */
export function normalizeForUndefined<T>(value: T | null | undefined): T | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
    return undefined;
  }
  return value;
}
