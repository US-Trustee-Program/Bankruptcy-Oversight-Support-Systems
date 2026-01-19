import { describe, expect, test } from 'vitest';
import { normalizeForUndefined } from './normalization';

describe('normalizeForUndefined', () => {
  test('should return undefined when value is null', () => {
    expect(normalizeForUndefined(null)).toBeUndefined();
  });

  test('should return undefined when value is undefined', () => {
    expect(normalizeForUndefined(undefined)).toBeUndefined();
  });

  test('should return undefined when value is an empty object', () => {
    expect(normalizeForUndefined({})).toBeUndefined();
  });

  test('should return the original value when it has properties', () => {
    const obj = { name: 'John', age: 30 };
    expect(normalizeForUndefined(obj)).toEqual(obj);
  });

  test('should return the original string value', () => {
    expect(normalizeForUndefined('test')).toBe('test');
  });

  test('should return the original number value', () => {
    expect(normalizeForUndefined(42)).toBe(42);
  });

  test('should return the original boolean value', () => {
    expect(normalizeForUndefined(true)).toBe(true);
    expect(normalizeForUndefined(false)).toBe(false);
  });

  test('should return an empty array as-is (not convert to undefined)', () => {
    const arr: string[] = [];
    expect(normalizeForUndefined(arr)).toEqual([]);
  });

  test('should return a non-empty array as-is', () => {
    const arr = [1, 2, 3];
    expect(normalizeForUndefined(arr)).toEqual(arr);
  });

  test('should handle nested objects', () => {
    const obj = {
      user: { name: 'John' },
      address: { street: '123 Main St' },
    };
    expect(normalizeForUndefined(obj)).toEqual(obj);
  });

  test('should return zero as-is', () => {
    expect(normalizeForUndefined(0)).toBe(0);
  });

  test('should return empty string as-is', () => {
    expect(normalizeForUndefined('')).toBe('');
  });
});
