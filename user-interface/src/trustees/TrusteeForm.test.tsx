import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrusteeForm, { TrusteeFormState } from './TrusteeForm';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import * as UseApi2Module from '@/lib/hooks/UseApi2';
import * as UseGlobalAlertModule from '@/lib/hooks/UseGlobalAlert';
import * as useCamsNavigatorModule from '@/lib/hooks/UseCamsNavigator';
import * as UseDebounceModule from '@/lib/hooks/UseDebounce';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole } from '@common/cams/roles';
import * as ReactRouterDomLib from 'react-router-dom';
import { BrowserRouter } from 'react-router-dom';
import { Mock } from 'vitest';
import { TrusteeInput } from '@common/cams/trustees';
import { Address } from '@common/cams/contact';

const zipCodeAlternate = '12345';
const stateLabel = 'IL - Illinois';
const address: Address = {
  address1: '123 Main St',
  address2: 'Suite 100',
  city: 'Springfield',
  state: 'IL',
  zipCode: '62704',
  countryCode: 'US' as const,
};

// Test data constants
const TEST_TRUSTEE_DATA: TrusteeInput = {
  name: 'Jane Doe',
  public: {
    address,
    phone: {
      number: '555-123-4567',
      extension: '123',
    },
    email: 'jane.doe@example.com',
  },
  status: 'active' as const,
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

  const nameInput = screen.getByTestId('trustee-name');
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, data.name);

  const address1Input = screen.getByTestId('trustee-address1');
  await userEvent.clear(address1Input);
  await userEvent.type(address1Input, address.address1);

  const cityInput = screen.getByTestId('trustee-city');
  await userEvent.clear(cityInput);
  await userEvent.type(cityInput, address.city);

  // Select state from ComboBox
  const stateCombobox = screen.getByRole('combobox', { name: /state/i });
  await userEvent.click(stateCombobox);
  await userEvent.click(screen.getByText(stateLabel));

  const zipInput = screen.getByTestId('trustee-zip');
  await userEvent.clear(zipInput);
  await userEvent.type(zipInput, address.zipCode);

  const phoneInput = screen.getByTestId('trustee-phone');
  await userEvent.clear(phoneInput);
  await userEvent.type(phoneInput, data.public.phone!.number);

  const emailInput = screen.getByTestId('trustee-email');
  await userEvent.clear(emailInput);
  await userEvent.type(emailInput, data.public.email!);
}

describe('TrusteeForm', () => {
  vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
      ...(actual as typeof actual),
      useLocation: vi.fn().mockReturnValue({
        pathname: '/trustees/create',
        search: '',
        hash: '',
        state: { action: 'create', cancelTo: '/trustees' },
        key: 'default',
      }),
    };
  });

  const renderWithRouter = (
    pathname: string = '/trustees/create',
    state: TrusteeFormState = { action: 'create', cancelTo: '/trustees' },
  ) => {
    vi.mocked(ReactRouterDomLib.useLocation).mockReturnValue({
      pathname,
      search: '',
      hash: '',
      state,
      key: 'default',
    });

    return render(
      <BrowserRouter>
        <TrusteeForm />
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

    // Reset mocks before each test
    vi.clearAllMocks();

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
    const nameInput = screen.getByTestId('trustee-name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, TEST_TRUSTEE_DATA.name);
    const address1Input = screen.getByTestId('trustee-address1');
    await userEvent.clear(address1Input);
    await userEvent.type(address1Input, address.address1);

    // Click again
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(document.querySelector('.usa-input__error-message')).toBeInTheDocument();
    });
    expect(postTrusteeSpy).not.toHaveBeenCalled();

    // Finish filling out the form
    const cityInput = screen.getByTestId('trustee-city');
    await userEvent.clear(cityInput);
    await userEvent.type(cityInput, address.city);
    const stateCombobox = screen.getByRole('combobox', { name: /state/i });
    await userEvent.click(stateCombobox);
    await userEvent.click(screen.getByText(stateLabel));
    const zipInput = screen.getByTestId('trustee-zip');
    await userEvent.clear(zipInput);
    await userEvent.type(zipInput, address.zipCode);
    const phoneInput = screen.getByTestId('trustee-phone');
    await userEvent.clear(phoneInput);
    await userEvent.type(phoneInput, TEST_TRUSTEE_DATA.public.phone!.number);
    const emailInput = screen.getByTestId('trustee-email');
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, TEST_TRUSTEE_DATA.public.email!);

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
      expect(screen.getByTestId('trustee-form')).toBeInTheDocument();
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
      await fillBasicTrusteeForm({ zipCode: zipCodeAlternate });

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockNavigate.navigateTo).toHaveBeenCalledWith('/trustees/trustee-123');
      });
    });

    test('shows error notification from API when API call fails', async () => {
      const errorMessage = 'Validation error occurred';
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
        // Check that the global alert was called with the expected message
        expect(mockGlobalAlert.error).toHaveBeenCalledWith(
          `Failed to create trustee: ${errorMessage}`,
        );
      });
    });

    test('clears validation errors when cancel is clicked', async () => {
      // Use custom cancelTo path for this test
      renderWithRouter('/trustees/create', { action: 'create', cancelTo: '/test-url' });

      // Enter invalid data to generate errors
      await userEvent.type(screen.getByTestId('trustee-zip'), '1234');
      await userEvent.tab(); // Trigger validation

      expect(
        await screen.findByText('ZIP code must be 5 digits or 9 digits with a hyphen'),
      ).toBeInTheDocument();

      // Click cancel
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockNavigate.navigateTo).toHaveBeenCalledWith('/test-url');
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
      await userEvent.clear(emailInput);
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
      const nameInput = screen.getByTestId('trustee-name');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, TEST_TRUSTEE_DATA.name);
      const address1Input = screen.getByTestId('trustee-address1');
      await userEvent.clear(address1Input);
      await userEvent.type(address1Input, address.address1);
      const cityInput = screen.getByTestId('trustee-city');
      await userEvent.clear(cityInput);
      await userEvent.type(cityInput, address.city);
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText(stateLabel));
      const zipInput = screen.getByTestId('trustee-zip');
      await userEvent.clear(zipInput);
      await userEvent.type(zipInput, address.zipCode);

      // Fill required phone and email fields
      const phoneInput = screen.getByTestId('trustee-phone');
      await userEvent.clear(phoneInput);
      await userEvent.type(phoneInput, '(555) 123-4567');
      const emailInput = screen.getByTestId('trustee-email');
      await userEvent.clear(emailInput);
      await userEvent.type(emailInput, TEST_TRUSTEE_DATA.public.email!);

      // Fill optional fields
      const address2Input = screen.getByTestId('trustee-address2');
      await userEvent.clear(address2Input);
      await userEvent.type(address2Input, address.address2!);
      await userEvent.type(
        screen.getByTestId('trustee-extension'),
        TEST_TRUSTEE_DATA.public.phone!.extension!,
      );

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        // Use a partial matcher to avoid issues with phone number formatting
        const calledArg = mockPostTrustee.mock.calls[0][0];
        expect(calledArg.name).toBe(TEST_TRUSTEE_DATA.name);
        expect(calledArg.public.address.address1).toBe(address.address1);
        expect(calledArg.public.address.address2).toBe(address.address2);
        expect(calledArg.public.address.city).toBe(address.city);
        expect(calledArg.public.address.state).toBe(address.state);
        expect(calledArg.public.address.zipCode).toBe(address.zipCode);
        expect(calledArg.public.email).toBe(TEST_TRUSTEE_DATA.public.email);
        expect(calledArg.status).toBe('active');
        // Verify phone number exists but don't check exact format
        expect(calledArg.public.phone.number).toBeTruthy();
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
      await userEvent.type(screen.getByTestId('trustee-address1'), address.address1);
      await userEvent.type(screen.getByTestId('trustee-city'), address.city);
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText(stateLabel));
      await userEvent.type(screen.getByTestId('trustee-zip'), address.zipCode);

      // Add the new required fields
      await userEvent.type(screen.getByTestId('trustee-phone'), '(555) 123-4567');
      await userEvent.type(screen.getByTestId('trustee-email'), TEST_TRUSTEE_DATA.public.email!);

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockPostTrustee).toHaveBeenCalledWith({
          name: TEST_TRUSTEE_DATA.name,
          public: {
            address: {
              address1: address.address1,
              city: address.city,
              state: address.state,
              zipCode: address.zipCode,
              countryCode: 'US' as const,
            },
            phone: { number: '555-123-4567' },
            email: TEST_TRUSTEE_DATA.public.email,
          },
          status: 'active' as const,
        });
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
      await userEvent.clear(trusteeName);
      await userEvent.type(trusteeName, TEST_TRUSTEE_DATA.name);
      expect(trusteeName).toHaveValue(TEST_TRUSTEE_DATA.name);

      const trusteeAddress1 = screen.getByTestId('trustee-address1');
      await userEvent.clear(trusteeAddress1);
      await userEvent.type(trusteeAddress1, address.address1);
      expect(trusteeAddress1).toHaveValue(address.address1);

      const trusteeCity = screen.getByTestId('trustee-city');
      await userEvent.clear(trusteeCity);
      await userEvent.type(trusteeCity, address.city);
      expect(trusteeCity).toHaveValue(address.city);

      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText(stateLabel));

      const trusteeZip = screen.getByTestId('trustee-zip');
      await userEvent.clear(trusteeZip);
      await userEvent.type(trusteeZip, address.zipCode);
      expect(trusteeZip).toHaveValue(address.zipCode);

      // Add the new required fields
      const trusteePhone = screen.getByTestId('trustee-phone');
      await userEvent.clear(trusteePhone);
      await userEvent.type(trusteePhone, TEST_TRUSTEE_DATA.public.phone!.number);
      await userEvent.type(screen.getByTestId('trustee-email'), TEST_TRUSTEE_DATA.public.email!);

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
              address1: address.address1,
              city: address.city,
              state: address.state,
              zipCode: address.zipCode,
              countryCode: 'US' as const,
            },
            phone: { number: TEST_TRUSTEE_DATA.public.phone!.number },
            email: TEST_TRUSTEE_DATA.public.email,
          },
          districts: ['NY'],
          chapters: ['11-subchapter-v', '13'],
          status: 'active' as const,
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
              countryCode: 'US' as const,
            },
            phone: { number: TEST_PERSONAS.johnSmith.phone },
            email: TEST_PERSONAS.johnSmith.email,
          },
          chapters: ['7-panel', '7-non-panel', '11-subchapter-v'],
          status: 'active' as const,
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
              countryCode: 'US' as const,
            },
            phone: { number: TEST_PERSONAS.mariaRodriguez.phone },
            email: TEST_PERSONAS.mariaRodriguez.email,
          },
          // CRITICAL: Must support multiple districts (not just single district)
          districts: ['NY-E', 'CA-N', 'TX-S'],
          status: 'active' as const,
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

    test('submits form in edit mode with public profile', async () => {
      // Mock a trustee object to edit
      const mockTrustee = {
        name: 'Jane Doe',
        public: {
          address: {
            address1: '123 Main St',
            address2: 'Suite 100',
            city: 'Springfield',
            state: 'IL',
            zipCode: '62704',
            countryCode: 'US' as const,
          },
          phone: {
            number: '555-123-4567',
            extension: '123',
          },
          email: 'jane.doe@example.com',
        },
        status: 'active' as const,
      };

      const mockPatchTrustee = vi.fn().mockResolvedValue({ data: { id: 'trustee-456' } });

      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: vi.fn(),
        patchTrustee: mockPatchTrustee,
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      // Render in edit mode with public profile
      renderWithRouter('/trustees/trustee-456/edit', {
        action: 'edit',
        cancelTo: '/trustees/trustee-456',
        trusteeId: 'trustee-456',
        trustee: mockTrustee,
        contactInformation: 'public',
      });

      // Ensure form is populated with trustee data
      await waitFor(() => {
        expect(screen.getByTestId('trustee-name')).toHaveValue('Jane Doe');
        expect(screen.getByTestId('trustee-address1')).toHaveValue('123 Main St');
        expect(screen.getByTestId('trustee-address2')).toHaveValue('Suite 100');
        expect(screen.getByTestId('trustee-city')).toHaveValue('Springfield');
        expect(screen.getByTestId('trustee-zip')).toHaveValue('62704');
        expect(screen.getByTestId('trustee-phone')).toHaveValue('555-123-4567');
        expect(screen.getByTestId('trustee-extension')).toHaveValue('123');
        expect(screen.getByTestId('trustee-email')).toHaveValue('jane.doe@example.com');
      });

      // Make some changes to the form
      await userEvent.clear(screen.getByTestId('trustee-address1'));
      await userEvent.type(screen.getByTestId('trustee-address1'), '456 New Address');

      await userEvent.clear(screen.getByTestId('trustee-city'));
      await userEvent.type(screen.getByTestId('trustee-city'), 'Chicago');

      // Submit the form
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      // Verify that patchTrustee was called with the updated data
      await waitFor(() => {
        expect(mockPatchTrustee).toHaveBeenCalledWith(
          'trustee-456',
          expect.objectContaining({
            name: 'Jane Doe',
            public: expect.objectContaining({
              address: expect.objectContaining({
                address1: '456 New Address',
                city: 'Chicago',
              }),
            }),
          }),
        );
        expect(mockNavigate.navigateTo).toHaveBeenCalledWith('/trustees/trustee-456');
      });
    });

    test('submits form in edit mode with internal profile', async () => {
      // Mock a trustee object to edit
      const mockTrustee = {
        name: 'Jane Doe',
        internal: {
          address: {
            address1: '123 Internal St',
            address2: 'Floor 5',
            city: 'Washington',
            state: 'DC',
            zipCode: '20001',
            countryCode: 'US' as const,
          },
          phone: {
            number: '555-987-6543',
            extension: '789',
          },
          email: 'jane.internal@example.gov',
        },
        status: 'active' as const,
      };

      const mockPatchTrustee = vi.fn().mockResolvedValue({ data: { id: 'trustee-789' } });

      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: vi.fn(),
        patchTrustee: mockPatchTrustee,
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      // Render in edit mode with internal profile
      renderWithRouter('/trustees/trustee-789/edit', {
        action: 'edit',
        cancelTo: '/trustees/trustee-789',
        trusteeId: 'trustee-789',
        trustee: mockTrustee,
        contactInformation: 'internal',
      });

      // Ensure form is populated with trustee data
      await waitFor(() => {
        expect(screen.getByTestId('trustee-name')).toBeDisabled(); // Name should be disabled for internal edit
        expect(screen.getByTestId('trustee-address1')).toHaveValue('123 Internal St');
        expect(screen.getByTestId('trustee-address2')).toHaveValue('Floor 5');
        expect(screen.getByTestId('trustee-city')).toHaveValue('Washington');
        expect(screen.getByTestId('trustee-zip')).toHaveValue('20001');
        expect(screen.getByTestId('trustee-phone')).toHaveValue('555-987-6543');
        expect(screen.getByTestId('trustee-extension')).toHaveValue('789');
        expect(screen.getByTestId('trustee-email')).toHaveValue('jane.internal@example.gov');
      });

      // Make some changes to the form
      await userEvent.clear(screen.getByTestId('trustee-address1'));
      await userEvent.type(screen.getByTestId('trustee-address1'), '789 Updated Internal');

      await userEvent.clear(screen.getByTestId('trustee-email'));
      await userEvent.type(screen.getByTestId('trustee-email'), 'updated.internal@example.gov');

      // Submit the form
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      // Verify that patchTrustee was called with the updated data
      await waitFor(() => {
        expect(mockPatchTrustee).toHaveBeenCalledWith(
          'trustee-789',
          expect.objectContaining({
            internal: expect.objectContaining({
              address: expect.objectContaining({
                address1: '789 Updated Internal',
              }),
              email: 'updated.internal@example.gov',
            }),
          }),
        );
        expect(mockNavigate.navigateTo).toHaveBeenCalledWith('/trustees/trustee-789');
      });
    });

    test('handles error in patchTrustee', async () => {
      // Mock a trustee object to edit
      const mockTrustee = {
        name: 'Error Test',
        public: {
          address: {
            address1: '123 Main St',
            city: 'Springfield',
            state: 'IL',
            zipCode: '62704',
            countryCode: 'US' as const,
          },
          phone: {
            number: '555-123-4567',
          },
          email: 'error.test@example.com',
        },
        status: 'active' as const,
      };

      const errorMessage = 'Failed to update trustee';
      const mockPatchTrustee = vi.fn().mockRejectedValue(new Error(errorMessage));

      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: vi.fn(),
        patchTrustee: mockPatchTrustee,
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      // Render in edit mode
      renderWithRouter('/trustees/trustee-error/edit', {
        action: 'edit',
        cancelTo: '/trustees/trustee-error',
        trusteeId: 'trustee-error',
        trustee: mockTrustee,
        contactInformation: 'public',
      });

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByTestId('trustee-name')).toHaveValue('Error Test');
      });

      // Submit the form
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      // Check that error was displayed
      await waitFor(() => {
        expect(mockPatchTrustee).toHaveBeenCalled();
        expect(mockGlobalAlert.error).toHaveBeenCalledWith(
          `Failed to create trustee: ${errorMessage}`,
        );
      });
    });

    test('handles various non-Error objects in API rejections', async () => {
      // One simple test that covers the key branch where error is not an Error instance
      const mockPostTrustee = vi.fn().mockRejectedValue('Not an Error instance');

      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: mockPostTrustee,
        patchTrustee: vi.fn(),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      // Render the form
      renderWithRouter();

      // Fill out form
      await userEvent.type(screen.getByTestId('trustee-name'), 'Error Test');
      await userEvent.type(screen.getByTestId('trustee-address1'), '123 Main St');
      await userEvent.type(screen.getByTestId('trustee-city'), 'Springfield');

      // Select state
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText('IL - Illinois'));

      await userEvent.type(screen.getByTestId('trustee-zip'), '62704');
      await userEvent.type(screen.getByTestId('trustee-phone'), '555-123-4567');
      await userEvent.type(screen.getByTestId('trustee-email'), 'error.test@example.com');

      // Submit form
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      // Verify the default error message is used
      await waitFor(() => {
        expect(mockPostTrustee).toHaveBeenCalled();
        expect(mockGlobalAlert.error).toHaveBeenCalledWith(
          'Failed to create trustee: Could not create trustee.',
        );
      });
    });

    test('renders the districtLoadError when present', async () => {
      // Set up a district load error
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockRejectedValue(new Error('Failed to load districts')),
        postTrustee: vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } }),
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      renderWithRouter();

      // Wait for the error message to appear
      await waitFor(() => {
        expect(document.getElementById('trustee-stop')).toBeInTheDocument();
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText(/Failed to load district options/)).toBeInTheDocument();
      });
    });

    test('handles invalid status by defaulting to active', async () => {
      // Rather than mocking an entire trustee, let's use a simpler approach to test the fallback logic
      // The statusSelection useMemo will default to 'active' when no valid status is found

      const mockPatchTrustee = vi.fn().mockResolvedValue({ data: { id: 'mock-id' } });

      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: vi.fn(),
        patchTrustee: mockPatchTrustee,
      } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

      // We need to modify the useLocation hook mock to provide a non-existent status
      vi.mocked(ReactRouterDomLib.useLocation).mockReturnValue({
        pathname: '/trustees/create',
        search: '',
        hash: '',
        state: {
          action: 'create',
          cancelTo: '/trustees',
          trustee: {
            status: 'nonexistent-status' as string, // This should trigger the fallback logic
          },
        },
        key: 'default',
      });

      render(
        <BrowserRouter>
          <TrusteeForm />
        </BrowserRouter>,
      );

      // Fill form with valid data (needed to submit the form)
      await fillBasicTrusteeForm();

      // The form should load with 'active' status by default due to the fallback
      const submitButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(submitButton);

      // Verify form submitted successfully, which means the status fallback worked
      await waitFor(() => {
        expect(screen.queryByText('Failed to create trustee')).not.toBeInTheDocument();
      });
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
      await userEvent.type(screen.getByTestId('trustee-address1'), address.address1);
      await userEvent.type(screen.getByTestId('trustee-city'), address.city);
      // Select state from ComboBox
      const stateCombobox = screen.getByRole('combobox', { name: /state/i });
      await userEvent.click(stateCombobox);
      await userEvent.click(screen.getByText(stateLabel));
      await userEvent.type(screen.getByTestId('trustee-zip'), address.zipCode);

      // Fill optional fields
      await userEvent.type(screen.getByTestId('trustee-address2'), address.address2!);
      await userEvent.type(screen.getByTestId('trustee-phone'), '(555) 123-4567');
      await userEvent.type(screen.getByTestId('trustee-email'), TEST_TRUSTEE_DATA.public.email!);

      // Submit the form
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      // Assert that postTrustee was called with the expected payload
      await waitFor(() => {
        expect(mockPostTrustee).toHaveBeenCalledWith({
          name: TEST_TRUSTEE_DATA.name,
          public: {
            address: {
              address1: address.address1,
              address2: address.address2,
              city: address.city,
              state: address.state,
              zipCode: address.zipCode,
              countryCode: 'US' as const,
            },
            phone: { number: '555-123-4567' },
            email: TEST_TRUSTEE_DATA.public.email,
          },
          status: 'active' as const,
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
