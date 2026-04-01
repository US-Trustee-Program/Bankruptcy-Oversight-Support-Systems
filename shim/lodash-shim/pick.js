'use strict';

/**
 * Returns a new object with only the specified keys.
 * Keys that don't exist on the source object are silently ignored.
 * Does not mutate the original.
 */
function pick(object, keys) {
  const result = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      result[key] = object[key];
    }
  }
  return result;
}

module.exports = pick;
