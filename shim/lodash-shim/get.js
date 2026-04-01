'use strict';

// Prototype pollution guard: traversing these path segments is never safe.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Gets the value at a dot-notation path of object.
 * Returns defaultValue if the path does not resolve or contains unsafe segments.
 *
 * Only dot notation is supported ('a.b.c') — bracket notation is not needed
 * by any caller in this project.
 */
function get(object, path, defaultValue) {
  if (object === null || object === undefined) return defaultValue;

  const parts = String(path).split('.').filter(Boolean);

  let current = object;
  for (let i = 0; i < parts.length; i++) {
    if (UNSAFE_KEYS.has(parts[i])) return defaultValue;
    if (current == null) return defaultValue;
    current = current[parts[i]];
  }
  return current === undefined ? defaultValue : current;
}

module.exports = get;
