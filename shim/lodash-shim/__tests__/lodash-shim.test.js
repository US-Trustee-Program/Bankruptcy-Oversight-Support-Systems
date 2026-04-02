/**
 * Tests for lodash-shim — native JS replacements for lodash functions.
 *
 * Tests cover:
 * - Each individual module (require('lodash/fn') style)
 * - The aggregate index (require('lodash') style)
 * - Specific caller patterns from @okta/okta-sdk-nodejs and node-jose
 */

const clone = require('../clone');
const uniq = require('../uniq');
const partialRight = require('../partialRight');
const merge = require('../merge');
const mergeWith = require('../mergeWith');
const omit = require('../omit');
const pick = require('../pick');
const assign = require('../assign');
const flatten = require('../flatten');
const intersection = require('../intersection');
const fill = require('../fill');
const get = require('../get');
const _ = require('../index');

// ---------------------------------------------------------------------------
// clone
// ---------------------------------------------------------------------------

test('clone: returns primitives as-is', () => {
  expect(clone(42)).toBe(42);
  expect(clone('hello')).toBe('hello');
  expect(clone(true)).toBe(true);
  expect(clone(null)).toBe(null);
  expect(clone(undefined)).toBe(undefined);
});

test('clone: shallow-copies arrays', () => {
  const arr = [1, 2, 3];
  const result = clone(arr);
  expect(result).toEqual([1, 2, 3]);
  expect(result).not.toBe(arr);
  // shallow: nested array is same reference
  const nested = [[1]];
  const clonedNested = clone(nested);
  expect(clonedNested[0]).toBe(nested[0]);
});

test('clone: copies Buffer by value', () => {
  const buf = Buffer.from([1, 2, 3]);
  const result = clone(buf);
  expect(Buffer.isBuffer(result)).toBe(true);
  expect(result).toEqual(buf);
  expect(result).not.toBe(buf);
});

test('clone: shallow-copies plain objects', () => {
  const obj = { a: 1, b: { c: 2 } };
  const result = clone(obj);
  expect(result).toEqual(obj);
  expect(result).not.toBe(obj);
  // shallow: nested object is same reference
  expect(result.b).toBe(obj.b);
});

test('clone: preserves prototype chain', () => {
  class Foo {
    bar() {
      return 'bar';
    }
  }
  const instance = new Foo();
  instance.x = 42;
  const result = clone(instance);
  expect(result).toBeInstanceOf(Foo);
  expect(result.x).toBe(42);
  expect(result.bar()).toBe('bar');
});

// ---------------------------------------------------------------------------
// uniq
// ---------------------------------------------------------------------------

test('uniq: removes duplicate primitives, preserves order', () => {
  expect(uniq([1, 2, 1, 3, 2])).toEqual([1, 2, 3]);
});

test('uniq: empty array returns empty array', () => {
  expect(uniq([])).toEqual([]);
});

test('uniq: no duplicates returns new array with same values', () => {
  const arr = [1, 2, 3];
  const result = uniq(arr);
  expect(result).toEqual([1, 2, 3]);
  expect(result).not.toBe(arr);
});

test('uniq: deduplicates strings', () => {
  expect(uniq(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
});

// ---------------------------------------------------------------------------
// partialRight
// ---------------------------------------------------------------------------

test('partialRight: appends right args to call', () => {
  const divide = (a, b) => a / b;
  const divideBy2 = partialRight(divide, 2);
  expect(divideBy2(10)).toBe(5);
});

test('partialRight: works with multiple right args', () => {
  const fn = (a, b, c) => `${a}-${b}-${c}`;
  const withBC = partialRight(fn, 'b', 'c');
  expect(withBC('a')).toBe('a-b-c');
});

test('partialRight: left args come before right args', () => {
  const fn = (...args) => args;
  const withRight = partialRight(fn, 'r1', 'r2');
  expect(withRight('l1', 'l2')).toEqual(['l1', 'l2', 'r1', 'r2']);
});

// ---------------------------------------------------------------------------
// merge
// ---------------------------------------------------------------------------

test('merge: deeply merges two plain objects', () => {
  const dest = { a: 1, b: { c: 2 } };
  const src = { b: { d: 3 }, e: 4 };
  const result = merge(dest, src);
  expect(result).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 4 });
});

test('merge: mutates and returns dest', () => {
  const dest = { a: 1 };
  const src = { b: 2 };
  const result = merge(dest, src);
  expect(result).toBe(dest);
  expect(dest).toEqual({ a: 1, b: 2 });
});

test('merge: src array overwrites dest value at key', () => {
  const dest = { a: [1, 2] };
  const src = { a: [3, 4, 5] };
  const result = merge(dest, src);
  // lodash merge merges arrays by index; we replicate that for the node-jose use case
  expect(result.a).toEqual([3, 4, 5]);
});

test('merge: customizer can override default behavior', () => {
  const dest = { a: 'hello', b: [1, 2] };
  const src = { a: ['x', 'y'], b: 'world' };
  // Mimics the okta customizer: if dest is string and src is array, join src
  const result = merge(dest, src, (d, s) => {
    if (typeof d === 'string' && Array.isArray(s)) return s.join(' ');
  });
  expect(result.a).toBe('x y');
  // b: dest is array, customizer returns undefined → default merge
  expect(result.b).toEqual('world');
});

test('merge: prototype pollution protection — __proto__', () => {
  const payload = JSON.parse('{"__proto__": {"polluted": true}}');
  const dest = {};
  merge(dest, payload);
  expect({}.polluted).toBeUndefined();
});

test('merge: prototype pollution protection — constructor', () => {
  const payload = JSON.parse('{"constructor": {"prototype": {"polluted": true}}}');
  const dest = {};
  merge(dest, payload);
  expect({}.polluted).toBeUndefined();
});

test('merge: null/undefined dest is a no-op and returns dest', () => {
  expect(merge(null, { a: 1 })).toBeNull();
  expect(merge(undefined, { a: 1 })).toBeUndefined();
});

test('merge: null/non-object sources are safely ignored', () => {
  expect(merge({}, null)).toEqual({});
  expect(merge({}, undefined)).toEqual({});
  expect(merge({}, 42)).toEqual({});
});

test('merge: single function arg is not invoked as a customizer', () => {
  let called = false;
  const fn = () => {
    called = true;
  };
  const dest = { a: 1 };
  merge(dest, fn);
  expect(called).toBe(false);
  expect(dest).toEqual({ a: 1 });
});

// ---------------------------------------------------------------------------
// mergeWith (same implementation as merge with customizer)
// ---------------------------------------------------------------------------

test('mergeWith: deeply merges without customizer', () => {
  const dest = { x: { y: 1 } };
  const src = { x: { z: 2 } };
  expect(mergeWith(dest, src)).toEqual({ x: { y: 1, z: 2 } });
});

test('mergeWith: okta pattern — customizer joining arrays to string', () => {
  // Replicates @okta/okta-sdk-nodejs config-loader.js usage
  const dest = { scopes: 'openid', timeout: 3000 };
  const src = { scopes: ['openid', 'profile', 'email'], timeout: 5000 };
  mergeWith(dest, src, (d, s) => {
    if (typeof d !== 'string') return undefined;
    if (Array.isArray(s)) return s.join(' ');
    if (typeof s === 'object' && s !== null) return JSON.stringify(s);
    return undefined;
  });
  expect(dest.scopes).toBe('openid profile email');
  expect(dest.timeout).toBe(5000);
});

test('mergeWith: prototype pollution protection', () => {
  const payload = JSON.parse('{"__proto__": {"evil": true}}');
  mergeWith({}, payload, () => undefined);
  expect({}.evil).toBeUndefined();
});

// ---------------------------------------------------------------------------
// omit
// ---------------------------------------------------------------------------

test('omit: removes specified keys', () => {
  const obj = { a: 1, b: 2, c: 3 };
  expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 });
});

test('omit: handles missing keys gracefully', () => {
  const obj = { a: 1 };
  expect(omit(obj, ['z'])).toEqual({ a: 1 });
});

test('omit: does not mutate original', () => {
  const obj = { a: 1, b: 2 };
  omit(obj, ['a']);
  expect(obj).toEqual({ a: 1, b: 2 });
});

test('omit: removes multiple keys', () => {
  const obj = { a: 1, b: 2, c: 3 };
  expect(omit(obj, ['a', 'c'])).toEqual({ b: 2 });
});

test('omit: returns empty object for null/undefined input', () => {
  expect(omit(null, ['a'])).toEqual({});
  expect(omit(undefined, ['a'])).toEqual({});
});

// ---------------------------------------------------------------------------
// pick
// ---------------------------------------------------------------------------

test('pick: returns object with only specified keys', () => {
  const obj = { a: 1, b: 2, c: 3 };
  expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
});

test('pick: handles missing keys gracefully', () => {
  const obj = { a: 1 };
  expect(pick(obj, ['a', 'z'])).toEqual({ a: 1 });
});

test('pick: does not mutate original', () => {
  const obj = { a: 1, b: 2 };
  pick(obj, ['a']);
  expect(obj).toEqual({ a: 1, b: 2 });
});

// ---------------------------------------------------------------------------
// assign
// ---------------------------------------------------------------------------

test('assign: shallow assigns from one source', () => {
  const result = assign({ a: 1 }, { b: 2 });
  expect(result).toEqual({ a: 1, b: 2 });
});

test('assign: mutates and returns dest', () => {
  const dest = { a: 1 };
  const result = assign(dest, { b: 2 });
  expect(result).toBe(dest);
});

test('assign: later sources overwrite earlier keys', () => {
  const result = assign({ a: 1 }, { a: 2, b: 3 }, { b: 4 });
  expect(result).toEqual({ a: 2, b: 4 });
});

test('assign: shallow — nested objects are references', () => {
  const nested = { x: 1 };
  const result = assign({}, { nested });
  expect(result.nested).toBe(nested);
});

// ---------------------------------------------------------------------------
// flatten
// ---------------------------------------------------------------------------

test('flatten: flattens one level deep', () => {
  expect(flatten([1, [2, 3], [4]])).toEqual([1, 2, 3, 4]);
});

test('flatten: does not flatten more than one level', () => {
  expect(flatten([1, [2, [3]]])).toEqual([1, 2, [3]]);
});

test('flatten: empty array returns empty array', () => {
  expect(flatten([])).toEqual([]);
});

// ---------------------------------------------------------------------------
// intersection
// ---------------------------------------------------------------------------

test('intersection: returns common elements', () => {
  expect(intersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3]);
});

test('intersection: returns unique elements only', () => {
  expect(intersection([1, 1, 2], [1, 2])).toEqual([1, 2]);
});

test('intersection: empty when no common elements', () => {
  expect(intersection([1, 2], [3, 4])).toEqual([]);
});

// ---------------------------------------------------------------------------
// fill
// ---------------------------------------------------------------------------

test('fill: fills entire array with value', () => {
  expect(fill([1, 2, 3], 0)).toEqual([0, 0, 0]);
});

test('fill: fills from start index', () => {
  expect(fill([1, 2, 3, 4], 0, 1)).toEqual([1, 0, 0, 0]);
});

test('fill: fills from start to end (exclusive)', () => {
  expect(fill([1, 2, 3, 4], 0, 1, 3)).toEqual([1, 0, 0, 4]);
});

test('fill: mutates the original array', () => {
  const arr = [1, 2, 3];
  fill(arr, 9);
  expect(arr).toEqual([9, 9, 9]);
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

test('get: simple dot path', () => {
  expect(get({ a: { b: 1 } }, 'a.b')).toBe(1);
});

test('get: returns undefined for missing path', () => {
  expect(get({ a: 1 }, 'a.b.c')).toBeUndefined();
});

test('get: okta pattern — _links.self.href', () => {
  const body = { _links: { self: { href: 'https://example.com' } } };
  expect(get(body, '_links.self.href')).toBe('https://example.com');
});

test('get: returns undefined on null/undefined root', () => {
  expect(get(null, 'a.b')).toBeUndefined();
  expect(get(undefined, 'a.b')).toBeUndefined();
});

test('get: returns defaultValue when path does not resolve', () => {
  expect(get({ a: 1 }, 'a.b.c', 'default')).toBe('default');
  expect(get({}, 'missing', 42)).toBe(42);
  expect(get(null, 'a', 'fallback')).toBe('fallback');
});

// ---------------------------------------------------------------------------
// Security: prototype pollution guards
// ---------------------------------------------------------------------------

test('omit: skips __proto__ key to prevent prototype pollution', () => {
  const obj = { a: 1 };
  omit(obj, ['__proto__']);
  expect(Object.prototype.polluted).toBeUndefined();
});

test('omit: does not copy unsafe keys from input object', () => {
  const parsed = JSON.parse('{"__proto__": {"polluted": true}, "a": 1}');
  const result = omit(parsed, []);
  expect({}.polluted).toBeUndefined();
  expect(result).toEqual({ a: 1 });
});

test('omit: does not copy constructor or prototype keys from input object', () => {
  const parsed = JSON.parse('{"constructor": {"evil": true}, "prototype": {"evil": true}, "b": 2}');
  const result = omit(parsed, []);
  expect(result).toEqual({ b: 2 });
});

test('merge: skips prototype key to prevent prototype pollution', () => {
  const dest = {};
  merge(dest, { prototype: { polluted: true } });
  expect({}.polluted).toBeUndefined();
});

test('get: returns undefined for __proto__ path traversal', () => {
  const obj = {};
  expect(get(obj, '__proto__.polluted')).toBeUndefined();
  expect(get(obj, 'a.__proto__.b')).toBeUndefined();
});

// ---------------------------------------------------------------------------
// index.js aggregate export
// ---------------------------------------------------------------------------

test('index.js exports all functions', () => {
  expect(typeof _.clone).toBe('function');
  expect(typeof _.uniq).toBe('function');
  expect(typeof _.partialRight).toBe('function');
  expect(typeof _.merge).toBe('function');
  expect(typeof _.mergeWith).toBe('function');
  expect(typeof _.omit).toBe('function');
  expect(typeof _.pick).toBe('function');
  expect(typeof _.assign).toBe('function');
  expect(typeof _.flatten).toBe('function');
  expect(typeof _.intersection).toBe('function');
  expect(typeof _.fill).toBe('function');
  expect(typeof _.get).toBe('function');
});

test('index.js functions work (spot check)', () => {
  expect(_.get({ a: 1 }, 'a')).toBe(1);
  expect(_.uniq([1, 1, 2])).toEqual([1, 2]);
});

// ---------------------------------------------------------------------------
// node-jose partialRight(merge, mergeBuffer) pattern
// ---------------------------------------------------------------------------

test('merge: node-jose pattern — partialRight with mergeBuffer appended as last arg', () => {
  // Simulates what node-jose/lib/jwk/basekey.js does:
  // const mergeUtil = partialRight(merge, mergeBuffer)
  // mergeUtil(result, json.base, json.public, json.private, json.extra)
  const mergeBuffer = (a, b) => (Buffer.isBuffer(b) ? Buffer.from(b) : undefined);
  const mergeUtil = partialRight(merge, mergeBuffer);

  const result = {};
  const base = { kty: 'RSA', kid: 'key-1' };
  const pub = { n: 'modulus', e: 'exponent' };
  const priv = { d: 'private-exp' };
  const extra = { use: 'sig' };

  mergeUtil(result, base, pub, priv, extra);

  expect(result.kty).toBe('RSA');
  expect(result.kid).toBe('key-1');
  expect(result.n).toBe('modulus'); // from json.public — currently DROPPED
  expect(result.e).toBe('exponent'); // from json.public — currently DROPPED
  expect(result.d).toBe('private-exp'); // from json.private — currently DROPPED
  expect(result.use).toBe('sig'); // from json.extra — currently DROPPED
});

test('node-jose pattern: partialRight(merge, customizer) produces working merge', () => {
  // Simulates: module.exports = partialRight(merge, mergeBuffer)
  // where mergeBuffer handles Buffer/TypedArray merging
  const mergeBuffer = (dest, src) => {
    if (Buffer.isBuffer(src) || src instanceof Uint8Array) {
      return Buffer.isBuffer(src) ? Buffer.from(src) : src.slice();
    }
    return undefined; // fall through to default
  };

  const mergeWithBuffer = partialRight(merge, mergeBuffer);

  const buf = Buffer.from([1, 2, 3]);
  const dest = { data: null, name: 'test' };
  const src = { data: buf, name: 'updated' };

  mergeWithBuffer(dest, src);

  expect(dest.name).toBe('updated');
  expect(Buffer.isBuffer(dest.data)).toBe(true);
  expect(dest.data).toEqual(buf);
  expect(dest.data).not.toBe(buf); // copied by customizer
});
