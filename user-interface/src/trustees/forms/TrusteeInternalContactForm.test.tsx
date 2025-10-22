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
import * as DebounceModule from '@/lib/hooks/UseDebounce';
import * as Validation from '@common/cams/validation';
import * as useCamsNavigatorModule from '@/lib/hooks/UseCamsNavigator';
import MockData from '@common/cams/test-utilities/mock-data';

function renderWithProps(
  props: TrusteeInternalContactFormProps = {
    cancelTo: '/trustees/123',
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
  const navigateTo = vi.fn();
  const navigatorMock = {
    navigateTo,
    redirectTo: vi.fn(),
  };

  beforeEach(() => {
    testingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);

    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
      'trustee-management': true,
    } as FeatureFlagSet);
    vi.spyOn(useCamsNavigatorModule, 'default').mockReturnValue(navigatorMock);
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

  test('should handle cancel button functionality', async () => {
    renderWithProps();

    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    await user.click(cancelButton);

    expect(navigateTo).toHaveBeenCalledWith(`/trustees/123`);
  });

  test('should map internal payload for edit and call patchTrustee then navigate to trustee profile', async () => {
    const trustee = MockData.getTrustee();
    trustee.internal = {
      address: {
        address1: '123 Main St',
        address2: 'Suite 100',
        city: 'Springfield',
        state: 'IL',
        zipCode: '11111',
        countryCode: 'US',
      },
      phone: { number: '555-000-1111', extension: '1234' },
      email: 'internal@example.com',
    };

    const patchSpy = vi.spyOn(Api2, 'patchTrustee').mockResolvedValue({
      data: {
        ...trustee,
      },
    });

    renderWithProps({ cancelTo: '/trustees', trusteeId: trustee.trusteeId, trustee });

    const newAddress1 = '1 Main St';
    const newCity = 'Cityville';
    const newZip = '12345';

    const user = userEvent.setup();
    await user.clear(screen.getByTestId('trustee-address1'));
    await user.type(screen.getByTestId('trustee-address1'), newAddress1);
    await user.clear(screen.getByTestId('trustee-city'));
    await user.type(screen.getByTestId('trustee-city'), newCity);
    await user.clear(screen.getByTestId('trustee-zip'));
    await user.type(screen.getByTestId('trustee-zip'), newZip);
    const CALIFORNIA = { index: 5, abbreviation: 'CA' };
    await testingUtilities.toggleComboBoxItemSelection('trustee-state', CALIFORNIA.index);
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalled();
    });

    const expectedPayload = {
      internal: {
        address: {
          address1: newAddress1,
          address2: trustee.internal?.address?.address2,
          city: newCity,
          state: CALIFORNIA.abbreviation,
          zipCode: newZip,
          countryCode: 'US',
        },
        phone: {
          number: trustee.internal?.phone?.number,
          extension: trustee.internal?.phone?.extension,
        },
        email: trustee.internal.email,
      },
    };

    expect(patchSpy).toHaveBeenCalledWith(trustee.trusteeId, expectedPayload);
    expect(navigateTo).toHaveBeenCalledWith(`/trustees/${trustee.trusteeId}`);
  });

  test('should not allow partial address', async () => {
    const trustee = MockData.getTrustee();

    const patchSpy = vi.spyOn(Api2, 'patchTrustee').mockResolvedValue({
      data: {
        ...trustee,
      },
    });

    renderWithProps({ cancelTo: '/trustees', trusteeId: trustee.trusteeId, trustee });

    const newAddress1 = '1 Main St';
    const newCity = 'Cityville';

    const user = userEvent.setup();
    await user.type(screen.getByTestId('trustee-address1'), newAddress1);
    await user.type(screen.getByTestId('trustee-city'), newCity);
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(patchSpy).not.toHaveBeenCalled();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  test('should allow no address with other fields', async () => {
    const trustee = MockData.getTrustee();

    const patchSpy = vi.spyOn(Api2, 'patchTrustee').mockResolvedValue({
      data: {
        ...trustee,
      },
    });

    renderWithProps({ cancelTo: '/trustees', trusteeId: trustee.trusteeId, trustee });

    const phoneNumber = '555-000-1111';

    const user = userEvent.setup();
    await user.type(screen.getByTestId('trustee-phone'), phoneNumber);
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalled();
    });

    const expectedPayload = {
      internal: {
        address: null,
        email: null,
        phone: {
          number: phoneNumber,
          extension: undefined,
        },
      },
    };

    expect(patchSpy).toHaveBeenCalledWith(trustee.trusteeId, expectedPayload);
    expect(navigateTo).toHaveBeenCalledWith(`/trustees/${trustee.trusteeId}`);
  });

  test('should map internal payload for edit and call patchTrustee with undefined for optional values when not included', async () => {
    const trustee = MockData.getTrustee();
    trustee.internal = {
      address: {
        address1: '123 Main St',
        address2: '',
        city: 'Springfield',
        state: 'IL',
        zipCode: '11111',
        countryCode: 'US',
      },
      phone: { number: '555-000-1111', extension: '' },
      email: 'internal@example.com',
    };

    const patchSpy = vi.spyOn(Api2, 'patchTrustee').mockResolvedValue({
      data: {
        ...trustee,
      },
    });

    renderWithProps({ cancelTo: '/trustees', trusteeId: trustee.trusteeId, trustee });

    const newAddress1 = '1 Main St';
    const newCity = 'Cityville';
    const newZip = '12345';

    const user = userEvent.setup();
    await user.clear(screen.getByTestId('trustee-address1'));
    await user.type(screen.getByTestId('trustee-address1'), newAddress1);
    await user.clear(screen.getByTestId('trustee-city'));
    await user.type(screen.getByTestId('trustee-city'), newCity);
    await user.clear(screen.getByTestId('trustee-zip'));
    await user.type(screen.getByTestId('trustee-zip'), newZip);
    const CALIFORNIA = { index: 5, abbreviation: 'CA' };
    await testingUtilities.toggleComboBoxItemSelection('trustee-state', CALIFORNIA.index);
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalled();
    });

    const expectedPayload = {
      internal: {
        address: {
          address1: newAddress1,
          address2: undefined,
          city: newCity,
          state: CALIFORNIA.abbreviation,
          zipCode: newZip,
          countryCode: 'US',
        },
        phone: {
          number: trustee.internal?.phone?.number,
          extension: undefined,
        },
        email: trustee.internal.email,
      },
    };

    expect(patchSpy).toHaveBeenCalledWith(trustee.trusteeId, expectedPayload);
    expect(navigateTo).toHaveBeenCalledWith(`/trustees/${trustee.trusteeId}`);
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
    vi.spyOn(Api2, 'patchTrustee').mockRejectedValue(error);

    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    vi.spyOn(NavigatorModule, 'default').mockReturnValue({
      navigateTo: vi.fn(),
    } as unknown as ReturnType<typeof NavigatorModule.default>);

    renderWithProps({
      cancelTo: '/trustees',
      trusteeId: 'fail-id',
    });

    const user = userEvent.setup();
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

    const addressErrorMessage = 'Address is required';
    const cityErrorMessage = 'City is required';
    const stateErrorMessage = 'State is required';
    const zipErrorMessage = 'ZIP code must be 5 digits or 9 digits with a hyphen';

    vi.spyOn(DebounceModule, 'default').mockReturnValue(((cb: () => void) =>
      cb()) as unknown as ReturnType<typeof DebounceModule.default>);

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'abc', trustee: existing });

    const user = userEvent.setup();
    const addr1 = screen.getByTestId('trustee-address1');
    const city = screen.getByTestId('trustee-city');
    const zip = screen.getByTestId('trustee-zip');

    expect(screen.queryByText(addressErrorMessage)).not.toBeInTheDocument();

    await user.clear(addr1);

    await waitFor(() => {
      expect(addr1).toHaveValue('');
    });
    expect(addr1).toBeRequired();
    expect(city).toBeRequired();
    expect(zip).toBeRequired();
    expect(screen.queryByText(addressErrorMessage)).toBeInTheDocument();
    expect(screen.queryByText(cityErrorMessage)).not.toBeInTheDocument();

    await user.clear(city);

    await waitFor(() => {
      expect(city).toHaveValue('');
    });
    expect(screen.queryByText(cityErrorMessage)).toBeInTheDocument();
    expect(screen.queryByText(stateErrorMessage)).not.toBeInTheDocument();

    expect(screen.queryByText(zipErrorMessage)).not.toBeInTheDocument();
    await user.clear(zip);

    await waitFor(() => {
      expect(zip).toHaveValue('');
    });
    expect(screen.queryByText(zipErrorMessage)).toBeInTheDocument();
    expect(screen.queryByText(stateErrorMessage)).not.toBeInTheDocument();

    await testingUtilities.clearComboBoxSelection('trustee-state');

    expect(screen.queryByText(addressErrorMessage)).not.toBeInTheDocument();
    expect(screen.queryByText(cityErrorMessage)).not.toBeInTheDocument();
    expect(screen.queryByText(stateErrorMessage)).not.toBeInTheDocument();
    expect(screen.queryByText(zipErrorMessage)).not.toBeInTheDocument();
    expect(addr1).not.toBeRequired();
    expect(city).not.toBeRequired();
    expect(zip).not.toBeRequired();
  });

  test('edit internal should send null for optional fields when deleted', async () => {
    const existing = {
      internal: {
        address: {
          address1: '123',
          city: 'City',
          state: 'CA',
          zipCode: '90210',
          countryCode: 'US',
        },
        phone: { number: '555-000-1111', extension: '1234' },
        email: 'test@example.com',
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
    await user.clear(screen.getByTestId('trustee-address1'));
    await user.clear(screen.getByTestId('trustee-city'));
    await testingUtilities.clearComboBoxSelection('trustee-state');
    await user.clear(screen.getByTestId('trustee-zip'));
    await user.clear(screen.getByTestId('trustee-phone'));
    await user.clear(screen.getByTestId('trustee-extension'));
    await user.clear(screen.getByTestId('trustee-email'));
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

    // TODO: If there is no data to submit then we should not call the handleSubmit callback because the button should be disabled.
    //       Disabled button must rely on not only that the form is empty, but also that there are no required fields that are empty.
    // TODO: Check for button is disabled. The rest will follow.
    // TODO: However there should be a sane guard in handleSubmit to ALSO prevent an API call.
    // TODO: API should return a 400 bad request if no data is sent in payload.

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(mockPatch).not.toHaveBeenCalled();
  });
});
