import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import TrusteeAssistantForm, { validateField } from './TrusteeAssistantForm';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import MockData from '@common/cams/test-utilities/mock-data';
import { TrusteeAssistant, TrusteeAssistantInput } from '@common/cams/trustee-assistants';
import useFeatureFlags, { TRUSTEE_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import { Trustee } from '@common/cams/trustees';

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

const mockUseFeatureFlags = vi.mocked(useFeatureFlags);

const TEST_TRUSTEE_ID = 'trustee-123';

const VALID_ASSISTANT: TrusteeAssistant = MockData.getTrusteeAssistant({
  id: 'valid-assistant-123',
  trusteeId: TEST_TRUSTEE_ID,
  name: 'Jane Assistant',
  title: 'Senior Assistant',
  contact: {
    address: {
      address1: '123 Main St',
      address2: 'Suite 100',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      countryCode: 'US',
    },
    phone: {
      number: '(123)456-7890',
      extension: '123',
    },
    email: 'jane@example.com',
  },
});

const MOCK_TRUSTEE_WITH_ASSISTANT = MockData.getTrustee({
  trusteeId: TEST_TRUSTEE_ID,
  assistants: [VALID_ASSISTANT],
});

describe('TrusteeAssistantForm', () => {
  const mockNavigate = vi.fn();
  let userEvent: ReturnType<typeof TestingUtilities.setupUserEvent>;

  function renderWithRouter(props: {
    trusteeId: string;
    trustee?: Trustee;
    assistantId?: string; // For mocking useParams
  }) {
    // Mock useParams to return the assistantId if provided (edit mode) or undefined (create mode)
    mockUseParams.mockReturnValue({ assistantId: props.assistantId });

    return render(
      <BrowserRouter>
        <TrusteeAssistantForm trusteeId={props.trusteeId} trustee={props.trustee} />
      </BrowserRouter>,
    );
  }

  // Helper for create mode tests
  function renderCreateMode() {
    return renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });
  }

  // Helper for edit mode tests with a specific assistant
  function renderEditMode(assistantData?: Partial<TrusteeAssistant>) {
    const assistant = MockData.getTrusteeAssistant({
      id: 'assistant-456',
      trusteeId: TEST_TRUSTEE_ID,
      ...assistantData,
    });

    const trustee = MockData.getTrustee({
      trusteeId: TEST_TRUSTEE_ID,
      assistants: [assistant],
    });

    return {
      ...renderWithRouter({
        trusteeId: TEST_TRUSTEE_ID,
        trustee,
        assistantId: assistant.id,
      }),
      assistant,
      trustee,
    };
  }

  beforeEach(() => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Missing Assistant', () => {
    test('should show error when assistant not found in trustee data', () => {
      // Mock route with assistantId but trustee has no assistants
      const trusteeWithoutAssistants = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        assistants: [],
      });

      renderWithRouter({
        trusteeId: TEST_TRUSTEE_ID,
        trustee: trusteeWithoutAssistants,
        assistantId: 'non-existent-id',
      });

      expect(screen.getByTestId('alert-container-assistant-not-found-alert')).toBeInTheDocument();
      expect(screen.getByText('Assistant not found.')).toBeInTheDocument();
      expect(screen.queryByTestId('trustee-assistant-form')).not.toBeInTheDocument();
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

      expect(screen.getByTestId('trustee-assistant-form')).toBeInTheDocument();
      expect(screen.getByRole('form', { name: 'Create Trustee Assistant' })).toBeInTheDocument();
    });
  });

  describe('Form Rendering and Initial State', () => {
    test('should render all form fields', () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      expect(screen.getByTestId('assistant-name')).toBeInTheDocument();
      expect(screen.getByTestId('assistant-title')).toBeInTheDocument();
      expect(screen.getByTestId('assistant-address1')).toBeInTheDocument();
      expect(screen.getByTestId('assistant-address2')).toBeInTheDocument();
      expect(screen.getByTestId('assistant-city')).toBeInTheDocument();
      expect(document.querySelector('#assistant-state')).toBeInTheDocument();
      expect(screen.getByTestId('assistant-zip')).toBeInTheDocument();
      expect(screen.getByTestId('assistant-phone')).toBeInTheDocument();
      expect(screen.getByTestId('assistant-extension')).toBeInTheDocument();
      expect(screen.getByTestId('assistant-email')).toBeInTheDocument();
    });

    test('should render Save and Cancel buttons', () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    test('should populate form fields when assistant data is provided', () => {
      renderWithRouter({
        trusteeId: TEST_TRUSTEE_ID,
        trustee: MOCK_TRUSTEE_WITH_ASSISTANT,
        assistantId: VALID_ASSISTANT.id,
      });

      expect(screen.getByDisplayValue('Jane Assistant')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Senior Assistant')).toBeInTheDocument();
      expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Suite 100')).toBeInTheDocument();
      expect(screen.getByDisplayValue('New York')).toBeInTheDocument();
      expect(screen.getByDisplayValue('(123)456-7890')).toBeInTheDocument();
      expect(screen.getByDisplayValue('123')).toBeInTheDocument();
      expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument();
    });

    test('should render empty form when no assistant data is provided', () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const nameInput = screen.getByTestId('assistant-name') as HTMLInputElement;
      const emailInput = screen.getByTestId('assistant-email') as HTMLInputElement;

      expect(nameInput.value).toBe('');
      expect(emailInput.value).toBe('');
    });

    test('should render form when assistant contact property is undefined', () => {
      const assistantWithoutContact = MockData.getTrusteeAssistant({
        id: 'assistant-456',
        trusteeId: TEST_TRUSTEE_ID,
        name: 'John Assistant',
        title: 'Lead Assistant',
        contact: undefined,
      });

      const trusteeWithAssistant = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        assistants: [assistantWithoutContact],
      });

      renderWithRouter({
        trusteeId: TEST_TRUSTEE_ID,
        trustee: trusteeWithAssistant,
        assistantId: assistantWithoutContact.id,
      });

      expect(screen.getByTestId('trustee-assistant-form')).toBeInTheDocument();
      expect(screen.getByRole('form', { name: 'Edit Trustee Assistant' })).toBeInTheDocument();

      const nameInput = screen.getByTestId('assistant-name') as HTMLInputElement;
      const titleInput = screen.getByTestId('assistant-title') as HTMLInputElement;
      const emailInput = screen.getByTestId('assistant-email') as HTMLInputElement;
      const phoneInput = screen.getByTestId('assistant-phone') as HTMLInputElement;
      const address1Input = screen.getByTestId('assistant-address1') as HTMLInputElement;

      expect(nameInput.value).toBe('John Assistant');
      expect(titleInput.value).toBe('Lead Assistant');
      expect(emailInput.value).toBe('');
      expect(phoneInput.value).toBe('');
      expect(address1Input.value).toBe('');
    });
  });

  describe('Form Field Validation', () => {
    test('should validate name max length', async () => {
      const expectedErrorMessage = 'Max length 50 characters';
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const nameInput = screen.getByTestId('assistant-name');
      const longName = 'A'.repeat(51);
      await userEvent.type(nameInput, longName);

      await waitFor(
        () => {
          const errorDiv = document.getElementById('assistant-name-input__error-message');
          expect(errorDiv).toBeInTheDocument();
          expect(errorDiv?.textContent).toBe(expectedErrorMessage);
        },
        { timeout: 1000 },
      );
    });

    test('should validate title max length', async () => {
      const expectedErrorMessage = 'Max length 50 characters';
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const titleInput = screen.getByTestId('assistant-title');
      const longTitle = 'A'.repeat(51);
      await userEvent.type(titleInput, longTitle);

      await waitFor(
        () => {
          const errorDiv = document.getElementById('assistant-title-input__error-message');
          expect(errorDiv).toBeInTheDocument();
          expect(errorDiv?.textContent).toBe(expectedErrorMessage);
        },
        { timeout: 1000 },
      );
    });

    test('should validate email format', async () => {
      const expectedErrorMessage = 'Must be a valid email address';
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const emailInput = screen.getByTestId('assistant-email');
      await userEvent.type(emailInput, 'invalid-email');

      await waitFor(
        () => {
          const errorDiv = document.getElementById('assistant-email-input__error-message');
          expect(errorDiv).toBeInTheDocument();
          expect(errorDiv?.textContent).toBe(expectedErrorMessage);
        },
        { timeout: 1000 },
      );
    });

    test('should validate phone number format', async () => {
      const expectedErrorMessage = 'Must be a valid phone number';
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const phoneInput = screen.getByTestId('assistant-phone');
      await userEvent.type(phoneInput, '123');

      await waitFor(
        () => {
          const errorDiv = document.getElementById('assistant-phone-input__error-message');
          expect(errorDiv).toBeInTheDocument();
          expect(errorDiv?.textContent).toBe(expectedErrorMessage);
        },
        { timeout: 1000 },
      );
    });

    test('should validate extension format', async () => {
      const expectedErrorMessage = 'Must be 1 to 6 digits';
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const extensionInput = screen.getByTestId('assistant-extension');
      await userEvent.type(extensionInput, '1234567');

      await waitFor(
        () => {
          const errorDiv = document.getElementById('assistant-extension-input__error-message');
          expect(errorDiv).toBeInTheDocument();
          expect(errorDiv?.textContent).toBe(expectedErrorMessage);
        },
        { timeout: 1000 },
      );
    });

    test('should validate zip code format', async () => {
      const expectedErrorMessage = 'Must be 5 or 9 digits';
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const zipInput = screen.getByTestId('assistant-zip');
      await userEvent.type(zipInput, '123');

      await waitFor(
        () => {
          const errorDiv = document.getElementById('assistant-zip-input__error-message');
          expect(errorDiv).toBeInTheDocument();
          expect(errorDiv?.textContent).toBe(expectedErrorMessage);
        },
        { timeout: 1000 },
      );
    });

    test('should display the correct error message for address information', async () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const address2Input = screen.getByTestId('assistant-address2');
      await userEvent.type(address2Input, '101');

      const saveButton = screen.getByTestId('button-submit-button');
      await saveButton.click();

      const address1ErrorMessage = document.getElementById(
        'assistant-address1-input__error-message',
      );
      expect(address1ErrorMessage).toBeInTheDocument();
      expect(address1ErrorMessage?.textContent).toEqual('Address is required');

      const cityErrorMessage = document.getElementById('assistant-city-input__error-message');
      expect(cityErrorMessage).toBeInTheDocument();
      expect(cityErrorMessage?.textContent).toEqual('City is required');

      const stateErrorMessage = document.getElementById('assistant-state-input__error-message');
      expect(stateErrorMessage).toBeInTheDocument();
      expect(stateErrorMessage?.textContent).toEqual('State is required');

      const zipErrorMessage = document.getElementById('assistant-zip-input__error-message');
      expect(zipErrorMessage).toBeInTheDocument();
      expect(zipErrorMessage?.textContent).toEqual('ZIP Code is required');
    });

    test('should hide alert after fixing validation errors and show new field-level errors', async () => {
      const { container } = renderWithRouter({
        trusteeId: TEST_TRUSTEE_ID,
      });

      // Fill in name and partial address (missing address1)
      await userEvent.type(screen.getByTestId('assistant-name'), 'Test Assistant');
      await userEvent.type(screen.getByTestId('assistant-city'), 'TestCity');
      await userEvent.type(screen.getByTestId('assistant-zip'), '12345');

      const stateCombobox = container.querySelector('#assistant-state [role="combobox"]');
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
          const alertMessage = screen.queryByTestId('alert-message-assistant-form-error-alert');
          expect(alertMessage).toBeInTheDocument();
          expect(alertMessage).toBeVisible();
        },
        { timeout: 1000 },
      );

      // Fix address1
      await userEvent.type(screen.getByTestId('assistant-address1'), '123 Main St');

      // Add phone extension without phone number (will cause new error)
      await userEvent.type(screen.getByTestId('assistant-extension'), '123');

      // Submit again
      saveButton.click();

      await waitFor(
        () => {
          const alertContainer = screen.getByTestId('alert-container-assistant-form-error-alert');
          expect(alertContainer).not.toHaveClass('visible');
        },
        { timeout: 1000 },
      );

      // Verify phone error message is displayed
      await waitFor(
        () => {
          const phoneErrorMessage = document.getElementById('assistant-phone-input__error-message');
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
      const { assistant } = renderEditMode({ name: 'Existing Assistant' });

      const updateSpy = vi
        .spyOn(Api2, 'updateTrusteeAssistant')
        .mockResolvedValue({ data: assistant });

      expect(screen.getByTestId('assistant-name')).toHaveValue('Existing Assistant');

      await userEvent.clear(screen.getByTestId('assistant-name'));
      await userEvent.type(screen.getByTestId('assistant-name'), 'Test Assistant');

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
      const { assistant } = renderEditMode();

      vi.spyOn(Api2, 'updateTrusteeAssistant').mockImplementation(() => new Promise(() => {}));

      expect(screen.getByTestId('assistant-name')).toHaveValue(assistant.name);

      await userEvent.clear(screen.getByTestId('assistant-name'));
      await userEvent.type(screen.getByTestId('assistant-name'), 'Test Assistant');

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
      const { assistant } = renderEditMode();

      const errorMessage = 'Failed to update';
      const updateSpy = vi
        .spyOn(Api2, 'updateTrusteeAssistant')
        .mockRejectedValue(new Error(errorMessage));

      expect(screen.getByTestId('assistant-name')).toHaveValue(assistant.name);

      await userEvent.clear(screen.getByTestId('assistant-name'));
      await userEvent.type(screen.getByTestId('assistant-name'), 'Test Assistant');

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      await waitFor(
        () => {
          expect(updateSpy).toHaveBeenCalled();
          expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    test('should not submit form when required fields are empty', async () => {
      const { assistant } = renderEditMode();

      const updateSpy = vi.spyOn(Api2, 'updateTrusteeAssistant');

      expect(screen.getByTestId('assistant-name')).toHaveValue(assistant.name);

      await userEvent.clear(screen.getByTestId('assistant-name'));

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
      const { assistant, container } = renderEditMode();

      const updateSpy = vi
        .spyOn(Api2, 'updateTrusteeAssistant')
        .mockResolvedValue({ data: assistant });

      expect(screen.getByTestId('assistant-name')).toHaveValue(assistant.name);

      // Clear and fill in all fields including complete address
      await userEvent.clear(screen.getByTestId('assistant-name'));
      await userEvent.type(screen.getByTestId('assistant-name'), 'Test Assistant');
      await userEvent.clear(screen.getByTestId('assistant-title'));
      await userEvent.type(screen.getByTestId('assistant-title'), 'Lead Assistant');
      await userEvent.clear(screen.getByTestId('assistant-address1'));
      await userEvent.type(screen.getByTestId('assistant-address1'), '456 Test St');
      await userEvent.clear(screen.getByTestId('assistant-address2'));
      await userEvent.type(screen.getByTestId('assistant-address2'), 'Suite 200');
      await userEvent.clear(screen.getByTestId('assistant-city'));
      await userEvent.type(screen.getByTestId('assistant-city'), 'TestCity');
      await userEvent.clear(screen.getByTestId('assistant-zip'));
      await userEvent.type(screen.getByTestId('assistant-zip'), '12345');
      await userEvent.clear(screen.getByTestId('assistant-phone'));
      await userEvent.type(screen.getByTestId('assistant-phone'), '(555)555-5555');
      await userEvent.clear(screen.getByTestId('assistant-extension'));
      await userEvent.type(screen.getByTestId('assistant-extension'), '999');
      await userEvent.clear(screen.getByTestId('assistant-email'));
      await userEvent.type(screen.getByTestId('assistant-email'), 'test@example.com');

      // State might already be selected, but ensure NY is set
      const stateCombobox = container.querySelector('#assistant-state [role="combobox"]');
      if (stateCombobox) {
        await userEvent.click(stateCombobox);
        const nyOptions = await screen.findAllByText(/NY.*New York/i, {}, { timeout: 1000 });
        // Click the last option (the one in the dropdown, not the screen reader text)
        await userEvent.click(nyOptions[nyOptions.length - 1]);
      }

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      await waitFor(
        () => {
          expect(updateSpy).toHaveBeenCalledTimes(1);
          const callArgs = updateSpy.mock.calls[0];
          expect(callArgs[0]).toBe(TEST_TRUSTEE_ID);
          expect(callArgs[1]).toBe(assistant.id);

          expect(callArgs[2]).toBeDefined();

          const { name, title, contact } = callArgs[2]!;
          expect(name).toBe('Test Assistant');
          expect(title).toBe('Lead Assistant');

          expect(contact).toBeDefined();

          const { address, phone, email } = contact!;
          expect(address).toBeDefined();
          expect(phone).toBeDefined();

          const { address1, address2, city, state, zipCode } = address!;
          expect(address1).toBe('456 Test St');
          expect(address2).toBe('Suite 200');
          expect(city).toBe('TestCity');
          expect(state).toBe('NY');
          expect(zipCode).toBe('12345');

          const { extension } = phone!;
          expect(extension).toBe('999');

          expect(email).toBe('test@example.com');
        },
        { timeout: 2000 },
      );
    });

    test('should successfully submit form in create mode', async () => {
      const mockCreateResponse = {
        data: {
          id: 'new-assistant-id',
          trusteeId: TEST_TRUSTEE_ID,
          name: 'New Assistant',
          updatedBy: { id: 'user-123', name: 'Test User' },
          updatedOn: '2024-01-01T00:00:00Z',
        },
      };
      vi.spyOn(Api2, 'createTrusteeAssistant').mockResolvedValue(mockCreateResponse);

      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      await userEvent.type(screen.getByTestId('assistant-name'), 'New Assistant');

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      await waitFor(
        () => {
          expect(Api2.createTrusteeAssistant).toHaveBeenCalledTimes(1);
          expect(Api2.createTrusteeAssistant).toHaveBeenCalledWith(TEST_TRUSTEE_ID, {
            name: 'New Assistant',
          });
          expect(mockNavigate).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}`);
        },
        { timeout: 2000 },
      );
    });

    test('should display correct aria-label for create mode', () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const form = screen.getByTestId('trustee-assistant-form');
      expect(form).toHaveAttribute('aria-label', 'Create Trustee Assistant');
    });

    test('should display correct aria-label for edit mode', () => {
      renderWithRouter({
        trusteeId: TEST_TRUSTEE_ID,
        trustee: MOCK_TRUSTEE_WITH_ASSISTANT,
        assistantId: VALID_ASSISTANT.id,
      });

      const form = screen.getByTestId('trustee-assistant-form');
      expect(form).toHaveAttribute('aria-label', 'Edit Trustee Assistant');
    });
  });

  describe('Individual Contact Info Saving', () => {
    async function submitFormAndGetAssistant(
      fillForm: (container: HTMLElement) => Promise<void>,
    ): Promise<TrusteeAssistantInput> {
      const mockCreateResponse = {
        data: {
          id: 'new-assistant-id',
          trusteeId: TEST_TRUSTEE_ID,
          name: 'Test Assistant',
          updatedBy: { id: 'user-123', name: 'Test User' },
          updatedOn: '2024-01-01T00:00:00Z',
        },
      };
      vi.spyOn(Api2, 'createTrusteeAssistant').mockResolvedValue(mockCreateResponse);

      const { container } = renderCreateMode();
      await fillForm(container);

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      let assistant: TrusteeAssistantInput | undefined;
      await waitFor(
        () => {
          expect(Api2.createTrusteeAssistant).toHaveBeenCalledTimes(1);
          const callArgs = vi.mocked(Api2.createTrusteeAssistant).mock.calls[0];
          expect(callArgs[0]).toBe(TEST_TRUSTEE_ID);
          expect(callArgs[1]).toBeDefined();
          assistant = callArgs[1];
        },
        { timeout: 2000 },
      );
      return assistant!;
    }

    test('should save email independently without address or phone', async () => {
      const assistant = await submitFormAndGetAssistant(async () => {
        await userEvent.type(screen.getByTestId('assistant-name'), 'Test Assistant');
        await userEvent.type(screen.getByTestId('assistant-email'), 'test@example.com');
      });

      expect(assistant.name).toBe('Test Assistant');
      expect(assistant.contact).toBeDefined();
      expect(assistant.contact!.email).toBe('test@example.com');
      expect(assistant.contact!.address).toBeUndefined();
      expect(assistant.contact!.phone).toBeUndefined();
    });

    test('should save phone independently without address or email', async () => {
      const assistant = await submitFormAndGetAssistant(async () => {
        await userEvent.type(screen.getByTestId('assistant-name'), 'Test Assistant');
        await userEvent.type(screen.getByTestId('assistant-phone'), '(555)555-5555');
        await userEvent.type(screen.getByTestId('assistant-extension'), '123');
      });

      expect(assistant.name).toBe('Test Assistant');
      expect(assistant.contact).toBeDefined();
      expect(assistant.contact!.phone).toBeDefined();
      expect(assistant.contact!.phone!.number).toBe('555-555-5555');
      expect(assistant.contact!.phone!.extension).toBe('123');
      expect(assistant.contact!.address).toBeUndefined();
      expect(assistant.contact!.email).toBeUndefined();
    });

    test('should save address independently without phone or email', async () => {
      const assistant = await submitFormAndGetAssistant(async (container) => {
        await userEvent.type(screen.getByTestId('assistant-name'), 'Test Assistant');
        await userEvent.type(screen.getByTestId('assistant-address1'), '123 Test St');
        await userEvent.type(screen.getByTestId('assistant-city'), 'TestCity');
        await userEvent.type(screen.getByTestId('assistant-zip'), '12345');

        const stateCombobox = container.querySelector('#assistant-state [role="combobox"]');
        if (stateCombobox) {
          await userEvent.click(stateCombobox);
          const nyOption = await screen.findByText(/NY.*New York/i, {}, { timeout: 1000 });
          await userEvent.click(nyOption);
        }
      });

      expect(assistant.name).toBe('Test Assistant');
      expect(assistant.contact).toBeDefined();
      expect(assistant.contact!.address).toBeDefined();
      expect(assistant.contact!.address!.address1).toBe('123 Test St');
      expect(assistant.contact!.address!.city).toBe('TestCity');
      expect(assistant.contact!.address!.state).toBe('NY');
      expect(assistant.contact!.address!.zipCode).toBe('12345');
      expect(assistant.contact!.phone).toBeUndefined();
      expect(assistant.contact!.email).toBeUndefined();
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
      const createSpy = vi.spyOn(Api2, 'createTrusteeAssistant');
      const updateSpy = vi.spyOn(Api2, 'updateTrusteeAssistant');

      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      // Fill in some data
      await userEvent.type(screen.getByTestId('assistant-name'), 'Test Assistant');

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await userEvent.click(cancelButton);

      expect(createSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Delete Functionality', () => {
    test('should show Delete button in edit mode', () => {
      renderEditMode();

      expect(screen.getByTestId('open-modal-button_delete-assistant-button')).toBeInTheDocument();
    });

    test('should not show Delete button in create mode', () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      expect(
        screen.queryByTestId('open-modal-button_delete-assistant-button'),
      ).not.toBeInTheDocument();
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
      expect(validateField('phone', undefined)).toBeUndefined();
      expect(validateField('address1', undefined)).toBeUndefined();
    });
  });
});
