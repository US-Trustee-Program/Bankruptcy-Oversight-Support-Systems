import { act, renderHook } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { useTrusteeFormValidation } from './UseTrusteeFormValidation';
import { TrusteeFormData } from './UseTrusteeFormValidation.types';

const validFormData: TrusteeFormData = {
  name: 'John Doe',
  address1: '123 Main Street',
  address2: 'Suite 100',
  city: 'Anytown',
  state: 'NY',
  zipCode: '12345',
  phone: '555-123-4567',
  extension: '123',
  email: 'john.doe@example.com',
  districts: ['NY'],
  chapters: ['7'],
  status: 'active',
};

describe('useTrusteeFormValidation', () => {
  test('initializes with empty errors', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.errors).toEqual([]);
  });

  test('validates required fields', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('name', '');
    });

    expect(result.current.fieldErrors.name).toBe('Trustee name is required');
  });

  test('validates email format', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('email', 'invalid-email');
    });

    expect(result.current.fieldErrors.email).toBe('Email must be a valid email address');
  });

  test('accepts valid email format', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('email', 'valid@example.com');
    });

    expect(result.current.fieldErrors.email).toBeUndefined();
  });

  test('validates phone format', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('phone', '123');
    });

    expect(result.current.fieldErrors.phone).toBe('Phone is required');
  });

  test('accepts various phone formats', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    const validPhoneFormats = [
      '555-123-4567',
      '(555) 123-4567',
      '555.123.4567',
      '555 123 4567',
      '5551234567',
      '+1 555 123 4567',
    ];

    validPhoneFormats.forEach((phone) => {
      act(() => {
        result.current.validateFieldAndUpdate('phone', phone);
      });
      expect(result.current.fieldErrors.phone).toBeUndefined();
    });
  });

  test('validates ZIP code format for 12345', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('zipCode', '12345');
    });

    expect(result.current.fieldErrors.zipCode).toBeUndefined();
  });

  test('validates ZIP code format for 12345-6789', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('zipCode', '12345-6789');
    });

    expect(result.current.fieldErrors.zipCode).toBeUndefined();
  });

  test('rejects invalid ZIP code format for 1234', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('zipCode', '1234');
    });

    expect(result.current.fieldErrors.zipCode).toBe(
      'ZIP code must be 5 digits or 9 digits with a hyphen',
    );
  });

  test('validates ZIP code format for 12.34', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('zipCode', '12.34');
    });

    expect(result.current.fieldErrors.zipCode).toBe(
      'ZIP code must be 5 digits or 9 digits with a hyphen',
    );
  });

  test('validates ZIP code format for ', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('zipCode', '');
    });

    expect(result.current.fieldErrors.zipCode).toBe(
      'ZIP code must be 5 digits or 9 digits with a hyphen',
    );
  });

  test('validates state format', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('state', 'NEW YORK');
    });

    expect(result.current.fieldErrors.state).toBe('State is required');
  });

  test('accepts valid state format', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('state', 'NY');
    });

    expect(result.current.fieldErrors.state).toBeUndefined();
  });

  test('validates extension format', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('extension', 'abc123');
    });

    expect(result.current.fieldErrors.extension).toBe('Extension must be 1 to 6 digits');
  });

  test('accepts valid extension format', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('extension', '123');
    });

    expect(result.current.fieldErrors.extension).toBeUndefined();
  });

  test('allows empty extension', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('extension', '');
    });

    expect(result.current.fieldErrors.extension).toBeUndefined();
  });

  test('validates trimmed values', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('name', '  John Doe  ');
    });

    expect(result.current.fieldErrors.name).toBeUndefined();

    act(() => {
      result.current.validateFieldAndUpdate('name', '   ');
    });

    expect(result.current.fieldErrors.name).toBe('Trustee name is required');
  });

  test('clears all errors', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('name', '');
      result.current.validateFieldAndUpdate('email', 'invalid');
    });

    expect(Object.keys(result.current.fieldErrors)).toHaveLength(2);

    act(() => {
      result.current.clearErrors();
    });

    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.errors).toEqual([]);
  });

  test('clears specific field error', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('name', '');
      result.current.validateFieldAndUpdate('email', 'invalid');
    });

    expect(result.current.fieldErrors.name).toBeDefined();
    expect(result.current.fieldErrors.email).toBeDefined();

    act(() => {
      result.current.clearFieldError('name');
    });

    expect(result.current.fieldErrors.name).toBeUndefined();
    expect(result.current.fieldErrors.email).toBeDefined();
  });

  test('identifies when required fields are filled', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    const incompleteData = { ...validFormData, name: '' };
    expect(result.current.areRequiredFieldsFilled(incompleteData)).toBe(false);

    expect(result.current.areRequiredFieldsFilled(validFormData)).toBe(true);
  });

  test('identifies when form is valid and complete', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    // Form with validation errors should be invalid
    act(() => {
      result.current.validateFieldAndUpdate('email', 'invalid-email');
    });

    expect(result.current.isFormValidAndComplete(validFormData)).toBe(false);

    // Clear errors - form should be valid
    act(() => {
      result.current.clearErrors();
    });

    expect(result.current.isFormValidAndComplete(validFormData)).toBe(true);

    // Form with missing required fields should be invalid
    const incompleteData = { ...validFormData, name: '' };
    expect(result.current.isFormValidAndComplete(incompleteData)).toBe(false);
  });
});
