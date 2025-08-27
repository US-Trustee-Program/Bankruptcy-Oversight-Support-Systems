import { renderHook, act } from '@testing-library/react';
import { useTrusteeFormValidation } from './UseTrusteeFormValidation';

// Test constants for form validation
const VALID_FORM_DATA = {
  name: 'Jane Doe',
  address1: '123 Main St',
  city: 'Springfield',
  state: 'IL',
  phone: '(555) 123-4567',
  email: 'test@example.com',
  status: 'active' as const,
};

const EMPTY_FORM_DATA = {
  name: '',
  address1: '',
  city: '',
  state: '',
  zipCode: '',
  phone: '',
  email: '',
  status: 'active' as const,
};

const SPACES_FORM_DATA = {
  name: '   ',
  address1: '  ',
  city: '  ',
  state: '  ',
  zipCode: '  ',
  phone: '  ',
  email: '  ',
  status: 'active' as const,
};

const COMPLETE_VALID_FORM_DATA = {
  name: 'Jane Doe',
  address1: '123 Main Street',
  city: 'Springfield',
  state: 'Illinois',
  zipCode: '62704',
  phone: '(555) 123-4567',
  email: 'jane.doe@example.com',
  status: 'active' as const,
};

// Error message constants
const ERROR_MESSAGES = {
  TRUSTEE_NAME_REQUIRED: 'Trustee name is required',
  ADDRESS_REQUIRED: 'Address line 1 is required',
  CITY_REQUIRED: 'City is required',
  STATE_REQUIRED: 'State is required',
  ZIP_CODE_REQUIRED: 'ZIP code is required',
  ZIP_CODE_INVALID: 'ZIP code must be 5 digits or 9 digits with a hyphen',
  EMAIL_REQUIRED: 'Email is required',
  EMAIL_INVALID: 'Email must be a valid email address',
  PHONE_REQUIRED: 'Phone is required',
  PHONE_INVALID: 'Please enter a valid phone number',
  EXTENSION_INVALID: 'Extension must be 1 to 6 digits',
};

describe('useTrusteeFormValidation', () => {
  test('validates required fields', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    const formData = EMPTY_FORM_DATA;

    const validationResult = result.current.isFormValidAndComplete(formData);

    expect(validationResult).toBe(false);
  });

  const invalidZipCodes = ['1234', '123456', '123456789', '1234a', 'abcde', '12.34', ''];
  test.each(invalidZipCodes)('validates ZIP code format for %s', (zipCode) => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    const formData = {
      ...VALID_FORM_DATA,
      zipCode,
    };

    const validationResult = result.current.isFormValidAndComplete(formData);

    expect(validationResult).toBe(false);
  });

  const validZipCodes = ['12345', '12345-6789'];
  test.each(validZipCodes)('validates ZIP code format for %s', (zipCode) => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    const formData = {
      ...VALID_FORM_DATA,
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
    { field: 'name', value: '', expectedValue: ERROR_MESSAGES.TRUSTEE_NAME_REQUIRED },
    { field: 'address1', value: '', expectedValue: ERROR_MESSAGES.ADDRESS_REQUIRED },
    { field: 'city', value: '', expectedValue: ERROR_MESSAGES.CITY_REQUIRED },
    { field: 'state', value: '', expectedValue: ERROR_MESSAGES.STATE_REQUIRED },
    {
      field: 'zipCode',
      value: '12',
      expectedValue: ERROR_MESSAGES.ZIP_CODE_INVALID,
    },
    { field: 'zipCode', value: '', expectedValue: ERROR_MESSAGES.ZIP_CODE_REQUIRED },
    { field: 'email', value: 'test@example.com', expectedValue: null },
    { field: 'email', value: 'user@domain.org', expectedValue: null },
    { field: 'email', value: 'valid.email+tag@subdomain.example.com', expectedValue: null },
    { field: 'email', value: '', expectedValue: ERROR_MESSAGES.EMAIL_REQUIRED },
    {
      field: 'email',
      value: 'invalid-email',
      expectedValue: ERROR_MESSAGES.EMAIL_INVALID,
    },
    {
      field: 'email',
      value: 'missing@domain',
      expectedValue: ERROR_MESSAGES.EMAIL_INVALID,
    },
    {
      field: 'email',
      value: 'user@@double.com',
      expectedValue: ERROR_MESSAGES.EMAIL_INVALID,
    },
    { field: 'phone', value: '(555) 123-4567', expectedValue: null },
    { field: 'phone', value: '5551234567', expectedValue: null },
    { field: 'phone', value: '555-123-4567', expectedValue: null },
    { field: 'phone', value: '', expectedValue: ERROR_MESSAGES.PHONE_REQUIRED },
    { field: 'phone', value: 'abc', expectedValue: ERROR_MESSAGES.PHONE_INVALID },
    { field: 'phone', value: '123', expectedValue: ERROR_MESSAGES.PHONE_INVALID },
    { field: 'extension', value: '123', expectedValue: null },
    { field: 'extension', value: '1', expectedValue: null },
    { field: 'extension', value: '123456', expectedValue: null },
    { field: 'extension', value: '', expectedValue: null },
    { field: 'extension', value: '1234567', expectedValue: ERROR_MESSAGES.EXTENSION_INVALID },
    { field: 'extension', value: 'abc', expectedValue: ERROR_MESSAGES.EXTENSION_INVALID },
    { field: 'extension', value: '12a', expectedValue: ERROR_MESSAGES.EXTENSION_INVALID },
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

    expect(result.current.fieldErrors.name).toBe(ERROR_MESSAGES.TRUSTEE_NAME_REQUIRED);
    expect(result.current.fieldErrors.zipCode).toBe(ERROR_MESSAGES.ZIP_CODE_INVALID);

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

    expect(result.current.fieldErrors.name).toBe(ERROR_MESSAGES.TRUSTEE_NAME_REQUIRED);
    expect(result.current.fieldErrors.zipCode).toBe(ERROR_MESSAGES.ZIP_CODE_INVALID);

    // Clear only the name field error
    act(() => {
      result.current.clearFieldError('name');
    });

    expect(result.current.fieldErrors.name).toBeUndefined();
    expect(result.current.fieldErrors.zipCode).toBe(ERROR_MESSAGES.ZIP_CODE_INVALID);
  });

  test('validates complete valid form', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    const validationResult = result.current.isFormValidAndComplete(COMPLETE_VALID_FORM_DATA);

    expect(validationResult).toBe(true);
  });

  test('validates trimmed values', () => {
    const { result } = renderHook(() => useTrusteeFormValidation());

    const validationResult = result.current.isFormValidAndComplete(SPACES_FORM_DATA);

    expect(validationResult).toBe(false);
  });
});
