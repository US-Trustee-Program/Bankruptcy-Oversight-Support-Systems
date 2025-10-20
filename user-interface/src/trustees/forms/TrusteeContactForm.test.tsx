import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TrusteeContactForm from './TrusteeContactForm';
import testingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { FeatureFlagSet } from '@common/feature-flags';
import Api2 from '@/lib/models/api2';
import { Trustee, TrusteeStatus } from '@common/cams/trustees';
import {
  UseTrusteeContactFormProps,
  TrusteeFormData,
} from '@/trustees/forms/UseTrusteeContactForm';
import * as UseFormHook from './UseTrusteeContactForm';
import * as NavigatorModule from '@/lib/hooks/UseCamsNavigator';
import * as GlobalAlertModule from '@/lib/hooks/UseGlobalAlert';
import * as DebounceModule from '@/lib/hooks/UseDebounce';

function renderWithProps(
  props: UseTrusteeContactFormProps = {
    action: 'create' as const,
    cancelTo: '/trustees',
    trusteeId: '',
    contactInformation: 'public' as const,
  },
) {
  return render(
    <MemoryRouter>
      <TrusteeContactForm {...props} />
    </MemoryRouter>,
  );
}

describe('TrusteeContactForm Tests', () => {
  beforeEach(() => {
    testingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);

    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
      'trustee-management': true,
    } as FeatureFlagSet);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should show disabled message when feature flag is disabled', async () => {
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
      'trustee-management': false,
    } as FeatureFlagSet);

    renderWithProps();

    let disabledMessage;

    await waitFor(() => {
      disabledMessage = screen.getByTestId('trustee-create-disabled');
    });

    expect(disabledMessage).toBeInTheDocument();
    expect(disabledMessage).toHaveTextContent('Trustee management is not enabled.');
  });

  test('should show forbidden message when user lacks TrusteeAdmin role', async () => {
    testingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderWithProps();

    let forbiddenAlert;
    await waitFor(() => {
      forbiddenAlert = screen.getByTestId('alert-forbidden-alert');
    });

    expect(forbiddenAlert).toBeInTheDocument();
    expect(forbiddenAlert).toHaveTextContent('Forbidden');
    expect(forbiddenAlert).toHaveTextContent('You do not have permission to manage Trustees');
  });

  test('should render form fields for editing internal contact information', async () => {
    const editInternalState = {
      action: 'edit' as const,
      cancelTo: '/trustees/123',
      trusteeId: '123',
      contactInformation: 'public' as const,
    };

    renderWithProps(editInternalState);

    await waitFor(() => {
      const nameInput = screen.getByTestId('trustee-name');
      expect(nameInput).toBeInTheDocument();
    });

    const address1Input = screen.getByTestId('trustee-address1');
    const emailInput = screen.getByTestId('trustee-email');

    expect(address1Input).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
  });

  test('should handle form submission for creating a new trustee', async () => {
    const mockPostTrustee = vi.fn().mockResolvedValue({
      data: { trusteeId: 'new-trustee-123' },
    });

    vi.spyOn(Api2, 'postTrustee').mockImplementation(mockPostTrustee);

    renderWithProps();

    await waitFor(() => {
      const nameInput = screen.getByTestId('trustee-name');
      expect(nameInput).toBeInTheDocument();
    });

    const nameInput = screen.getByTestId('trustee-name');
    const address1Input = screen.getByTestId('trustee-address1');
    const cityInput = screen.getByTestId('trustee-city');
    const zipInput = screen.getByTestId('trustee-zip');
    const phoneInput = screen.getByTestId('trustee-phone');
    const emailInput = screen.getByTestId('trustee-email');

    const user = userEvent.setup();

    await user.type(nameInput, 'Test Trustee');
    await user.type(address1Input, '123 Main St');
    await user.type(cityInput, 'Test City');
    await user.type(zipInput, '90210');
    await user.type(phoneInput, '555-123-4567');
    await user.type(emailInput, 'test@example.com');

    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    // Submit the form
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockPostTrustee).toHaveBeenCalled();
    });
  });

  test('should render form for editing public profile information', async () => {
    const editPublicState = {
      action: 'edit' as const,
      cancelTo: '/trustees/456',
      trusteeId: '456',
      contactInformation: 'public' as const,
    };

    renderWithProps(editPublicState);

    await waitFor(() => {
      const nameInput = screen.getByTestId('trustee-name');
      expect(nameInput).toBeInTheDocument();
    });

    const address1Input = screen.getByTestId('trustee-address1');
    const cityInput = screen.getByTestId('trustee-city');
    const stateInput = screen.getByRole('combobox', { name: /state/i });
    const zipInput = screen.getByTestId('trustee-zip');
    const phoneInput = screen.getByTestId('trustee-phone');
    const emailInput = screen.getByTestId('trustee-email');

    expect(address1Input).toBeInTheDocument();
    expect(cityInput).toBeInTheDocument();
    expect(stateInput).toBeInTheDocument();
    expect(zipInput).toBeInTheDocument();
    expect(phoneInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
  });

  test('should handle field changes and validation', async () => {
    renderWithProps();

    await waitFor(() => {
      const nameInput = screen.getByTestId('trustee-name');
      expect(nameInput).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const nameInput = screen.getByTestId('trustee-name');

    await user.type(nameInput, 'Test Name');

    expect(nameInput).toHaveValue('Test Name');
  });

  test('should handle state combo box selection', async () => {
    renderWithProps();

    await waitFor(() => {
      const stateCombo = screen.getByRole('combobox', { name: /state/i });
      expect(stateCombo).toBeInTheDocument();
    });

    const stateCombo = screen.getByRole('combobox', { name: /state/i });

    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    expect(stateCombo).toBeInTheDocument();
  });

  test('should handle zip code field validation', async () => {
    renderWithProps();

    await waitFor(() => {
      const zipInput = screen.getByTestId('trustee-zip');
      expect(zipInput).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const zipInput = screen.getByTestId('trustee-zip');

    await user.type(zipInput, '12345');

    expect(zipInput).toHaveValue('12345');
  });

  test('should handle website field with URL normalization', async () => {
    renderWithProps();

    await waitFor(() => {
      const websiteInput = screen.getByTestId('trustee-website');
      expect(websiteInput).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const websiteInput = screen.getByTestId('trustee-website');

    await user.type(websiteInput, 'example.com');

    expect(websiteInput).toHaveValue('example.com');
  });

  test('should handle cancel button functionality', async () => {
    renderWithProps();

    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    await user.click(cancelButton);

    expect(cancelButton).toBeInTheDocument();
  });

  test('should handle phone number input field', async () => {
    renderWithProps();

    await waitFor(() => {
      const phoneInput = screen.getByTestId('trustee-phone');
      expect(phoneInput).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const phoneInput = screen.getByTestId('trustee-phone');

    await user.type(phoneInput, '555-123-4567');

    expect(phoneInput).toHaveValue('555-123-4567');
  });

  test('should handle address2 optional field', async () => {
    renderWithProps();

    await waitFor(() => {
      const address2Input = screen.getByTestId('trustee-address2');
      expect(address2Input).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const address2Input = screen.getByTestId('trustee-address2');

    await user.type(address2Input, 'Apt 123');

    expect(address2Input).toHaveValue('Apt 123');
  });

  test('should handle extension field input', async () => {
    renderWithProps();

    await waitFor(() => {
      const extensionInput = screen.getByTestId('trustee-extension');
      expect(extensionInput).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const extensionInput = screen.getByTestId('trustee-extension');

    await user.type(extensionInput, '123');

    expect(extensionInput).toHaveValue('123');
  });

  test('should map existing chapter selections to chapter options', async () => {
    const stateWithChapters = {
      action: 'edit' as const,
      cancelTo: '/trustees/456',
      trusteeId: '456',
      contactInformation: 'public' as const,
      trustee: {
        chapters: ['7-panel' as const, '11' as const, '13' as const], // Pre-existing chapter selections
      },
    };

    renderWithProps(stateWithChapters);

    await waitFor(() => {
      const nameInput = screen.getByTestId('trustee-name');
      expect(nameInput).toBeInTheDocument();
    });

    expect(screen.getByTestId('trustee-name')).toBeInTheDocument();
  });

  test('should fallback to active status when status is invalid', async () => {
    const stateWithInvalidStatus = {
      action: 'edit' as const,
      cancelTo: '/trustees/789',
      trusteeId: '789',
      contactInformation: 'public' as const,
      trustee: {
        status: 'invalid-status' as TrusteeStatus, // Invalid status that won't match STATUS_OPTIONS
      },
    };

    renderWithProps(stateWithInvalidStatus);

    await waitFor(() => {
      const nameInput = screen.getByTestId('trustee-name');
      expect(nameInput).toBeInTheDocument();
    });

    expect(screen.getByTestId('trustee-name')).toBeInTheDocument();
  });

  test('should map internal payload for edit and call patchTrustee then navigate with returned data', async () => {
    const baseFormData = {
      name: 'Internal Trustee',
      address1: '',
      address2: '',
      city: '',
      state: '',
      zipCode: '',
      phone: '555-000-1111',
      extension: '',
      email: 'internal@example.com',
      website: '',
    };

    const updateField = vi.fn();
    const validateFieldAndUpdate = vi.fn();
    const clearErrors = vi.fn();
    const clearFieldError = vi.fn();
    const getDynamicSpec = vi.fn().mockReturnValue({});
    const getFormData = vi.fn().mockImplementation((override) => {
      return override ? { ...baseFormData, [override.name]: override.value } : baseFormData;
    });

    vi.spyOn(UseFormHook, 'useTrusteeContactForm').mockReturnValue({
      formData: baseFormData,
      updateField,
      getFormData,
      fieldErrors: {},
      validateFieldAndUpdate,
      clearErrors,
      clearFieldError,
      validateFormAndUpdateErrors: vi.fn().mockReturnValue(true),
      getDynamicSpec,
    } as unknown as ReturnType<typeof UseFormHook.useTrusteeContactForm>);

    const mockPatch = vi.fn().mockResolvedValue({
      data: {
        id: 'patched',
        name: 'patched trustee',
      },
    });
    vi.spyOn(Api2, 'patchTrustee').mockImplementation(
      mockPatch as unknown as typeof Api2.patchTrustee,
    );

    const navigateMock = { navigateTo: vi.fn() };
    vi.spyOn(NavigatorModule, 'default').mockReturnValue(
      navigateMock as unknown as ReturnType<typeof NavigatorModule.default>,
    );

    vi.spyOn(GlobalAlertModule, 'useGlobalAlert').mockReturnValue({
      error: vi.fn(),
    } as unknown as ReturnType<typeof GlobalAlertModule.useGlobalAlert>);

    renderWithProps({
      action: 'edit',
      cancelTo: '/trustees',
      trusteeId: 'abc',
      contactInformation: 'internal',
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalled();
    });

    const calledPayload = mockPatch.mock.calls[0][1];
    expect(calledPayload).toHaveProperty('internal');
    expect(calledPayload.internal).toHaveProperty('phone');
    expect(calledPayload.internal.phone).toEqual({ number: '555-000-1111', extension: '' });
    expect(calledPayload.internal).toHaveProperty('email', 'internal@example.com');

    expect(navigateMock.navigateTo).toHaveBeenCalledWith('/trustees/abc', {
      trustee: { id: 'patched', name: 'patched trustee' },
    });
  });

  test('should call globalAlert.error when patchTrustee rejects during edit', async () => {
    const baseFormData = {
      name: 'Internal Trustee',
      address1: '',
      address2: '',
      city: '',
      state: '',
      zipCode: '',
      phone: '555-000-1111',
      extension: '',
      email: 'internal@example.com',
      website: '',
    };

    vi.spyOn(UseFormHook, 'useTrusteeContactForm').mockReturnValue({
      formData: baseFormData,
      updateField: vi.fn(),
      getFormData: vi.fn().mockReturnValue(baseFormData),
      fieldErrors: {},
      validateFieldAndUpdate: vi.fn(),
      clearErrors: vi.fn(),
      clearFieldError: vi.fn(),
      validateFormAndUpdateErrors: vi.fn().mockReturnValue(true),
      getDynamicSpec: vi.fn().mockReturnValue({}),
    } as unknown as ReturnType<typeof UseFormHook.useTrusteeContactForm>);

    const error = new Error('Network failure');
    vi.spyOn(Api2, 'patchTrustee').mockRejectedValue(error);

    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    vi.spyOn(NavigatorModule, 'default').mockReturnValue({
      navigateTo: vi.fn(),
    } as unknown as ReturnType<typeof NavigatorModule.default>);

    renderWithProps({
      action: 'edit',
      cancelTo: '/trustees',
      trusteeId: 'fail-id',
      contactInformation: 'internal',
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalled();
      expect(globalAlertSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to update trustee/),
      );
    });
  });

  test('should clear address field errors when internal and all address fields become empty', async () => {
    const baseFormData = {
      name: 'Internal Trustee',
      address1: '123',
      address2: '',
      city: 'Some City',
      state: 'CA',
      zipCode: '90210',
      phone: '',
      extension: '',
      email: '',
      website: '',
    };

    const updateField = vi.fn();
    const validateFieldAndUpdate = vi.fn();
    const clearFieldError = vi.fn();
    const getFormData = vi.fn().mockImplementation((override) => {
      if (override && override.name === 'address1' && override.value === '') {
        return { ...baseFormData, address1: '', city: '', state: '', zipCode: '' };
      }
      return baseFormData;
    });

    vi.spyOn(UseFormHook, 'useTrusteeContactForm').mockReturnValue({
      formData: baseFormData,
      updateField,
      getFormData,
      fieldErrors: { address1: 'error', city: 'error', state: 'error', zipCode: 'error' },
      validateFieldAndUpdate,
      clearErrors: vi.fn(),
      clearFieldError,
      validateFormAndUpdateErrors: vi.fn().mockReturnValue(false), // prevent submit
      getDynamicSpec: vi.fn().mockReturnValue({}),
    } as unknown as ReturnType<typeof UseFormHook.useTrusteeContactForm>);

    // Make debounce immediate so validation runs synchronously in test
    vi.spyOn(DebounceModule, 'default').mockReturnValue(((cb: () => void) =>
      cb()) as unknown as ReturnType<typeof DebounceModule.default>);

    renderWithProps({
      action: 'edit',
      cancelTo: '/trustees',
      trusteeId: 'abc',
      contactInformation: 'internal',
    });

    const user = userEvent.setup();
    const addr1 = screen.getByTestId('trustee-address1');
    await user.clear(addr1);

    await waitFor(() => {
      expect(clearFieldError).toHaveBeenCalled();
      expect(clearFieldError.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('should normalize website URL in outgoing payload during create', async () => {
    const mockPostTrustee = vi.fn().mockResolvedValue({
      data: { trusteeId: 'new-trustee-123' },
    });
    vi.spyOn(Api2, 'postTrustee').mockImplementation(mockPostTrustee);

    renderWithProps({
      action: 'create',
      cancelTo: '/trustees',
      trusteeId: '',
      contactInformation: 'public',
    });

    await waitFor(() => {
      const nameInput = screen.getByTestId('trustee-name');
      expect(nameInput).toBeInTheDocument();
    });

    const user = userEvent.setup();

    await user.type(screen.getByTestId('trustee-name'), 'Test Trustee');
    await user.type(screen.getByTestId('trustee-address1'), '123 Main St');
    await user.type(screen.getByTestId('trustee-city'), 'Test City');
    await user.type(screen.getByTestId('trustee-zip'), '90210');
    await user.type(screen.getByTestId('trustee-phone'), '555-123-4567');
    await user.type(screen.getByTestId('trustee-email'), 'test@example.com');
    await user.type(screen.getByTestId('trustee-website'), 'example.com');

    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockPostTrustee).toHaveBeenCalled();
      const calledPayload = mockPostTrustee.mock.calls[0][0];
      expect(calledPayload.public.website).toBe('https://example.com');
    });
  });

  test('create should not include website property when website is empty', async () => {
    const mockPostTrustee = vi.fn().mockResolvedValue({ data: { trusteeId: 'no-site-123' } });
    vi.spyOn(Api2, 'postTrustee').mockImplementation(
      mockPostTrustee as unknown as typeof Api2.postTrustee,
    );

    renderWithProps({
      action: 'create',
      cancelTo: '/trustees',
      trusteeId: '',
      contactInformation: 'public',
    });

    await screen.findByTestId('trustee-name');

    const user = userEvent.setup();
    await user.type(screen.getByTestId('trustee-name'), 'No Site Trustee');
    await user.type(screen.getByTestId('trustee-address1'), '10 Test Ave');
    await user.type(screen.getByTestId('trustee-city'), 'Testopolis');
    await user.type(screen.getByTestId('trustee-zip'), '12345');
    await user.type(screen.getByTestId('trustee-phone'), '555-999-0000');
    await user.type(screen.getByTestId('trustee-email'), 'nosite@example.com');

    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockPostTrustee).toHaveBeenCalled();
      const payload = mockPostTrustee.mock.calls[0][0];
      expect(payload.public).toBeDefined();
      expect(payload.public).not.toHaveProperty('website');
    });
  });

  test('create should include address2 in public.address when provided', async () => {
    const mockFormData = {
      name: 'With Addr2',
      address1: '100 A St',
      address2: 'Suite 200',
      city: 'CityX',
      state: 'CA',
      zipCode: '90001',
      phone: '555-222-3333',
      extension: '',
      email: 'addr2@example.com',
      website: 'example.org',
    } as TrusteeFormData;

    vi.spyOn(UseFormHook, 'useTrusteeContactForm').mockReturnValue({
      formData: mockFormData,
      updateField: vi.fn(),
      getFormData: vi.fn().mockReturnValue(mockFormData),
      fieldErrors: {},
      validateFieldAndUpdate: vi.fn(),
      clearErrors: vi.fn(),
      clearFieldError: vi.fn(),
      validateFormAndUpdateErrors: vi.fn().mockReturnValue(true),
      getDynamicSpec: vi.fn().mockReturnValue({}),
    } as unknown as ReturnType<typeof UseFormHook.useTrusteeContactForm>);

    const postSpy = vi
      .spyOn(Api2, 'postTrustee')
      .mockResolvedValue({ data: { trusteeId: 'addr2-id' } as Trustee });

    renderWithProps({
      action: 'create',
      cancelTo: '/trustees',
      trusteeId: '',
      contactInformation: 'public',
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalled();
      const payload = postSpy.mock.calls[0][0];
      expect(payload.public.address).toHaveProperty('address2', 'Suite 200');
      expect(payload.public.website).toBe('https://example.org');
    });
  });

  test('edit internal should include phone object when phone provided', async () => {
    const baseFormData = {
      name: 'Internal With Phone',
      address1: '1 Main',
      address2: '',
      city: 'C',
      state: 'NY',
      zipCode: '10001',
      phone: '555-333-4444',
      extension: '12',
      email: 'i@example.com',
      website: '',
    } as TrusteeFormData;

    vi.spyOn(UseFormHook, 'useTrusteeContactForm').mockReturnValue({
      formData: baseFormData,
      updateField: vi.fn(),
      getFormData: vi.fn().mockReturnValue(baseFormData),
      fieldErrors: {},
      validateFieldAndUpdate: vi.fn(),
      clearErrors: vi.fn(),
      clearFieldError: vi.fn(),
      validateFormAndUpdateErrors: vi.fn().mockReturnValue(true),
      getDynamicSpec: vi.fn().mockReturnValue({}),
    } as unknown as ReturnType<typeof UseFormHook.useTrusteeContactForm>);

    const mockPatch = vi.fn().mockResolvedValue({ data: { id: 'patched-3' } });
    vi.spyOn(Api2, 'patchTrustee').mockImplementation(
      mockPatch as unknown as typeof Api2.patchTrustee,
    );

    renderWithProps({
      action: 'edit',
      cancelTo: '/trustees',
      trusteeId: 'int-1',
      contactInformation: 'internal',
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalled();
      const calledPayload = mockPatch.mock.calls[0][1];
      expect(calledPayload.internal.phone).toEqual({ number: '555-333-4444', extension: '12' });
    });
  });

  test('edit internal should send internal.address=null and phone null when address/phone missing', async () => {
    const baseFormData = {
      name: 'Internal Missing Addr',
      address1: '',
      address2: '',
      city: '',
      state: '',
      zipCode: '',
      phone: '',
      extension: '',
      email: undefined,
      website: '',
    } as TrusteeFormData;

    vi.spyOn(UseFormHook, 'useTrusteeContactForm').mockReturnValue({
      formData: baseFormData,
      updateField: vi.fn(),
      getFormData: vi.fn().mockReturnValue(baseFormData),
      fieldErrors: {},
      validateFieldAndUpdate: vi.fn(),
      clearErrors: vi.fn(),
      clearFieldError: vi.fn(),
      validateFormAndUpdateErrors: vi.fn().mockReturnValue(true),
      getDynamicSpec: vi.fn().mockReturnValue({}),
    } as unknown as ReturnType<typeof UseFormHook.useTrusteeContactForm>);

    const mockPatch = vi.fn().mockResolvedValue({ data: { id: 'patched-2' } });
    vi.spyOn(Api2, 'patchTrustee').mockImplementation(
      mockPatch as unknown as typeof Api2.patchTrustee,
    );

    renderWithProps({
      action: 'edit',
      cancelTo: '/trustees',
      trusteeId: 'edit-id',
      contactInformation: 'internal',
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalled();
      const calledPayload = mockPatch.mock.calls[0][1];
      expect(calledPayload).toHaveProperty('internal');
      expect(calledPayload.internal.address).toBeNull();
      expect(calledPayload.internal.phone).toBeNull();
      expect(calledPayload.internal.email).toBeNull();
    });
  });

  test('shows Saving… while submitting', async () => {
    let resolver: (value: { data: { trusteeId: string } }) => void;
    const pending = new Promise<{ data: { trusteeId: string } }>((res) => {
      resolver = res;
    });
    const mockPost = vi.fn().mockImplementation(() => pending);
    vi.spyOn(Api2, 'postTrustee').mockImplementation(
      mockPost as unknown as typeof Api2.postTrustee,
    );

    renderWithProps({
      action: 'create',
      cancelTo: '/trustees',
      trusteeId: '',
      contactInformation: 'public',
    });

    await screen.findByTestId('trustee-name');

    const user = userEvent.setup();
    await user.type(screen.getByTestId('trustee-name'), 'Pending Save');
    await user.type(screen.getByTestId('trustee-address1'), '1 Pending');
    await user.type(screen.getByTestId('trustee-city'), 'Nowhere');
    await user.type(screen.getByTestId('trustee-zip'), '00000');
    await user.type(screen.getByTestId('trustee-phone'), '555-000-0000');
    await user.type(screen.getByTestId('trustee-email'), 'p@example.com');
    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    await user.click(screen.getByRole('button', { name: /save/i }));

    await screen.findByRole('button', { name: /saving…/i });

    // Resolve the pending API call
    resolver!({ data: { trusteeId: 'resolved' } });

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
  });

  test('should show required attribute based on getDynamicSpec for non-create internal editing', async () => {
    const mockDynamicSpec = {
      name: { required: true },
      address1: { required: true },
      phone: { required: true },
    };

    const mockFormData = {
      name: 'Test Trustee',
      address1: '',
      address2: '',
      city: '',
      state: '',
      zipCode: '',
      phone: '',
      extension: '',
      email: '',
      website: '',
    };

    vi.spyOn(UseFormHook, 'useTrusteeContactForm').mockReturnValue({
      formData: mockFormData,
      updateField: vi.fn(),
      getFormData: vi.fn().mockReturnValue(mockFormData),
      fieldErrors: {},
      validateFieldAndUpdate: vi.fn(),
      clearErrors: vi.fn(),
      clearFieldError: vi.fn(),
      validateFormAndUpdateErrors: vi.fn().mockReturnValue(false),
      getDynamicSpec: vi.fn().mockReturnValue(mockDynamicSpec),
    } as unknown as ReturnType<typeof UseFormHook.useTrusteeContactForm>);

    renderWithProps({
      action: 'edit',
      cancelTo: '/trustees',
      trusteeId: 'test-id',
      contactInformation: 'internal',
    });

    await waitFor(() => {
      const nameInput = screen.getByTestId('trustee-name');
      expect(nameInput).toBeInTheDocument();
    });

    const nameInput = screen.getByTestId('trustee-name');
    const address1Input = screen.getByTestId('trustee-address1');
    const phoneInput = screen.getByTestId('trustee-phone');
    const emailInput = screen.getByTestId('trustee-email');

    expect(nameInput).toBeRequired();
    expect(address1Input).toBeRequired();
    expect(phoneInput).not.toBeRequired();
    expect(emailInput).not.toBeRequired();
  });

  test('should handle internal profile with address2 and null conditions', async () => {
    const mockUpdateField = vi.fn();
    const mockGetFormData = vi.fn();
    const mockValidateFormAndUpdateErrors = vi.fn().mockReturnValue(true);

    vi.spyOn(UseFormHook, 'useTrusteeContactForm').mockReturnValue({
      formData: {
        name: 'Test Trustee',
        address1: '123 Main St',
        address2: 'Suite 100',
        city: 'Test City',
        state: 'TX',
        zipCode: '12345',
        phone: '',
        email: '',
        extension: '123',
        website: '',
      },
      updateField: mockUpdateField,
      getFormData: mockGetFormData.mockReturnValue({
        name: 'Test Trustee',
        address1: '123 Main St',
        address2: 'Suite 100',
        city: 'Test City',
        state: 'TX',
        zipCode: '12345',
        phone: '',
        email: '',
        extension: '123',
        website: '',
      }),
      fieldErrors: {},
      validateFieldAndUpdate: vi.fn(),
      clearErrors: vi.fn(),
      clearFieldError: vi.fn(),
      validateFormAndUpdateErrors: mockValidateFormAndUpdateErrors,
      getDynamicSpec: vi.fn().mockReturnValue({}),
    } as unknown as ReturnType<typeof UseFormHook.useTrusteeContactForm>);

    const mockPatch = vi.fn().mockResolvedValue({
      data: {
        id: 'patched',
        name: 'patched trustee',
      },
    });
    vi.spyOn(Api2, 'patchTrustee').mockImplementation(
      mockPatch as unknown as typeof Api2.patchTrustee,
    );

    renderWithProps({
      action: 'edit',
      cancelTo: '/trustees',
      trusteeId: 'test-trustee-id',
      contactInformation: 'internal',
    });

    const submitButton = screen.getByRole('button', { name: /save/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('test-trustee-id', {
        internal: {
          address: {
            address1: '123 Main St',
            address2: 'Suite 100',
            city: 'Test City',
            state: 'TX',
            zipCode: '12345',
            countryCode: 'US',
          },
          phone: null,
          email: '',
        },
      });
    });
  });

  test('should handle ZIP code field change with debounced validation', async () => {
    const mockUpdateField = vi.fn();
    const mockValidateFieldAndUpdate = vi.fn();
    const mockDebounce = vi.fn((fn: () => void) => fn());

    vi.spyOn(DebounceModule, 'default').mockReturnValue(
      mockDebounce as unknown as ReturnType<typeof DebounceModule.default>,
    );

    vi.spyOn(UseFormHook, 'useTrusteeContactForm').mockReturnValue({
      formData: {
        name: 'Test Trustee',
        address1: '123 Main St',
        city: 'Test City',
        state: 'TX',
        zipCode: '',
        phone: '555-000-1111',
        email: 'test@example.com',
        extension: '',
        website: '',
      },
      updateField: mockUpdateField,
      getFormData: vi.fn(),
      fieldErrors: {},
      validateFieldAndUpdate: mockValidateFieldAndUpdate,
      clearErrors: vi.fn(),
      clearFieldError: vi.fn(),
      validateFormAndUpdateErrors: vi.fn(),
      getDynamicSpec: vi.fn().mockReturnValue({}),
    } as unknown as ReturnType<typeof UseFormHook.useTrusteeContactForm>);

    renderWithProps();

    const zipInput = screen.getByTestId('trustee-zip');
    await userEvent.type(zipInput, '12345');

    await waitFor(() => {
      expect(mockUpdateField).toHaveBeenCalledWith('zipCode', '12345');
      expect(mockValidateFieldAndUpdate).toHaveBeenCalledWith('zipCode', '12345', {});
    });
  });

  test('should call updateField when state selection changes (UsStatesComboBox)', async () => {
    const mockUpdateField = vi.fn();
    const mockValidateFieldAndUpdate = vi.fn();

    vi.spyOn(UseFormHook, 'useTrusteeContactForm').mockReturnValue({
      formData: {
        name: 'Test Trustee',
        address1: '123 Main St',
        city: 'Test City',
        state: '',
        zipCode: '12345',
        phone: '555-000-1111',
        email: 'test@example.com',
        extension: '',
        website: '',
      },
      updateField: mockUpdateField,
      updateMultipleFields: vi.fn(),
      resetForm: vi.fn(),
      getFormData: vi.fn(),
      fieldErrors: {},
      validateFieldAndUpdate: mockValidateFieldAndUpdate,
      clearErrors: vi.fn(),
      clearFieldError: vi.fn(),
      validateFormAndUpdateErrors: vi.fn(),
      getDynamicSpec: vi.fn().mockReturnValue({}),
    } as unknown as ReturnType<typeof UseFormHook.useTrusteeContactForm>);

    renderWithProps();

    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    await waitFor(() => {
      expect(mockUpdateField).toHaveBeenCalled();
    });
  });

  test('should execute inline UsStatesComboBox onUpdateSelection handler (direct mock)', async () => {
    const mockUpdateField = vi.fn();
    const mockValidateFieldAndUpdate = vi.fn();

    vi.spyOn(UseFormHook, 'useTrusteeContactForm').mockReturnValue({
      formData: {
        name: 'Test Trustee',
        address1: '123 Main St',
        city: 'Test City',
        state: '',
        zipCode: '12345',
        phone: '555-000-1111',
        email: 'test@example.com',
        extension: '',
        website: '',
      },
      updateField: mockUpdateField,
      updateMultipleFields: vi.fn(),
      resetForm: vi.fn(),
      getFormData: vi.fn(),
      fieldErrors: {},
      validateFieldAndUpdate: mockValidateFieldAndUpdate,
      clearErrors: vi.fn(),
      clearFieldError: vi.fn(),
      validateFormAndUpdateErrors: vi.fn(),
      getDynamicSpec: vi.fn().mockReturnValue({}),
    } as unknown as ReturnType<typeof UseFormHook.useTrusteeContactForm>);

    renderWithProps();

    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    await waitFor(() => {
      expect(mockUpdateField).toHaveBeenCalled();
      expect(mockValidateFieldAndUpdate).toHaveBeenCalled();
    });
  });

  test('should map public payload for edit and call patchTrustee with public property', async () => {
    const mockPatch = vi
      .fn()
      .mockResolvedValue({ data: { id: 'patched', name: 'patched trustee' } });
    vi.spyOn(Api2, 'patchTrustee').mockImplementation(
      mockPatch as unknown as typeof Api2.patchTrustee,
    );

    const navigateMock = { navigateTo: vi.fn() };
    vi.spyOn(NavigatorModule, 'default').mockReturnValue(
      navigateMock as unknown as ReturnType<typeof NavigatorModule.default>,
    );

    vi.spyOn(UseFormHook, 'useTrusteeContactForm').mockReturnValue({
      formData: {
        name: 'Public Trustee',
        address1: '1 Public St',
        address2: '',
        city: 'Public City',
        state: 'NY',
        zipCode: '10001',
        phone: '555-111-2222',
        extension: '',
        email: 'public@example.com',
        website: '',
      },
      updateField: vi.fn(),
      getFormData: vi.fn().mockReturnValue({
        name: 'Public Trustee',
        address1: '1 Public St',
        address2: '',
        city: 'Public City',
        state: 'NY',
        zipCode: '10001',
        phone: '555-111-2222',
        extension: '',
        email: 'public@example.com',
        website: '',
      }),
      fieldErrors: {},
      validateFieldAndUpdate: vi.fn(),
      clearErrors: vi.fn(),
      clearFieldError: vi.fn(),
      validateFormAndUpdateErrors: vi.fn().mockReturnValue(true),
      getDynamicSpec: vi.fn().mockReturnValue({}),
    } as unknown as ReturnType<typeof UseFormHook.useTrusteeContactForm>);

    renderWithProps({
      action: 'edit',
      cancelTo: '/trustees',
      trusteeId: 'pub-1',
      contactInformation: 'public',
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalled();
      const calledPayload = mockPatch.mock.calls[0][1];
      expect(calledPayload).toHaveProperty('public');
      expect(calledPayload).not.toHaveProperty('internal');
      expect(calledPayload.public).toHaveProperty('email', 'public@example.com');
    });
  });

  test('should not call API when validation fails on submit (create)', async () => {
    const mockPost = vi.fn();
    vi.spyOn(Api2, 'postTrustee').mockImplementation(
      mockPost as unknown as typeof Api2.postTrustee,
    );

    vi.spyOn(UseFormHook, 'useTrusteeContactForm').mockReturnValue({
      formData: {
        name: 'X',
        address1: '',
        address2: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
        extension: '',
        email: '',
        website: '',
      },
      updateField: vi.fn(),
      getFormData: vi.fn().mockReturnValue({}),
      fieldErrors: {},
      validateFieldAndUpdate: vi.fn(),
      clearErrors: vi.fn(),
      clearFieldError: vi.fn(),
      validateFormAndUpdateErrors: vi.fn().mockReturnValue(false),
      getDynamicSpec: vi.fn().mockReturnValue({}),
    } as unknown as ReturnType<typeof UseFormHook.useTrusteeContactForm>);

    renderWithProps({
      action: 'create',
      cancelTo: '/trustees',
      trusteeId: '',
      contactInformation: 'public',
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));

    await new Promise((res) => setTimeout(res, 50));
    expect(mockPost).not.toHaveBeenCalled();
  });

  test('should call globalAlert.error when postTrustee rejects during create', async () => {
    const error = new Error('create failed');
    vi.spyOn(Api2, 'postTrustee').mockRejectedValue(error);

    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    vi.spyOn(UseFormHook, 'useTrusteeContactForm').mockReturnValue({
      formData: {
        name: 'Create Trustee',
        address1: '1 Main St',
        address2: '',
        city: 'City',
        state: 'CA',
        zipCode: '90210',
        phone: '555-111-2222',
        extension: '',
        email: 'create@example.com',
        website: '',
      },
      updateField: vi.fn(),
      getFormData: vi.fn().mockReturnValue({}),
      fieldErrors: {},
      validateFieldAndUpdate: vi.fn(),
      clearErrors: vi.fn(),
      clearFieldError: vi.fn(),
      validateFormAndUpdateErrors: vi.fn().mockReturnValue(true),
      getDynamicSpec: vi.fn().mockReturnValue({}),
    } as unknown as ReturnType<typeof UseFormHook.useTrusteeContactForm>);

    renderWithProps({
      action: 'create',
      cancelTo: '/trustees',
      trusteeId: '',
      contactInformation: 'public',
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalled();
      expect(globalAlertSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to create trustee/),
      );
    });
  });

  test('should execute inline UsStatesComboBox onUpdateSelection handler with empty selection', async () => {
    const mockUpdateField = vi.fn();
    const mockValidateFieldAndUpdate = vi.fn();

    vi.spyOn(UseFormHook, 'useTrusteeContactForm').mockReturnValue({
      formData: {
        name: 'Test Trustee',
        address1: '123 Main St',
        city: 'Test City',
        state: '',
        zipCode: '12345',
        phone: '555-000-1111',
        email: 'test@example.com',
        extension: '',
        website: '',
      },
      updateField: mockUpdateField,
      updateMultipleFields: vi.fn(),
      resetForm: vi.fn(),
      getFormData: vi.fn(),
      fieldErrors: {},
      validateFieldAndUpdate: mockValidateFieldAndUpdate,
      clearErrors: vi.fn(),
      clearFieldError: vi.fn(),
      validateFormAndUpdateErrors: vi.fn(),
      getDynamicSpec: vi.fn().mockReturnValue({}),
    } as unknown as ReturnType<typeof UseFormHook.useTrusteeContactForm>);

    renderWithProps();

    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);
    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5, false);

    await waitFor(() => {
      // After deselecting, updateField should have been called (with undefined or empty) and validate invoked
      expect(mockUpdateField).toHaveBeenCalled();
      expect(mockValidateFieldAndUpdate).toHaveBeenCalled();
    });
  });
});
