import { renderHook, act } from '@testing-library/react';
import { useTrusteeForm, TRUSTEE_SPEC } from './UseTrusteeForm';
import { TrusteeFormData, TrusteeFormState } from './UseTrusteeForm';
import { ContactInformation } from '@common/cams/contact';
import { ChapterType } from '@common/cams/trustees';

// Test constants for form validation
const VALID_FORM_DATA = {
  name: 'Jane Doe',
  address1: '123 Main St',
  city: 'Springfield',
  state: 'IL',
  phone: '555-123-4567',
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
  state: 'IL',
  zipCode: '62704',
  phone: '555-123-4567',
  email: 'jane.doe@example.com',
  status: 'active' as const,
};

// Error message constants
const ERROR_MESSAGES = {
  TRUSTEE_NAME_REQUIRED: 'Trustee name is required',
  ADDRESS_REQUIRED: 'Address is required',
  CITY_REQUIRED: 'City is required',
  STATE_REQUIRED: 'State is required',
  ZIP_CODE_INVALID: 'ZIP code must be 5 digits or 9 digits with a hyphen',
  EMAIL_INVALID: 'Email must be a valid email address',
  PHONE_REQUIRED: 'Phone must be a valid phone number',
  EXTENSION_INVALID: 'Extension must be 1 to 6 digits',
};

describe('useTrusteeForm', () => {
  // Test constants
  const mockInternalContact: ContactInformation = {
    address: {
      address1: 'Internal Address 1',
      address2: 'Suite 100',
      city: 'Internal City',
      state: 'CA',
      zipCode: '90001',
      countryCode: 'US',
    },
    phone: {
      number: '555-123-4567',
      extension: '123',
    },
    email: 'internal@example.com',
  };

  const mockPublicContact: ContactInformation = {
    address: {
      address1: 'Public Address 1',
      address2: 'Floor 2',
      city: 'Public City',
      state: 'NY',
      zipCode: '10001',
      countryCode: 'US',
    },
    phone: {
      number: '555-987-6543',
      extension: '456',
    },
    email: 'public@example.com',
  };

  const mockDistricts = ['District 1', 'District 2'];
  const mockChapters = ['CHAPTER_7', 'CHAPTER_13'] as unknown as ChapterType[];

  describe('initialization', () => {
    test('should initialize with empty values when no trustee data provided', () => {
      const initialState: TrusteeFormState = {
        action: 'create',
        cancelTo: '/trustees',
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      expect(result.current.formData).toEqual({
        name: '',
        address1: '',
        address2: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
        extension: '',
        email: '',
        districts: [],
        chapters: [],
        status: 'active',
      });
    });

    test('should initialize with trustee data for create action', () => {
      const initialState: TrusteeFormState = {
        action: 'create',
        cancelTo: '/trustees',
        trustee: {
          name: 'Test Trustee',
          districts: mockDistricts,
          chapters: mockChapters,
          status: 'active',
        },
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      expect(result.current.formData).toEqual({
        name: 'Test Trustee',
        address1: '',
        address2: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
        extension: '',
        email: '',
        districts: mockDistricts,
        chapters: mockChapters,
        status: 'active',
      });
    });

    test('should initialize with internal contact data for edit action', () => {
      const initialState: TrusteeFormState = {
        action: 'edit',
        cancelTo: '/trustees/1',
        trusteeId: '1',
        contactInformation: 'internal',
        trustee: {
          name: 'Internal Trustee',
          internal: mockInternalContact,
          districts: mockDistricts,
          chapters: mockChapters,
          status: 'active',
        },
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      expect(result.current.formData).toEqual({
        name: 'Internal Trustee',
        address1: mockInternalContact.address.address1,
        address2: mockInternalContact.address.address2,
        city: mockInternalContact.address.city,
        state: mockInternalContact.address.state,
        zipCode: mockInternalContact.address.zipCode,
        phone: mockInternalContact.phone?.number,
        extension: mockInternalContact.phone?.extension,
        email: mockInternalContact.email,
        districts: mockDistricts,
        chapters: mockChapters,
        status: 'active',
      });
    });

    test('should initialize with public contact data for edit action', () => {
      const initialState: TrusteeFormState = {
        action: 'edit',
        cancelTo: '/trustees/1',
        trusteeId: '1',
        contactInformation: 'public',
        trustee: {
          name: 'Public Trustee',
          public: mockPublicContact,
          districts: mockDistricts,
          chapters: mockChapters,
          status: 'active',
        },
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      expect(result.current.formData).toEqual({
        name: 'Public Trustee',
        address1: mockPublicContact.address.address1,
        address2: mockPublicContact.address.address2,
        city: mockPublicContact.address.city,
        state: mockPublicContact.address.state,
        zipCode: mockPublicContact.address.zipCode,
        phone: mockPublicContact.phone?.number,
        extension: mockPublicContact.phone?.extension,
        email: mockPublicContact.email,
        districts: mockDistricts,
        chapters: mockChapters,
        status: 'active',
      });
    });

    test('should handle missing contact information in edit mode', () => {
      const initialState: TrusteeFormState = {
        action: 'edit',
        cancelTo: '/trustees/1',
        trusteeId: '1',
        contactInformation: 'internal',
        trustee: {
          name: 'Missing Contact Trustee',
          // internal contact is missing
          districts: mockDistricts,
          chapters: mockChapters,
          status: 'active',
        },
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      expect(result.current.formData).toEqual({
        name: 'Missing Contact Trustee',
        address1: '',
        address2: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
        extension: '',
        email: '',
        districts: mockDistricts,
        chapters: mockChapters,
        status: 'active',
      });
    });
  });

  describe('updateField', () => {
    test('should update a single field', () => {
      const initialState: TrusteeFormState = {
        action: 'create',
        cancelTo: '/trustees',
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      act(() => {
        result.current.updateField('name', 'Updated Name');
      });

      expect(result.current.formData.name).toBe('Updated Name');
    });

    test('should update a field with different types of values', () => {
      const initialState: TrusteeFormState = {
        action: 'create',
        cancelTo: '/trustees',
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      // Test with string
      act(() => {
        result.current.updateField('name', 'String Value');
      });
      expect(result.current.formData.name).toBe('String Value');

      // Test with array
      const districts = ['District A', 'District B'];
      act(() => {
        result.current.updateField('districts', districts);
      });
      expect(result.current.formData.districts).toEqual(districts);

      // Test with empty array
      act(() => {
        result.current.updateField('districts', []);
      });
      expect(result.current.formData.districts).toEqual([]);

      // Test with enum value
      act(() => {
        result.current.updateField('status', 'inactive');
      });
      expect(result.current.formData.status).toBe('inactive');
    });
  });

  describe('updateMultipleFields', () => {
    test('should update multiple fields at once', () => {
      const initialState: TrusteeFormState = {
        action: 'create',
        cancelTo: '/trustees',
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      const updates = {
        name: 'Multiple Update',
        address1: '123 Main St',
        city: 'Anytown',
        state: 'CA',
      };

      act(() => {
        result.current.updateMultipleFields(updates);
      });

      expect(result.current.formData.name).toBe(updates.name);
      expect(result.current.formData.address1).toBe(updates.address1);
      expect(result.current.formData.city).toBe(updates.city);
      expect(result.current.formData.state).toBe(updates.state);
    });

    test('should handle empty updates', () => {
      const initialState: TrusteeFormState = {
        action: 'create',
        cancelTo: '/trustees',
        trustee: {
          name: 'Initial Name',
        },
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      act(() => {
        result.current.updateMultipleFields({});
      });

      expect(result.current.formData.name).toBe('Initial Name');
    });
  });

  describe('resetForm', () => {
    test('should reset form to initial values', () => {
      const initialState: TrusteeFormState = {
        action: 'create',
        cancelTo: '/trustees',
        trustee: {
          name: 'Initial Name',
        },
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      // First update some values
      act(() => {
        result.current.updateField('name', 'Changed Name');
        result.current.updateField('address1', 'Changed Address');
      });

      expect(result.current.formData.name).toBe('Changed Name');
      expect(result.current.formData.address1).toBe('Changed Address');

      // Then reset
      act(() => {
        result.current.resetForm();
      });

      expect(result.current.formData.name).toBe('Initial Name');
      expect(result.current.formData.address1).toBe('');
    });
  });

  describe('getFormData', () => {
    test('should return trimmed form data', () => {
      const initialState: TrusteeFormState = {
        action: 'create',
        cancelTo: '/trustees',
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      // Update with values with spaces
      act(() => {
        result.current.updateMultipleFields({
          name: ' Test Name ',
          address1: ' 123 Main St ',
          address2: ' Apt 2 ',
          city: ' Anytown ',
          zipCode: ' 12345 ',
          phone: ' 555-123-4567 ',
          extension: ' 123 ',
          email: ' test@example.com ',
        });
      });

      const trimmedData = result.current.getFormData();

      expect(trimmedData.name).toBe('Test Name');
      expect(trimmedData.address1).toBe('123 Main St');
      expect(trimmedData.address2).toBe('Apt 2');
      expect(trimmedData.city).toBe('Anytown');
      expect(trimmedData.zipCode).toBe('12345');
      expect(trimmedData.phone).toBe('555-123-4567');
      expect(trimmedData.extension).toBe('123');
      expect(trimmedData.email).toBe('test@example.com');
    });

    test('should convert empty strings to undefined for optional fields', () => {
      const initialState: TrusteeFormState = {
        action: 'create',
        cancelTo: '/trustees',
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      act(() => {
        result.current.updateMultipleFields({
          name: 'Test Name',
          address1: '123 Main St',
          address2: '',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          phone: '555-123-4567',
          extension: '',
          email: 'test@example.com',
        });
      });

      const trimmedData = result.current.getFormData();

      expect(trimmedData.address2).toBeUndefined();
      expect(trimmedData.extension).toBeUndefined();
    });

    test('should convert empty arrays to undefined', () => {
      const initialState: TrusteeFormState = {
        action: 'create',
        cancelTo: '/trustees',
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      act(() => {
        result.current.updateMultipleFields({
          name: 'Test Name',
          districts: [],
          chapters: [],
        });
      });

      const trimmedData = result.current.getFormData();

      expect(trimmedData.districts).toBeUndefined();
      expect(trimmedData.chapters).toBeUndefined();
    });

    test('should override a field value when provided', () => {
      const initialState: TrusteeFormState = {
        action: 'create',
        cancelTo: '/trustees',
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      act(() => {
        result.current.updateField('name', 'Original Name');
      });

      const override = {
        name: 'name' as keyof Partial<TrusteeFormData>,
        value: 'Overridden Name',
      };

      const dataWithOverride = result.current.getFormData(override);

      expect(dataWithOverride.name).toBe('Overridden Name');
    });

    test('should maintain non-empty arrays in the form data', () => {
      const initialState: TrusteeFormState = {
        action: 'create',
        cancelTo: '/trustees',
        trustee: {
          districts: mockDistricts,
          chapters: mockChapters,
        },
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      const trimmedData = result.current.getFormData();

      expect(trimmedData.districts).toEqual(mockDistricts);
      expect(trimmedData.chapters).toEqual(mockChapters);
    });
  });

  describe('getDynamicSpec', () => {
    test('should exclude address validation when all address fields are empty in internal edit mode', () => {
      // Test for lines 222-223 and 225-230
      const initialState: TrusteeFormState = {
        action: 'edit',
        cancelTo: '/trustees/1',
        trusteeId: '1',
        contactInformation: 'internal',
        trustee: {
          name: 'Test Trustee',
          status: 'active',
        },
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      // Make sure all address fields are empty
      act(() => {
        result.current.updateMultipleFields({
          address1: '',
          city: '',
          state: '',
          zipCode: '',
        });
      });

      // Get the dynamic spec
      const dynamicSpec = result.current.getDynamicSpec();

      // Check that address-related validations are excluded
      expect(dynamicSpec.name).toBeUndefined(); // Name is always excluded in internal edit mode
      expect(dynamicSpec.address1).toBeUndefined();
      expect(dynamicSpec.address2).toBeUndefined();
      expect(dynamicSpec.city).toBeUndefined();
      expect(dynamicSpec.state).toBeUndefined();
      expect(dynamicSpec.zipCode).toBeUndefined();

      // Status should still be included
      expect(dynamicSpec.status).toBeDefined();
    });

    test('should include address validation when some address fields are populated in internal edit mode', () => {
      const initialState: TrusteeFormState = {
        action: 'edit',
        cancelTo: '/trustees/1',
        trusteeId: '1',
        contactInformation: 'internal',
        trustee: {
          name: 'Test Trustee',
          status: 'active',
        },
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      // Set one address field to be non-empty
      act(() => {
        result.current.updateMultipleFields({
          address1: '123 Main St',
          city: '',
          state: '',
          zipCode: '',
        });
      });

      // Get the dynamic spec
      const dynamicSpec = result.current.getDynamicSpec();

      // Check that address-related validations are included
      expect(dynamicSpec.name).toBeUndefined(); // Name is always excluded in internal edit mode
      expect(dynamicSpec.address1).toBeDefined();
      expect(dynamicSpec.address2).toBeDefined();
      expect(dynamicSpec.city).toBeDefined();
      expect(dynamicSpec.state).toBeDefined();
      expect(dynamicSpec.zipCode).toBeDefined();
    });

    test('should exclude phone validation when phone is empty in internal edit mode', () => {
      // Test for lines 232-233
      const initialState: TrusteeFormState = {
        action: 'edit',
        cancelTo: '/trustees/1',
        trusteeId: '1',
        contactInformation: 'internal',
        trustee: {
          name: 'Test Trustee',
          status: 'active',
        },
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      // Make sure phone is empty
      act(() => {
        result.current.updateField('phone', '');
      });

      // Get the dynamic spec
      const dynamicSpec = result.current.getDynamicSpec();

      // Check that phone validation is excluded
      expect(dynamicSpec.phone).toBeUndefined();

      // Extension is not excluded because it's optional anyway
      expect(dynamicSpec.extension).toBeDefined();
    });

    test('should include phone validation when phone is populated in internal edit mode', () => {
      const initialState: TrusteeFormState = {
        action: 'edit',
        cancelTo: '/trustees/1',
        trusteeId: '1',
        contactInformation: 'internal',
        trustee: {
          name: 'Test Trustee',
          status: 'active',
        },
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      // Set phone to be non-empty
      act(() => {
        result.current.updateField('phone', '555-123-4567');
      });

      // Get the dynamic spec
      const dynamicSpec = result.current.getDynamicSpec();

      // Check that phone validation is included
      expect(dynamicSpec.phone).toBeDefined();
    });

    test('should exclude email validation when email is empty in internal edit mode', () => {
      // Test for lines 234-236
      const initialState: TrusteeFormState = {
        action: 'edit',
        cancelTo: '/trustees/1',
        trusteeId: '1',
        contactInformation: 'internal',
        trustee: {
          name: 'Test Trustee',
          status: 'active',
        },
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      // Make sure email is empty
      act(() => {
        result.current.updateField('email', '');
      });

      // Get the dynamic spec
      const dynamicSpec = result.current.getDynamicSpec();

      // Check that email validation is excluded
      expect(dynamicSpec.email).toBeUndefined();
    });

    test('should include email validation when email is populated in internal edit mode', () => {
      const initialState: TrusteeFormState = {
        action: 'edit',
        cancelTo: '/trustees/1',
        trusteeId: '1',
        contactInformation: 'internal',
        trustee: {
          name: 'Test Trustee',
          status: 'active',
        },
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      // Set email to be non-empty
      act(() => {
        result.current.updateField('email', 'test@example.com');
      });

      // Get the dynamic spec
      const dynamicSpec = result.current.getDynamicSpec();

      // Check that email validation is included
      expect(dynamicSpec.email).toBeDefined();
    });

    test('should not modify validation spec when not in internal edit mode', () => {
      // Test that the function behaves differently outside internal edit mode
      const initialState: TrusteeFormState = {
        action: 'create',
        cancelTo: '/trustees',
        trustee: {
          name: 'Test Trustee',
          status: 'active',
        },
      };

      const { result } = renderHook(() => useTrusteeForm({ initialState }));

      // Set empty values
      act(() => {
        result.current.updateMultipleFields({
          address1: '',
          city: '',
          state: '',
          zipCode: '',
          phone: '',
          email: '',
        });
      });

      // Get the dynamic spec
      const dynamicSpec = result.current.getDynamicSpec();

      // Check that all validations are still included
      expect(dynamicSpec.name).toBeDefined();
      expect(dynamicSpec.address1).toBeDefined();
      expect(dynamicSpec.city).toBeDefined();
      expect(dynamicSpec.state).toBeDefined();
      expect(dynamicSpec.zipCode).toBeDefined();
      expect(dynamicSpec.phone).toBeDefined();
      expect(dynamicSpec.email).toBeDefined();
    });
  });

  // Test the complete hook implementation including all functions
  test('should work with all functions together', () => {
    const initialState: TrusteeFormState = {
      action: 'create',
      cancelTo: '/trustees',
    };

    const { result } = renderHook(() => useTrusteeForm({ initialState }));

    // Update fields
    act(() => {
      result.current.updateField('name', 'John Doe');
    });

    expect(result.current.formData.name).toBe('John Doe');

    // Update multiple fields
    act(() => {
      result.current.updateMultipleFields({
        address1: '123 Main St',
        city: 'Anytown',
        state: 'CA',
      });
    });

    expect(result.current.formData.address1).toBe('123 Main St');
    expect(result.current.formData.city).toBe('Anytown');
    expect(result.current.formData.state).toBe('CA');

    // Get trimmed data
    const trimmedData = result.current.getFormData();
    expect(trimmedData.name).toBe('John Doe');

    // Reset form
    act(() => {
      result.current.resetForm();
    });

    expect(result.current.formData.name).toBe('');
    expect(result.current.formData.address1).toBe('');
  });

  test('validates required fields', () => {
    const initialState: TrusteeFormState = {
      action: 'create',
      cancelTo: '/trustees',
    };

    const { result } = renderHook(() => useTrusteeForm({ initialState }));

    let validationResult;
    act(() => {
      validationResult = result.current.isFormValidAndComplete(EMPTY_FORM_DATA, TRUSTEE_SPEC);
    });

    expect(validationResult).toBe(false);
  });

  const invalidZipCodes = ['1234', '123456', '123456789', '1234a', 'abcde', '12.34', ''];
  test.each(invalidZipCodes)('validates ZIP code format for %s', (zipCode) => {
    const initialState: TrusteeFormState = {
      action: 'create',
      cancelTo: '/trustees',
    };

    const { result } = renderHook(() => useTrusteeForm({ initialState }));

    const formData = {
      ...VALID_FORM_DATA,
      zipCode,
    };

    let validationResult;
    act(() => {
      validationResult = result.current.isFormValidAndComplete(formData, TRUSTEE_SPEC);
    });

    expect(validationResult).toBe(false);
  });

  const validZipCodes = ['12345', '12345-6789'];
  test.each(validZipCodes)('validates ZIP code format for %s', (zipCode) => {
    const initialState: TrusteeFormState = {
      action: 'create',
      cancelTo: '/trustees',
    };

    const { result } = renderHook(() => useTrusteeForm({ initialState }));

    const formData = {
      ...VALID_FORM_DATA,
      zipCode,
    };

    let validationResult;
    act(() => {
      validationResult = result.current.isFormValidAndComplete(formData, TRUSTEE_SPEC);
    });
    expect(validationResult).toBe(true);
  });

  const fieldTests: {
    field: keyof TrusteeFormData;
    value: string;
    expectedValue: null | string;
  }[] = [
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
    { field: 'zipCode', value: '', expectedValue: ERROR_MESSAGES.ZIP_CODE_INVALID },
    { field: 'email', value: 'test@example.com', expectedValue: null },
    { field: 'email', value: 'user@domain.org', expectedValue: null },
    { field: 'email', value: 'valid.email+tag@subdomain.example.com', expectedValue: null },
    { field: 'email', value: '', expectedValue: ERROR_MESSAGES.EMAIL_INVALID },
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
    { field: 'phone', value: '555-123-4567', expectedValue: null },
    { field: 'phone', value: '', expectedValue: ERROR_MESSAGES.PHONE_REQUIRED },
    { field: 'phone', value: 'abc', expectedValue: ERROR_MESSAGES.PHONE_REQUIRED },
    { field: 'phone', value: '123', expectedValue: ERROR_MESSAGES.PHONE_REQUIRED },
    { field: 'extension', value: '123', expectedValue: null },
    { field: 'extension', value: '1', expectedValue: null },
    { field: 'extension', value: '123456', expectedValue: null },
    { field: 'extension', value: '', expectedValue: null },
    { field: 'extension', value: '1234567', expectedValue: ERROR_MESSAGES.EXTENSION_INVALID },
    { field: 'extension', value: 'abc', expectedValue: ERROR_MESSAGES.EXTENSION_INVALID },
    { field: 'extension', value: '12a', expectedValue: ERROR_MESSAGES.EXTENSION_INVALID },
  ];
  test.each(fieldTests)('validates individual field $field=$value to be $expectedValue', (args) => {
    const initialState: TrusteeFormState = {
      action: 'create',
      cancelTo: '/trustees',
    };

    const { result } = renderHook(() => useTrusteeForm({ initialState }));

    act(() => {
      result.current.validateFieldAndUpdate(args.field, args.value, TRUSTEE_SPEC);
    });

    if (args.expectedValue) {
      expect(result.current.fieldErrors[args.field]).toEqual(args.expectedValue);
    } else {
      expect(result.current.fieldErrors[args.field]).toBeUndefined();
    }
  });

  test('clears errors', () => {
    const initialState: TrusteeFormState = {
      action: 'create',
      cancelTo: '/trustees',
    };

    const { result } = renderHook(() => useTrusteeForm({ initialState }));

    // First generate some errors
    act(() => {
      result.current.validateFieldAndUpdate('name', '', TRUSTEE_SPEC);
      result.current.validateFieldAndUpdate('zipCode', '1234', TRUSTEE_SPEC);
    });

    expect(result.current.fieldErrors.name).toBe(ERROR_MESSAGES.TRUSTEE_NAME_REQUIRED);
    expect(result.current.fieldErrors.zipCode).toBe(ERROR_MESSAGES.ZIP_CODE_INVALID);

    // Clear all errors
    act(() => {
      result.current.clearErrors();
    });

    expect(result.current.fieldErrors).toEqual({});
  });

  test('clears individual field errors', () => {
    const initialState: TrusteeFormState = {
      action: 'create',
      cancelTo: '/trustees',
    };

    const { result } = renderHook(() => useTrusteeForm({ initialState }));

    // Generate errors for multiple fields
    act(() => {
      result.current.validateFieldAndUpdate('name', '', TRUSTEE_SPEC);
      result.current.validateFieldAndUpdate('zipCode', '1234', TRUSTEE_SPEC);
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
    const initialState: TrusteeFormState = {
      action: 'create',
      cancelTo: '/trustees',
    };

    const { result } = renderHook(() => useTrusteeForm({ initialState }));

    const validationResult = result.current.isFormValidAndComplete(
      COMPLETE_VALID_FORM_DATA,
      TRUSTEE_SPEC,
    );

    expect(validationResult).toBeTruthy();
  });

  test('validates trimmed values', () => {
    const initialState: TrusteeFormState = {
      action: 'create',
      cancelTo: '/trustees',
    };

    const { result } = renderHook(() => useTrusteeForm({ initialState }));

    let validationResult;
    act(() => {
      validationResult = result.current.isFormValidAndComplete(SPACES_FORM_DATA, TRUSTEE_SPEC);
    });

    expect(validationResult).toBeFalsy();
  });
});
