'use strict';

/**
 * Assigns own enumerable properties from source objects to dest.
 * Mutates dest and returns it. Later sources overwrite earlier keys.
 * Equivalent to Object.assign.
 */
function assign(dest, ...sources) {
  return Object.assign(dest, ...sources);
}

module.exports = assign;
