'use strict';

/**
 * Deeply merges one or more source objects into dest (mutates dest, returns dest).
 *
 * Signature: merge(dest, ...sources[, customizer])
 *
 * If the last argument is a function it is treated as the customizer.
 * customizer(destVal, srcVal, key) is called for each key. If it returns a
 * non-undefined value that value is used; otherwise default deep-merge applies.
 *
 * Accepts any number of source objects so that the node-jose call pattern:
 *   merge(result, json.base, json.public, json.private || {}, json.extra)
 * works correctly when mergeBuffer is appended as the last arg via partialRight.
 *
 * Prototype pollution protection: __proto__, constructor, and prototype keys
 * are skipped unconditionally (UNSAFE_KEYS guard).
 */

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function _mergeOne(dest, src, customizer) {
  if (src == null || typeof src !== 'object') return;
  if (dest == null || typeof dest !== 'object') return;

  for (const key of Object.keys(src)) {
    // Prototype pollution guard
    if (UNSAFE_KEYS.has(key)) continue;

    const srcVal = src[key];
    const destVal = dest[key];

    if (typeof customizer === 'function') {
      const result = customizer(destVal, srcVal, key);
      if (result !== undefined) {
        dest[key] = result;
        continue;
      }
    }

    // Default deep merge: recurse into plain objects
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      !Buffer.isBuffer(srcVal) &&
      destVal !== null &&
      typeof destVal === 'object' &&
      !Array.isArray(destVal)
    ) {
      _mergeOne(destVal, srcVal, customizer);
    } else {
      dest[key] = srcVal;
    }
  }
}

function merge(dest, ...args) {
  // Last arg is customizer if it is a function AND there is at least one source
  // before it. Requiring args.length > 1 prevents a lone function argument from
  // being silently swallowed as a customizer instead of merged as a source.
  const lastArg = args[args.length - 1];
  const hasCustomizer = args.length > 1 && typeof lastArg === 'function';
  const sources = hasCustomizer ? args.slice(0, -1) : args;
  const customizer = hasCustomizer ? lastArg : undefined;

  for (const src of sources) {
    _mergeOne(dest, src, customizer);
  }

  return dest;
}

module.exports = merge;
