import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import TrusteeStaffForm, { validateField } from './TrusteeStaffForm';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import MockData from '@common/cams/test-utilities/mock-data';
import { TrusteeStaff, TrusteeStaffInput } from '@common/cams/trustee-staff';
import useFeatureFlags, {
  TRUSTEE_MANAGEMENT,
  TRUSTEE_TYPED_PHONES,
} from '@/lib/hooks/UseFeatureFlags';
import { Trustee } from '@common/cams/trustees';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';

const mockUseNavigate = vi.hoisted(() => vi.fn());
const mockUseParams = vi.hoisted(() => vi.fn());

vi.mock('@/lib/hooks/UseFeatureFlags');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: mockUseNavigate,
    useParams: mockUseParams,
  };
});

// Mocked only to capture the `openProps.onDelete` callback so its success/error
// handling can be tested directly, without driving the real modal's dialog UI.
// Renders a stub preserving the real component's testid convention so the existing
// presence/absence tests below continue to work unchanged.
vi.mock('@/lib/components/uswds/modal/OpenModalButton', () => ({
  default: vi.fn(({ id, children }: { id?: string; children?: React.ReactNode }) => (
    <button data-testid={`open-modal-button${id ? `_${id}` : ''}`}>{children}</button>
  )),
}));

const mockUseFeatureFlags = vi.mocked(useFeatureFlags);
const mockOpenModalButton = vi.mocked(OpenModalButton);

function getDeleteOnClick(): () => Promise<void> {
  const call = mockOpenModalButton.mock.calls.at(-1);
  const openProps = call?.[0]?.openProps as { onDelete: () => Promise<void> } | undefined;
  if (!openProps) {
    throw new Error('OpenModalButton was not rendered with openProps.onDelete');
  }
  return openProps.onDelete;
}

const TEST_TRUSTEE_ID = 'trustee-123';

const VALID_STAFF_MEMBER: TrusteeStaff = MockData.getTrusteeStaff({
  id: 'valid-staff-123',
  trusteeId: TEST_TRUSTEE_ID,
  name: 'Jane Staff',
  title: 'Senior Staff',
  contact: {
    address: {
      address1: '123 Main St',
      address2: 'Suite 100',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      countryCode: 'US',
    },
    phones: [
      {
        number: '(123)456-7890',
        extension: '123',
        type: 'direct',
      },
    ],
    email: 'jane@example.com',
  },
});

const MOCK_TRUSTEE_WITH_STAFF = MockData.getTrustee({
  trusteeId: TEST_TRUSTEE_ID,
  staff: [VALID_STAFF_MEMBER],
});

describe('TrusteeStaffForm', () => {
  const mockNavigate = vi.fn();
  let userEvent: ReturnType<typeof TestingUtilities.setupUserEvent>;

  function renderWithRouter(props: {
    trusteeId: string;
    trustee?: Trustee;
    staffId?: string; // For mocking useParams
  }) {
    mockUseParams.mockReturnValue({ staffId: props.staffId });

    return render(
      <BrowserRouter>
        <TrusteeStaffForm trusteeId={props.trusteeId} trustee={props.trustee} />
      </BrowserRouter>,
    );
  }

  // Helper for create mode tests
  function renderCreateMode() {
    return renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });
  }

  // Helper for edit mode tests with a specific staff member
  function renderEditMode(staffData?: Partial<TrusteeStaff>) {
    const staffMember = MockData.getTrusteeStaff({
      id: 'staff-456',
      trusteeId: TEST_TRUSTEE_ID,
      ...staffData,
    });

    const trustee = MockData.getTrustee({
      trusteeId: TEST_TRUSTEE_ID,
      staff: [staffMember],
    });

    return {
      ...renderWithRouter({
        trusteeId: TEST_TRUSTEE_ID,
        trustee,
        staffId: staffMember.id,
      }),
      staffMember,
      trustee,
    };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    TestingUtilities.spyOnGlobalAlert();
    mockUseNavigate.mockReturnValue(mockNavigate);
    userEvent = TestingUtilities.setupUserEvent();

    // Mock feature flag enabled by default
    mockUseFeatureFlags.mockReturnValue({
      [TRUSTEE_MANAGEMENT]: true,
    });

    const user = MockData.getCamsUser({
      roles: [CamsRole.TrusteeAdmin],
    });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));
  });

  describe('Missing Staff Member', () => {
    test('should show error when staff member not found in trustee data', () => {
      const trusteeWithoutStaff = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        staff: [],
      });

      renderWithRouter({
        trusteeId: TEST_TRUSTEE_ID,
        trustee: trusteeWithoutStaff,
        staffId: 'non-existent-id',
      });

      expect(screen.getByTestId('alert-container-staff-not-found-alert')).toBeInTheDocument();
      expect(screen.getByText('Trustee staff member not found.')).toBeInTheDocument();
      expect(screen.queryByTestId('trustee-staff-form')).not.toBeInTheDocument();
    });
  });

  describe('Permissions and Feature Flags', () => {
    test('should show message when trustee management feature is disabled', () => {
      mockUseFeatureFlags.mockReturnValue({
        [TRUSTEE_MANAGEMENT]: false,
      });

      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      expect(screen.getByTestId('trustee-create-disabled')).toBeInTheDocument();
      expect(screen.getByText('Trustee management is not enabled.')).toBeInTheDocument();
    });

    test('should show forbidden message when user lacks TrusteeAdmin role', () => {
      const user = MockData.getCamsUser({
        roles: [CamsRole.TrialAttorney],
      });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      expect(screen.getByTestId('alert-container-forbidden-alert')).toBeInTheDocument();
      expect(screen.getByText('You do not have permission to manage Trustees')).toBeInTheDocument();
    });

    test('should render form when user has proper permissions', () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      expect(screen.getByTestId('trustee-staff-form')).toBeInTheDocument();
      expect(screen.getByRole('form', { name: 'Create Trustee Staff' })).toBeInTheDocument();
    });
  });

  describe('TRUSTEE_TYPED_PHONES enabled', () => {
    beforeEach(() => {
      mockUseFeatureFlags.mockReturnValue({
        [TRUSTEE_MANAGEMENT]: true,
        [TRUSTEE_TYPED_PHONES]: true,
      });
    });

    test('should render TypedPhoneList instead of the flat phone/extension inputs', () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      expect(screen.getByTestId('phone-row-direct')).toBeInTheDocument();
      expect(screen.getByTestId('phone-row-cell')).toBeInTheDocument();
      expect(screen.getByTestId('phone-row-home')).toBeInTheDocument();
      expect(screen.queryByTestId('staff-phone')).not.toBeInTheDocument();
      expect(screen.queryByTestId('staff-extension')).not.toBeInTheDocument();
    });

    test('should submit the typed phones entered across rows', async () => {
      const mockCreateResponse = {
        data: {
          id: 'new-staff-id',
          trusteeId: TEST_TRUSTEE_ID,
          name: 'Test Staff',
          updatedBy: { id: 'user-123', name: 'Test User' },
          updatedOn: '2024-01-01T00:00:00Z',
        },
      };
      vi.spyOn(Api2, 'createStaffMember').mockResolvedValue(mockCreateResponse);

      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });
      await userEvent.type(screen.getByTestId('staff-name'), 'Test Staff');
      await userEvent.type(screen.getByLabelText(/direct phone number/i), '(555)555-5555');
      await userEvent.type(screen.getByLabelText(/cell phone number/i), '(555)555-1111');

      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(Api2.createStaffMember).toHaveBeenCalledTimes(1);
      });
      const staffMember = vi.mocked(Api2.createStaffMember).mock.calls[0][1];

      expect(staffMember.contact?.phones).toHaveLength(2);
      expect(staffMember.contact?.phones?.find((p) => p.type === 'direct')?.number).toBe(
        '555-555-5555',
      );
      expect(staffMember.contact?.phones?.find((p) => p.type === 'cell')?.number).toBe(
        '555-555-1111',
      );
    });

    test('should block submission when a typed phone row has an invalid number', async () => {
      const createSpy = vi.spyOn(Api2, 'createStaffMember');
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      await userEvent.type(screen.getByTestId('staff-name'), 'Test Staff');
      await userEvent.type(screen.getByLabelText(/direct phone number/i), '123');

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('phone-row-direct')).toHaveTextContent(
          'Must be a valid phone number',
        );
      });
      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  describe('Form Rendering and Initial State', () => {
    test('should render all form fields', () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      expect(screen.getByTestId('staff-name')).toBeInTheDocument();
      expect(screen.getByTestId('staff-title')).toBeInTheDocument();
      expect(screen.getByTestId('staff-address1')).toBeInTheDocument();
      expect(screen.getByTestId('staff-address2')).toBeInTheDocument();
      expect(screen.getByTestId('staff-city')).toBeInTheDocument();
      expect(document.querySelector('#staff-state')).toBeInTheDocument();
      expect(screen.getByTestId('staff-zip')).toBeInTheDocument();
      expect(screen.getByTestId('staff-phone')).toBeInTheDocument();
      expect(screen.getByTestId('staff-extension')).toBeInTheDocument();
      expect(screen.getByTestId('staff-email')).toBeInTheDocument();
    });

    test('should render Save and Cancel buttons', () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    test('should populate form fields when staff member data is provided', () => {
      renderWithRouter({
        trusteeId: TEST_TRUSTEE_ID,
        trustee: MOCK_TRUSTEE_WITH_STAFF,
        staffId: VALID_STAFF_MEMBER.id,
      });

      expect(screen.getByDisplayValue('Jane Staff')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Senior Staff')).toBeInTheDocument();
      expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Suite 100')).toBeInTheDocument();
      expect(screen.getByDisplayValue('New York')).toBeInTheDocument();
      expect(screen.getByDisplayValue('(123)456-7890')).toBeInTheDocument();
      expect(screen.getByDisplayValue('123')).toBeInTheDocument();
      expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument();
    });

    test('should render empty form when no staff member data is provided', () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const nameInput = screen.getByTestId('staff-name') as HTMLInputElement;
      const emailInput = screen.getByTestId('staff-email') as HTMLInputElement;

      expect(nameInput.value).toBe('');
      expect(emailInput.value).toBe('');
    });

    test('should render form when staff member contact property is undefined', () => {
      const staffWithoutContact = MockData.getTrusteeStaff({
        id: 'staff-456',
        trusteeId: TEST_TRUSTEE_ID,
        name: 'John Staff',
        title: 'Lead Staff',
        contact: undefined,
      });

      const trusteeWithStaff = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        staff: [staffWithoutContact],
      });

      renderWithRouter({
        trusteeId: TEST_TRUSTEE_ID,
        trustee: trusteeWithStaff,
        staffId: staffWithoutContact.id,
      });

      expect(screen.getByTestId('trustee-staff-form')).toBeInTheDocument();
      expect(screen.getByRole('form', { name: 'Edit Trustee Staff' })).toBeInTheDocument();

      const nameInput = screen.getByTestId('staff-name') as HTMLInputElement;
      const titleInput = screen.getByTestId('staff-title') as HTMLInputElement;
      const emailInput = screen.getByTestId('staff-email') as HTMLInputElement;
      const phoneInput = screen.getByTestId('staff-phone') as HTMLInputElement;
      const address1Input = screen.getByTestId('staff-address1') as HTMLInputElement;

      expect(nameInput.value).toBe('John Staff');
      expect(titleInput.value).toBe('Lead Staff');
      expect(emailInput.value).toBe('');
      expect(phoneInput.value).toBe('');
      expect(address1Input.value).toBe('');
    });
  });

  describe('Form Field Validation', () => {
    test('should validate name max length', async () => {
      const expectedErrorMessage = 'Max length 50 characters';
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const nameInput = screen.getByTestId('staff-name');
      const longName = 'A'.repeat(51);
      await userEvent.type(nameInput, longName);

      await waitFor(
        () => {
          const errorDiv = document.getElementById('staff-name-input__error-message');
          expect(errorDiv).toBeInTheDocument();
          expect(errorDiv?.textContent).toBe(expectedErrorMessage);
        },
        { timeout: 1000 },
      );
    });

    test('should validate title max length', async () => {
      const expectedErrorMessage = 'Max length 50 characters';
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const titleInput = screen.getByTestId('staff-title');
      const longTitle = 'A'.repeat(51);
      await userEvent.type(titleInput, longTitle);

      await waitFor(
        () => {
          const errorDiv = document.getElementById('staff-title-input__error-message');
          expect(errorDiv).toBeInTheDocument();
          expect(errorDiv?.textContent).toBe(expectedErrorMessage);
        },
        { timeout: 1000 },
      );
    });

    test('should validate email format', async () => {
      const expectedErrorMessage = 'Must be a valid email address';
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const emailInput = screen.getByTestId('staff-email');
      await userEvent.type(emailInput, 'invalid-email');

      await waitFor(
        () => {
          const errorDiv = document.getElementById('staff-email-input__error-message');
          expect(errorDiv).toBeInTheDocument();
          expect(errorDiv?.textContent).toBe(expectedErrorMessage);
        },
        { timeout: 1000 },
      );
    });

    test('should validate phone number format', async () => {
      const expectedErrorMessage = 'Must be a valid phone number';
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const phoneInput = screen.getByTestId('staff-phone');
      await userEvent.type(phoneInput, '123');

      await waitFor(
        () => {
          const errorDiv = document.getElementById('staff-phone-input__error-message');
          expect(errorDiv).toBeInTheDocument();
          expect(errorDiv?.textContent).toBe(expectedErrorMessage);
        },
        { timeout: 1000 },
      );
    });

    test('should validate extension format', async () => {
      const expectedErrorMessage = 'Must be 1 to 6 digits';
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const extensionInput = screen.getByTestId('staff-extension');
      await userEvent.type(extensionInput, '1234567');

      await waitFor(
        () => {
          const errorDiv = document.getElementById('staff-extension-input__error-message');
          expect(errorDiv).toBeInTheDocument();
          expect(errorDiv?.textContent).toBe(expectedErrorMessage);
        },
        { timeout: 1000 },
      );
    });

    test('should validate zip code format', async () => {
      const expectedErrorMessage = 'Must be 5 or 9 digits';
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const zipInput = screen.getByTestId('staff-zip');
      await userEvent.type(zipInput, '123');

      await waitFor(
        () => {
          const errorDiv = document.getElementById('staff-zip-input__error-message');
          expect(errorDiv).toBeInTheDocument();
          expect(errorDiv?.textContent).toBe(expectedErrorMessage);
        },
        { timeout: 1000 },
      );
    });

    test('should display the correct error message for address information', async () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const address2Input = screen.getByTestId('staff-address2');
      await userEvent.type(address2Input, '101');

      const saveButton = screen.getByTestId('button-submit-button');
      await saveButton.click();

      const address1ErrorMessage = document.getElementById('staff-address1-input__error-message');
      expect(address1ErrorMessage).toBeInTheDocument();
      expect(address1ErrorMessage?.textContent).toEqual('Address is required');

      const cityErrorMessage = document.getElementById('staff-city-input__error-message');
      expect(cityErrorMessage).toBeInTheDocument();
      expect(cityErrorMessage?.textContent).toEqual('City is required');

      const stateErrorMessage = document.getElementById('staff-state-input__error-message');
      expect(stateErrorMessage).toBeInTheDocument();
      expect(stateErrorMessage?.textContent).toEqual('State is required');

      const zipErrorMessage = document.getElementById('staff-zip-input__error-message');
      expect(zipErrorMessage).toBeInTheDocument();
      expect(zipErrorMessage?.textContent).toEqual('ZIP Code is required');
    });

    test('should hide alert after fixing validation errors and show new field-level errors', async () => {
      const { container } = renderWithRouter({
        trusteeId: TEST_TRUSTEE_ID,
      });

      // Fill in name and partial address (missing address1)
      await userEvent.type(screen.getByTestId('staff-name'), 'Test Staff');
      await userEvent.type(screen.getByTestId('staff-city'), 'TestCity');
      await userEvent.type(screen.getByTestId('staff-zip'), '12345');

      const stateCombobox = container.querySelector('#staff-state [role="combobox"]');
      if (stateCombobox) {
        await userEvent.click(stateCombobox);
        const nyOption = await screen.findByText(/NY.*New York/i, {}, { timeout: 1000 });
        await userEvent.click(nyOption);
      }

      // Submit to trigger alert
      const saveButton = screen.getByTestId('button-submit-button');
      saveButton.click();

      // Verify alert message is visible
      await waitFor(
        () => {
          const alertMessage = screen.queryByTestId('alert-message-staff-form-error-alert');
          expect(alertMessage).toBeInTheDocument();
          expect(alertMessage).toBeVisible();
        },
        { timeout: 1000 },
      );

      // Fix address1
      await userEvent.type(screen.getByTestId('staff-address1'), '123 Main St');

      // Add phone extension without phone number (will cause new error)
      await userEvent.type(screen.getByTestId('staff-extension'), '123');

      // Submit again
      saveButton.click();

      await waitFor(
        () => {
          const alertContainer = screen.getByTestId('alert-container-staff-form-error-alert');
          expect(alertContainer).not.toHaveClass('visible');
        },
        { timeout: 1000 },
      );

      // Verify phone error message is displayed
      await waitFor(
        () => {
          const phoneErrorMessage = document.getElementById('staff-phone-input__error-message');
          expect(phoneErrorMessage).toBeInTheDocument();
          expect(phoneErrorMessage?.textContent).toEqual(
            'Phone number is required when extension is provided',
          );
        },
        { timeout: 1000 },
      );
    });
  });

  describe('Form Submission', () => {
    test('should successfully submit form with only name field filled', async () => {
      const { staffMember } = renderEditMode({ name: 'Existing Staff' });

      const updateSpy = vi
        .spyOn(Api2, 'updateStaffMember')
        .mockResolvedValue({ data: staffMember });

      expect(screen.getByTestId('staff-name')).toHaveValue('Existing Staff');

      await userEvent.clear(screen.getByTestId('staff-name'));
      await userEvent.type(screen.getByTestId('staff-name'), 'Test Staff');

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      await waitFor(
        () => {
          expect(updateSpy).toHaveBeenCalledTimes(1);
          expect(mockNavigate).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}`);
        },
        { timeout: 2000 },
      );
    });

    test('should show Saving... text during submission', async () => {
      const { staffMember } = renderEditMode();

      vi.spyOn(Api2, 'updateStaffMember').mockImplementation(() => new Promise(() => {}));

      expect(screen.getByTestId('staff-name')).toHaveValue(staffMember.name);

      await userEvent.clear(screen.getByTestId('staff-name'));
      await userEvent.type(screen.getByTestId('staff-name'), 'Test Staff');

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    test('should handle API error during submission', async () => {
      const alertHooks = TestingUtilities.spyOnGlobalAlert();
      const { staffMember } = renderEditMode();

      const errorMessage = 'Failed to update';
      const updateSpy = vi
        .spyOn(Api2, 'updateStaffMember')
        .mockRejectedValue(new Error(errorMessage));

      expect(screen.getByTestId('staff-name')).toHaveValue(staffMember.name);

      await userEvent.clear(screen.getByTestId('staff-name'));
      await userEvent.type(screen.getByTestId('staff-name'), 'Test Staff');

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      await waitFor(
        () => {
          expect(updateSpy).toHaveBeenCalled();
          expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
          expect(alertHooks.error).toHaveBeenCalledWith(
            `Failed to update trustee staff member: ${errorMessage}`,
          );
        },
        { timeout: 2000 },
      );
    });

    test('should not submit form when required fields are empty', async () => {
      const { staffMember } = renderEditMode();

      const updateSpy = vi.spyOn(Api2, 'updateStaffMember');

      expect(screen.getByTestId('staff-name')).toHaveValue(staffMember.name);

      await userEvent.clear(screen.getByTestId('staff-name'));

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      await waitFor(
        () => {
          expect(updateSpy).not.toHaveBeenCalled();
        },
        { timeout: 1000 },
      );
    });

    test('should submit form with complete address', async () => {
      // Pre-populate state as 'NY' so the test does not depend on a timing-sensitive
      // combobox interaction to change a random faker state to a specific value.
      const { staffMember } = renderEditMode({
        contact: {
          address: {
            address1: '1 Old St',
            city: 'OldCity',
            state: 'NY',
            zipCode: '00000',
            countryCode: 'US',
          },
        },
      });

      const updateSpy = vi
        .spyOn(Api2, 'updateStaffMember')
        .mockResolvedValue({ data: staffMember });

      expect(screen.getByTestId('staff-name')).toHaveValue(staffMember.name);

      // Clear and fill in all fields including complete address
      await userEvent.clear(screen.getByTestId('staff-name'));
      await userEvent.type(screen.getByTestId('staff-name'), 'Test Staff');
      await userEvent.clear(screen.getByTestId('staff-title'));
      await userEvent.type(screen.getByTestId('staff-title'), 'Lead Staff');
      await userEvent.clear(screen.getByTestId('staff-address1'));
      await userEvent.type(screen.getByTestId('staff-address1'), '456 Test St');
      await userEvent.clear(screen.getByTestId('staff-address2'));
      await userEvent.type(screen.getByTestId('staff-address2'), 'Suite 200');
      await userEvent.clear(screen.getByTestId('staff-city'));
      await userEvent.type(screen.getByTestId('staff-city'), 'TestCity');
      await userEvent.clear(screen.getByTestId('staff-zip'));
      await userEvent.type(screen.getByTestId('staff-zip'), '12345');
      await userEvent.clear(screen.getByTestId('staff-phone'));
      await userEvent.type(screen.getByTestId('staff-phone'), '(555)555-5555');
      await userEvent.clear(screen.getByTestId('staff-extension'));
      await userEvent.type(screen.getByTestId('staff-extension'), '999');
      await userEvent.clear(screen.getByTestId('staff-email'));
      await userEvent.type(screen.getByTestId('staff-email'), 'test@example.com');

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      await waitFor(
        () => {
          expect(updateSpy).toHaveBeenCalledTimes(1);
          const callArgs = updateSpy.mock.calls[0];
          expect(callArgs[0]).toBe(TEST_TRUSTEE_ID);
          expect(callArgs[1]).toBe(staffMember.id);

          expect(callArgs[2]).toBeDefined();

          const { name, title, contact } = callArgs[2]!;
          expect(name).toBe('Test Staff');
          expect(title).toBe('Lead Staff');

          expect(contact).toBeDefined();

          const { address, phones, email } = contact!;
          expect(address).toBeDefined();
          expect(phones).toBeDefined();

          const { address1, address2, city, state, zipCode } = address!;
          expect(address1).toBe('456 Test St');
          expect(address2).toBe('Suite 200');
          expect(city).toBe('TestCity');
          expect(state).toBe('NY');
          expect(zipCode).toBe('12345');

          const directPhone = phones!.find((p) => p.type === 'direct');
          expect(directPhone?.extension).toBe('999');

          expect(email).toBe('test@example.com');
        },
        { timeout: 2000 },
      );
    });

    test('should successfully submit form in create mode', async () => {
      const mockCreateResponse = {
        data: {
          id: 'new-staff-id',
          trusteeId: TEST_TRUSTEE_ID,
          name: 'New Staff',
          updatedBy: { id: 'user-123', name: 'Test User' },
          updatedOn: '2024-01-01T00:00:00Z',
        },
      };
      vi.spyOn(Api2, 'createStaffMember').mockResolvedValue(mockCreateResponse);

      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      await userEvent.type(screen.getByTestId('staff-name'), 'New Staff');

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      await waitFor(
        () => {
          expect(Api2.createStaffMember).toHaveBeenCalledTimes(1);
          expect(Api2.createStaffMember).toHaveBeenCalledWith(TEST_TRUSTEE_ID, {
            name: 'New Staff',
          });
          expect(mockNavigate).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}`);
        },
        { timeout: 2000 },
      );
    });

    test('should display correct aria-label for create mode', () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const form = screen.getByTestId('trustee-staff-form');
      expect(form).toHaveAttribute('aria-label', 'Create Trustee Staff');
    });

    test('should display correct aria-label for edit mode', () => {
      renderWithRouter({
        trusteeId: TEST_TRUSTEE_ID,
        trustee: MOCK_TRUSTEE_WITH_STAFF,
        staffId: VALID_STAFF_MEMBER.id,
      });

      const form = screen.getByTestId('trustee-staff-form');
      expect(form).toHaveAttribute('aria-label', 'Edit Trustee Staff');
    });
  });

  describe('Individual Contact Info Saving', () => {
    async function submitFormAndGetStaffMember(
      fillForm: (container: HTMLElement) => Promise<void>,
    ): Promise<TrusteeStaffInput> {
      const mockCreateResponse = {
        data: {
          id: 'new-staff-id',
          trusteeId: TEST_TRUSTEE_ID,
          name: 'Test Staff',
          updatedBy: { id: 'user-123', name: 'Test User' },
          updatedOn: '2024-01-01T00:00:00Z',
        },
      };
      vi.spyOn(Api2, 'createStaffMember').mockResolvedValue(mockCreateResponse);

      const { container } = renderCreateMode();
      await fillForm(container);

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      let staffMember: TrusteeStaffInput | undefined;
      await waitFor(
        () => {
          expect(Api2.createStaffMember).toHaveBeenCalledTimes(1);
          const callArgs = vi.mocked(Api2.createStaffMember).mock.calls[0];
          expect(callArgs[0]).toBe(TEST_TRUSTEE_ID);
          expect(callArgs[1]).toBeDefined();
          staffMember = callArgs[1];
        },
        { timeout: 2000 },
      );
      return staffMember!;
    }

    test('should save email independently without address or phone', async () => {
      const staffMember = await submitFormAndGetStaffMember(async () => {
        await userEvent.type(screen.getByTestId('staff-name'), 'Test Staff');
        await userEvent.type(screen.getByTestId('staff-email'), 'test@example.com');
      });

      expect(staffMember.name).toBe('Test Staff');
      expect(staffMember.contact).toBeDefined();
      expect(staffMember.contact!.email).toBe('test@example.com');
      expect(staffMember.contact!.address).toBeUndefined();
      expect(staffMember.contact!.phones).toBeUndefined();
    });

    test('should save phone independently without address or email', async () => {
      const staffMember = await submitFormAndGetStaffMember(async () => {
        await userEvent.type(screen.getByTestId('staff-name'), 'Test Staff');
        await userEvent.type(screen.getByTestId('staff-phone'), '(555)555-5555');
        await userEvent.type(screen.getByTestId('staff-extension'), '123');
      });

      expect(staffMember.name).toBe('Test Staff');
      expect(staffMember.contact).toBeDefined();
      expect(staffMember.contact!.phones).toBeDefined();
      const directPhone = staffMember.contact!.phones!.find((p) => p.type === 'direct');
      expect(directPhone?.number).toBe('555-555-5555');
      expect(directPhone?.extension).toBe('123');
      expect(staffMember.contact!.address).toBeUndefined();
      expect(staffMember.contact!.email).toBeUndefined();
    });

    test('should save address independently without phone or email', async () => {
      const staffMember = await submitFormAndGetStaffMember(async (container) => {
        await userEvent.type(screen.getByTestId('staff-name'), 'Test Staff');
        await userEvent.type(screen.getByTestId('staff-address1'), '123 Test St');
        await userEvent.type(screen.getByTestId('staff-city'), 'TestCity');
        await userEvent.type(screen.getByTestId('staff-zip'), '12345');

        const stateCombobox = container.querySelector('#staff-state [role="combobox"]');
        if (stateCombobox) {
          await userEvent.click(stateCombobox);
          const nyOption = await screen.findByText(/NY.*New York/i, {}, { timeout: 1000 });
          await userEvent.click(nyOption);
        }
      });

      expect(staffMember.name).toBe('Test Staff');
      expect(staffMember.contact).toBeDefined();
      expect(staffMember.contact!.address).toBeDefined();
      expect(staffMember.contact!.address!.address1).toBe('123 Test St');
      expect(staffMember.contact!.address!.city).toBe('TestCity');
      expect(staffMember.contact!.address!.state).toBe('NY');
      expect(staffMember.contact!.address!.zipCode).toBe('12345');
      expect(staffMember.contact!.phones).toBeUndefined();
      expect(staffMember.contact!.email).toBeUndefined();
    });
  });

  describe('Cancel Functionality', () => {
    test('should navigate back to trustee detail when cancel is clicked', async () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await userEvent.click(cancelButton);

      expect(mockNavigate).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}`);
    });

    test('should not submit form data when cancel is clicked', async () => {
      const createSpy = vi.spyOn(Api2, 'createStaffMember');
      const updateSpy = vi.spyOn(Api2, 'updateStaffMember');

      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      // Fill in some data
      await userEvent.type(screen.getByTestId('staff-name'), 'Test Staff');

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await userEvent.click(cancelButton);

      expect(createSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Delete Functionality', () => {
    test('should show Delete button in edit mode', () => {
      renderEditMode();

      expect(screen.getByTestId('open-modal-button_delete-staff-button')).toBeInTheDocument();
    });

    test('should not show Delete button in create mode', () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      expect(screen.queryByTestId('open-modal-button_delete-staff-button')).not.toBeInTheDocument();
    });

    test('should delete the staff member and navigate away on success', async () => {
      const { trustee, staffMember } = renderEditMode();
      const deleteSpy = vi.spyOn(Api2, 'deleteStaffMember').mockResolvedValue(undefined);

      await getDeleteOnClick()();

      expect(deleteSpy).toHaveBeenCalledWith(trustee.trusteeId, staffMember.id);
      expect(mockNavigate).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}`);
    });

    test('should show an alert and rethrow when delete fails', async () => {
      const alertHooks = TestingUtilities.spyOnGlobalAlert();
      renderEditMode();
      vi.spyOn(Api2, 'deleteStaffMember').mockRejectedValue(new Error('network error'));

      await expect(getDeleteOnClick()()).rejects.toThrow('Delete failed');

      expect(alertHooks.error).toHaveBeenCalledWith(
        'There was a problem removing the trustee staff member.',
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('validateField Helper Function', () => {
    test('should return undefined for valid field value', () => {
      const result = validateField('name', 'Valid Name');
      expect(result).toBeUndefined();
    });

    test('should return error reasons for invalid field value', () => {
      const result = validateField('name', 'A'.repeat(51));
      expect(result).toBeDefined();
      expect(result).toEqual(['Max length 50 characters']);
    });

    test('should return error for name field with undefined value', () => {
      const result = validateField('name', undefined);
      expect(result).toBeDefined();
      expect(result).toEqual(['Trustee name is required']);
    });

    test('should return error for name field with whitespace-only value', () => {
      const result = validateField('name', '   ');
      expect(result).toBeDefined();
      expect(result).toEqual(['Trustee name is required']);
    });

    test('should return undefined for optional fields with undefined value', () => {
      expect(validateField('title', undefined)).toBeUndefined();
      expect(validateField('email', undefined)).toBeUndefined();
      expect(validateField('address1', undefined)).toBeUndefined();
    });
  });
});
