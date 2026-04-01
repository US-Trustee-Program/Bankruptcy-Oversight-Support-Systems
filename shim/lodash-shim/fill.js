'use strict';

/**
 * Fills elements of array with value from start up to (but not including) end.
 * Mutates and returns the array.
 * Equivalent to Array.prototype.fill.
 */
function fill(array, value, start, end) {
  return array.fill(value, start, end);
}

module.exports = fill;
