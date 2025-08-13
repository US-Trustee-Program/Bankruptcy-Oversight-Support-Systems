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

    const validationResult = result.current.validateForm(formData);

    expect(validationResult.isValid).toBe(false);
    expect(validationResult.errors).toHaveLength(5);
    expect(validationResult.fieldErrors).toEqual({
      name: 'Trustee name is required',
      address1: 'Address line 1 is required',
      city: 'City is required',
      state: 'State is required',
      zipCode: 'ZIP code is required',
    });
  });

  test('validates ZIP code format', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    // Test invalid ZIP codes
    const invalidZipCodes = ['1234', '123456', '1234a', 'abcde', '12.34', ''];

    invalidZipCodes.forEach((zipCode) => {
      const formData = {
        name: 'Jane Doe',
        address1: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zipCode,
      };

      const validationResult = result.current.validateForm(formData);

      expect(validationResult.isValid).toBe(false);
      if (zipCode === '') {
        expect(validationResult.fieldErrors.zipCode).toBe('ZIP code is required');
      } else {
        expect(validationResult.fieldErrors.zipCode).toBe('ZIP code must be exactly 5 digits');
      }
    });

    // Test valid ZIP code
    const formData = {
      name: 'Jane Doe',
      address1: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zipCode: '12345',
    };

    const validationResult = result.current.validateForm(formData);
    expect(validationResult.isValid).toBe(true);
    expect(validationResult.fieldErrors.zipCode).toBeUndefined();
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

    const validationResult = result.current.validateForm(validFormData);

    expect(validationResult.isValid).toBe(true);
    expect(validationResult.errors).toHaveLength(0);
    expect(validationResult.fieldErrors).toEqual({});
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

    const validationResult = result.current.validateForm(formDataWithSpaces);

    expect(validationResult.isValid).toBe(false);
    expect(validationResult.errors).toHaveLength(5);
    // All should be treated as required field errors since they're empty after trimming
    expect(validationResult.fieldErrors.name).toBe('Trustee name is required');
    expect(validationResult.fieldErrors.address1).toBe('Address line 1 is required');
    expect(validationResult.fieldErrors.city).toBe('City is required');
    expect(validationResult.fieldErrors.state).toBe('State is required');
    expect(validationResult.fieldErrors.zipCode).toBe('ZIP code is required');
  });
});
