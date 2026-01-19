/**
 * Normalizes a value by converting null, undefined, or empty objects to undefined.
 * This ensures consistent representation of "no value" as undefined rather than null or {}.
 *
 * **Important limitations:**
 * - This function treats ANY object with zero enumerable own properties as empty (returns undefined)
 * - Only checks enumerable properties via `Object.keys()`, so objects with non-enumerable properties
 *   or prototype state may be treated as empty unexpectedly
 * - Intended for plain data objects (POJOs) like those from JSON serialization or form data
 * - Not suitable for class instances, objects with getters/setters, or objects relying on prototype chains
 *
 * @param value - The value to normalize
 * @returns The normalized value (undefined if null, undefined, or empty object; otherwise the original value)
 *
 * @example
 * normalizeForUndefined(null) // undefined
 * normalizeForUndefined({}) // undefined
 * normalizeForUndefined({ name: 'John' }) // { name: 'John' }
 * normalizeForUndefined([]) // [] (arrays are not converted)
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
