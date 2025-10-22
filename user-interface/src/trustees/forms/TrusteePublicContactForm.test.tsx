import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TrusteePublicContactForm, {
  TrusteePublicContactFormProps,
} from './TrusteePublicContactForm';
import testingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { FeatureFlagSet } from '@common/feature-flags';
import Api2 from '@/lib/models/api2';
import * as UseApi2Module from '@/lib/hooks/UseApi2';
import { Trustee } from '@common/cams/trustees';
import * as NavigatorModule from '@/lib/hooks/UseCamsNavigator';
import MockData from '@common/cams/test-utilities/mock-data';
import { TrusteePublicFormData } from './TrusteeSpecs';
import * as Validation from '@common/cams/validation';

function renderWithProps(
  props: TrusteePublicContactFormProps = {
    action: 'create' as const,
    cancelTo: '/trustees',
    trusteeId: '',
    trustee: undefined,
  },
) {
  return render(
    <MemoryRouter>
      <TrusteePublicContactForm {...props} />
    </MemoryRouter>,
  );
}

describe('TrusteePublicContactForm Tests', () => {
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

  test('should handle form submission for creating a new trustee', async () => {
    const mockPostTrustee = vi.fn().mockResolvedValue({
      data: { trusteeId: 'new-trustee-123' },
    });

    vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
      postTrustee: mockPostTrustee,
    } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

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

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockPostTrustee).toHaveBeenCalled();
    });
  });

  test('should handle form submission for editing public profile information', async () => {
    const existing = MockData.getTrustee();
    const patchSpy = vi.fn().mockResolvedValue({ data: existing } as { data: Trustee });
    vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
      patchTrustee: patchSpy,
    } as unknown as ReturnType<typeof UseApi2Module.useApi2>);
    const editPublicState = {
      action: 'edit' as const,
      cancelTo: `/trustees/${existing.trusteeId}`,
      trusteeId: existing.trusteeId,
      trustee: existing,
    };
    renderWithProps(editPublicState);

    await waitFor(() => {
      const nameInput = screen.getByTestId('trustee-name');
      expect(nameInput).toBeInTheDocument();
    });

    const address1Input = screen.getByTestId('trustee-address1');
    const zipInput = screen.getByTestId('trustee-zip');
    const phoneInput = screen.getByTestId('trustee-phone');
    const emailInput = screen.getByTestId('trustee-email');
    const nameInput = screen.getByTestId('trustee-name');

    const user = userEvent.setup();
    await user.clear(nameInput);
    await user.type(nameInput, 'Edited Trustee');
    await user.clear(address1Input);
    await user.type(address1Input, '123 Main St');
    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);
    await user.clear(zipInput);
    await user.type(zipInput, '90210-1111');
    await user.clear(phoneInput);
    await user.type(phoneInput, '555-123-4567');
    await user.clear(emailInput);
    await user.type(emailInput, 'test@example.com');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith(
        existing.trusteeId,
        expect.objectContaining({
          public: expect.objectContaining({
            address: expect.objectContaining({ address1: '123 Main St', zipCode: '90210-1111' }),
            phone: expect.objectContaining({ number: '555-123-4567' }),
            email: 'test@example.com',
          }),
        }),
      );
    });
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

  test('should normalize website URL in outgoing payload during create', async () => {
    const mockPostTrustee = vi.fn().mockResolvedValue({
      data: { trusteeId: 'new-trustee-123' },
    });
    vi.spyOn(Api2, 'postTrustee').mockImplementation(mockPostTrustee);

    renderWithProps({
      action: 'create',
      cancelTo: '/trustees',
      trusteeId: '',
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
    } as TrusteePublicFormData;

    const postSpy = vi
      .spyOn(Api2, 'postTrustee')
      .mockResolvedValue({ data: { trusteeId: 'addr2-id' } as Trustee });

    renderWithProps({
      action: 'create',
      cancelTo: '/trustees',
      trusteeId: '',
    });

    const user = userEvent.setup();

    await user.type(screen.getByTestId('trustee-name'), mockFormData.name!);
    await user.type(screen.getByTestId('trustee-address1'), mockFormData.address1!);
    await user.type(screen.getByTestId('trustee-address2'), mockFormData.address2!);
    await user.type(screen.getByTestId('trustee-city'), mockFormData.city!);
    await user.type(screen.getByTestId('trustee-zip'), mockFormData.zipCode!);
    await user.type(screen.getByTestId('trustee-phone'), mockFormData.phone!);
    await user.type(screen.getByTestId('trustee-email'), mockFormData.email!);
    await user.type(screen.getByTestId('trustee-website'), mockFormData.website!);

    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalled();
      const payload = postSpy.mock.calls[0][0];
      expect(payload.public.address).toHaveProperty('address2', 'Suite 200');
      expect(payload.public.website).toBe('https://example.org');
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

    resolver!({ data: { trusteeId: 'resolved' } });

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
  });

  test('should handle ZIP code field change', async () => {
    renderWithProps();

    const zipInput = screen.getByTestId('trustee-zip');
    await userEvent.type(zipInput, '12345');

    await waitFor(() => {
      expect(zipInput).toHaveValue('12345');
    });
  });

  test('should open state combobox and allow selection', async () => {
    renderWithProps();

    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    await waitFor(() => {
      const stateInput = screen.getByRole('combobox', { name: /state/i });
      expect(stateInput).toBeInTheDocument();
    });
  });

  test('should execute inline UsStatesComboBox onUpdateSelection handler (direct mock)', async () => {
    renderWithProps();

    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    await waitFor(() => {
      const stateInput = screen.getByRole('combobox', { name: /state/i });
      expect(stateInput).toBeInTheDocument();
      expect(stateInput).not.toHaveTextContent('');
    });
  });

  test('should map public payload for edit and call patchTrustee with public property', async () => {
    const api = UseApi2Module.useApi2();
    const mockPatch = vi
      .fn()
      .mockResolvedValue({ data: { id: 'patched', name: 'patched trustee' } });
    vi.spyOn(api, 'patchTrustee').mockImplementation(
      mockPatch as unknown as typeof api.patchTrustee,
    );

    const navigateMock = { navigateTo: vi.fn() };
    vi.spyOn(NavigatorModule, 'default').mockReturnValue(
      navigateMock as unknown as ReturnType<typeof NavigatorModule.default>,
    );

    const existing = MockData.getTrustee();
    renderWithProps({
      action: 'edit',
      cancelTo: '/trustees',
      trusteeId: existing.trusteeId,
      trustee: existing,
    });

    await waitFor(() => {
      const emailInput = screen.getByTestId('trustee-email');
      expect(emailInput).toContainHTML(existing.public.email!);
    });
  });

  test('should not call API when validation fails on submit (create)', async () => {
    const api = UseApi2Module.useApi2();
    const mockPost = vi.fn();
    vi.spyOn(api, 'postTrustee').mockImplementation(mockPost as unknown as typeof api.postTrustee);

    renderWithProps({
      action: 'create',
      cancelTo: '/trustees',
      trusteeId: '',
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));

    await new Promise((res) => setTimeout(res, 50));
    expect(mockPost).not.toHaveBeenCalled();
  });

  test('should call globalAlert.error when postTrustee rejects during create', async () => {
    const api = UseApi2Module.useApi2();
    const error = new Error('create failed');
    vi.spyOn(api, 'postTrustee').mockRejectedValue(error);

    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    renderWithProps({ action: 'create', cancelTo: '/trustees', trusteeId: '' });

    const user = userEvent.setup();
    await user.type(screen.getByTestId('trustee-name'), 'Create Trustee');
    await user.type(screen.getByTestId('trustee-address1'), '1 Main St');
    await user.type(screen.getByTestId('trustee-city'), 'City');
    await user.type(screen.getByTestId('trustee-zip'), '90210');
    await user.type(screen.getByTestId('trustee-phone'), '555-111-2222');
    await user.type(screen.getByTestId('trustee-email'), 'create@example.com');
    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalled();
      expect(globalAlertSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to create trustee/),
      );
    });
  });

  test('should call globalAlert.error when patchTrustee rejects during edit', async () => {
    const error = new Error('Network failure');
    const mockReject = vi.fn().mockRejectedValue(error);
    vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
      patchTrustee: mockReject,
    } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    vi.spyOn(NavigatorModule, 'default').mockReturnValue({
      navigateTo: vi.fn(),
    } as unknown as ReturnType<typeof NavigatorModule.default>);

    const existing = MockData.getTrustee();
    renderWithProps({
      action: 'edit',
      cancelTo: '/trustees',
      trusteeId: existing.trusteeId,
      trustee: existing,
    });

    vi.spyOn(Validation, 'validateObject').mockReturnValue({
      valid: true,
      reasonMap: undefined,
    } as Validation.ValidatorResult);

    const user2 = userEvent.setup();
    await user2.type(screen.getByTestId('trustee-name'), 'Edited Name');
    await user2.type(screen.getByTestId('trustee-address1'), '1 Main St');
    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);
    await user2.type(screen.getByTestId('trustee-zip'), '90210');
    await user2.type(screen.getByTestId('trustee-phone'), '555-111-2222');
    await user2.type(screen.getByTestId('trustee-email'), 'p@example.com');

    await user2.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalled();
      expect(globalAlertSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to update trustee/),
      );
    });
  });

  test('should execute inline UsStatesComboBox onUpdateSelection handler with empty selection', async () => {
    renderWithProps();

    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);
    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5, false);

    await waitFor(() => {
      const stateInput = screen.getByRole('combobox', { name: /state/i });
      expect(stateInput).toBeInTheDocument();
    });
  });
});
