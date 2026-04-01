'use strict';

/**
 * Returns an array of unique values present in all given arrays.
 * Order is determined by the first array.
 */
function intersection(...arrays) {
  if (arrays.length === 0) return [];
  const [first, ...rest] = arrays;
  const sets = rest.map((arr) => new Set(arr));
  const seen = new Set();
  const result = [];
  for (const val of first) {
    if (!seen.has(val) && sets.every((s) => s.has(val))) {
      result.push(val);
      seen.add(val);
    }
  }
  return result;
}

module.exports = intersection;
