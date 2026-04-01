'use strict';

// Prototype pollution guard: never copy these keys onto a result object.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Returns a new object excluding the specified keys.
 * Does not mutate the original.
 */
function omit(object, keys) {
  const keySet = new Set(keys);
  const result = {};
  for (const key of Object.keys(object)) {
    if (UNSAFE_KEYS.has(key)) continue;
    if (!keySet.has(key)) {
      result[key] = object[key];
    }
  }
  return result;
}

module.exports = omit;
