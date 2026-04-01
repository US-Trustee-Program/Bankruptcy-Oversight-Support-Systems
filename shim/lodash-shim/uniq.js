'use strict';

/**
 * Returns a new array with duplicate values removed, preserving first occurrence order.
 */
function uniq(array) {
  return [...new Set(array)];
}

module.exports = uniq;
