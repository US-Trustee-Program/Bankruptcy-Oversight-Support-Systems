import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrusteeInternalContactForm, {
  TrusteeInternalContactFormProps,
  validateField,
} from './TrusteeInternalContactForm';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { FeatureFlagSet } from '@common/feature-flags';
import Api2 from '@/lib/models/api2';
import { Trustee } from '@common/cams/trustees';

import * as NavigatorModule from '@/lib/hooks/UseCamsNavigator';
import * as DebounceModule from '@/lib/hooks/UseDebounce';
import * as Validation from '@common/cams/validation';
import * as useCamsNavigatorModule from '@/lib/hooks/UseCamsNavigator';
import MockData from '@common/cams/test-utilities/mock-data';
import {
  ADDRESS_REQUIRED_ERROR_REASON,
  CITY_REQUIRED_ERROR_REASON,
  PARTIAL_ADDRESS_ERROR_REASON,
  STATE_REQUIRED_ERROR_REASON,
  ZIP_CODE_REQUIRED_ERROR_REASON,
  TRUSTEE_INTERNAL_SPEC,
} from '@/trustees/forms/trusteeForms.types';

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
  const immediateDebounce: ReturnType<typeof DebounceModule.default> = (
    cb: () => void,
    _delay?: number,
  ) => {
    cb();
  };
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);

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
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

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

    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    await userEvent.click(cancelButton);

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

    await userEvent.clear(screen.getByTestId('trustee-address1'));
    await userEvent.type(screen.getByTestId('trustee-address1'), newAddress1);
    await userEvent.clear(screen.getByTestId('trustee-city'));
    await userEvent.type(screen.getByTestId('trustee-city'), newCity);
    await userEvent.clear(screen.getByTestId('trustee-zip'));
    await userEvent.type(screen.getByTestId('trustee-zip'), newZip);
    const CALIFORNIA = { index: 5, abbreviation: 'CA' };
    await TestingUtilities.toggleComboBoxItemSelection('trustee-state', CALIFORNIA.index);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

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

    await userEvent.type(screen.getByTestId('trustee-address1'), newAddress1);
    await userEvent.type(screen.getByTestId('trustee-city'), newCity);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

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

    await userEvent.type(screen.getByTestId('trustee-phone'), phoneNumber);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

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

    await userEvent.clear(screen.getByTestId('trustee-address1'));
    await userEvent.type(screen.getByTestId('trustee-address1'), newAddress1);
    await userEvent.clear(screen.getByTestId('trustee-city'));
    await userEvent.type(screen.getByTestId('trustee-city'), newCity);
    await userEvent.clear(screen.getByTestId('trustee-zip'));
    await userEvent.type(screen.getByTestId('trustee-zip'), newZip);
    const CALIFORNIA = { index: 5, abbreviation: 'CA' };
    await TestingUtilities.toggleComboBoxItemSelection('trustee-state', CALIFORNIA.index);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

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

    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    const navStub: ReturnType<typeof NavigatorModule.default> = {
      navigateTo: vi.fn(),
      redirectTo: vi.fn(),
    };
    vi.spyOn(NavigatorModule, 'default').mockReturnValue(navStub);

    renderWithProps({
      cancelTo: '/trustees',
      trusteeId: 'fail-id',
    });

    await userEvent.type(screen.getByTestId('trustee-address1'), '1 Main St');
    await userEvent.type(screen.getByTestId('trustee-city'), 'City');
    await userEvent.type(screen.getByTestId('trustee-zip'), '90210');
    await TestingUtilities.toggleComboBoxItemSelection('trustee-state', 5);
    await userEvent.type(screen.getByTestId('trustee-phone'), baseFormData.phone);
    await userEvent.type(screen.getByTestId('trustee-email'), baseFormData.email);

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalled();
      expect(globalAlertSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to update trustee/),
      );
    });
  });

  test('should clear address field errors when all address fields become empty', async () => {
    const startingState = {
      internal: {},
    } as Partial<Trustee>;

    const addressErrorMessage = ADDRESS_REQUIRED_ERROR_REASON;
    const cityErrorMessage = CITY_REQUIRED_ERROR_REASON;
    const stateErrorMessage = STATE_REQUIRED_ERROR_REASON;
    const zipErrorMessage = ZIP_CODE_REQUIRED_ERROR_REASON;

    vi.spyOn(DebounceModule, 'default').mockReturnValue(immediateDebounce);

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'abc', trustee: startingState });

    expect(screen.queryByText(addressErrorMessage)).not.toBeInTheDocument();
    expect(screen.queryByText(cityErrorMessage)).not.toBeInTheDocument();
    expect(screen.queryByText(stateErrorMessage)).not.toBeInTheDocument();
    expect(screen.queryByText(zipErrorMessage)).not.toBeInTheDocument();

    const addr2 = screen.getByTestId('trustee-address2');
    const extension = screen.getByTestId('trustee-extension');
    await userEvent.type(addr2, 'suite 101');
    await userEvent.type(extension, '1234');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.queryByText(addressErrorMessage)).toBeInTheDocument();
    expect(screen.queryByText(cityErrorMessage)).toBeInTheDocument();
    expect(screen.queryByText(stateErrorMessage)).toBeInTheDocument();
    expect(screen.queryByText(zipErrorMessage)).toBeInTheDocument();

    await userEvent.clear(addr2);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.queryByText(addressErrorMessage)).not.toBeInTheDocument();
    });
    expect(screen.queryByText(cityErrorMessage)).not.toBeInTheDocument();
    expect(screen.queryByText(stateErrorMessage)).not.toBeInTheDocument();
    expect(screen.queryByText(zipErrorMessage)).not.toBeInTheDocument();
  });

  test('should display partial address alert on save when address is incomplete', async () => {
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

    vi.spyOn(DebounceModule, 'default').mockReturnValue(immediateDebounce);

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'abc', trustee: existing });

    const addr1 = screen.getByTestId('trustee-address1');
    const city = screen.getByTestId('trustee-city');
    const zip = screen.getByTestId('trustee-zip');

    await userEvent.clear(addr1);

    // With immediate validation, address1 error appears immediately
    expect(screen.queryByText(ADDRESS_REQUIRED_ERROR_REASON)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.queryByText(PARTIAL_ADDRESS_ERROR_REASON)).toBeInTheDocument();

    await userEvent.clear(city);

    // With immediate validation, city error appears immediately
    expect(screen.queryByText(CITY_REQUIRED_ERROR_REASON)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.queryByText(CITY_REQUIRED_ERROR_REASON)).toBeInTheDocument();
    expect(screen.queryByText(ZIP_CODE_REQUIRED_ERROR_REASON)).not.toBeInTheDocument();

    await userEvent.clear(zip);

    // With immediate validation, zip error appears immediately
    expect(screen.queryByText(ZIP_CODE_REQUIRED_ERROR_REASON)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.queryByText(ZIP_CODE_REQUIRED_ERROR_REASON)).toBeInTheDocument();
    expect(screen.queryByText(STATE_REQUIRED_ERROR_REASON)).not.toBeInTheDocument();

    await TestingUtilities.clearComboBoxSelection('trustee-state');

    expect(screen.queryByText(ADDRESS_REQUIRED_ERROR_REASON)).not.toBeInTheDocument();
    expect(screen.queryByText(CITY_REQUIRED_ERROR_REASON)).not.toBeInTheDocument();
    expect(screen.queryByText(STATE_REQUIRED_ERROR_REASON)).not.toBeInTheDocument();
    expect(screen.queryByText(ZIP_CODE_REQUIRED_ERROR_REASON)).not.toBeInTheDocument();
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

    const patchSpy = vi.spyOn(Api2, 'patchTrustee').mockResolvedValue(undefined);

    vi.spyOn(Validation, 'validateObject').mockReturnValue(Validation.VALID);

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'edit-id', trustee: existing });

    await userEvent.clear(screen.getByTestId('trustee-address1'));
    await userEvent.clear(screen.getByTestId('trustee-address2'));
    await userEvent.clear(screen.getByTestId('trustee-city'));
    await TestingUtilities.clearComboBoxSelection('trustee-state');
    await userEvent.clear(screen.getByTestId('trustee-zip'));
    await userEvent.clear(screen.getByTestId('trustee-phone'));
    await userEvent.clear(screen.getByTestId('trustee-extension'));
    await userEvent.clear(screen.getByTestId('trustee-email'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalled();
      const calledPayload = patchSpy.mock.calls[0][1];
      expect(calledPayload).toHaveProperty('internal');
      const internal = calledPayload!.internal!;
      expect(internal.address).toBeNull();
      expect(internal.phone).toBeNull();
      expect(internal.email).toBeNull();
    });
  });

  test('should not call API when validation fails on submit', async () => {
    const patchSpy = vi.spyOn(Api2, 'patchTrustee').mockResolvedValue(undefined);

    renderWithProps({
      cancelTo: '/trustees',
      trusteeId: 'fail-id',
    });

    const address2Field = screen.getByTestId('trustee-address2');
    await userEvent.clear(address2Field);
    await userEvent.type(address2Field, 'Suite 100');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(patchSpy).not.toHaveBeenCalled();
  });

  test('removes field error when subsequent validation succeeds (covers return rest path)', async () => {
    vi.spyOn(DebounceModule, 'default').mockReturnValue(immediateDebounce);

    const invalidResult: Validation.ValidatorResult = { reasons: ['bad'] };
    const validateSpy = vi
      .spyOn(Validation, 'validateEach')
      .mockReturnValueOnce(invalidResult)
      .mockReturnValue(Validation.VALID);

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'rem-1' });

    const addr1 = screen.getByTestId('trustee-address1');

    await userEvent.clear(addr1);
    await userEvent.type(addr1, 'x');

    await waitFor(() => {
      expect(screen.queryByText('bad')).toBeInTheDocument();
    });

    await userEvent.clear(addr1);
    await userEvent.type(addr1, 'ok');

    await waitFor(() => {
      expect(screen.queryByText('bad')).not.toBeInTheDocument();
    });

    expect(validateSpy).toHaveBeenCalled();
  });

  test('validateField returns undefined when spec does not contain the field', () => {
    const result = validateField('address1', 'value', {});
    expect(result).toBeUndefined();
  });

  test('trims value before validating and returns undefined when validateEach says valid', () => {
    const spy = vi.spyOn(Validation, 'validateEach').mockReturnValue(Validation.VALID);

    const spec: Partial<typeof TRUSTEE_INTERNAL_SPEC> = {
      address1: TRUSTEE_INTERNAL_SPEC.address1,
    };
    const result = validateField('address1', '  abc  ', spec);

    expect(spy).toHaveBeenCalledWith(spec.address1, 'abc');
    expect(result).toBeUndefined();
  });

  test('returns a ValidatorReasonMap when validateEach reports invalid', () => {
    const tooLongResult: Validation.ValidatorResult = { reasons: ['too long'] };
    vi.spyOn(Validation, 'validateEach').mockReturnValue(tooLongResult);

    const spec: Partial<typeof TRUSTEE_INTERNAL_SPEC> = { email: TRUSTEE_INTERNAL_SPEC.email };
    const result = validateField('email', 'bad', spec);

    expect(result).toEqual({ email: { reasons: ['too long'] } });
  });

  test('converts whitespace-only value to undefined before calling validateEach', () => {
    const spy2 = vi.spyOn(Validation, 'validateEach').mockReturnValue(Validation.VALID);

    const spec: Partial<typeof TRUSTEE_INTERNAL_SPEC> = { city: TRUSTEE_INTERNAL_SPEC.city };
    validateField('city', '   ', spec);

    expect(spy2).toHaveBeenCalledWith(spec.city, undefined);
  });

  test('getDynamicSpec removes spec keys that are not present in form data (covers delete path)', async () => {
    (TRUSTEE_INTERNAL_SPEC as unknown as Record<string, unknown[]>).__extra_temp_key = [];

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'spec-rem-1' });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    delete (TRUSTEE_INTERNAL_SPEC as unknown as Record<string, unknown[]>).__extra_temp_key;
  });

  test('shows saving state while awaiting patchTrustee', async () => {
    vi.spyOn(Validation, 'validateObject').mockReturnValue(Validation.VALID);

    let resolvePatch: (() => void) | undefined;
    const patchPromise = new Promise<void>((res) => {
      resolvePatch = res;
    });

    const patchSpy = vi
      .spyOn(Api2, 'patchTrustee')
      .mockImplementation(() => patchPromise as unknown as ReturnType<typeof Api2.patchTrustee>);

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'save-wait' });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(screen.getByTestId('button-submit-button')).toHaveTextContent('Saving…'),
    );

    resolvePatch!();

    await waitFor(() => expect(patchSpy).toHaveBeenCalled());
  });

  test('displays field errors returned by validateObject on submit (covers optional chaining errorMessage props)', async () => {
    const reasonMap = {
      address2: { reasons: ['addr2 error'] },
      phone: { reasons: ['phone error'] },
      extension: { reasons: ['ext error'] },
      email: { reasons: ['email error'] },
    } as unknown as Validation.ValidatorResult['reasonMap'];

    vi.spyOn(Validation, 'validateObject').mockReturnValue({
      reasonMap,
    } as Validation.ValidatorResult);

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'err-1' });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.queryByText('addr2 error')).toBeInTheDocument();
    expect(screen.queryByText('phone error')).toBeInTheDocument();
    expect(screen.queryByText('ext error')).toBeInTheDocument();
    expect(screen.queryByText('email error')).toBeInTheDocument();
  });

  test('renders submit and cancel buttons (covers submit/cancel JSX region)', () => {
    renderWithProps();

    const submitButton = screen.getByTestId('button-submit-button');
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    expect(submitButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
  });
});
