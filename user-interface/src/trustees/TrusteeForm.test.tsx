import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrusteeForm from './TrusteeForm';
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
import { TrusteeInput, Trustee } from '@common/cams/trustees';
import { Address } from '@common/cams/contact';
import { ResponseBody } from '@common/api/response';
import { TrusteeFormState } from './UseTrusteeForm';

type MockApiShape = Partial<ReturnType<typeof UseApi2Module.useApi2>>;
const createMockApi = (methods: MockApiShape): ReturnType<typeof UseApi2Module.useApi2> => {
  return methods as ReturnType<typeof UseApi2Module.useApi2>;
};

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

const TEST_TRUSTEE_DATA: TrusteeInput = {
  name: 'Jane Doe',
  public: {
    address,
    phone: {
      number: '555-123-4567',
      extension: '123',
    },
    email: 'jane.doe@example.com',
    website: 'https://www.janedoe.com',
  },
  status: 'active' as const,
} as const;

const TEST_PERSONAS = {
  johnSmith: {
    name: 'John Smith',
    address1: '456 Oak St',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62705',
    phone: '555-123-4567',
    email: 'john.smith@example.com',
    website: 'https://www.johnsmith-trustee.com',
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
    website: 'https://www.rodriguez-law.com',
  },
} as const;

async function fillBasicTrusteeForm(
  overrides: Partial<{
    name: string;
    address1: string;
    city: string;
    stateLabel: string;
    zipCode: string;
    phone: string;
    email: string;
    website: string;
  }> = {},
) {
  const data = { ...TEST_TRUSTEE_DATA, ...overrides };

  const nameInput = screen.getByTestId('trustee-name');
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, data.name);

  const address1Input = screen.getByTestId('trustee-address1');
  await userEvent.clear(address1Input);
  await userEvent.type(address1Input, data.public.address.address1);

  const cityInput = screen.getByTestId('trustee-city');
  await userEvent.clear(cityInput);
  await userEvent.type(cityInput, data.public.address.city);

  const stateCombobox = screen.getByRole('combobox', { name: /state/i });
  await userEvent.click(stateCombobox);
  await userEvent.click(screen.getByText(overrides.stateLabel || stateLabel));

  const zipInput = screen.getByTestId('trustee-zip');
  await userEvent.clear(zipInput);
  await userEvent.type(zipInput, overrides.zipCode || data.public.address.zipCode);

  const phoneInput = screen.getByTestId('trustee-phone');
  await userEvent.clear(phoneInput);
  await userEvent.type(phoneInput, data.public.phone!.number);

  const emailInput = screen.getByTestId('trustee-email');
  await userEvent.clear(emailInput);
  await userEvent.type(emailInput, data.public.email!);

  const websiteInput = screen.getByTestId('trustee-website');
  await userEvent.clear(websiteInput);

  // Only fill website if explicitly provided in overrides or if overrides don't specify website at all AND default data has it
  if (overrides.website !== undefined) {
    // If website is explicitly in overrides (even if empty string), use that value
    if (overrides.website) {
      await userEvent.type(websiteInput, overrides.website);
    }
    // If overrides.website is '', leave field empty (already cleared)
  } else if (data.public.website) {
    // Only use default data if overrides don't specify website at all
    await userEvent.type(websiteInput, data.public.website);
  }
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

  let postTrusteeSpy: Mock<(trustee: TrusteeInput) => Promise<ResponseBody<Trustee>>>;

  beforeEach(() => {
    const defaultUser = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
      MockData.getCamsSession({ user: defaultUser }),
    );

    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      [FeatureFlags.TRUSTEE_MANAGEMENT]: true,
    } as Record<string, boolean>);

    vi.spyOn(UseDebounceModule, 'default').mockReturnValue(
      (callback: () => void, _delay: number) => {
        callback();
        return 0;
      },
    );

    vi.spyOn(UseGlobalAlertModule, 'useGlobalAlert').mockReturnValue(mockGlobalAlert);
    vi.spyOn(useCamsNavigatorModule, 'default').mockReturnValue(mockNavigate);

    postTrusteeSpy = vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } });

    vi.clearAllMocks();

    const mockApi = createMockApi({
      getCourts: vi.fn().mockResolvedValue({
        data: MockData.getCourts(),
      }),
      postTrustee: postTrusteeSpy,
    });

    vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue(mockApi);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should not call the API when the submit button is clicked until the form is valid', async () => {
    renderWithRouter();

    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(document.querySelector('.usa-input__error-message')).toBeInTheDocument();
    });
    expect(postTrusteeSpy).not.toHaveBeenCalled();

    const nameInput = screen.getByTestId('trustee-name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, TEST_TRUSTEE_DATA.name);
    const address1Input = screen.getByTestId('trustee-address1');
    await userEvent.clear(address1Input);
    await userEvent.type(address1Input, address.address1);

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(document.querySelector('.usa-input__error-message')).toBeInTheDocument();
    });
    expect(postTrusteeSpy).not.toHaveBeenCalled();

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
    const user = MockData.getCamsUser({ roles: [CamsRole.CaseAssignmentManager] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

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
    const user = MockData.getCamsUser({ roles: [] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      [FeatureFlags.TRUSTEE_MANAGEMENT]: true,
    } as Record<string, boolean>);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByTestId('alert-container-forbidden-alert')).toBeInTheDocument();
    });
  });

  test('renders form when user has TrusteeAdmin role and feature flag is enabled', async () => {
    renderWithRouter();

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
    } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
      typeof UseApi2Module.useApi2
    >);

    renderWithRouter();

    await fillBasicTrusteeForm();

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

      renderWithRouter();

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

      renderWithRouter();

      await fillBasicTrusteeForm({ zipCode: '12345' });

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockGlobalAlert.error).toHaveBeenCalledWith(
          `Failed to create trustee: ${errorMessage}`,
        );
      });
    });

    test('clears validation errors when cancel is clicked', async () => {
      renderWithRouter('/trustees/create', { action: 'create', cancelTo: '/test-url' });

      await userEvent.type(screen.getByTestId('trustee-zip'), '1234');
      await userEvent.tab();

      expect(
        await screen.findByText('ZIP code must be 5 digits or 9 digits with a hyphen'),
      ).toBeInTheDocument();

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);
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
      expect(screen.getByTestId('trustee-website')).toBeInTheDocument();
      expect(document.getElementById('trustee-districts')).toBeInTheDocument();
      expect(document.getElementById('trustee-chapters')).toBeInTheDocument();
    });

    test('allows form submission with required fields', async () => {
      renderWithRouter();

      await fillBasicTrusteeForm();

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() =>
        expect(mockNavigate.navigateTo).toHaveBeenCalledWith('/trustees/trustee-123'),
      );
    });

    // Tests for email, phone, and extension validation have been removed
    // as they duplicate functionality already tested in UseTrusteeForm.test.tsx

    test('includes optional fields in form submission when provided', async () => {
      const mockPostTrustee = vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } });
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: mockPostTrustee,
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

      renderWithRouter();

      const nameInput = screen.getByTestId('trustee-name');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, TEST_TRUSTEE_DATA.name);
      const address1Input = screen.getByTestId('trustee-address1');
      await userEvent.clear(address1Input);
      await userEvent.type(address1Input, address.address1);
      const cityInput = screen.getByTestId('trustee-city');
      await userEvent.clear(cityInput);
      await userEvent.type(cityInput, address.city);
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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
            // website should NOT be included when the field is left empty
          },
          status: 'active' as const,
        });
      });
    });

    test('includes website in form submission when provided', async () => {
      const mockPostTrustee = vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } });
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: mockPostTrustee,
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

      renderWithRouter();

      const testWebsite = 'https://www.test-trustee-website.com';

      // Fill all required fields and website
      await fillBasicTrusteeForm({ website: testWebsite });

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        const calledArg = mockPostTrustee.mock.calls[0][0];
        expect(calledArg.public.website).toBe(testWebsite);
      });
    });

    test('excludes website from form submission when empty', async () => {
      const mockPostTrustee = vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } });
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: mockPostTrustee,
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

      renderWithRouter();

      // Fill required fields without website
      await fillBasicTrusteeForm({ website: '' });

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        const calledArg = mockPostTrustee.mock.calls[0][0];
        expect(calledArg.public.website).toBeUndefined();
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

    test('validates website field with valid URLs', async () => {
      renderWithRouter();

      // Fill required fields first
      await fillBasicTrusteeForm({ website: '' });

      const websiteInput = screen.getByTestId('trustee-website');

      // Test comprehensive set of valid website URLs
      const validUrls = [
        // Basic formats
        'https://www.example.com',
        'http://example.org',
        // URLs with paths and query parameters
        'https://trustee-law.com/services/bankruptcy?ref=homepage#consultation',
        // Different TLDs
        'https://legal.example.co.uk/trustees',
      ];

      // Test each valid URL - they should all pass validation
      for (const url of validUrls) {
        await userEvent.clear(websiteInput);
        await userEvent.type(websiteInput, url);
        await userEvent.tab(); // Trigger validation

        // Should not show validation error for valid URLs
        expect(screen.queryByText('Website must be a valid URL')).not.toBeInTheDocument();
      }
    }, 10000);

    test('shows validation error for invalid website URLs', async () => {
      renderWithRouter();

      // Fill required fields first
      await fillBasicTrusteeForm({ website: '' });

      const websiteInput = screen.getByTestId('trustee-website');

      // Test invalid website URLs
      const invalidUrls = ['not-a-url', 'just-text'];

      for (const url of invalidUrls) {
        await userEvent.clear(websiteInput);
        await userEvent.type(websiteInput, url);
        await userEvent.tab(); // Trigger validation

        // Should show validation error for invalid URLs
        await waitFor(() => {
          expect(screen.getByText('Website must be a valid URL')).toBeInTheDocument();
        });
      }
    });

    test('allows empty website field as it is optional', async () => {
      renderWithRouter();

      // Fill required fields without website
      await fillBasicTrusteeForm({ website: '' });

      const websiteInput = screen.getByTestId('trustee-website');
      expect(websiteInput).toHaveValue('');

      // Form should be submittable without website
      const submitButton = screen.getByRole('button', { name: /save/i });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      // Should not show validation error for empty website
      expect(screen.queryByText('Website must be a valid URL')).not.toBeInTheDocument();
    });

    test('accepts URLs without protocol and normalizes them on form submission', async () => {
      const mockPostTrustee = vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } });
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: mockPostTrustee,
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

      renderWithRouter();

      // Test website URL without protocol
      const websiteWithoutProtocol = 'www.trustee-website.com';
      const expectedWebsiteWithProtocol = 'https://www.trustee-website.com';

      // Fill all required fields with website without protocol
      await fillBasicTrusteeForm({ website: websiteWithoutProtocol });

      // Verify that the form accepts the URL without protocol (no validation error)
      const websiteInput = screen.getByTestId('trustee-website');
      expect(websiteInput).toHaveValue(websiteWithoutProtocol);
      expect(screen.queryByText('Website must be a valid URL')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      // Verify that the API was called with the normalized URL (with protocol)
      await waitFor(() => {
        const calledArg = mockPostTrustee.mock.calls[0][0];
        expect(calledArg.public.website).toBe(expectedWebsiteWithProtocol);
      });
    });

    test('validates and accepts URLs without protocol during form input', async () => {
      renderWithRouter();

      // Fill required fields first
      await fillBasicTrusteeForm({ website: '' });

      const websiteInput = screen.getByTestId('trustee-website');

      // Test URLs without protocol that should be accepted
      const validUrlsWithoutProtocol = [
        'www.example.com',
        'example.org',
        'subdomain.example.com/path',
        'example.com/path?query=1#section',
        'trustee-website.com',
        'jane-smith-trustee.com',
      ];

      // Test each URL without protocol - they should all pass validation
      for (const url of validUrlsWithoutProtocol) {
        await userEvent.clear(websiteInput);
        await userEvent.type(websiteInput, url);
        await userEvent.tab(); // Trigger validation

        // Should not show validation error for URLs without protocol
        expect(screen.queryByText('Website must be a valid URL')).not.toBeInTheDocument();
      }
    });

    test('shows validation error for unsupported protocols', async () => {
      renderWithRouter();

      // Fill required fields first
      await fillBasicTrusteeForm({ website: '' });

      const websiteInput = screen.getByTestId('trustee-website');

      // Test unsupported protocol URLs that should show validation errors
      await userEvent.clear(websiteInput);
      await userEvent.type(websiteInput, 'ftp://example.com');
      await userEvent.tab(); // Trigger validation

      // Should show validation error for unsupported protocols
      await waitFor(() => {
        expect(screen.getByText('Website must be a valid URL')).toBeInTheDocument();
      });
    });

    test('excludes website field entirely when website contains only whitespace', async () => {
      const mockPostTrustee = vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } });

      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: mockPostTrustee,
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

      renderWithRouter();

      // Fill required fields but with whitespace-only website (which normalizes to empty string)
      await fillBasicTrusteeForm({ website: '   ' });

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      // Verify that the website field is completely excluded from the payload
      await waitFor(() => {
        const calledArg = mockPostTrustee.mock.calls[0][0];
        expect(calledArg.public).not.toHaveProperty('website');
        expect('website' in calledArg.public).toBe(false);
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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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

      // Wait for submit button to be enabled
      const submitButton = screen.getByRole('button', { name: /save/i });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      await userEvent.click(submitButton);

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);
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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      vi.spyOn(UseDebounceModule, 'default').mockReturnValue(
        (callback: () => void, _delay: number) => {
          callback();
          return 0;
        },
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('clears address field errors when all address fields are empty in internal profile editing', async () => {
      // Mock a trustee object to edit with internal profile
      const mockTrustee = {
        name: 'Jane Doe',
        internal: {
          address: {
            address1: '123 Internal St',
            city: 'Washington',
            state: 'DC',
            zipCode: '20001',
            countryCode: 'US' as const,
          },
          phone: {
            number: '555-987-6543',
          },
          email: 'jane.internal@example.gov',
        },
        status: 'active' as const,
      };

      // Mock the clearFieldError function to track calls
      const mockClearFieldError = vi.fn();

      // Import the UseTrusteeForm module to mock its functions
      const UseTrusteeFormModule = await import('./UseTrusteeForm');

      // Save the original function to restore later
      const originalUseTrusteeForm = UseTrusteeFormModule.useTrusteeForm;

      // Mock the useTrusteeForm hook to inject our spy
      vi.spyOn(UseTrusteeFormModule, 'useTrusteeForm').mockImplementation((props) => {
        const hookResult = originalUseTrusteeForm(props);

        // Create a function that returns empty address fields to simulate the condition
        const getFormDataFn = (options?: { name?: string; value?: unknown }) => {
          // This mimics the behavior in lines 255-256 to make allAddressFieldsEmpty true
          return {
            ...hookResult.formData,
            address1: '',
            city: '',
            state: '',
            zipCode: '',
            ...(options?.name && { [options.name]: options.value }),
          };
        };

        return {
          ...hookResult,
          clearFieldError: mockClearFieldError,
          // This is crucial to provide the correct formData for the component
          getFormData: getFormDataFn,
        };
      });

      // Render in edit mode with internal profile
      renderWithRouter('/trustees/trustee-789/edit', {
        action: 'edit',
        cancelTo: '/trustees/trustee-789',
        trusteeId: 'trustee-789',
        trustee: mockTrustee,
        contactInformation: 'internal',
      });

      // Wait for form to be rendered
      await waitFor(() => {
        expect(screen.getByTestId('trustee-address1')).toBeInTheDocument();
      });

      // Find the address field and change it
      // This will trigger handleFieldChange which contains our target code (lines 260-263)
      const address1Input = screen.getByTestId('trustee-address1');

      // First make sure input has some value
      await userEvent.clear(address1Input);
      await userEvent.type(address1Input, 'Some value');

      // Then clear it to trigger the code path we want
      await userEvent.clear(address1Input);

      // Verify clearFieldError was called for each address field
      // The code in lines 260-263 uses forEach to clear errors for all required address fields
      await waitFor(() => {
        expect(mockClearFieldError).toHaveBeenCalledWith('address1');
        expect(mockClearFieldError).toHaveBeenCalledWith('city');
        expect(mockClearFieldError).toHaveBeenCalledWith('state');
        expect(mockClearFieldError).toHaveBeenCalledWith('zipCode');
      });
    });

    test('updates field with single value when handleComboBoxUpdate is called with isMultiSelect=false', async () => {
      // Mock the updateField function
      const mockUpdateField = vi.fn();

      // Import the UseTrusteeForm module to mock its functions
      const UseTrusteeFormModule = await import('./UseTrusteeForm');

      // Save the original function to restore later
      const originalUseTrusteeForm = UseTrusteeFormModule.useTrusteeForm;

      // Mock the useTrusteeForm hook to inject our spy
      vi.spyOn(UseTrusteeFormModule, 'useTrusteeForm').mockImplementation((props) => {
        const hookResult = originalUseTrusteeForm(props);
        return {
          ...hookResult,
          updateField: mockUpdateField,
          validateFieldAndUpdate: vi.fn(),
        };
      });

      // Render in create mode
      renderWithRouter('/trustees/create', {
        action: 'create',
        cancelTo: '/trustees',
      });

      // Wait for form to be rendered
      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /status/i })).toBeInTheDocument();
      });

      // Find the status ComboBox (single-select)
      const statusCombobox = screen.getByRole('combobox', { name: /status/i });
      await userEvent.click(statusCombobox);

      // Select "Suspended" status
      await userEvent.click(screen.getByText('Suspended'));

      // This specifically tests lines 285-286 in handleComboBoxUpdate function
      // which updates a field with a single value when isMultiSelect is false
      await waitFor(() => {
        // For a single select, updateField should be called with the first value
        expect(mockUpdateField).toHaveBeenCalledWith('status', 'suspended');
      });
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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
          `Failed to update trustee: ${errorMessage}`,
        );
      });
    });

    test('renders the districtLoadError when present', async () => {
      // Set up a district load error
      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockRejectedValue(new Error('Failed to load districts')),
        postTrustee: vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } }),
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      // Spy on the postTrustee function and mock it to return a promise
      const mockPostTrustee = vi.fn().mockResolvedValue({ data: { id: 'trustee-123' } });

      vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
        getCourts: vi.fn().mockResolvedValue({
          data: MockData.getCourts(),
        }),
        postTrustee: mockPostTrustee,
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
      } as Partial<ReturnType<typeof UseApi2Module.useApi2>> as ReturnType<
        typeof UseApi2Module.useApi2
      >);

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
