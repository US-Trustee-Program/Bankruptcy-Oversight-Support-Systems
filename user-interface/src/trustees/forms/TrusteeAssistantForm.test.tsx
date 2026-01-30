import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import TrusteeAssistantForm, { validateField } from './TrusteeAssistantForm';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import MockData from '@common/cams/test-utilities/mock-data';
import { TrusteeAssistant } from '@common/cams/trustees';
import useFeatureFlags, { TRUSTEE_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';

const mockUseNavigate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/hooks/UseFeatureFlags');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: mockUseNavigate,
  };
});

const mockUseFeatureFlags = vi.mocked(useFeatureFlags);

const TEST_TRUSTEE_ID = 'trustee-123';

const VALID_ASSISTANT: TrusteeAssistant = {
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
};

describe('TrusteeAssistantForm', () => {
  const mockNavigate = vi.fn();
  let userEvent: ReturnType<typeof TestingUtilities.setupUserEvent>;

  function renderWithRouter(props: { trusteeId: string; assistant?: TrusteeAssistant }) {
    return render(
      <BrowserRouter>
        <TrusteeAssistantForm {...props} />
      </BrowserRouter>,
    );
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
      expect(screen.getByRole('form', { name: 'Edit Trustee Assistant' })).toBeInTheDocument();
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
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID, assistant: VALID_ASSISTANT });

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
  });

  describe('Form Field Validation', () => {
    test('should validate name max length', async () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const nameInput = screen.getByTestId('assistant-name');
      const longName = 'A'.repeat(51);
      await userEvent.type(nameInput, longName);

      await waitFor(
        () => {
          const errorMessage = screen.queryByText(/Max length 50 characters/i);
          expect(errorMessage).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    test('should validate title max length', async () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const titleInput = screen.getByTestId('assistant-title');
      const longTitle = 'A'.repeat(51);
      await userEvent.type(titleInput, longTitle);

      await waitFor(
        () => {
          const errorMessage = screen.queryByText(/Max length 50 characters/i);
          expect(errorMessage).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    test('should validate email format', async () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const emailInput = screen.getByTestId('assistant-email');
      await userEvent.type(emailInput, 'invalid-email');

      await waitFor(
        () => {
          const errorMessage = screen.queryByText(/Must be a valid email address/i);
          expect(errorMessage).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    test('should validate phone number format', async () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const phoneInput = screen.getByTestId('assistant-phone');
      await userEvent.type(phoneInput, '123');

      await waitFor(
        () => {
          const errorMessage = screen.queryByText(/Must be a valid phone number/i);
          expect(errorMessage).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    test('should validate extension format', async () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const extensionInput = screen.getByTestId('assistant-extension');
      await userEvent.type(extensionInput, '1234567');

      await waitFor(
        () => {
          const errorMessage = screen.queryByText(/Must be 1 to 6 digits/i);
          expect(errorMessage).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    test('should validate zip code format', async () => {
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      const zipInput = screen.getByTestId('assistant-zip');
      await userEvent.type(zipInput, '123');

      await waitFor(
        () => {
          const errorMessage = screen.queryByText(/Must be 5 or 9 digits/i);
          expect(errorMessage).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });
  });

  describe('Form Submission', () => {
    test('should successfully submit form with manually filled valid data', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId: TEST_TRUSTEE_ID });
      const mockPatchResponse = { data: mockTrustee };
      vi.spyOn(Api2, 'patchTrustee').mockResolvedValue(mockPatchResponse);

      const { container } = renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      // Fill in all required fields manually
      await userEvent.type(screen.getByTestId('assistant-name'), 'Test Assistant');
      await userEvent.type(screen.getByTestId('assistant-address1'), '456 Test St');
      await userEvent.type(screen.getByTestId('assistant-city'), 'TestCity');
      await userEvent.type(screen.getByTestId('assistant-zip'), '12345');
      await userEvent.type(screen.getByTestId('assistant-phone'), '(555)555-5555');
      await userEvent.type(screen.getByTestId('assistant-email'), 'test@example.com');

      // Select state from ComboBox
      const stateCombobox = container.querySelector('#assistant-state [role="combobox"]');
      if (stateCombobox) {
        await userEvent.click(stateCombobox);
        // Wait for options to appear and select NY
        const nyOption = await screen.findByText(/NY.*New York/i, {}, { timeout: 1000 });
        await userEvent.click(nyOption);
      }

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      await waitFor(
        () => {
          expect(Api2.patchTrustee).toHaveBeenCalledTimes(1);
          expect(mockNavigate).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}`);
        },
        { timeout: 2000 },
      );
    });

    test('should show Saving... text during submission', async () => {
      vi.spyOn(Api2, 'patchTrustee').mockImplementation(() => new Promise(() => {}));

      const { container } = renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      // Fill in required fields
      await userEvent.type(screen.getByTestId('assistant-name'), 'Test Assistant');
      await userEvent.type(screen.getByTestId('assistant-address1'), '456 Test St');
      await userEvent.type(screen.getByTestId('assistant-city'), 'TestCity');
      await userEvent.type(screen.getByTestId('assistant-zip'), '12345');
      await userEvent.type(screen.getByTestId('assistant-phone'), '(555)555-5555');
      await userEvent.type(screen.getByTestId('assistant-email'), 'test@example.com');

      const stateCombobox = container.querySelector('#assistant-state [role="combobox"]');
      if (stateCombobox) {
        await userEvent.click(stateCombobox);
        const nyOption = await screen.findByText(/NY.*New York/i, {}, { timeout: 1000 });
        await userEvent.click(nyOption);
      }

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
      const errorMessage = 'Failed to update';
      vi.spyOn(Api2, 'patchTrustee').mockRejectedValue(new Error(errorMessage));

      const { container } = renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      // Fill in required fields
      await userEvent.type(screen.getByTestId('assistant-name'), 'Test Assistant');
      await userEvent.type(screen.getByTestId('assistant-address1'), '456 Test St');
      await userEvent.type(screen.getByTestId('assistant-city'), 'TestCity');
      await userEvent.type(screen.getByTestId('assistant-zip'), '12345');
      await userEvent.type(screen.getByTestId('assistant-phone'), '(555)555-5555');
      await userEvent.type(screen.getByTestId('assistant-email'), 'test@example.com');

      const stateCombobox = container.querySelector('#assistant-state [role="combobox"]');
      if (stateCombobox) {
        await userEvent.click(stateCombobox);
        const nyOption = await screen.findByText(/NY.*New York/i, {}, { timeout: 1000 });
        await userEvent.click(nyOption);
      }

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      await waitFor(
        () => {
          expect(Api2.patchTrustee).toHaveBeenCalled();
          expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    test('should send undefined assistant when form is empty', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId: TEST_TRUSTEE_ID });
      const mockPatchResponse = { data: mockTrustee };
      vi.spyOn(Api2, 'patchTrustee').mockResolvedValue(mockPatchResponse);

      // Start with no assistant (empty form)
      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID, assistant: undefined });

      // Remove all required attributes to allow empty form submission
      const nameInput = screen.getByTestId('assistant-name') as HTMLInputElement;
      const addressInput = screen.getByTestId('assistant-address1') as HTMLInputElement;
      const cityInput = screen.getByTestId('assistant-city') as HTMLInputElement;
      const zipInput = screen.getByTestId('assistant-zip') as HTMLInputElement;
      const phoneInput = screen.getByTestId('assistant-phone') as HTMLInputElement;
      const emailInput = screen.getByTestId('assistant-email') as HTMLInputElement;

      nameInput.removeAttribute('required');
      addressInput.removeAttribute('required');
      cityInput.removeAttribute('required');
      zipInput.removeAttribute('required');
      phoneInput.removeAttribute('required');
      emailInput.removeAttribute('required');

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      await waitFor(
        () => {
          expect(Api2.patchTrustee).toHaveBeenCalledWith(TEST_TRUSTEE_ID, {
            assistant: undefined,
          });
        },
        { timeout: 2000 },
      );
    });

    test('should submit form with complete address', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId: TEST_TRUSTEE_ID });
      const mockPatchResponse = { data: mockTrustee };
      vi.spyOn(Api2, 'patchTrustee').mockResolvedValue(mockPatchResponse);

      const { container } = renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      // Fill in all fields including complete address
      await userEvent.type(screen.getByTestId('assistant-name'), 'Test Assistant');
      await userEvent.type(screen.getByTestId('assistant-title'), 'Lead Assistant');
      await userEvent.type(screen.getByTestId('assistant-address1'), '456 Test St');
      await userEvent.type(screen.getByTestId('assistant-address2'), 'Suite 200');
      await userEvent.type(screen.getByTestId('assistant-city'), 'TestCity');
      await userEvent.type(screen.getByTestId('assistant-zip'), '12345');
      await userEvent.type(screen.getByTestId('assistant-phone'), '(555)555-5555');
      await userEvent.type(screen.getByTestId('assistant-extension'), '999');
      await userEvent.type(screen.getByTestId('assistant-email'), 'test@example.com');

      const stateCombobox = container.querySelector('#assistant-state [role="combobox"]');
      if (stateCombobox) {
        await userEvent.click(stateCombobox);
        const nyOption = await screen.findByText(/NY.*New York/i, {}, { timeout: 1000 });
        await userEvent.click(nyOption);
      }

      const submitButton = screen.getByRole('button', { name: 'Save' });
      await userEvent.click(submitButton);

      await waitFor(
        () => {
          expect(Api2.patchTrustee).toHaveBeenCalledTimes(1);
          const mockPatchTrustee = vi.mocked(Api2.patchTrustee);
          const callArgs = mockPatchTrustee.mock.calls[0];
          expect(callArgs[0]).toBe(TEST_TRUSTEE_ID);
          expect(callArgs[1].assistant).toBeDefined();
          expect(callArgs[1].assistant!.name).toBe('Test Assistant');
          expect(callArgs[1].assistant!.title).toBe('Lead Assistant');
          expect(callArgs[1].assistant!.contact.address!.address1).toBe('456 Test St');
          expect(callArgs[1].assistant!.contact.address!.address2).toBe('Suite 200');
          expect(callArgs[1].assistant!.contact.address!.city).toBe('TestCity');
          expect(callArgs[1].assistant!.contact.address!.state).toBe('NY');
          expect(callArgs[1].assistant!.contact.address!.zipCode).toBe('12345');
          expect(callArgs[1].assistant!.contact.phone!.extension).toBe('999');
          expect(callArgs[1].assistant!.contact.email).toBe('test@example.com');
        },
        { timeout: 2000 },
      );
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
      const patchSpy = vi.spyOn(Api2, 'patchTrustee');

      renderWithRouter({ trusteeId: TEST_TRUSTEE_ID });

      // Fill in some data
      await userEvent.type(screen.getByTestId('assistant-name'), 'Test Assistant');

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await userEvent.click(cancelButton);

      expect(patchSpy).not.toHaveBeenCalled();
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
      expect(result).toContain('Max length 50 characters');
    });

    test('should handle undefined values', () => {
      const result = validateField('name', undefined);
      expect(result).toBeUndefined();
    });

    test('should trim whitespace before validation', () => {
      const result = validateField('name', '   ');
      expect(result).toBeUndefined();
    });
  });
});
