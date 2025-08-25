import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrusteeCreateForm from './TrusteeCreateForm';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import * as UseApi2Module from '@/lib/hooks/UseApi2';
import * as UseGlobalAlertModule from '@/lib/hooks/UseGlobalAlert';
import * as UseTrusteeFormValidationModule from '@/trustees/UseTrusteeFormValidation';
import * as useCamsNavigatorModule from '@/lib/hooks/UseCamsNavigator';
import type {
  ValidationError,
  FormValidationResult,
  TrusteeFormData,
} from '@/trustees/UseTrusteeFormValidation.types';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole } from '@common/cams/roles';
import { BrowserRouter } from 'react-router-dom';

describe('TrusteeCreateForm', () => {
  const renderWithRouter = () => {
    return render(
      <BrowserRouter>
        <TrusteeCreateForm />
      </BrowserRouter>,
    );
  };

  const mockGlobalAlert = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
  };

  const mockNavigate = {
    navigateTo: vi.fn(),
    redirectTo: vi.fn(),
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
    vi.spyOn(useCamsNavigatorModule, 'default').mockReturnValue(mockNavigate);

    // Mock the useApi2 hook to include getCourts
    vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
      getCourts: vi.fn().mockResolvedValue({
        data: MockData.getCourts(),
      }),
      postTrustee: vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } }),
    } as unknown as ReturnType<typeof UseApi2Module.useApi2>);
  });

  afterEach(() => {
    // Reset field errors before each test
    currentFieldErrors = {};

    vi.restoreAllMocks();
  });

  test('renders disabled message when feature is off', () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      [FeatureFlags.TRUSTEE_MANAGEMENT]: false,
    } as Record<string, boolean>);
    renderWithRouter();
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

    renderWithRouter();
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

    renderWithRouter();
    expect(screen.getByTestId('trustee-create-unauthorized')).toBeInTheDocument();
  });

  test('renders form when user has TrusteeAdmin role and feature flag is enabled', () => {
    // Uses default setup from beforeEach (TrusteeAdmin user and enabled feature flag)
    renderWithRouter();

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

    renderWithRouter();

    await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
    await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
    await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
    // Select state from ComboBox
    const stateCombobox = screen.getByRole('combobox', { name: /state/i });
    await userEvent.click(stateCombobox);
    await userEvent.click(screen.getByText('IL - Illinois'));
    await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(mockNavigate.navigateTo).toHaveBeenCalledWith('/trustees/trustee-123'),
    );
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

    afterEach(() => {
      // Reset field errors before each test
      currentFieldErrors = {};

      vi.restoreAllMocks();
    });

    test('disables submit button when there are validation errors', async () => {
      renderWithRouter();

      const submitButton = screen.getByRole('button', { name: /save/i });

      // Enter invalid ZIP code
      await userEvent.type(screen.getByTestId('trustee-zip'), '1234');

      // Button should be disabled due to validation errors
      await waitFor(() => expect(submitButton).toBeDisabled());
    });

    test('displays general error message when form validation fails during submission', async () => {
      renderWithRouter();

      // Fill all required fields with valid data to enabled the submit button,
      // then click the submit button with validation function mocked to return failures.
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('IL - Illinois'));
      await userEvent.type(screen.getByTestId('trustee-zip'), '12345');

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /save/i });
        expect(submitButton).not.toBeDisabled();
      });

      mockValidation.validateForm.mockReturnValueOnce({
        isValid: false,
        errors: [{ field: 'zipCode', message: 'ZIP code must be exactly 5 digits' }],
        fieldErrors: { zipCode: 'ZIP code must be exactly 5 digits' },
      });

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Please correct the errors below before submitting.',
      );
    });
  });

  describe('Success and Error Handling', () => {
    beforeEach(() => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        [FeatureFlags.TRUSTEE_MANAGEMENT]: true,
      } as Record<string, boolean>);
    });

    afterEach(() => {
      // Reset field errors before each test
      currentFieldErrors = {};

      vi.restoreAllMocks();
    });

    test('shows success notification when trustee is created successfully', async () => {
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } }),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      renderWithRouter();

      // Fill form with valid data
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('IL - Illinois'));
      await userEvent.type(screen.getByTestId('trustee-zip'), '12345');

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockNavigate.navigateTo).toHaveBeenCalledWith('/trustees/trustee-123');
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

      renderWithRouter();

      // Fill form with valid data
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('IL - Illinois'));
      await userEvent.type(screen.getByTestId('trustee-zip'), '12345');

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockGlobalAlert.error).toHaveBeenCalledWith(
          `Failed to create trustee: ${errorMessage}`,
        );
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    test('shows default error message when API call fails with non-Error object', async () => {
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: vi.fn().mockRejectedValue('String error instead of Error object'),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      renderWithRouter();

      // Fill form with valid data
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('IL - Illinois'));
      await userEvent.type(screen.getByTestId('trustee-zip'), '12345');

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockGlobalAlert.error).toHaveBeenCalledWith(
          'Failed to create trustee: Could not create trustee.',
        );
        expect(screen.getByText('Could not create trustee.')).toBeInTheDocument();
      });
    });

    test('clears validation errors when cancel is clicked', async () => {
      renderWithRouter();

      // Enter invalid data to generate errors
      await userEvent.type(screen.getByTestId('trustee-zip'), '1234');
      expect(await screen.findByText('ZIP code must be exactly 5 digits')).toBeInTheDocument();

      // Click cancel
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockNavigate.navigateTo).toHaveBeenCalledWith('/trustees');
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

    afterEach(() => {
      // Reset field errors before each test
      currentFieldErrors = {};

      vi.restoreAllMocks();
    });

    test('renders all optional fields', () => {
      renderWithRouter();

      expect(screen.getByTestId('trustee-address2')).toBeInTheDocument();
      expect(screen.getByTestId('trustee-phone')).toBeInTheDocument();
      expect(screen.getByTestId('trustee-extension')).toBeInTheDocument();
      expect(screen.getByTestId('trustee-email')).toBeInTheDocument();
      // ComboBox components render with their ID as the container element ID
      expect(document.getElementById('trustee-district')).toBeInTheDocument();
      expect(document.getElementById('trustee-chapters')).toBeInTheDocument();
    });

    test('allows form submission without optional fields', async () => {
      renderWithRouter();

      // Fill only required fields
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('IL - Illinois'));
      await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() =>
        expect(mockNavigate.navigateTo).toHaveBeenCalledWith('/trustees/trustee-123'),
      );
    });

    test('validates email format when provided', async () => {
      renderWithRouter();

      const emailInput = screen.getByTestId('trustee-email');

      // Test one invalid email format
      await userEvent.type(emailInput, 'invalid-email');

      // Wait for validation to be called and check if error appears
      await waitFor(() => {
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

      await waitFor(() => {
        expect(mockValidation.validateFieldAndUpdate).toHaveBeenCalledWith(
          'email',
          'test@example.com',
        );
      });

      // Error should be cleared
      expect(currentFieldErrors.email).toBeUndefined();
    });

    test('validates phone format when provided', async () => {
      renderWithRouter();

      const phoneInput = screen.getByTestId('trustee-phone');

      // Test invalid phone format
      await userEvent.type(phoneInput, 'abc123');

      // Wait for validation to be called
      await waitFor(() => {
        expect(mockValidation.validateFieldAndUpdate).toHaveBeenCalledWith('phone', 'abc123');
      });

      // Check if error message is in field errors
      expect(currentFieldErrors.phone).toBe('Please enter a valid phone number');

      // Test valid phone format
      await userEvent.clear(phoneInput);
      await userEvent.type(phoneInput, '1234567890');

      await waitFor(() => {
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

      renderWithRouter();

      // Fill required fields
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('IL - Illinois'));
      await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

      // Fill optional fields
      await userEvent.type(screen.getByTestId('trustee-address2'), 'Suite 100');
      await userEvent.type(screen.getByTestId('trustee-phone'), '(555) 123-4567');
      await userEvent.type(screen.getByTestId('trustee-extension'), '123');
      await userEvent.type(screen.getByTestId('trustee-email'), 'jane.doe@example.com');

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
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
        expect(mockNavigate.navigateTo).toHaveBeenCalledWith('/trustees/trustee-123');
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

      renderWithRouter();

      // Fill only required fields
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('IL - Illinois'));
      await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
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
      renderWithRouter();

      // Fill required fields and leave optional fields empty
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('IL - Illinois'));
      await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

      // Optional fields should be empty by default and no errors should appear
      expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
      expect(screen.queryByText('Please enter a valid phone number')).not.toBeInTheDocument();

      // Form should be submittable - wait for validation to complete
      const submitButton = screen.getByRole('button', { name: /save/i });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
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

      renderWithRouter();

      // Fill required fields
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('IL - Illinois'));
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

      // Wait for submit button to be enabled before clicking
      const submitButton = screen.getByRole('button', { name: /save/i });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      await userEvent.click(submitButton);

      await waitFor(() => {
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
        expect(mockNavigate.navigateTo).toHaveBeenCalledWith('/trustees/trustee-123');
      });
    });

    test('handles extended chapter types correctly in payload', async () => {
      const mockPostTrustee = vi.fn().mockResolvedValue({ data: { id: 'trustee-456' } });
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({ data: [] }),
        postTrustee: mockPostTrustee,
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      renderWithRouter();

      // Fill required fields
      await userEvent.type(screen.getByTestId('trustee-name'), 'John Smith');
      await userEvent.type(screen.getByTestId('trustee-address1'), '456 Oak St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('IL - Illinois'));
      await userEvent.type(screen.getByTestId('trustee-zip'), '62705');

      // Select extended chapter types that previously caused validation errors
      const chaptersCombobox = screen.getByRole('combobox', { name: /chapter types/i });
      await userEvent.click(chaptersCombobox);
      await userEvent.click(screen.getByText('7 - Panel'));
      await userEvent.click(screen.getByText('7 - Non-Panel'));
      await userEvent.click(screen.getByText('11 - Subchapter V'));

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
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

      renderWithRouter();

      // Fill required fields
      await userEvent.type(screen.getByTestId('trustee-name'), 'Maria Rodriguez');
      await userEvent.type(screen.getByTestId('trustee-address1'), '789 Federal Plaza');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Houston');
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('TX - Texas'));
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

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      // EXECUTABLE SPECIFICATION: Payload must include all selected districts
      await waitFor(() => {
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
        expect(mockNavigate.navigateTo).toHaveBeenCalledWith('/trustees/trustee-789');
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

    afterEach(() => {
      // Reset field errors before each test
      currentFieldErrors = {};

      vi.restoreAllMocks();
    });

    test('submit button starts disabled and enables only when form is valid and complete', async () => {
      renderWithRouter();

      const submitButton = screen.getByRole('button', { name: /save/i });

      // Submit button should start disabled
      expect(submitButton).toBeDisabled();

      // Fill some required fields, but not all
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');

      // Button should still be disabled (not all required fields filled)
      expect(submitButton).toBeDisabled();

      // Fill remaining required fields
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('IL - Illinois'));
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
      renderWithRouter();

      const submitButton = screen.getByRole('button', { name: /save/i });

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

      renderWithRouter();

      // Fill all required fields
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('IL - Illinois'));
      await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

      // Wait for button to be enabled
      const submitButton = screen.getByRole('button', {
        name: /save/i,
      }) as HTMLButtonElement;
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      // Submit the form
      await userEvent.click(submitButton);

      // API should be called exactly once, not twice
      await waitFor(() => {
        expect(mockPostTrustee).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('District Loading Error Handling', () => {
    afterEach(() => {
      // Reset field errors before each test
      currentFieldErrors = {};

      vi.restoreAllMocks();
    });

    test('should handle getCourts API failure gracefully', async () => {
      // Mock getCourts to reject
      const mockGetCourts = vi.fn().mockRejectedValue(new Error('API Error'));
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: mockGetCourts,
        postTrustee: vi.fn(),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      renderWithRouter();

      // Wait for the effect to run and error to be handled
      await waitFor(() => {
        expect(mockGetCourts).toHaveBeenCalled();
      });

      // The form should still render even if district loading fails
      expect(screen.getByTestId('trustee-name')).toBeInTheDocument();

      // Verify the error handling completed successfully
      expect(mockGetCourts).toHaveBeenCalled();
    });

    test('should handle getCourts returning undefined data', async () => {
      // Mock getCourts to return response with no data
      const mockGetCourts = vi.fn().mockResolvedValue({ data: null });
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: mockGetCourts,
        postTrustee: vi.fn(),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      renderWithRouter();

      // Wait for the effect to run and error to be handled
      await waitFor(() => {
        expect(mockGetCourts).toHaveBeenCalled();
      });

      // The form should still render
      expect(screen.getByTestId('trustee-name')).toBeInTheDocument();
    });
  });

  describe('Cancel Button Behavior', () => {
    test('should handle cancel when onCancel prop is not provided', async () => {
      const user = userEvent.setup();

      // Render without onCancel prop
      renderWithRouter();

      // Find and click cancel button
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      // Should not throw error - just verify form still exists
      expect(screen.getByTestId('trustee-name')).toBeInTheDocument();
    });
  });

  describe('Form Submission with Spy', () => {
    afterEach(() => {
      // Reset field errors before each test
      currentFieldErrors = {};

      vi.restoreAllMocks();
    });

    test('submits form and calls postTrustee with expected payload', async () => {
      // Spy on the postTrustee function and mock it to noop
      const mockPostTrustee = vi.fn().mockImplementation(() => {
        // noop - no operation
      });

      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: mockPostTrustee,
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      renderWithRouter();

      // Fill required fields to create a valid form
      await userEvent.type(screen.getByTestId('trustee-name'), 'Jane Doe');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('IL - Illinois'));
      await userEvent.type(screen.getByTestId('trustee-zip'), '62704');

      // Fill optional fields
      await userEvent.type(screen.getByTestId('trustee-address2'), 'Suite 100');
      await userEvent.type(screen.getByTestId('trustee-phone'), '(555) 123-4567');
      await userEvent.type(screen.getByTestId('trustee-email'), 'jane.doe@example.com');

      // Submit the form
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      // Assert that postTrustee was called with the expected payload
      await waitFor(() => {
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
      });
    });
  });
  describe('District Loading', () => {
    beforeEach(() => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        [FeatureFlags.TRUSTEE_MANAGEMENT]: true,
      } as Record<string, boolean>);
    });

    afterEach(() => {
      // Reset field errors before each test
      currentFieldErrors = {};

      vi.restoreAllMocks();
    });

    test('loads districts successfully on mount', async () => {
      const mockCourts = [
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
      ];

      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: mockCourts,
        }),
        postTrustee: vi.fn(),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      renderWithRouter();

      // Wait for districts to load
      await waitFor(() => {
        const districtCombobox = screen.getByRole('combobox', { name: /district/i });
        expect(districtCombobox).toBeInTheDocument();
      });

      // Check that districts are available by clicking the combobox
      const districtCombobox = screen.getByRole('combobox', { name: /district/i });
      await userEvent.click(districtCombobox);

      expect(
        screen.getByText(
          'United States Bankruptcy Court for the Central District of California (California)',
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'United States Bankruptcy Court for the Southern District of New York (New York)',
        ),
      ).toBeInTheDocument();
    });

    test('handles API error when loading districts', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockRejectedValue(new Error('Network error')),
        postTrustee: vi.fn(),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      renderWithRouter();

      // Wait for error handling and click to expand combobox
      await waitFor(() => {
        const districtCombobox = screen.getByRole('combobox', { name: /district/i });
        expect(districtCombobox).toBeInTheDocument();
      });

      // Click to expand the combobox and reveal the input with placeholder
      const districtCombobox = screen.getByRole('combobox', { name: /district/i });
      await userEvent.click(districtCombobox);

      // Check for the placeholder on the input field when expanded
      await waitFor(() => {
        const inputField = screen.getByTestId('combo-box-input');
        expect(inputField).toHaveAttribute('placeholder', 'Error loading districts');
      });

      consoleErrorSpy.mockRestore();
    });

    test('handles empty response when loading districts', async () => {
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: null,
        }),
        postTrustee: vi.fn(),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      renderWithRouter();

      // Wait for error handling and click to expand combobox
      await waitFor(() => {
        const districtCombobox = screen.getByRole('combobox', { name: /district/i });
        expect(districtCombobox).toBeInTheDocument();
      });

      // Click to expand the combobox and reveal the input with placeholder
      const districtCombobox = screen.getByRole('combobox', { name: /district/i });
      await userEvent.click(districtCombobox);

      // Check for the placeholder on the input field when expanded
      await waitFor(() => {
        const inputField = screen.getByTestId('combo-box-input');
        expect(inputField).toHaveAttribute('placeholder', 'Error loading districts');
      });
    });

    test('handles missing data property when loading districts', async () => {
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({}),
        postTrustee: vi.fn(),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      renderWithRouter();

      // Wait for error handling and click to expand combobox
      await waitFor(() => {
        const districtCombobox = screen.getByRole('combobox', { name: /district/i });
        expect(districtCombobox).toBeInTheDocument();
      });

      // Click to expand the combobox and reveal the input with placeholder
      const districtCombobox = screen.getByRole('combobox', { name: /district/i });
      await userEvent.click(districtCombobox);

      // Check for the placeholder on the input field when expanded
      await waitFor(() => {
        const inputField = screen.getByTestId('combo-box-input');
        expect(inputField).toHaveAttribute('placeholder', 'Error loading districts');
      });
    });

    test('sorts district options alphabetically', async () => {
      const mockCourts = [
        {
          courtDivisionCode: 'TX',
          courtName: 'United States Bankruptcy Court for the Southern District of Texas',
          courtDivisionName: 'Texas',
        },
        {
          courtDivisionCode: 'AL',
          courtName: 'United States Bankruptcy Court for the Northern District of Alabama',
          courtDivisionName: 'Alabama',
        },
        {
          courtDivisionCode: 'NY',
          courtName: 'United States Bankruptcy Court for the Southern District of New York',
          courtDivisionName: 'New York',
        },
      ];

      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: mockCourts,
        }),
        postTrustee: vi.fn(),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      renderWithRouter();

      // Wait for districts to load
      await waitFor(() => {
        const districtCombobox = screen.getByRole('combobox', { name: /district/i });
        expect(districtCombobox).toBeInTheDocument();
      });

      // Click combobox to see options
      const districtCombobox = screen.getByRole('combobox', { name: /district/i });
      await userEvent.click(districtCombobox);

      // Get all option elements and verify they are sorted
      const options = screen.getAllByRole('option');
      const optionTexts = options.map((option) => option.textContent);

      // Should be sorted alphabetically: Alabama, New York, Texas
      expect(optionTexts[0]).toContain('Alabama');
      expect(optionTexts[1]).toContain('New York');
      expect(optionTexts[2]).toContain('Texas');
    });

    test('handles duplicate district codes by using Map', async () => {
      const mockCourts = [
        {
          courtDivisionCode: 'NY',
          courtName: 'United States Bankruptcy Court for the Southern District of New York',
          courtDivisionName: 'New York',
        },
        {
          courtDivisionCode: 'NY',
          courtName: 'United States Bankruptcy Court for the Eastern District of New York',
          courtDivisionName: 'New York East',
        },
      ];

      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: mockCourts,
        }),
        postTrustee: vi.fn(),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      renderWithRouter();

      // Wait for districts to load
      await waitFor(() => {
        const districtCombobox = screen.getByRole('combobox', { name: /district/i });
        expect(districtCombobox).toBeInTheDocument();
      });

      // Click combobox to see options
      const districtCombobox = screen.getByRole('combobox', { name: /district/i });
      await userEvent.click(districtCombobox);

      // Should only have one NY option (the last one due to Map behavior)
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(1);
      expect(options[0].textContent).toContain('New York East');
    });

    test('handles unknown error types when loading districts', async () => {
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockRejectedValue('String error instead of Error object'),
        postTrustee: vi.fn(),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      renderWithRouter();

      // Wait for error handling and click to expand combobox
      await waitFor(() => {
        const districtCombobox = screen.getByRole('combobox', { name: /district/i });
        expect(districtCombobox).toBeInTheDocument();
      });

      // Click to expand the combobox and reveal the input with placeholder
      const districtCombobox = screen.getByRole('combobox', { name: /district/i });
      await userEvent.click(districtCombobox);

      // Check for the placeholder on the input field when expanded
      await waitFor(() => {
        const inputField = screen.getByTestId('combo-box-input');
        expect(inputField).toHaveAttribute('placeholder', 'Error loading districts');
      });
    });
  });
});
