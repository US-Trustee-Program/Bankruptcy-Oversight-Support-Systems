import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrusteeContactForm, { TrusteeContactFormProps, validateField } from './TrusteeContactForm';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { FeatureFlagSet } from '@common/feature-flags';
import Api2 from '@/lib/models/api2';
import { Trustee, TypedPhoneNumber } from '@common/cams/trustees';

import * as NavigatorModule from '@/lib/hooks/UseCamsNavigator';
import * as DebounceModule from '@/lib/hooks/UseDebounce';
import * as Validation from '@common/cams/validation';
import * as useCamsNavigatorModule from '@/lib/hooks/UseCamsNavigator';
import MockData from '@common/cams/test-utilities/mock-data';
import { trusteeInternalSpec } from './trusteeForms.types';
import { FIELD_VALIDATION_MESSAGES } from '@common/cams/validation-messages';

vi.mock('@/lib/components/cams/TypedPhoneList/TypedPhoneList', () => ({
  default: vi.fn(() => <div data-testid="mock-typed-phone-list" />),
}));

import TypedPhoneList from '@/lib/components/cams/TypedPhoneList/TypedPhoneList';

const mockTypedPhoneList = vi.mocked(TypedPhoneList);

const FLAGS_TYPED_PHONES_OFF: FeatureFlagSet = {
  'trustee-management': true,
  'trustee-typed-phones': false,
};
const FLAGS_TYPED_PHONES_ON: FeatureFlagSet = {
  'trustee-management': true,
  'trustee-typed-phones': true,
};

const ADDRESS_REQUIRED_ERROR_REASON = FIELD_VALIDATION_MESSAGES.ADDRESS_REQUIRED;
const CITY_REQUIRED_ERROR_REASON = FIELD_VALIDATION_MESSAGES.CITY_REQUIRED;
const PARTIAL_ADDRESS_ERROR_REASON = FIELD_VALIDATION_MESSAGES.PARTIAL_ADDRESS;
const STATE_REQUIRED_ERROR_REASON = FIELD_VALIDATION_MESSAGES.STATE_REQUIRED;
const ZIP_CODE_REQUIRED_ERROR_REASON = FIELD_VALIDATION_MESSAGES.ZIP_CODE_REQUIRED;

function renderWithProps(
  props: TrusteeContactFormProps = {
    cancelTo: '/trustees/123',
    trusteeId: '123',
    trustee: undefined,
  },
) {
  return render(
    <MemoryRouter>
      <TrusteeContactForm {...props} />
    </MemoryRouter>,
  );
}

describe('TrusteeContactForm Tests', () => {
  let navigateTo: (destination: string) => void;
  let navigatorMock: {
    navigateTo: (destination: string) => void;
    redirectTo: (destination: string) => void;
  };
  const immediateDebounce: ReturnType<typeof DebounceModule.default> = (
    cb: () => void,
    _delay?: number,
  ) => {
    cb();
  };
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    navigateTo = vi.fn();
    navigatorMock = {
      navigateTo,
      redirectTo: vi.fn(),
    };
    userEvent = TestingUtilities.setupUserEvent();
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);

    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(FLAGS_TYPED_PHONES_OFF);
    vi.spyOn(useCamsNavigatorModule, 'default').mockReturnValue(navigatorMock);
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

  test.each([
    {
      name: 'with an address2 and a phone extension',
      address2: 'Suite 100',
      phones: [{ number: '555-000-1111', extension: '1234', type: 'direct' as const }],
    },
    {
      name: 'with an empty address2 and no phone extension',
      address2: '',
      phones: [{ number: '555-000-1111', type: 'direct' as const }],
    },
  ])(
    'should map internal payload for edit and call patchTrustee then navigate to trustee profile ($name)',
    async ({ address2, phones }) => {
      const trustee = MockData.getTrustee();
      trustee.internal = {
        address: {
          address1: '123 Main St',
          address2,
          city: 'Springfield',
          state: 'IL',
          zipCode: '11111',
          countryCode: 'US',
        },
        phones,
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
            address2,
            city: newCity,
            state: CALIFORNIA.abbreviation,
            zipCode: newZip,
            countryCode: 'US',
          },
          phones,
          email: trustee.internal!.email,
        },
      };

      expect(patchSpy).toHaveBeenCalledWith(trustee.trusteeId, expectedPayload);
      expect(navigateTo).toHaveBeenCalledWith(`/trustees/${trustee.trusteeId}`);
    },
  );

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

    await userEvent.type(screen.getByTestId('trustee-email'), 'test@example.com');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalled();
    });

    const expectedPayload = {
      internal: {
        address: null,
        email: 'test@example.com',
        phones: undefined,
      },
    };

    expect(patchSpy).toHaveBeenCalledWith(trustee.trusteeId, expectedPayload);
    expect(navigateTo).toHaveBeenCalledWith(`/trustees/${trustee.trusteeId}`);
  });

  describe('phone UI — flag off (trustee-typed-phones: false)', () => {
    beforeEach(() => {
      vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(FLAGS_TYPED_PHONES_OFF);
    });

    test('shows a single Phone input bound to the direct number', async () => {
      const trustee = MockData.getTrustee();
      trustee.internal = { email: 'internal@example.com' };

      renderWithProps({ cancelTo: '/trustees', trusteeId: trustee.trusteeId, trustee });

      await waitFor(() => {
        expect(screen.getByTestId('trustee-phone')).toBeInTheDocument();
      });
      expect(screen.getByTestId('trustee-extension')).toBeInTheDocument();
      expect(screen.queryByTestId('phone-row-direct')).not.toBeInTheDocument();
      expect(screen.queryByTestId('phone-row-cell')).not.toBeInTheDocument();
      expect(screen.queryByTestId('phone-row-home')).not.toBeInTheDocument();
    });

    test('pre-populates phone input with the saved direct number', async () => {
      const trustee = MockData.getTrustee();
      trustee.internal = {
        phones: [{ type: 'direct', number: '555-000-1234', extension: '99' }],
      };

      renderWithProps({ cancelTo: '/trustees', trusteeId: trustee.trusteeId, trustee });

      await waitFor(() => {
        expect(screen.getByTestId('trustee-phone')).toHaveValue('555-000-1234');
      });
      expect(screen.getByTestId('trustee-extension')).toHaveValue('99');
    });

    test('submits an updated extension for the direct number', async () => {
      const trustee = MockData.getTrustee();
      trustee.internal = { phones: [{ type: 'direct', number: '555-000-1234' }] };

      const patchSpy = vi.spyOn(Api2, 'patchTrustee').mockResolvedValue(undefined);

      renderWithProps({ cancelTo: '/trustees', trusteeId: trustee.trusteeId, trustee });

      await userEvent.type(screen.getByTestId('trustee-extension'), '42');
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(patchSpy).toHaveBeenCalled());

      const payload = patchSpy.mock.calls[0][1] as { internal: { phones?: TypedPhoneNumber[] } };
      expect(payload.internal.phones).toEqual([
        { type: 'direct', number: '555-000-1234', extension: '42' },
      ]);
    });

    test('preserves all non-empty phones from state (user can only edit direct, but others are not wiped)', async () => {
      const trustee = MockData.getTrustee();
      trustee.internal = {
        phones: [
          { type: 'direct', number: '555-111-0000' },
          { type: 'cell', number: '555-222-0000' },
        ],
      };

      const patchSpy = vi.spyOn(Api2, 'patchTrustee').mockResolvedValue(undefined);

      renderWithProps({ cancelTo: '/trustees', trusteeId: trustee.trusteeId, trustee });

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(patchSpy).toHaveBeenCalled());

      const payload = patchSpy.mock.calls[0][1] as { internal: { phones?: unknown[] } };
      expect(payload.internal.phones).toEqual([
        { type: 'direct', number: '555-111-0000' },
        { type: 'cell', number: '555-222-0000' },
      ]);
    });

    test('submits phones as undefined when the direct number is cleared', async () => {
      const trustee = MockData.getTrustee();
      trustee.internal = { phones: [{ type: 'direct', number: '555-000-0000' }] };

      const patchSpy = vi.spyOn(Api2, 'patchTrustee').mockResolvedValue(undefined);

      renderWithProps({ cancelTo: '/trustees', trusteeId: trustee.trusteeId, trustee });

      await userEvent.clear(screen.getByTestId('trustee-phone'));
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(patchSpy).toHaveBeenCalled());

      const payload = patchSpy.mock.calls[0][1] as { internal: { phones?: unknown } };
      expect(payload.internal.phones).toBeUndefined();
    });
  });

  describe('phone UI — flag on (trustee-typed-phones: true)', () => {
    beforeEach(() => {
      vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(FLAGS_TYPED_PHONES_ON);
    });

    test('renders TypedPhoneList instead of the single-phone inputs', async () => {
      const trustee = MockData.getTrustee();
      trustee.internal = { email: 'internal@example.com' };

      renderWithProps({ cancelTo: '/trustees', trusteeId: trustee.trusteeId, trustee });

      await waitFor(() => {
        expect(screen.getByTestId('mock-typed-phone-list')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('trustee-phone')).not.toBeInTheDocument();
    });

    test("passes the trustee's saved phones through to TypedPhoneList", async () => {
      const trustee = MockData.getTrustee();
      trustee.internal = {
        phones: [
          { type: 'direct', number: '555-111-0001' },
          { type: 'cell', number: '555-222-0002' },
        ],
      };

      renderWithProps({ cancelTo: '/trustees', trusteeId: trustee.trusteeId, trustee });

      await waitFor(() => {
        expect(mockTypedPhoneList).toHaveBeenCalled();
      });
      const { phones } = mockTypedPhoneList.mock.calls.at(-1)![0];
      expect(phones).toEqual([
        { type: 'direct', number: '555-111-0001' },
        { type: 'cell', number: '555-222-0002' },
        { type: 'home', number: '' },
      ]);
    });

    test('omits empty rows from the submitted phones array', async () => {
      const trustee = MockData.getTrustee();
      trustee.internal = { phones: [{ type: 'direct', number: '555-333-0000' }] };

      const patchSpy = vi.spyOn(Api2, 'patchTrustee').mockResolvedValue(undefined);

      renderWithProps({ cancelTo: '/trustees', trusteeId: trustee.trusteeId, trustee });

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(patchSpy).toHaveBeenCalled());

      const payload = patchSpy.mock.calls[0][1] as { internal: { phones?: unknown[] } };
      expect(payload.internal.phones).toEqual([{ type: 'direct', number: '555-333-0000' }]);
    });

    test('submits phones as undefined when all rows are empty', async () => {
      const trustee = MockData.getTrustee();
      trustee.internal = { email: 'internal@example.com' };

      const patchSpy = vi.spyOn(Api2, 'patchTrustee').mockResolvedValue(undefined);

      renderWithProps({ cancelTo: '/trustees', trusteeId: trustee.trusteeId, trustee });

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(patchSpy).toHaveBeenCalled());

      const payload = patchSpy.mock.calls[0][1] as { internal: { phones?: unknown } };
      expect(payload.internal.phones).toBeUndefined();
    });
  });

  test('should call globalAlert.error when patchTrustee rejects during edit', async () => {
    const baseFormData = {
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

    vi.spyOn(DebounceModule, 'default').mockReturnValue(immediateDebounce);

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'abc', trustee: startingState });

    expect(
      document.getElementById('trustee-address1-input__error-message'),
    ).not.toBeInTheDocument();
    expect(document.getElementById('trustee-city-input__error-message')).not.toBeInTheDocument();
    expect(document.getElementById('trustee-state-input__error-message')).not.toBeInTheDocument();
    expect(document.getElementById('trustee-zip-input__error-message')).not.toBeInTheDocument();

    const addr2 = screen.getByTestId('trustee-address2');
    await userEvent.type(addr2, 'suite 101');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    const address1Error = document.getElementById('trustee-address1-input__error-message');
    expect(address1Error).toBeInTheDocument();
    expect(address1Error).toHaveTextContent(ADDRESS_REQUIRED_ERROR_REASON);
    const cityError = document.getElementById('trustee-city-input__error-message');
    expect(cityError).toBeInTheDocument();
    expect(cityError).toHaveTextContent(CITY_REQUIRED_ERROR_REASON);
    const stateError = document.getElementById('trustee-state-input__error-message');
    expect(stateError).toBeInTheDocument();
    expect(stateError).toHaveTextContent(STATE_REQUIRED_ERROR_REASON);
    const zipError = document.getElementById('trustee-zip-input__error-message');
    expect(zipError).toBeInTheDocument();
    expect(zipError).toHaveTextContent(ZIP_CODE_REQUIRED_ERROR_REASON);

    await userEvent.clear(addr2);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(
        document.getElementById('trustee-address1-input__error-message'),
      ).not.toBeInTheDocument();
    });
    expect(document.getElementById('trustee-city-input__error-message')).not.toBeInTheDocument();
    expect(document.getElementById('trustee-state-input__error-message')).not.toBeInTheDocument();
    expect(document.getElementById('trustee-zip-input__error-message')).not.toBeInTheDocument();
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
          countryCode: 'US',
        },
        phones: [],
        email: undefined,
      },
    } as Partial<Trustee>;

    vi.spyOn(DebounceModule, 'default').mockReturnValue(immediateDebounce);

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'abc', trustee: existing });

    const addr1 = screen.getByTestId('trustee-address1');
    const city = screen.getByTestId('trustee-city');
    const zip = screen.getByTestId('trustee-zip');

    await userEvent.clear(addr1);

    // Per-field validation doesn't show group-level errors immediately
    // Address field is optional, so no error appears until submit
    expect(
      document.getElementById('trustee-address1-input__error-message'),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    // On submit, full form validation runs and shows partial address error
    expect(screen.queryByText(PARTIAL_ADDRESS_ERROR_REASON)).toBeInTheDocument();
    const address1Error = document.getElementById('trustee-address1-input__error-message');
    expect(address1Error).toBeInTheDocument();
    expect(address1Error).toHaveTextContent(ADDRESS_REQUIRED_ERROR_REASON);

    await userEvent.clear(city);

    // Per-field validation doesn't show group-level errors immediately
    expect(document.getElementById('trustee-city-input__error-message')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    const cityError = document.getElementById('trustee-city-input__error-message');
    expect(cityError).toBeInTheDocument();
    expect(cityError).toHaveTextContent(CITY_REQUIRED_ERROR_REASON);
    expect(document.getElementById('trustee-zip-input__error-message')).not.toBeInTheDocument();

    await userEvent.clear(zip);

    // Per-field validation doesn't show group-level errors immediately
    expect(document.getElementById('trustee-zip-input__error-message')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    const zipError = document.getElementById('trustee-zip-input__error-message');
    expect(zipError).toBeInTheDocument();
    expect(zipError).toHaveTextContent(ZIP_CODE_REQUIRED_ERROR_REASON);
    expect(document.getElementById('trustee-state-input__error-message')).not.toBeInTheDocument();

    await TestingUtilities.clearComboBoxSelection('trustee-state');

    // Errors from previous submit persist until revalidation
    // All address fields are now empty, click Save to revalidate
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    // Now that all address fields are empty (valid state), errors should clear
    expect(
      document.getElementById('trustee-address1-input__error-message'),
    ).not.toBeInTheDocument();
    expect(document.getElementById('trustee-city-input__error-message')).not.toBeInTheDocument();
    expect(document.getElementById('trustee-state-input__error-message')).not.toBeInTheDocument();
    expect(document.getElementById('trustee-zip-input__error-message')).not.toBeInTheDocument();
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
        phones: [{ number: '555-000-1111', extension: '1234', type: 'direct' as const }],
        email: 'test@example.com',
      },
    } as Partial<Trustee>;

    const patchSpy = vi.spyOn(Api2, 'patchTrustee').mockResolvedValue(undefined);

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'edit-id', trustee: existing });

    await userEvent.clear(screen.getByTestId('trustee-address1'));
    await userEvent.clear(screen.getByTestId('trustee-address2'));
    await userEvent.clear(screen.getByTestId('trustee-city'));
    await TestingUtilities.clearComboBoxSelection('trustee-state');
    await userEvent.clear(screen.getByTestId('trustee-zip'));
    await userEvent.clear(screen.getByTestId('trustee-email'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalled();
      const calledPayload = patchSpy.mock.calls[0][1];
      expect(calledPayload).toHaveProperty('internal');
      const internal = calledPayload!.internal!;
      expect(internal.address).toBeNull();
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
      const errorElement = document.getElementById('trustee-address1-input__error-message');
      expect(errorElement).toBeInTheDocument();
      expect(errorElement).toHaveTextContent('bad');
    });

    await userEvent.clear(addr1);
    await userEvent.type(addr1, 'ok');

    await waitFor(() => {
      expect(
        document.getElementById('trustee-address1-input__error-message'),
      ).not.toBeInTheDocument();
    });

    expect(validateSpy).toHaveBeenCalled();
  });

  test('trims value before validating and returns undefined when validateEach says valid', () => {
    const spy = vi.spyOn(Validation, 'validateEach').mockReturnValue(Validation.VALID);

    const result = validateField('address1', '  abc  ');

    expect(spy).toHaveBeenCalledWith(trusteeInternalSpec.address1, 'abc');
    expect(result).toBeUndefined();
  });

  test('returns error reasons when validateEach reports invalid', () => {
    const tooLongResult: Validation.ValidatorResult = { reasons: ['too long'] };
    vi.spyOn(Validation, 'validateEach').mockReturnValue(tooLongResult);

    const result = validateField('email', 'bad');

    expect(result).toEqual(['too long']);
  });

  test('converts whitespace-only value to undefined before calling validateEach', () => {
    const spy2 = vi.spyOn(Validation, 'validateEach').mockReturnValue(Validation.VALID);

    validateField('city', '   ');

    expect(spy2).toHaveBeenCalledWith(trusteeInternalSpec.city, undefined);
  });

  test('shows saving state while awaiting patchTrustee', async () => {
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
      phones: { reasons: ['phone type error'] },
      email: { reasons: ['email error'] },
    } as unknown as Validation.ValidatorResult['reasonMap'];

    vi.spyOn(Validation, 'validateObject').mockReturnValue({
      reasonMap,
    } as Validation.ValidatorResult);

    renderWithProps({ cancelTo: '/trustees', trusteeId: 'err-1' });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    const address2Error = document.getElementById('trustee-address2-input__error-message');
    expect(address2Error).toBeInTheDocument();
    expect(address2Error).toHaveTextContent('addr2 error');
    const emailError = document.getElementById('trustee-email-input__error-message');
    expect(emailError).toBeInTheDocument();
    expect(emailError).toHaveTextContent('email error');
  });
});
