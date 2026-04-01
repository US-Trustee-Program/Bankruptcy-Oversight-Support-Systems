'use strict';

/**
 * Creates a function that invokes fn with rightArgs appended after any provided args.
 *
 * partialRight(fn, r1, r2)(...leftArgs) === fn(...leftArgs, r1, r2)
 */
function partialRight(fn, ...rightArgs) {
  return function (...leftArgs) {
    return fn.apply(this, [...leftArgs, ...rightArgs]);
  };
}

module.exports = partialRight;
