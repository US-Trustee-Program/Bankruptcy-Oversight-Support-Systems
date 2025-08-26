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

  const fieldTests = [
    { field: 'name', value: 'Fred', expectedValue: null },
    { field: 'address1', value: '123 Main', expectedValue: null },
    { field: 'city', value: 'Center City', expectedValue: null },
    { field: 'state', value: 'PA', expectedValue: null },
    { field: 'zipCode', value: '10110', expectedValue: null },
    { field: 'name', value: '', expectedValue: 'Trustee name is required' },
    { field: 'address1', value: '', expectedValue: 'Address line 1 is required' },
    { field: 'city', value: '', expectedValue: 'City is required' },
    { field: 'state', value: '', expectedValue: 'State is required' },
    {
      field: 'zipCode',
      value: '12',
      expectedValue: 'ZIP code must be 5 digits or 9 digits with a hyphen',
    },
    { field: 'zipCode', value: '', expectedValue: 'ZIP code is required' },
    { field: 'email', value: 'test@example.com', expectedValue: null },
    { field: 'email', value: 'user@domain.org', expectedValue: null },
    { field: 'email', value: 'valid.email+tag@subdomain.example.com', expectedValue: null },
    { field: 'email', value: '', expectedValue: 'Email is required' },
    {
      field: 'email',
      value: 'invalid-email',
      expectedValue: 'Email must be a valid email address',
    },
    {
      field: 'email',
      value: 'missing@domain',
      expectedValue: 'Email must be a valid email address',
    },
    {
      field: 'email',
      value: 'user@@double.com',
      expectedValue: 'Email must be a valid email address',
    },
    { field: 'phone', value: '(555) 123-4567', expectedValue: null },
    { field: 'phone', value: '5551234567', expectedValue: null },
    { field: 'phone', value: '555-123-4567', expectedValue: null },
    { field: 'phone', value: '', expectedValue: null },
    { field: 'phone', value: 'abc', expectedValue: 'Please enter a valid phone number' },
    { field: 'phone', value: '123', expectedValue: 'Please enter a valid phone number' },
    { field: 'extension', value: '123', expectedValue: null },
    { field: 'extension', value: '1', expectedValue: null },
    { field: 'extension', value: '123456', expectedValue: null },
    { field: 'extension', value: '', expectedValue: null },
    { field: 'extension', value: '1234567', expectedValue: 'Extension must be 1 to 6 digits' },
    { field: 'extension', value: 'abc', expectedValue: 'Extension must be 1 to 6 digits' },
    { field: 'extension', value: '12a', expectedValue: 'Extension must be 1 to 6 digits' },
    { field: 'foo', value: '', expectedValue: null },
  ];
  test.each(fieldTests)('validates individual field $field=$value to be $expectedValue', (args) => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    act(() => {
      result.current.validateFieldAndUpdate(args.field, args.value);
    });

    if (args.expectedValue) {
      expect(result.current.fieldErrors[args.field]).toEqual(args.expectedValue);
    } else {
      expect(result.current.fieldErrors[args.field]).toBeUndefined();
    }
  });

  test('clears errors', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    // First generate some errors
    act(() => {
      result.current.validateFieldAndUpdate('name', '');
      result.current.validateFieldAndUpdate('zipCode', '1234');
    });

    expect(result.current.fieldErrors.name).toBe('Trustee name is required');
    expect(result.current.fieldErrors.zipCode).toBe(
      'ZIP code must be 5 digits or 9 digits with a hyphen',
    );

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
    expect(result.current.fieldErrors.zipCode).toBe(
      'ZIP code must be 5 digits or 9 digits with a hyphen',
    );

    // Clear only the name field error
    act(() => {
      result.current.clearFieldError('name');
    });

    expect(result.current.fieldErrors.name).toBeUndefined();
    expect(result.current.fieldErrors.zipCode).toBe(
      'ZIP code must be 5 digits or 9 digits with a hyphen',
    );
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
