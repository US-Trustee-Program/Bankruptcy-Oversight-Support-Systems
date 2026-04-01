'use strict';

/**
 * Flattens array one level deep.
 * Equivalent to Array.prototype.flat(1).
 */
function flatten(array) {
  return array.flat(1);
}

module.exports = flatten;
