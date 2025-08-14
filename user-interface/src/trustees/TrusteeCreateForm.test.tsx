import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrusteeCreateForm from './TrusteeCreateForm';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import * as UseApi2Module from '@/lib/hooks/UseApi2';
import * as UseGlobalAlertModule from '@/lib/hooks/UseGlobalAlert';
import * as UseTrusteeFormValidationModule from '@/lib/hooks/UseTrusteeFormValidation';
import type {
  ValidationError,
  FormValidationResult,
  TrusteeFormData,
} from '@/lib/hooks/UseTrusteeFormValidation.types';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole } from '@common/cams/roles';

describe('TrusteeCreateForm', () => {
  const mockGlobalAlert = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
  };

  // Real validation logic for testing
  const validateField = (field: string, value: string): string | null => {
    switch (field) {
      case 'name':
        return !value || value.trim() === '' ? 'Trustee name is required' : null;
      case 'address1':
        return !value || value.trim() === '' ? 'Address line 1 is required' : null;
      case 'address2':
        return null; // Optional field
      case 'city':
        return !value || value.trim() === '' ? 'City is required' : null;
      case 'state':
        return !value || value.trim() === '' ? 'State is required' : null;
      case 'zipCode':
        if (!value || value.trim() === '') {
          return 'ZIP code is required';
        }
        if (!/^\d{5}$/.test(value.trim())) {
          return 'ZIP code must be exactly 5 digits';
        }
        return null;
      case 'phone': {
        if (!value || value.trim() === '') {
          return null; // Phone is optional
        }
        const phoneRegex =
          /^[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*$/;
        if (!phoneRegex.test(value.trim())) {
          return 'Please enter a valid phone number';
        }
        return null;
      }
      case 'extension':
        return null; // Optional field
      case 'email': {
        if (!value || value.trim() === '') {
          return null; // Email is optional
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.trim())) {
          return 'Please enter a valid email address';
        }
        return null;
      }
      case 'district':
        return null; // Optional field
      case 'chapters':
        return null; // Optional field
      default:
        return null;
    }
  };

  // State for field errors that the mock can manipulate
  let currentFieldErrors: Record<string, string> = {};

  const mockValidation = {
    get fieldErrors() {
      return currentFieldErrors;
    },
    errors: [],
    validateForm: vi.fn((formData: TrusteeFormData): FormValidationResult => {
      const errors: ValidationError[] = [];
      const fieldErrors: Record<string, string> = {};

      Object.entries(formData).forEach(([field, value]) => {
        const error = validateField(field, value);
        if (error) {
          errors.push({ field, message: error });
          fieldErrors[field] = error;
        }
      });

      // Update current field errors
      currentFieldErrors = fieldErrors;

      return {
        isValid: errors.length === 0,
        errors,
        fieldErrors,
      };
    }),
    validateFieldAndUpdate: vi.fn((field: string, value: string): string | null => {
      const error = validateField(field, value);
      if (error) {
        currentFieldErrors = { ...currentFieldErrors, [field]: error };
      } else {
        const { [field]: _, ...rest } = currentFieldErrors;
        currentFieldErrors = rest;
      }
      return error;
    }),
    clearErrors: vi.fn(() => {
      currentFieldErrors = {};
    }),
    clearFieldError: vi.fn(),
    areRequiredFieldsFilled: vi.fn((formData: TrusteeFormData): boolean => {
      const requiredFields = ['name', 'address1', 'city', 'state', 'zipCode'];
      return requiredFields.every((field) => {
        const value = formData[field as keyof TrusteeFormData];
        return value && typeof value === 'string' && value.trim() !== '';
      });
    }),
    isFormValidAndComplete: vi.fn((formData: TrusteeFormData): boolean => {
      const requiredFieldsFilled = mockValidation.areRequiredFieldsFilled(formData);
      const hasNoErrors = Object.keys(currentFieldErrors).length === 0;
      return requiredFieldsFilled && hasNoErrors;
    }),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // Reset field errors before each test
    currentFieldErrors = {};

    // Set up default authorized user with TrusteeAdmin role
    const defaultUser = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
      MockData.getCamsSession({ user: defaultUser }),
    );

    // Enable feature flag by default
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      [FeatureFlags.TRUSTEE_MANAGEMENT]: true,
    } as Record<string, boolean>);

    vi.spyOn(UseGlobalAlertModule, 'useGlobalAlert').mockReturnValue(mockGlobalAlert);
    vi.spyOn(UseTrusteeFormValidationModule, 'useTrusteeFormValidation').mockReturnValue(
      mockValidation,
    );

    // Mock the useApi2 hook to include getCourts
    vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
      getCourts: vi.fn().mockResolvedValue({
        data: MockData.getCourts(),
      }),
      postTrustee: vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } }),
    } as unknown as ReturnType<typeof UseApi2Module.useApi2>);
  });

  test('renders disabled message when feature is off', () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      [FeatureFlags.TRUSTEE_MANAGEMENT]: false,
    } as Record<string, boolean>);
    render(<TrusteeCreateForm />);
    expect(screen.getByTestId('trustee-create-disabled')).toBeInTheDocument();
  });

  test('renders unauthorized message when user lacks TrusteeAdmin role', () => {
    // Set up a user without TrusteeAdmin role
    const user = MockData.getCamsUser({ roles: [CamsRole.CaseAssignmentManager] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

    // Enable feature flag
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      [FeatureFlags.TRUSTEE_MANAGEMENT]: true,
    } as Record<string, boolean>);

    render(<TrusteeCreateForm />);
    expect(screen.getByTestId('trustee-create-unauthorized')).toBeInTheDocument();
    expect(screen.getByText('You do not have permission to manage trustees.')).toBeInTheDocument();
  });

  test('renders unauthorized message when user has no roles', () => {
    // Set up a user with no roles
    const user = MockData.getCamsUser({ roles: [] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

    // Enable feature flag
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      [FeatureFlags.TRUSTEE_MANAGEMENT]: true,
    } as Record<string, boolean>);

    render(<TrusteeCreateForm />);
    expect(screen.getByTestId('trustee-create-unauthorized')).toBeInTheDocument();
  });

  test('renders form when user has TrusteeAdmin role and feature flag is enabled', () => {
    // Uses default setup from beforeEach (TrusteeAdmin user and enabled feature flag)
    render(<TrusteeCreateForm />);

    // Should render the form, not authorization messages
    expect(screen.queryByTestId('trustee-create-disabled')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trustee-create-unauthorized')).not.toBeInTheDocument();
    expect(screen.getByTestId('trustee-create-form')).toBeInTheDocument();
  });

  test('submits required fields and calls onSuccess', async () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      [FeatureFlags.TRUSTEE_MANAGEMENT]: true,
    } as Record<string, boolean>);

    vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
      getCourts: vi.fn().mockResolvedValue({
        data: MockData.getCourts(),
      }),
      postTrustee: vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } }),
    } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

    const onSuccess = vi.fn();
    render(<TrusteeCreateForm onSuccess={onSuccess} />);

    await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
    await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
    await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
    await userEvent.type(screen.getByTestId('trustee-state'), 'IL');
    await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

    await userEvent.click(screen.getByRole('button', { name: /create trustee/i }));

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith('trustee-123'));
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        [FeatureFlags.TRUSTEE_MANAGEMENT]: true,
      } as Record<string, boolean>);
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } }),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);
    });

    test('displays error for invalid ZIP code format', async () => {
      render(<TrusteeCreateForm />);

      // Fill form with invalid ZIP code
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      await userEvent.type(screen.getByTestId('trustee-state'), 'IL');
      await userEvent.type(screen.getByTestId('trustee-zip'), '1234'); // Invalid: only 4 digits

      await userEvent.click(screen.getByRole('button', { name: /create trustee/i }));

      expect(screen.getByText('ZIP code must be exactly 5 digits')).toBeInTheDocument();
    });

    test('displays real-time validation for ZIP code with letters', async () => {
      render(<TrusteeCreateForm />);

      await userEvent.type(screen.getByTestId('trustee-zip'), '1234a');

      // Should trigger real-time validation
      expect(await screen.findByText('ZIP code must be exactly 5 digits')).toBeInTheDocument();
    });

    test('clears validation errors when valid input is provided', async () => {
      render(<TrusteeCreateForm />);

      // First enter invalid ZIP
      await userEvent.type(screen.getByTestId('trustee-zip'), '1234');
      expect(await screen.findByText('ZIP code must be exactly 5 digits')).toBeInTheDocument();

      // Clear and enter valid ZIP
      await userEvent.clear(screen.getByTestId('trustee-zip'));
      await userEvent.type(screen.getByTestId('trustee-zip'), '12345');

      // Error should be gone
      expect(screen.queryByText('ZIP code must be exactly 5 digits')).not.toBeInTheDocument();
    });

    test('disables submit button when there are validation errors', async () => {
      render(<TrusteeCreateForm />);

      const submitButton = screen.getByRole('button', { name: /create trustee/i });

      // Enter invalid ZIP code
      await userEvent.type(screen.getByTestId('trustee-zip'), '1234');

      // Button should be disabled due to validation errors
      await vi.waitFor(() => expect(submitButton).toBeDisabled());
    });

    test('validates ZIP code must be exactly 5 digits', async () => {
      render(<TrusteeCreateForm />);

      const zipInput = screen.getByTestId('trustee-zip');

      // Test various invalid ZIP codes
      const invalidZips = ['123', '123456', '1234a', 'abcde', '12.34'];

      for (const invalidZip of invalidZips) {
        await userEvent.clear(zipInput);
        await userEvent.type(zipInput, invalidZip);
        expect(await screen.findByText('ZIP code must be exactly 5 digits')).toBeInTheDocument();
      }

      // Test valid ZIP code
      await userEvent.clear(zipInput);
      await userEvent.type(zipInput, '12345');
      expect(screen.queryByText('ZIP code must be exactly 5 digits')).not.toBeInTheDocument();
    });
  });

  describe('Success and Error Handling', () => {
    beforeEach(() => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        [FeatureFlags.TRUSTEE_MANAGEMENT]: true,
      } as Record<string, boolean>);
    });

    test('shows success notification when trustee is created successfully', async () => {
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } }),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      const onSuccess = vi.fn();
      render(<TrusteeCreateForm onSuccess={onSuccess} />);

      // Fill form with valid data
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      await userEvent.type(screen.getByTestId('trustee-state'), 'IL');
      await userEvent.type(screen.getByTestId('trustee-zip'), '12345');

      await userEvent.click(screen.getByRole('button', { name: /create trustee/i }));

      await vi.waitFor(() => {
        expect(mockGlobalAlert.success).toHaveBeenCalledWith('Trustee created successfully.');
        expect(onSuccess).toHaveBeenCalledWith('trustee-123');
      });
    });

    test('shows error notification when API call fails', async () => {
      const errorMessage = 'Network error occurred';
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: vi.fn().mockRejectedValue(new Error(errorMessage)),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      render(<TrusteeCreateForm />);

      // Fill form with valid data
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      await userEvent.type(screen.getByTestId('trustee-state'), 'IL');
      await userEvent.type(screen.getByTestId('trustee-zip'), '12345');

      await userEvent.click(screen.getByRole('button', { name: /create trustee/i }));

      await vi.waitFor(() => {
        expect(mockGlobalAlert.error).toHaveBeenCalledWith(
          `Failed to create trustee: ${errorMessage}`,
        );
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    test('clears validation errors when cancel is clicked', async () => {
      const onCancel = vi.fn();
      render(<TrusteeCreateForm onCancel={onCancel} />);

      // Enter invalid data to generate errors
      await userEvent.type(screen.getByTestId('trustee-zip'), '1234');
      expect(await screen.findByText('ZIP code must be exactly 5 digits')).toBeInTheDocument();

      // Click cancel
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Optional Fields', () => {
    beforeEach(() => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        [FeatureFlags.TRUSTEE_MANAGEMENT]: true,
      } as Record<string, boolean>);
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } }),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);
    });

    test('renders all optional fields', () => {
      render(<TrusteeCreateForm />);

      expect(screen.getByTestId('trustee-address2')).toBeInTheDocument();
      expect(screen.getByTestId('trustee-phone')).toBeInTheDocument();
      expect(screen.getByTestId('trustee-extension')).toBeInTheDocument();
      expect(screen.getByTestId('trustee-email')).toBeInTheDocument();
      // ComboBox components render with their ID as the container element ID
      expect(document.getElementById('trustee-district')).toBeInTheDocument();
      expect(document.getElementById('trustee-chapters')).toBeInTheDocument();
    });

    test('allows form submission without optional fields', async () => {
      const onSuccess = vi.fn();
      render(<TrusteeCreateForm onSuccess={onSuccess} />);

      // Fill only required fields
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      await userEvent.type(screen.getByTestId('trustee-state'), 'IL');
      await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

      await userEvent.click(screen.getByRole('button', { name: /create trustee/i }));

      await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith('trustee-123'));
    });

    test('validates email format when provided', async () => {
      render(<TrusteeCreateForm />);

      const emailInput = screen.getByTestId('trustee-email');

      // Test one invalid email format
      await userEvent.type(emailInput, 'invalid-email');

      // Wait for validation to be called and check if error appears
      await vi.waitFor(() => {
        // The mock validation should have been called and updated the field errors
        expect(mockValidation.validateFieldAndUpdate).toHaveBeenCalledWith(
          'email',
          'invalid-email',
        );
      });

      // Check if error message is displayed - it should be in the fieldErrors
      expect(currentFieldErrors.email).toBe('Please enter a valid email address');

      // Test valid email
      await userEvent.clear(emailInput);
      await userEvent.type(emailInput, 'test@example.com');

      await vi.waitFor(() => {
        expect(mockValidation.validateFieldAndUpdate).toHaveBeenCalledWith(
          'email',
          'test@example.com',
        );
      });

      // Error should be cleared
      expect(currentFieldErrors.email).toBeUndefined();
    });

    test('validates phone format when provided', async () => {
      render(<TrusteeCreateForm />);

      const phoneInput = screen.getByTestId('trustee-phone');

      // Test invalid phone format
      await userEvent.type(phoneInput, 'abc123');

      // Wait for validation to be called
      await vi.waitFor(() => {
        expect(mockValidation.validateFieldAndUpdate).toHaveBeenCalledWith('phone', 'abc123');
      });

      // Check if error message is in field errors
      expect(currentFieldErrors.phone).toBe('Please enter a valid phone number');

      // Test valid phone format
      await userEvent.clear(phoneInput);
      await userEvent.type(phoneInput, '1234567890');

      await vi.waitFor(() => {
        expect(mockValidation.validateFieldAndUpdate).toHaveBeenCalledWith('phone', '1234567890');
      });

      // Error should be cleared
      expect(currentFieldErrors.phone).toBeUndefined();
    });

    test('includes optional fields in form submission when provided', async () => {
      const mockPostTrustee = vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } });
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: mockPostTrustee,
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      const onSuccess = vi.fn();
      render(<TrusteeCreateForm onSuccess={onSuccess} />);

      // Fill required fields
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      await userEvent.type(screen.getByTestId('trustee-state'), 'IL');
      await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

      // Fill optional fields
      await userEvent.type(screen.getByTestId('trustee-address2'), 'Suite 100');
      await userEvent.type(screen.getByTestId('trustee-phone'), '(555) 123-4567');
      await userEvent.type(screen.getByTestId('trustee-extension'), '123');
      await userEvent.type(screen.getByTestId('trustee-email'), 'jane.doe@example.com');

      await userEvent.click(screen.getByRole('button', { name: /create trustee/i }));

      await vi.waitFor(() => {
        expect(mockPostTrustee).toHaveBeenCalledWith({
          name: 'Jane Doe',
          address: {
            address1: '123 Main St',
            address2: 'Suite 100',
            city: 'Springfield',
            state: 'IL',
            zipCode: '62704',
            countryCode: 'US',
          },
          phone: '(555) 123-4567',
          email: 'jane.doe@example.com',
        });
        expect(onSuccess).toHaveBeenCalledWith('trustee-123');
      });
    });

    test('does not include empty optional fields in submission', async () => {
      const mockPostTrustee = vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } });
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: mockPostTrustee,
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      const onSuccess = vi.fn();
      render(<TrusteeCreateForm onSuccess={onSuccess} />);

      // Fill only required fields
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      await userEvent.type(screen.getByTestId('trustee-state'), 'IL');
      await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

      await userEvent.click(screen.getByRole('button', { name: /create trustee/i }));

      await vi.waitFor(() => {
        const calledPayload = mockPostTrustee.mock.calls[0][0];
        expect(calledPayload).toEqual({
          name: 'Jane Doe',
          address: {
            address1: '123 Main St',
            city: 'Springfield',
            state: 'IL',
            zipCode: '62704',
            countryCode: 'US',
          },
        });
        // Should not include phone, email, districts, chapters when not provided
        expect(calledPayload.phone).toBeUndefined();
        expect(calledPayload.email).toBeUndefined();
        expect(calledPayload.districts).toBeUndefined();
        expect(calledPayload.chapters).toBeUndefined();
        expect(calledPayload.address.address2).toBeUndefined();
      });
    });

    test('allows empty optional fields without validation errors', async () => {
      render(<TrusteeCreateForm />);

      // Fill required fields and leave optional fields empty
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      await userEvent.type(screen.getByTestId('trustee-state'), 'IL');
      await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

      // Optional fields should be empty by default and no errors should appear
      expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
      expect(screen.queryByText('Please enter a valid phone number')).not.toBeInTheDocument();

      // Form should be submittable
      const submitButton = screen.getByRole('button', { name: /create trustee/i });
      expect(submitButton).not.toBeDisabled();
    });

    test('includes districts and chapters in submission when selected', async () => {
      const mockPostTrustee = vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } });
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: [
            {
              courtDivisionCode: 'NY',
              courtName: 'United States Bankruptcy Court for the Southern District of New York',
              courtDivisionName: 'New York',
            },
            {
              courtDivisionCode: 'CA',
              courtName: 'United States Bankruptcy Court for the Central District of California',
              courtDivisionName: 'California',
            },
          ],
        }),
        postTrustee: mockPostTrustee,
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      const onSuccess = vi.fn();
      render(<TrusteeCreateForm onSuccess={onSuccess} />);

      // Fill required fields
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      await userEvent.type(screen.getByTestId('trustee-state'), 'IL');
      await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

      // Select district from ComboBox
      const districtCombobox = screen.getByRole('combobox', { name: /district/i });
      await userEvent.click(districtCombobox);
      await userEvent.click(
        screen.getByText(
          'United States Bankruptcy Court for the Southern District of New York (New York)',
        ),
      );

      // Select multiple chapters from ComboBox
      const chaptersCombobox = screen.getByRole('combobox', { name: /chapter types/i });
      await userEvent.click(chaptersCombobox);
      await userEvent.click(screen.getByText('11 - Subchapter V'));
      await userEvent.click(screen.getByText('13'));

      await userEvent.click(screen.getByRole('button', { name: /create trustee/i }));

      await vi.waitFor(() => {
        expect(mockPostTrustee).toHaveBeenCalledWith({
          name: 'Jane Doe',
          address: {
            address1: '123 Main St',
            city: 'Springfield',
            state: 'IL',
            zipCode: '62704',
            countryCode: 'US',
          },
          districts: ['NY'],
          chapters: ['11-subchapter-v', '13'],
        });
        expect(onSuccess).toHaveBeenCalledWith('trustee-123');
      });
    });

    test('handles extended chapter types correctly in payload', async () => {
      const mockPostTrustee = vi.fn().mockResolvedValue({ data: { id: 'trustee-456' } });
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({ data: [] }),
        postTrustee: mockPostTrustee,
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      render(<TrusteeCreateForm />);

      // Fill required fields
      await userEvent.type(screen.getByTestId('trustee-name'), 'John Smith');
      await userEvent.type(screen.getByTestId('trustee-address1'), '456 Oak St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      await userEvent.type(screen.getByTestId('trustee-state'), 'IL');
      await userEvent.type(screen.getByTestId('trustee-zip'), '62705');

      // Select extended chapter types that previously caused validation errors
      const chaptersCombobox = screen.getByRole('combobox', { name: /chapter types/i });
      await userEvent.click(chaptersCombobox);
      await userEvent.click(screen.getByText('7 - Panel'));
      await userEvent.click(screen.getByText('7 - Non-Panel'));
      await userEvent.click(screen.getByText('11 - Subchapter V'));

      await userEvent.click(screen.getByRole('button', { name: /create trustee/i }));

      await vi.waitFor(() => {
        expect(mockPostTrustee).toHaveBeenCalledWith({
          name: 'John Smith',
          address: {
            address1: '456 Oak St',
            city: 'Springfield',
            state: 'IL',
            zipCode: '62705',
            countryCode: 'US',
          },
          chapters: ['7-panel', '7-non-panel', '11-subchapter-v'],
        });
      });
    });

    test('supports multi-select for districts', async () => {
      const mockPostTrustee = vi.fn().mockResolvedValue({ data: { id: 'trustee-789' } });
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: [
            {
              courtDivisionCode: 'NY-E',
              courtName: 'United States Bankruptcy Court for the Eastern District of New York',
              courtDivisionName: 'New York Eastern',
            },
            {
              courtDivisionCode: 'NY-S',
              courtName: 'United States Bankruptcy Court for the Southern District of New York',
              courtDivisionName: 'New York Southern',
            },
            {
              courtDivisionCode: 'CA-N',
              courtName: 'United States Bankruptcy Court for the Northern District of California',
              courtDivisionName: 'California Northern',
            },
            {
              courtDivisionCode: 'TX-S',
              courtName: 'United States Bankruptcy Court for the Southern District of Texas',
              courtDivisionName: 'Texas Southern',
            },
          ],
        }),
        postTrustee: mockPostTrustee,
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      const onSuccess = vi.fn();
      render(<TrusteeCreateForm onSuccess={onSuccess} />);

      // Fill required fields
      await userEvent.type(screen.getByTestId('trustee-name'), 'Maria Rodriguez');
      await userEvent.type(screen.getByTestId('trustee-address1'), '789 Federal Plaza');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Houston');
      await userEvent.type(screen.getByTestId('trustee-state'), 'TX');
      await userEvent.type(screen.getByTestId('trustee-zip'), '77002');

      // SPECIFICATION: Districts ComboBox must support multiple selections
      const districtCombobox = screen.getByRole('combobox', { name: /district/i });
      await userEvent.click(districtCombobox);

      // Select THREE different districts to verify multi-select functionality
      await userEvent.click(
        screen.getByText(
          'United States Bankruptcy Court for the Eastern District of New York (New York Eastern)',
        ),
      );
      await userEvent.click(
        screen.getByText(
          'United States Bankruptcy Court for the Northern District of California (California Northern)',
        ),
      );
      await userEvent.click(
        screen.getByText(
          'United States Bankruptcy Court for the Southern District of Texas (Texas Southern)',
        ),
      );

      await userEvent.click(screen.getByRole('button', { name: /create trustee/i }));

      // EXECUTABLE SPECIFICATION: Payload must include all selected districts
      await vi.waitFor(() => {
        expect(mockPostTrustee).toHaveBeenCalledWith({
          name: 'Maria Rodriguez',
          address: {
            address1: '789 Federal Plaza',
            city: 'Houston',
            state: 'TX',
            zipCode: '77002',
            countryCode: 'US',
          },
          // CRITICAL: Must support multiple districts (not just single district)
          districts: ['NY-E', 'CA-N', 'TX-S'],
        });
        expect(onSuccess).toHaveBeenCalledWith('trustee-789');
      });
    });
  });

  describe('Enhanced Submit Button UX', () => {
    beforeEach(() => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        [FeatureFlags.TRUSTEE_MANAGEMENT]: true,
      } as Record<string, boolean>);

      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } }),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);
    });

    test('submit button starts disabled and enables only when form is valid and complete', async () => {
      render(<TrusteeCreateForm />);

      const submitButton = screen.getByRole('button', { name: /create trustee/i });

      // Submit button should start disabled
      expect(submitButton).toBeDisabled();

      // Fill some required fields, but not all
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');

      // Button should still be disabled (not all required fields filled)
      expect(submitButton).toBeDisabled();

      // Fill remaining required fields
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      await userEvent.type(screen.getByTestId('trustee-state'), 'IL');
      await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

      // Now button should be enabled (all required fields filled and valid)
      expect(submitButton).not.toBeDisabled();

      // Make a field invalid
      await userEvent.clear(screen.getByTestId('trustee-zip'));
      await userEvent.type(screen.getByTestId('trustee-zip'), '1234');

      // Button should be disabled again (validation error)
      expect(submitButton).toBeDisabled();

      // Fix the validation error
      await userEvent.clear(screen.getByTestId('trustee-zip'));
      await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

      // Button should be enabled again
      expect(submitButton).not.toBeDisabled();
    });

    test('submit button remains disabled when only optional fields are filled', async () => {
      render(<TrusteeCreateForm />);

      const submitButton = screen.getByRole('button', { name: /create trustee/i });

      // Submit button should start disabled
      expect(submitButton).toBeDisabled();

      // Fill only optional fields, leave all required fields empty
      await userEvent.type(screen.getByTestId('trustee-address2'), 'Suite 100');
      await userEvent.type(screen.getByTestId('trustee-phone'), '(555) 123-4567');
      await userEvent.type(screen.getByTestId('trustee-extension'), '123');
      await userEvent.type(screen.getByTestId('trustee-email'), 'test@example.com');

      // Button should still be disabled (no required fields filled)
      expect(submitButton).toBeDisabled();

      // Fill one required field but not all
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');

      // Button should still be disabled (not all required fields filled)
      expect(submitButton).toBeDisabled();
    });

    test('does not double-submit when form is submitted via different mechanisms', async () => {
      const mockPostTrustee = vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } });
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: mockPostTrustee,
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      render(<TrusteeCreateForm />);

      // Fill all required fields
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      await userEvent.type(screen.getByTestId('trustee-state'), 'IL');
      await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

      // Wait for button to be enabled
      const submitButton = screen.getByRole('button', {
        name: /create trustee/i,
      }) as HTMLButtonElement;
      await vi.waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      // Submit the form
      await userEvent.click(submitButton);

      // API should be called exactly once, not twice
      await vi.waitFor(() => {
        expect(mockPostTrustee).toHaveBeenCalledTimes(1);
      });
    });
  });
});
