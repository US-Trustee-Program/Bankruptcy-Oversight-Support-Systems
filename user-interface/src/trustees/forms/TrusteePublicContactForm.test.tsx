import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrusteePublicContactForm, {
  TrusteePublicContactFormProps,
  validateField,
} from './TrusteePublicContactForm';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import * as DebounceModule from '@/lib/hooks/UseDebounce';
import { FeatureFlagSet } from '@common/feature-flags';
import Api2 from '@/lib/models/api2';

import { Trustee, TrusteeInput } from '@common/cams/trustees';
import * as NavigatorModule from '@/lib/hooks/UseCamsNavigator';
import MockData from '@common/cams/test-utilities/mock-data';
import { TrusteePublicFormData } from './trusteeForms.types';
import * as Validation from '@common/cams/validation';
import * as useCamsNavigatorModule from '@/lib/hooks/UseCamsNavigator';

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
  const navigateTo = vi.fn();
  const navigatorMock = {
    navigateTo,
    redirectTo: vi.fn(),
  };
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);

    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
      'trustee-management': true,
    } as FeatureFlagSet);
    // Mock useDebounce so debounced callbacks run immediately in tests
    vi.spyOn(DebounceModule, 'default').mockReturnValue(((cb: () => void) =>
      cb()) as unknown as ReturnType<typeof DebounceModule.default>);
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

  test('should handle form submission for creating a new trustee', async () => {
    const postSpy = vi
      .spyOn(Api2, 'postTrustee')
      .mockResolvedValue({ data: MockData.getTrustee() });

    renderWithProps();

    await waitFor(() => {
      const nameInput = screen.getByTestId('trustee-name');
      expect(nameInput).toBeInTheDocument();
    });

    const nameInput = screen.getByTestId('trustee-name');
    const address1Input = screen.getByTestId('trustee-address1');
    const address2Input = screen.getByTestId('trustee-address2');
    const cityInput = screen.getByTestId('trustee-city');
    const zipInput = screen.getByTestId('trustee-zip');
    const phoneInput = screen.getByTestId('trustee-phone');
    const extensionInput = screen.getByTestId('trustee-extension');
    const emailInput = screen.getByTestId('trustee-email');
    const websiteInput = screen.getByTestId('trustee-website');

    const trusteeName = 'Test Trustee';
    await userEvent.type(nameInput, trusteeName);
    const address1 = '123 Main St';
    await userEvent.type(address1Input, address1);
    const address2 = 'Apt 123';
    await userEvent.type(address2Input, address2);
    const city = 'Test City';
    await userEvent.type(cityInput, city);
    const zip = '90210';
    await userEvent.type(zipInput, zip);
    const phoneNumer = '555-123-4567';
    await userEvent.type(phoneInput, phoneNumer);
    const extension = '123';
    await userEvent.type(extensionInput, extension);
    const email = 'test@example.com';
    await userEvent.type(emailInput, email);
    const website = 'example.com';
    await userEvent.type(websiteInput, website);

    await TestingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    const expectedPayload = {
      name: trusteeName,
      public: {
        address: {
          address1,
          address2,
          city,
          state: 'CA',
          zipCode: zip,
          countryCode: 'US',
        },
        phone: {
          number: phoneNumer,
          extension,
        },
        email,
        website,
      },
    } as Partial<TrusteeInput>;

    expect(postSpy).toHaveBeenCalledWith(expectedPayload);
  });

  test('should handle form submission for creating a new trustee with only required fields', async () => {
    const newTrustee = MockData.getTrustee();
    const postSpy = vi.spyOn(Api2, 'postTrustee').mockResolvedValue({ data: newTrustee });

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

    const trusteeName = 'Test Trustee';
    await userEvent.type(nameInput, trusteeName);
    const address1 = '123 Main St';
    await userEvent.type(address1Input, address1);
    const city = 'Test City';
    await userEvent.type(cityInput, city);
    const zip = '90210';
    await userEvent.type(zipInput, zip);
    const phoneNumber = '555-123-4567';
    await userEvent.type(phoneInput, phoneNumber);
    const email = 'test@example.com';
    await userEvent.type(emailInput, email);

    await TestingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    const expectedPayload = {
      name: trusteeName,
      public: {
        address: {
          address1,
          address2: undefined,
          city,
          state: 'CA',
          zipCode: zip,
          countryCode: 'US',
        },
        phone: {
          number: phoneNumber,
          extension: undefined,
        },
        email,
        website: undefined,
      },
    } as Partial<TrusteeInput>;

    expect(postSpy).toHaveBeenCalledWith(expectedPayload);
    expect(navigateTo).toHaveBeenCalledWith('/trustees/' + newTrustee.trusteeId);
  });

  test('should handle form submission for editing public profile information', async () => {
    const existing = MockData.getTrustee();
    existing.public.website = 'https://existing.com';
    existing.public.address.address2 = '';
    const editPublicState = {
      action: 'edit' as const,
      cancelTo: `/trustees/${existing.trusteeId}`,
      trusteeId: existing.trusteeId,
      contactInformation: 'public' as const,
      trustee: existing,
    };

    const patchSpy = vi.spyOn(Api2, 'patchTrustee').mockResolvedValue({ data: existing });

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
    const websiteInput = screen.getByTestId('trustee-website');

    expect(address1Input).toContainHTML(existing.public.address.address1);
    expect(cityInput).toContainHTML(existing.public.address.city);
    expect(stateInput).toContainHTML(existing.public.address.state);
    expect(zipInput).toContainHTML(existing.public.address.zipCode);
    expect(phoneInput).toContainHTML(existing.public.phone!.number);
    expect(emailInput).toContainHTML(existing.public.email!);
    expect(websiteInput).toContainHTML(existing.public.website!);

    const newAddress1 = '123 Main St';
    await userEvent.clear(address1Input);
    await userEvent.type(address1Input, newAddress1);
    await TestingUtilities.clearComboBoxSelection('trustee-state');
    await TestingUtilities.toggleComboBoxItemSelection('trustee-state', 5);
    const newZip = '90210-1111';
    await userEvent.clear(zipInput);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await userEvent.type(zipInput, newZip);
    await waitFor(() => {
      expect(zipInput).toHaveValue(newZip);
    });
    const newPhone = '555-123-4567';
    await userEvent.clear(phoneInput);
    await userEvent.type(phoneInput, newPhone);
    const newEmail = 'test@example.com';
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, newEmail);
    await userEvent.clear(websiteInput);
    await userEvent.type(websiteInput, 'example.com');

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    const expectedPayload = {
      ...existing,
      public: {
        ...existing.public,
        address: {
          ...existing.public.address,
          address1: newAddress1,
          zipCode: newZip,
          state: 'CA',
        },
        phone: {
          ...existing.public.phone,
          number: newPhone,
        },
        email: newEmail,
        website: 'example.com',
      },
    } as Partial<Trustee>;
    delete expectedPayload.id;
    delete expectedPayload.trusteeId;
    delete expectedPayload.public?.address.address2;
    delete expectedPayload.public?.address.address3;
    delete expectedPayload.updatedBy;
    delete expectedPayload.updatedOn;

    expect(patchSpy).toHaveBeenCalledWith(existing.trusteeId, expectedPayload);
    expect(navigateTo).toHaveBeenCalledWith('/trustees/' + existing.trusteeId);
  });

  test('should handle cancel button functionality for create mode', async () => {
    renderWithProps();

    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    await userEvent.click(cancelButton);

    expect(navigateTo).toHaveBeenCalledWith('/trustees');
  });

  test('should handle cancel button functionality for edit mode', async () => {
    const existing = MockData.getTrustee();
    renderWithProps({
      action: 'edit',
      cancelTo: `/trustees/${existing.trusteeId}`,
      trusteeId: '123',
      trustee: existing,
    });

    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    await userEvent.click(cancelButton);

    expect(navigateTo).toHaveBeenCalledWith(`/trustees/${existing.trusteeId}`);
  });

  test('should not call API when validation fails on submit (create)', async () => {
    const mockPost = vi.spyOn(Api2, 'postTrustee').mockImplementation(vi.mocked(Api2.postTrustee));

    renderWithProps({
      action: 'create',
      cancelTo: '/trustees',
      trusteeId: '',
    });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await new Promise((res) => setTimeout(res, 50));
    expect(mockPost).not.toHaveBeenCalled();
  });

  test('should call globalAlert.error when postTrustee rejects during create', async () => {
    const error = new Error('create failed');
    vi.spyOn(Api2, 'postTrustee').mockRejectedValue(error);

    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    renderWithProps({ action: 'create', cancelTo: '/trustees', trusteeId: '' });

    await userEvent.type(screen.getByTestId('trustee-name'), 'Create Trustee');
    await userEvent.type(screen.getByTestId('trustee-address1'), '1 Main St');
    await userEvent.type(screen.getByTestId('trustee-city'), 'City');
    await userEvent.type(screen.getByTestId('trustee-zip'), '90210');
    await userEvent.type(screen.getByTestId('trustee-phone'), '555-111-2222');
    await userEvent.type(screen.getByTestId('trustee-email'), 'create@example.com');
    await TestingUtilities.toggleComboBoxItemSelection('trustee-state', 5);

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalled();
      expect(globalAlertSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to create trustee/),
      );
    });
  });

  test('should call globalAlert.error when patchTrustee rejects during edit', async () => {
    const error = new Error('Network failure');
    vi.spyOn(Api2, 'patchTrustee').mockRejectedValue(error);

    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    vi.spyOn(NavigatorModule, 'default').mockReturnValue({
      navigateTo: vi.fn(),
    } as unknown as ReturnType<typeof NavigatorModule.default>);

    vi.spyOn(Validation, 'validateObject').mockReturnValue({
      valid: true,
      reasonMap: undefined,
    } as Validation.ValidatorResult);

    const existing = MockData.getTrustee();
    renderWithProps({
      action: 'edit',
      cancelTo: '/trustees',
      trusteeId: existing.trusteeId,
      trustee: existing,
    });

    await waitFor(() => {
      expect(screen.getByTestId('trustee-name')).toHaveValue(existing.name);
    });

    await userEvent.type(screen.getByTestId('trustee-name'), 'Edited Name');
    await userEvent.type(screen.getByTestId('trustee-address1'), '1 Main St');
    await TestingUtilities.toggleComboBoxItemSelection('trustee-state', 5);
    await userEvent.type(screen.getByTestId('trustee-zip'), '90210');
    await userEvent.type(screen.getByTestId('trustee-phone'), '555-111-2222');
    await userEvent.type(screen.getByTestId('trustee-email'), 'p@example.com');

    const form = screen.getByTestId('trustee-public-form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalled();
      expect(globalAlertSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to update trustee/),
      );
    });
  });

  test('validateField returns null for a field not in spec (covers else branch)', () => {
    const unknownField = 'notASpecField' as unknown as keyof TrusteePublicFormData;
    expect(validateField(unknownField, 'some value')).toBeNull();
  });
});
