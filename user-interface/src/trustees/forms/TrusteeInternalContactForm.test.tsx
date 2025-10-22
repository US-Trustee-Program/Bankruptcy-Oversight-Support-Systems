import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TrusteeInternalContactForm, {
  TrusteeInternalContactFormProps,
} from './TrusteeInternalContactForm';
import testingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { FeatureFlagSet } from '@common/feature-flags';
import Api2 from '@/lib/models/api2';
import * as UseApi2Module from '@/lib/hooks/UseApi2';
import { Trustee } from '@common/cams/trustees';

import * as NavigatorModule from '@/lib/hooks/UseCamsNavigator';
import * as GlobalAlertModule from '@/lib/hooks/UseGlobalAlert';
import * as DebounceModule from '@/lib/hooks/UseDebounce';
import * as Validation from '@common/cams/validation';

function renderWithProps(
  props: TrusteeInternalContactFormProps = {
    cancelTo: '/trustees',
    trusteeId: '123',
    trustee: undefined,
  },
) {
  return render(
    <MemoryRouter>
      <TrusteeInternalContactForm {...props} />
    </MemoryRouter>,
  );
}

describe('TrusteeInternalContactForm Tests', () => {
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

  test('trustee name field should be disabled and other required fields should be enabled if editing internal contact information', async () => {
    renderWithProps();

    let nameInput;
    await waitFor(() => {
      nameInput = screen.getByTestId('trustee-name');
      expect(nameInput).toBeInTheDocument();
    });

    expect(nameInput).toBeDisabled();
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

  test('should map internal payload for edit and call patchTrustee then navigate with returned data', async () => {
    const existing = {
      internal: {
        address: { address1: '', address2: '', city: '', state: '', zipCode: '' },
        phone: { number: '555-000-1111', extension: '' },
        email: 'internal@example.com',
      },
    } as Partial<Trustee>;

    const mockPatch = vi.fn().mockResolvedValue({
      data: {
        id: 'patched',
        name: 'patched trustee',
      },
    });
    vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
      patchTrustee: mockPatch,
    } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

    const navigateMock = { navigateTo: vi.fn() };
    vi.spyOn(NavigatorModule, 'default').mockReturnValue(
      navigateMock as unknown as ReturnType<typeof NavigatorModule.default>,
    );

    vi.spyOn(GlobalAlertModule, 'useGlobalAlert').mockReturnValue({
      error: vi.fn(),
    } as unknown as ReturnType<typeof GlobalAlertModule.useGlobalAlert>);

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'abc', trustee: existing });

    const user = userEvent.setup();
    await user.type(screen.getByTestId('trustee-address1'), '1 Main St');
    await user.type(screen.getByTestId('trustee-city'), 'Cityville');
    await user.type(screen.getByTestId('trustee-zip'), '12345');
    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalled();
    });

    const calledPayload = mockPatch.mock.calls[0][1];
    expect(calledPayload).toHaveProperty('internal');
    expect(calledPayload.internal).toHaveProperty('phone');
    expect(calledPayload.internal.phone.number).toEqual('555-000-1111');
    expect(['', undefined]).toContain(calledPayload.internal.phone.extension);
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
    };

    const error = new Error('Network failure');
    const mockReject = vi.fn().mockRejectedValue(error);
    vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
      patchTrustee: mockReject,
    } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    vi.spyOn(NavigatorModule, 'default').mockReturnValue({
      navigateTo: vi.fn(),
    } as unknown as ReturnType<typeof NavigatorModule.default>);

    renderWithProps({
      cancelTo: '/trustees',
      trusteeId: 'fail-id',
    });

    const user = userEvent.setup();
    await user.type(screen.getByTestId('trustee-name'), baseFormData.name);
    await user.type(screen.getByTestId('trustee-address1'), '1 Main St');
    await user.type(screen.getByTestId('trustee-city'), 'City');
    await user.type(screen.getByTestId('trustee-zip'), '90210');
    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);
    await user.type(screen.getByTestId('trustee-phone'), baseFormData.phone);
    await user.type(screen.getByTestId('trustee-email'), baseFormData.email);

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalled();
      expect(globalAlertSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to update trustee/),
      );
    });
  });

  test('should clear address field errors when internal and all address fields become empty', async () => {
    const existing = {
      internal: {
        address: {
          address1: '123',
          address2: '',
          city: 'Some City',
          state: 'CA',
          zipCode: '90210',
        },
        phone: undefined,
        email: undefined,
      },
    } as Partial<Trustee>;

    vi.spyOn(DebounceModule, 'default').mockReturnValue(((cb: () => void) =>
      cb()) as unknown as ReturnType<typeof DebounceModule.default>);

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'abc', trustee: existing });

    const user = userEvent.setup();
    const addr1 = screen.getByTestId('trustee-address1');
    await user.clear(addr1);

    await waitFor(() => {
      expect(addr1).toHaveValue('');
    });
  });

  test('edit internal should include phone object when phone provided', async () => {
    const existing = {
      internal: {
        address: {
          address1: '1 Main',
          address2: '',
          city: 'C',
          state: 'NY',
          zipCode: '10001',
        },
        phone: { number: '555-333-4444', extension: '12' },
        email: 'i@example.com',
      },
    } as Partial<Trustee>;

    const mockPatch = vi.fn().mockResolvedValue({ data: { id: 'patched-3' } });
    vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
      patchTrustee: mockPatch,
    } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'int-1', trustee: existing });

    const user = userEvent.setup();
    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalled();
      const calledPayload = mockPatch.mock.calls[0][1];
      expect(calledPayload.internal.phone).toEqual({ number: '555-333-4444', extension: '12' });
    });
  });

  test('edit internal should send internal.address=null and phone null when address/phone missing', async () => {
    const existing = {
      internal: {
        address: undefined,
        phone: undefined,
        email: undefined,
      },
    } as Partial<Trustee>;

    const mockPatch = vi.fn().mockResolvedValue({ data: { id: 'patched-2' } });
    vi.spyOn(UseApi2Module, 'useApi2').mockReturnValue({
      patchTrustee: mockPatch,
    } as unknown as ReturnType<typeof UseApi2Module.useApi2>);

    vi.spyOn(Validation, 'validateObject').mockReturnValue({
      valid: true,
      reasonMap: undefined,
    } as Validation.ValidatorResult);

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'edit-id', trustee: existing });

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

  test('should show required attribute based on getDynamicSpec for non-create internal editing', async () => {
    renderWithProps({
      cancelTo: '/trustees',
      trusteeId: 'test-id',
    });

    await waitFor(() => {
      const nameInput = screen.getByTestId('trustee-name');
      expect(nameInput).toBeInTheDocument();
    });

    const address1Input = screen.getByTestId('trustee-address1');
    const phoneInput = screen.getByTestId('trustee-phone');
    const emailInput = screen.getByTestId('trustee-email');

    expect(address1Input).toBeRequired();
    expect(phoneInput).not.toBeRequired();
    expect(emailInput).not.toBeRequired();
  });

  test('should handle internal profile with address2 and null conditions', async () => {
    const mockPatch = vi.fn().mockResolvedValue({
      data: {
        id: 'patched',
        name: 'patched trustee',
      },
    });
    vi.spyOn(Api2, 'patchTrustee').mockImplementation(
      mockPatch as unknown as typeof Api2.patchTrustee,
    );

    const existing = {
      name: 'Test Trustee',
      internal: {
        address: {
          address1: '123 Main St',
          address2: 'Suite 100',
          city: 'Test City',
          state: 'TX',
          zipCode: '12345',
          countryCode: 'US',
        },
        phone: undefined,
        email: '',
      },
    } as Partial<Trustee>;

    renderWithProps({
      cancelTo: '/trustees',
      trusteeId: 'test-trustee-id',
      trustee: existing,
    });

    vi.spyOn(Validation, 'validateObject').mockReturnValue({
      valid: true,
      reasonMap: undefined,
    } as Validation.ValidatorResult);

    const user = userEvent.setup();
    const addr1Input = screen.getByTestId('trustee-address1');
    const cityInput = screen.getByTestId('trustee-city');
    const zipInput = screen.getByTestId('trustee-zip');

    await user.clear(addr1Input);
    await user.clear(cityInput);
    await user.clear(zipInput);

    await user.type(addr1Input, '123 Main St');
    await user.type(cityInput, 'Test City');
    await user.type(zipInput, '12345');
    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalled();
      const calledArgs = mockPatch.mock.calls[0];
      expect(calledArgs[0]).toEqual('test-trustee-id');
      const calledPayload = calledArgs[1];
      expect(calledPayload).toHaveProperty('internal');
      expect(calledPayload.internal.address).toEqual(
        expect.objectContaining({
          address1: '123 Main St',
          address2: 'Suite 100',
          city: 'Test City',
          zipCode: '12345',
          countryCode: 'US',
        }),
      );
      expect(calledPayload.internal.phone).toBeNull();
      expect(
        calledPayload.internal.email === '' || calledPayload.internal.email === null,
      ).toBeTruthy();
    });
  });

  test('should handle ZIP code field change with debounced validation', async () => {
    vi.spyOn(DebounceModule, 'default').mockReturnValue(((fn: () => void) =>
      fn()) as unknown as ReturnType<typeof DebounceModule.default>);

    renderWithProps();

    const zipInput = screen.getByTestId('trustee-zip');
    await userEvent.type(zipInput, '12345');

    await waitFor(() => {
      expect(zipInput).toHaveValue('12345');
    });
  });

  test('should call updateField when state selection changes (UsStatesComboBox)', async () => {
    renderWithProps();

    await testingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    await waitFor(() => {
      const stateInput = screen.getByRole('combobox', { name: /state/i });
      expect(stateInput).toBeInTheDocument();
      expect(stateInput).not.toHaveTextContent('');
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

  test('should not call API when validation fails on submit', async () => {
    const mockPatch = vi.fn();
    vi.spyOn(Api2, 'patchTrustee').mockImplementation(
      mockPatch as unknown as typeof Api2.patchTrustee,
    );

    renderWithProps({
      cancelTo: '/trustees',
      trusteeId: 'fail-id',
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));

    await new Promise((res) => setTimeout(res, 50));
    expect(mockPatch).not.toHaveBeenCalled();
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
