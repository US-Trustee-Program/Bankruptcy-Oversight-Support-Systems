import { describe, expect, it } from 'vitest';
import { normalizeForUndefined } from './normalization';

describe('normalizeForUndefined', () => {
  it('should return undefined when value is null', () => {
    expect(normalizeForUndefined(null)).toBeUndefined();
  });

  it('should return undefined when value is undefined', () => {
    expect(normalizeForUndefined(undefined)).toBeUndefined();
  });

  it('should return undefined when value is an empty object', () => {
    expect(normalizeForUndefined({})).toBeUndefined();
  });

  it('should return the original value when it has properties', () => {
    const obj = { name: 'John', age: 30 };
    expect(normalizeForUndefined(obj)).toEqual(obj);
  });

  it('should return the original string value', () => {
    expect(normalizeForUndefined('test')).toBe('test');
  });

  it('should return the original number value', () => {
    expect(normalizeForUndefined(42)).toBe(42);
  });

  it('should return the original boolean value', () => {
    expect(normalizeForUndefined(true)).toBe(true);
    expect(normalizeForUndefined(false)).toBe(false);
  });

  it('should return an empty array as-is (not convert to undefined)', () => {
    const arr: string[] = [];
    expect(normalizeForUndefined(arr)).toEqual([]);
  });

  it('should return a non-empty array as-is', () => {
    const arr = [1, 2, 3];
    expect(normalizeForUndefined(arr)).toEqual(arr);
  });

  it('should handle nested objects', () => {
    const obj = {
      user: { name: 'John' },
      address: { street: '123 Main St' },
    };
    expect(normalizeForUndefined(obj)).toEqual(obj);
  });

  it('should return zero as-is', () => {
    expect(normalizeForUndefined(0)).toBe(0);
  });

  it('should return empty string as-is', () => {
    expect(normalizeForUndefined('')).toBe('');
  });
});
