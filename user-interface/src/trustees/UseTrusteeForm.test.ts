import { renderHook, act } from '@testing-library/react';
import { useTrusteeForm } from './UseTrusteeForm';
import { TrusteeFormData, TrusteeFormState } from './UseTrusteeFormValidation.types';
import { ContactInformation } from '@common/cams/contact';
import { ChapterType } from '@common/cams/trustees';

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
});
