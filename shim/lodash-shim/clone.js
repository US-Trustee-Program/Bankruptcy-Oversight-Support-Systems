'use strict';

/**
 * Shallow clone of value.
 * - Primitives and null are returned as-is.
 * - Buffers are copied via Buffer.from.
 * - Arrays are sliced (shallow copy).
 * - Objects are copied with Object.assign, preserving prototype.
 *
 * Does NOT use structuredClone — it drops prototypes and fails on crypto material.
 */
function clone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (Array.isArray(value)) return value.slice();
  return Object.assign(Object.create(Object.getPrototypeOf(value)), value);
}

module.exports = clone;
