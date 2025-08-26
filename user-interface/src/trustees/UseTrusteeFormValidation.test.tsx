import { renderHook, act } from '@testing-library/react';
import { useTrusteeFormValidation } from './UseTrusteeFormValidation';

describe('useTrusteeFormValidation', () => {
  test('validates required fields', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    const formData = {
      name: '',
      address1: '',
      city: '',
      state: '',
      zipCode: '',
    };

    const validationResult = result.current.isFormValidAndComplete(formData);

    expect(validationResult).toBe(false);
  });

  const invalidZipCodes = ['1234', '123456', '123456789', '1234a', 'abcde', '12.34', ''];
  test.each(invalidZipCodes)('validates ZIP code format for %s', (zipCode) => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    const formData = {
      name: 'Jane Doe',
      address1: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zipCode,
    };

    const validationResult = result.current.isFormValidAndComplete(formData);

    expect(validationResult).toBe(false);
  });

  const validZipCodes = ['12345', '12345-6789'];
  test.each(validZipCodes)('validates ZIP code format for %s', (zipCode) => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    const formData = {
      name: 'Jane Doe',
      address1: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zipCode,
    };

    const validationResult = result.current.isFormValidAndComplete(formData);
    expect(validationResult).toBe(true);
  });

  test('validates individual fields', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate('name', '');
    });

    expect(result.current.fieldErrors.name).toBe('Trustee name is required');

    act(() => {
      result.current.validateFieldAndUpdate('name', 'Jane Doe');
    });

    expect(result.current.fieldErrors.name).toBeUndefined();
  });

  test('clears errors', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    // First generate some errors
    act(() => {
      result.current.validateFieldAndUpdate('name', '');
      result.current.validateFieldAndUpdate('zipCode', '1234');
    });

    expect(result.current.fieldErrors.name).toBe('Trustee name is required');
    expect(result.current.fieldErrors.zipCode).toBe('ZIP code must be exactly 5 digits');

    // Clear all errors
    act(() => {
      result.current.clearErrors();
    });

    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.errors).toEqual([]);
  });

  test('clears individual field errors', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    // Generate errors for multiple fields
    act(() => {
      result.current.validateFieldAndUpdate('name', '');
      result.current.validateFieldAndUpdate('zipCode', '1234');
    });

    expect(result.current.fieldErrors.name).toBe('Trustee name is required');
    expect(result.current.fieldErrors.zipCode).toBe('ZIP code must be exactly 5 digits');

    // Clear only the name field error
    act(() => {
      result.current.clearFieldError('name');
    });

    expect(result.current.fieldErrors.name).toBeUndefined();
    expect(result.current.fieldErrors.zipCode).toBe('ZIP code must be exactly 5 digits');
  });

  test('validates complete valid form', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    const validFormData = {
      name: 'Jane Doe',
      address1: '123 Main Street',
      city: 'Springfield',
      state: 'Illinois',
      zipCode: '62704',
    };

    const validationResult = result.current.isFormValidAndComplete(validFormData);

    expect(validationResult).toBe(true);
  });

  test('validates trimmed values', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    // Test with spaces that should be trimmed
    const formDataWithSpaces = {
      name: '   ',
      address1: '  ',
      city: '  ',
      state: '  ',
      zipCode: '  ',
    };

    const validationResult = result.current.isFormValidAndComplete(formDataWithSpaces);

    expect(validationResult).toBe(false);
  });
});
