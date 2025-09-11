import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrusteeCreateForm from './TrusteeCreateForm';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import * as UseApi2Module from '@/lib/hooks/UseApi2';
import * as UseGlobalAlertModule from '@/lib/hooks/UseGlobalAlert';
import * as useCamsNavigatorModule from '@/lib/hooks/UseCamsNavigator';
import * as UseDebounceModule from '@/lib/hooks/UseDebounce';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole } from '@common/cams/roles';
import { BrowserRouter } from 'react-router-dom';
import { Mock } from 'vitest';

// Test data constants
const TEST_TRUSTEE_DATA = {
  name: 'Jane Doe',
  address1: '123 Main St',
  address2: 'Suite 100',
  city: 'Springfield',
  state: 'IL',
  stateLabel: 'IL - Illinois',
  zipCode: '62704',
  zipCodeAlternate: '12345',
  phone: '555-123-4567',
  email: 'jane.doe@example.com',
  extension: '123',
  invalidZip: '1234',
} as const;

// Alternative test personas for specific tests
const TEST_PERSONAS = {
  johnSmith: {
    name: 'John Smith',
    address1: '456 Oak St',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62705',
    phone: '555-123-4567',
    email: 'john.smith@example.com',
  },
  mariaRodriguez: {
    name: 'Maria Rodriguez',
    address1: '789 Federal Plaza',
    city: 'Houston',
    state: 'TX',
    stateLabel: 'TX - Texas',
    zipCode: '77002',
    phone: '555-987-6543',
    email: 'maria.rodriguez@example.com',
  },
} as const;

// Helper function to fill common form fields
async function fillBasicTrusteeForm(
  overrides: Partial<{
    name: string;
    address1: string;
    city: string;
    stateLabel: string;
    zipCode: string;
    phone: string;
    email: string;
  }> = {},
) {
  const data = { ...TEST_TRUSTEE_DATA, ...overrides };

  await userEvent.type(screen.getByTestId('trustee-name'), data.name);
  await userEvent.type(screen.getByTestId('trustee-address1'), data.address1);
  await userEvent.type(screen.getByTestId('trustee-city'), data.city);

  // Select state from ComboBox
  const stateCombobox = screen.getByRole('combobox', { name: /state/i });
  await userEvent.click(stateCombobox);
  await userEvent.click(screen.getByText(data.stateLabel));

  await userEvent.type(screen.getByTestId('trustee-zip'), data.zipCode);
  await userEvent.type(screen.getByTestId('trustee-phone'), data.phone);
  await userEvent.type(screen.getByTestId('trustee-email'), data.email);
}

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

  let postTrusteeSpy: Mock<(...args: unknown[]) => unknown>;

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

    // Mock useDebounce to execute immediately for testing
    vi.spyOn(UseDebounceModule, 'default').mockReturnValue(
      (callback: () => void, _delay: number) => {
        // Execute callback immediately in tests to avoid timing issues
        callback();
        return 0; // Return a fake timer ID
      },
    );

    vi.spyOn(UseGlobalAlertModule, 'useGlobalAlert').mockReturnValue(mockGlobalAlert);
    vi.spyOn(useCamsNavigatorModule, 'default').mockReturnValue(mockNavigate);

    postTrusteeSpy = vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } });

    // Mock the useApi2 hook to include getCourts
    vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
      getCourts: vi.fn().mockResolvedValue({
        data: MockData.getCourts(),
      }),
      postTrustee: postTrusteeSpy,
    } as unknown as ReturnType<typeof UseApi2Module.useApi2>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should not call the API when the submit button is clicked until the form is valid', async () => {
    renderWithRouter();

    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();

    // Click before entering data
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(document.querySelector('.usa-input__error-message')).toBeInTheDocument();
    });
    expect(postTrusteeSpy).not.toHaveBeenCalled();

    // Enter some data
    await userEvent.type(screen.getByTestId('trustee-name'), TEST_TRUSTEE_DATA.name);
    await userEvent.type(screen.getByTestId('trustee-address1'), TEST_TRUSTEE_DATA.address1);

    // Click again
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(document.querySelector('.usa-input__error-message')).toBeInTheDocument();
    });
    expect(postTrusteeSpy).not.toHaveBeenCalled();

    // Finish filling out the form
    await userEvent.type(screen.getByTestId('trustee-city'), TEST_TRUSTEE_DATA.city);
    const stateCombobox = screen.getByRole('combobox', { name: /state/i });
    await userEvent.click(stateCombobox);
    await userEvent.click(screen.getByText(TEST_TRUSTEE_DATA.stateLabel));
    await userEvent.type(screen.getByTestId('trustee-zip'), TEST_TRUSTEE_DATA.zipCode);
    await userEvent.type(screen.getByTestId('trustee-phone'), TEST_TRUSTEE_DATA.phone);
    await userEvent.type(screen.getByTestId('trustee-email'), TEST_TRUSTEE_DATA.email);

    // One last click to submit
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(document.querySelector('.usa-input__error-message')).not.toBeInTheDocument();
    });
    expect(postTrusteeSpy).toHaveBeenCalled();
  });

  test('renders disabled message when feature is off', async () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      [FeatureFlags.TRUSTEE_MANAGEMENT]: false,
    } as Record<string, boolean>);
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('trustee-create-disabled')).toBeInTheDocument();
    });
  });

  test('renders unauthorized message when user lacks TrusteeAdmin role', async () => {
    // Set up a user without TrusteeAdmin role
    const user = MockData.getCamsUser({ roles: [CamsRole.CaseAssignmentManager] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

    // Enable feature flag
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      [FeatureFlags.TRUSTEE_MANAGEMENT]: true,
    } as Record<string, boolean>);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('alert-container-forbidden-alert')).toBeInTheDocument();
      expect(screen.getByText('You do not have permission to manage Trustees')).toBeInTheDocument();
    });
  });

  test('renders unauthorized message when user has no roles', async () => {
    // Set up a user with no roles
    const user = MockData.getCamsUser({ roles: [] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

    // Enable feature flag
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      [FeatureFlags.TRUSTEE_MANAGEMENT]: true,
    } as Record<string, boolean>);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('alert-container-forbidden-alert')).toBeInTheDocument();
    });
  });

  test('renders form when user has TrusteeAdmin role and feature flag is enabled', async () => {
    // Uses default setup from beforeEach (TrusteeAdmin user and enabled feature flag)
    renderWithRouter();

    // Should render the form, not authorization messages
    await waitFor(() => {
      expect(screen.queryByTestId('trustee-create-disabled')).not.toBeInTheDocument();
      expect(screen.queryByTestId('trustee-create-unauthorized')).not.toBeInTheDocument();
      expect(screen.getByTestId('trustee-create-form')).toBeInTheDocument();
    });
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

    await fillBasicTrusteeForm();
    // Select status from ComboBox - status defaults to 'active' so it should already be selected

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(mockNavigate.navigateTo).toHaveBeenCalledWith('/trustees/trustee-123'),
    );
  });

  describe('Success and Error Handling', () => {
    beforeEach(() => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        [FeatureFlags.TRUSTEE_MANAGEMENT]: true,
      } as Record<string, boolean>);
    });

    afterEach(() => {
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
      await fillBasicTrusteeForm({ zipCode: TEST_TRUSTEE_DATA.zipCodeAlternate });

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
      await fillBasicTrusteeForm({ zipCode: '12345' });

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
      await fillBasicTrusteeForm({ zipCode: '12345' });

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
      await userEvent.tab(); // Trigger validation

      expect(
        await screen.findByText('ZIP code must be 5 digits or 9 digits with a hyphen'),
      ).toBeInTheDocument();

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
      vi.restoreAllMocks();
    });

    test('renders all optional fields', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('trustee-address2')).toBeInTheDocument();
      });
      expect(screen.getByTestId('trustee-phone')).toBeInTheDocument();
      expect(screen.getByTestId('trustee-extension')).toBeInTheDocument();
      expect(screen.getByTestId('trustee-email')).toBeInTheDocument();
      // ComboBox components render with their ID as the container element ID
      expect(document.getElementById('trustee-districts')).toBeInTheDocument();
      expect(document.getElementById('trustee-chapters')).toBeInTheDocument();
    });

    test('allows form submission with required fields', async () => {
      renderWithRouter();

      // Fill all required fields (including newly required phone and email)
      await fillBasicTrusteeForm();

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() =>
        expect(mockNavigate.navigateTo).toHaveBeenCalledWith('/trustees/trustee-123'),
      );
    });

    test('validates email format when provided', async () => {
      renderWithRouter();

      const emailInput = screen.getByTestId('trustee-email');

      // Test invalid email format - should show error message
      await userEvent.type(emailInput, 'invalid-email');
      await userEvent.tab(); // Trigger blur to activate validation

      // Wait for error message to appear in the UI
      await waitFor(() => {
        expect(screen.getByText('Email must be a valid email address')).toBeInTheDocument();
      });

      // Test valid email - error should disappear
      await userEvent.clear(emailInput);
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.tab();

      await waitFor(() => {
        expect(screen.queryByText('Email must be a valid email address')).not.toBeInTheDocument();
      });
    });

    test('validates phone format', async () => {
      renderWithRouter();

      const phoneInput = screen.getByTestId('trustee-phone');

      // Test invalid phone format - should show error message
      await userEvent.type(phoneInput, 'abc123');
      await userEvent.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByText('Phone is required')).toBeInTheDocument();
      });

      // Test valid phone format - error should disappear
      await userEvent.clear(phoneInput);
      await userEvent.type(phoneInput, '1234567890');
      await userEvent.tab();

      await waitFor(() => {
        expect(screen.queryByText('Phone is required')).not.toBeInTheDocument();
      });
    });

    test('validates extension format when provided', async () => {
      renderWithRouter();

      const extensionInput = screen.getByTestId('trustee-extension');

      // Test invalid extension format (too many digits)
      await userEvent.type(extensionInput, '1234567');
      await userEvent.tab();

      await waitFor(() => {
        expect(screen.getByText('Extension must be 1 to 6 digits')).toBeInTheDocument();
      });

      // Test valid extension format - error should disappear
      await userEvent.clear(extensionInput);
      await userEvent.type(extensionInput, '123');
      await userEvent.tab();

      await waitFor(() => {
        expect(screen.queryByText('Extension must be 1 to 6 digits')).not.toBeInTheDocument();
      });
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

      // Fill all required fields
      await userEvent.type(screen.getByTestId('trustee-name'), TEST_TRUSTEE_DATA.name);
      await userEvent.type(screen.getByTestId('trustee-address1'), TEST_TRUSTEE_DATA.address1);
      await userEvent.type(screen.getByTestId('trustee-city'), TEST_TRUSTEE_DATA.city);
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText(TEST_TRUSTEE_DATA.stateLabel));
      await userEvent.type(screen.getByTestId('trustee-zip'), TEST_TRUSTEE_DATA.zipCode);

      // Fill required phone and email fields
      await userEvent.type(screen.getByTestId('trustee-phone'), '(555) 123-4567');
      await userEvent.type(screen.getByTestId('trustee-email'), TEST_TRUSTEE_DATA.email);

      // Fill optional fields
      await userEvent.type(screen.getByTestId('trustee-address2'), TEST_TRUSTEE_DATA.address2);
      await userEvent.type(screen.getByTestId('trustee-extension'), TEST_TRUSTEE_DATA.extension);

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockPostTrustee).toHaveBeenCalledWith({
          name: TEST_TRUSTEE_DATA.name,
          public: {
            address: {
              address1: TEST_TRUSTEE_DATA.address1,
              address2: TEST_TRUSTEE_DATA.address2,
              city: TEST_TRUSTEE_DATA.city,
              state: TEST_TRUSTEE_DATA.state,
              zipCode: TEST_TRUSTEE_DATA.zipCode,
              countryCode: 'US',
            },
            phone: { number: '555-123-4567' },
            email: TEST_TRUSTEE_DATA.email,
          },
          status: 'active',
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

      // Fill all required fields (including newly required phone and email)
      await userEvent.type(screen.getByTestId('trustee-name'), TEST_TRUSTEE_DATA.name);
      await userEvent.type(screen.getByTestId('trustee-address1'), TEST_TRUSTEE_DATA.address1);
      await userEvent.type(screen.getByTestId('trustee-city'), TEST_TRUSTEE_DATA.city);
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText(TEST_TRUSTEE_DATA.stateLabel));
      await userEvent.type(screen.getByTestId('trustee-zip'), TEST_TRUSTEE_DATA.zipCode);

      // Add the new required fields
      await userEvent.type(screen.getByTestId('trustee-phone'), '(555) 123-4567');
      await userEvent.type(screen.getByTestId('trustee-email'), TEST_TRUSTEE_DATA.email);

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        const calledPayload = mockPostTrustee.mock.calls[0][0];
        expect(calledPayload).toEqual({
          name: TEST_TRUSTEE_DATA.name,
          public: {
            address: {
              address1: TEST_TRUSTEE_DATA.address1,
              city: TEST_TRUSTEE_DATA.city,
              state: TEST_TRUSTEE_DATA.state,
              zipCode: TEST_TRUSTEE_DATA.zipCode,
              countryCode: 'US',
            },
            phone: { number: '555-123-4567' },
            email: TEST_TRUSTEE_DATA.email,
          },
          status: 'active',
        });
        // Should not include districts, chapters, address2 when not provided
        expect(calledPayload.districts).toBeUndefined();
        expect(calledPayload.chapters).toBeUndefined();
        expect(calledPayload.public.address.address2).toBeUndefined();
      });
    });

    test('allows empty optional fields without validation errors', async () => {
      renderWithRouter();

      // Fill all required fields (including newly required phone and email)
      await fillBasicTrusteeForm();

      // Optional fields (address2, extension) should be empty by default and no errors should appear
      expect(screen.queryByText('Extension must be 1 to 6 digits')).not.toBeInTheDocument();

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
      const trusteeName = screen.getByTestId('trustee-name');
      await userEvent.type(trusteeName, TEST_TRUSTEE_DATA.name);
      expect(trusteeName).toHaveValue(TEST_TRUSTEE_DATA.name);

      const trusteeAddress1 = screen.getByTestId('trustee-address1');
      await userEvent.type(trusteeAddress1, TEST_TRUSTEE_DATA.address1);
      expect(trusteeAddress1).toHaveValue(TEST_TRUSTEE_DATA.address1);

      const trusteeCity = screen.getByTestId('trustee-city');
      await userEvent.type(trusteeCity, TEST_TRUSTEE_DATA.city);
      expect(trusteeCity).toHaveValue(TEST_TRUSTEE_DATA.city);

      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText(TEST_TRUSTEE_DATA.stateLabel));

      const trusteeZip = screen.getByTestId('trustee-zip');
      await userEvent.type(trusteeZip, TEST_TRUSTEE_DATA.zipCode);
      expect(trusteeZip).toHaveValue(TEST_TRUSTEE_DATA.zipCode);

      // Add the new required fields
      await userEvent.type(screen.getByTestId('trustee-phone'), TEST_TRUSTEE_DATA.phone);
      await userEvent.type(screen.getByTestId('trustee-email'), TEST_TRUSTEE_DATA.email);

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
      const submitButton = screen.getByTestId('button-submit-button');
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPostTrustee).toHaveBeenCalledWith({
          name: TEST_TRUSTEE_DATA.name,
          public: {
            address: {
              address1: TEST_TRUSTEE_DATA.address1,
              city: TEST_TRUSTEE_DATA.city,
              state: TEST_TRUSTEE_DATA.state,
              zipCode: TEST_TRUSTEE_DATA.zipCode,
              countryCode: 'US',
            },
            phone: { number: TEST_TRUSTEE_DATA.phone },
            email: TEST_TRUSTEE_DATA.email,
          },
          districts: ['NY'],
          chapters: ['11-subchapter-v', '13'],
          status: 'active',
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
      await userEvent.type(screen.getByTestId('trustee-name'), TEST_PERSONAS.johnSmith.name);
      await userEvent.type(
        screen.getByTestId('trustee-address1'),
        TEST_PERSONAS.johnSmith.address1,
      );
      await userEvent.type(screen.getByTestId('trustee-city'), TEST_PERSONAS.johnSmith.city);
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('IL - Illinois'));
      await userEvent.type(screen.getByTestId('trustee-zip'), TEST_PERSONAS.johnSmith.zipCode);

      // Add the new required fields
      await userEvent.type(screen.getByTestId('trustee-phone'), TEST_PERSONAS.johnSmith.phone);
      await userEvent.type(screen.getByTestId('trustee-email'), TEST_PERSONAS.johnSmith.email);

      // Select extended chapter types that previously caused validation errors
      const chaptersCombobox = screen.getByRole('combobox', { name: /chapter types/i });
      await userEvent.click(chaptersCombobox);
      await userEvent.click(screen.getByText('7 - Panel'));
      await userEvent.click(screen.getByText('7 - Non-Panel'));
      await userEvent.click(screen.getByText('11 - Subchapter V'));

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockPostTrustee).toHaveBeenCalledWith({
          name: TEST_PERSONAS.johnSmith.name,
          public: {
            address: {
              address1: TEST_PERSONAS.johnSmith.address1,
              city: TEST_PERSONAS.johnSmith.city,
              state: TEST_PERSONAS.johnSmith.state,
              zipCode: TEST_PERSONAS.johnSmith.zipCode,
              countryCode: 'US',
            },
            phone: { number: TEST_PERSONAS.johnSmith.phone },
            email: TEST_PERSONAS.johnSmith.email,
          },
          chapters: ['7-panel', '7-non-panel', '11-subchapter-v'],
          status: 'active',
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
      await userEvent.type(screen.getByTestId('trustee-name'), TEST_PERSONAS.mariaRodriguez.name);
      await userEvent.type(
        screen.getByTestId('trustee-address1'),
        TEST_PERSONAS.mariaRodriguez.address1,
      );
      await userEvent.type(screen.getByTestId('trustee-city'), TEST_PERSONAS.mariaRodriguez.city);
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText(TEST_PERSONAS.mariaRodriguez.stateLabel));
      await userEvent.type(screen.getByTestId('trustee-zip'), TEST_PERSONAS.mariaRodriguez.zipCode);

      // Add the new required fields
      await userEvent.type(screen.getByTestId('trustee-phone'), TEST_PERSONAS.mariaRodriguez.phone);
      await userEvent.type(screen.getByTestId('trustee-email'), TEST_PERSONAS.mariaRodriguez.email);

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
          name: TEST_PERSONAS.mariaRodriguez.name,
          public: {
            address: {
              address1: TEST_PERSONAS.mariaRodriguez.address1,
              city: TEST_PERSONAS.mariaRodriguez.city,
              state: TEST_PERSONAS.mariaRodriguez.state,
              zipCode: TEST_PERSONAS.mariaRodriguez.zipCode,
              countryCode: 'US',
            },
            phone: { number: TEST_PERSONAS.mariaRodriguez.phone },
            email: TEST_PERSONAS.mariaRodriguez.email,
          },
          // CRITICAL: Must support multiple districts (not just single district)
          districts: ['NY-E', 'CA-N', 'TX-S'],
          status: 'active',
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
      vi.restoreAllMocks();
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
      await fillBasicTrusteeForm();

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
    afterEach(() => {
      vi.restoreAllMocks();
    });

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
    beforeEach(() => {
      // Re-establish the useDebounce mock since this describe block restores all mocks
      vi.spyOn(UseDebounceModule, 'default').mockReturnValue(
        (callback: () => void, _delay: number) => {
          // Execute callback immediately in tests to avoid timing issues
          callback();
          return 0; // Return a dummy timer ID
        },
      );
    });

    afterEach(() => {
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
      await userEvent.type(screen.getByTestId('trustee-name'), TEST_TRUSTEE_DATA.name);
      await userEvent.type(screen.getByTestId('trustee-address1'), TEST_TRUSTEE_DATA.address1);
      await userEvent.type(screen.getByTestId('trustee-city'), TEST_TRUSTEE_DATA.city);
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText(TEST_TRUSTEE_DATA.stateLabel));
      await userEvent.type(screen.getByTestId('trustee-zip'), TEST_TRUSTEE_DATA.zipCode);

      // Fill optional fields
      await userEvent.type(screen.getByTestId('trustee-address2'), TEST_TRUSTEE_DATA.address2);
      await userEvent.type(screen.getByTestId('trustee-phone'), '(555) 123-4567');
      await userEvent.type(screen.getByTestId('trustee-email'), TEST_TRUSTEE_DATA.email);

      // Submit the form
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      // Assert that postTrustee was called with the expected payload
      await waitFor(() => {
        expect(mockPostTrustee).toHaveBeenCalledWith({
          name: TEST_TRUSTEE_DATA.name,
          public: {
            address: {
              address1: TEST_TRUSTEE_DATA.address1,
              address2: TEST_TRUSTEE_DATA.address2,
              city: TEST_TRUSTEE_DATA.city,
              state: TEST_TRUSTEE_DATA.state,
              zipCode: TEST_TRUSTEE_DATA.zipCode,
              countryCode: 'US',
            },
            phone: { number: '555-123-4567' },
            email: TEST_TRUSTEE_DATA.email,
          },
          status: 'active',
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
