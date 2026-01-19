import { describe, expect, test } from 'vitest';
import { normalizeFormData } from './trusteeForms.utils';

describe('normalizeFormData', () => {
  test('should trim whitespace from string values', () => {
    const formData = {
      name: '  John Doe  ',
      email: '  john@example.com  ',
      age: 30,
    };

    const result = normalizeFormData(formData);

    expect(result.name).toBe('John Doe');
    expect(result.email).toBe('john@example.com');
    expect(result.age).toBe(30);
  });

  test('should convert empty strings to undefined', () => {
    const formData = {
      name: '',
      email: '   ',
      phone: 'valid',
    };

    const result = normalizeFormData(formData);

    expect(result.name).toBeUndefined();
    expect(result.email).toBeUndefined();
    expect(result.phone).toBe('valid');
  });

  test('should handle mixed data types correctly', () => {
    const formData = {
      name: '  Test  ',
      count: 42,
      active: true,
      empty: '',
      nullValue: null,
      undefinedValue: undefined,
    };

    const result = normalizeFormData(formData);

    expect(result.name).toBe('Test');
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
    expect(result.empty).toBeUndefined();
    expect(result.nullValue).toBeNull();
    expect(result.undefinedValue).toBeUndefined();
  });

  test('should preserve already trimmed strings', () => {
    const formData = {
      name: 'John Doe',
      email: 'john@example.com',
    };

    const result = normalizeFormData(formData);

    expect(result.name).toBe('John Doe');
    expect(result.email).toBe('john@example.com');
  });

  test('should not modify the original object', () => {
    const formData = {
      name: '  John  ',
      email: '  test@example.com  ',
    };

    const original = { ...formData };
    normalizeFormData(formData);

    expect(formData).toEqual(original);
  });

  test('should handle empty object', () => {
    const formData = {};

    const result = normalizeFormData(formData);

    expect(result).toEqual({});
  });

  test('should handle form data with all fields empty strings', () => {
    const formData = {
      field1: '',
      field2: '   ',
      field3: '\t\n',
    };

    const result = normalizeFormData(formData);

    expect(result.field1).toBeUndefined();
    expect(result.field2).toBeUndefined();
    expect(result.field3).toBeUndefined();
  });

  test('should handle typical trustee form data', () => {
    const formData = {
      name: '  Jane Smith  ',
      address1: '  123 Main St  ',
      address2: '',
      city: '  New York  ',
      state: 'NY',
      zipCode: '  10001  ',
      phone: '  (555)123-4567  ',
      extension: '',
      email: '  jane@example.com  ',
    };

    const result = normalizeFormData(formData);

    expect(result).toEqual({
      name: 'Jane Smith',
      address1: '123 Main St',
      address2: undefined,
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      phone: '(555)123-4567',
      extension: undefined,
      email: 'jane@example.com',
    });
  });
});
