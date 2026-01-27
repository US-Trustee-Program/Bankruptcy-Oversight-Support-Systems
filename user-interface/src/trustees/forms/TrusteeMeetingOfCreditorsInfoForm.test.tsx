import { render, screen, waitFor } from '@testing-library/react';
import TrusteeMeetingOfCreditorsInfoForm from './TrusteeMeetingOfCreditorsInfoForm';
import Api2 from '@/lib/models/api2';
import * as UseGlobalAlertModule from '@/lib/hooks/UseGlobalAlert';
import * as useCamsNavigatorModule from '@/lib/hooks/UseCamsNavigator';
import * as useDebounceModule from '@/lib/hooks/UseDebounce';
import { Mock } from 'vitest';
import { Trustee } from '@common/cams/trustees';
import { ResponseBody } from '@common/api/response';
import MockData from '@common/cams/test-utilities/mock-data';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

describe('TrusteeMeetingOfCreditorsInfoForm', () => {
  const TEST_TRUSTEE_ID = 'trustee-123';
  const VALID_ZOOM_INFO = {
    link: 'https://zoom.us/j/1234567890',
    phone: '555-123-4567',
    meetingId: '1234567890',
    passcode: 'test123', // pragma: allowlist secret
  };

  const mockGlobalAlert = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
  };

  const mockNavigate = {
    navigateTo: vi.fn(),
    redirectTo: vi.fn(),
  };

  let mockDebounce: Mock;
  let patchTrusteeSpy: Mock<
    (trusteeId: string, trustee: unknown) => Promise<ResponseBody<Trustee>>
  >;
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
    vi.clearAllMocks();

    // Mock debounce to execute immediately
    mockDebounce = vi.fn((callback: () => void) => {
      callback();
    });

    vi.spyOn(UseGlobalAlertModule, 'useGlobalAlert').mockReturnValue(mockGlobalAlert);
    vi.spyOn(useCamsNavigatorModule, 'default').mockReturnValue(mockNavigate);
    vi.spyOn(useDebounceModule, 'default').mockReturnValue(mockDebounce);

    patchTrusteeSpy = vi.fn();
    vi.spyOn(Api2, 'patchTrustee').mockImplementation(patchTrusteeSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    test('renders the form with existing zoom info', async () => {
      const trustee = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        zoomInfo: VALID_ZOOM_INFO,
      });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      await waitFor(() => {
        expect(screen.getByTestId('trustee-zoom-info-form')).toBeInTheDocument();
      });

      expect(screen.getByTestId('trustee-zoom-link')).toHaveValue(VALID_ZOOM_INFO.link);
      expect(screen.getByTestId('trustee-zoom-phone')).toHaveValue(VALID_ZOOM_INFO.phone);
      expect(screen.getByTestId('trustee-zoom-meeting-id')).toHaveValue(VALID_ZOOM_INFO.meetingId);
      expect(screen.getByTestId('trustee-zoom-passcode')).toHaveValue(VALID_ZOOM_INFO.passcode);
    });

    test('renders the form with empty fields when no zoom info exists', async () => {
      const trustee = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        zoomInfo: undefined,
      });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      await waitFor(() => {
        expect(screen.getByTestId('trustee-zoom-info-form')).toBeInTheDocument();
      });

      expect(screen.getByTestId('trustee-zoom-link')).toHaveValue('');
      expect(screen.getByTestId('trustee-zoom-phone')).toHaveValue('');
      expect(screen.getByTestId('trustee-zoom-meeting-id')).toHaveValue('');
      expect(screen.getByTestId('trustee-zoom-passcode')).toHaveValue('');
    });

    test('renders required field indicator text', async () => {
      const trustee = MockData.getTrustee({ trusteeId: TEST_TRUSTEE_ID });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      await waitFor(() => {
        expect(screen.getByText(/red asterisk/i)).toBeInTheDocument();
      });
    });

    test('renders Save and Cancel buttons', async () => {
      const trustee = MockData.getTrustee({ trusteeId: TEST_TRUSTEE_ID });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });
  });

  describe('form field validation', () => {
    test('validates zoom link field on change', async () => {
      const trustee = MockData.getTrustee({ trusteeId: TEST_TRUSTEE_ID });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      const linkInput = screen.getByTestId('trustee-zoom-link');
      await userEvent.clear(linkInput);
      await userEvent.type(linkInput, 'invalid-link');

      await waitFor(() => {
        expect(screen.getByText(/must be a valid url/i)).toBeInTheDocument();
      });
    });

    test('validates phone field on change', async () => {
      const trustee = MockData.getTrustee({ trusteeId: TEST_TRUSTEE_ID });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      const phoneInput = screen.getByTestId('trustee-zoom-phone');
      await userEvent.clear(phoneInput);
      await userEvent.type(phoneInput, 'invalid-phone');

      await waitFor(() => {
        expect(screen.getByText(/must be a valid phone number/i)).toBeInTheDocument();
      });
    });

    test('validates meeting ID field on change', async () => {
      const trustee = MockData.getTrustee({ trusteeId: TEST_TRUSTEE_ID });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      const meetingIdInput = screen.getByTestId('trustee-zoom-meeting-id');
      await userEvent.clear(meetingIdInput);
      await userEvent.type(meetingIdInput, 'invalid');

      await waitFor(() => {
        expect(screen.getByText(/must be 9 to 11 digits/i)).toBeInTheDocument();
      });
    });

    test('clears validation errors when field becomes valid', async () => {
      const trustee = MockData.getTrustee({ trusteeId: TEST_TRUSTEE_ID });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      const linkInput = screen.getByTestId('trustee-zoom-link');

      // Enter invalid value
      await userEvent.clear(linkInput);
      await userEvent.type(linkInput, 'invalid');

      await waitFor(() => {
        expect(screen.getByText(/must be a valid url/i)).toBeInTheDocument();
      });

      // Enter valid value
      await userEvent.clear(linkInput);
      await userEvent.type(linkInput, 'https://zoom.us/j/1234567890');

      await waitFor(() => {
        expect(screen.queryByText(/must be a valid url/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('save button state', () => {
    test('Save button is disabled when form has empty fields', async () => {
      const trustee = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        zoomInfo: undefined,
      });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      await waitFor(() => {
        const saveButton = screen.getByText('Save');
        expect(saveButton).toBeDisabled();
      });
    });

    test('Save button is disabled when form has validation errors', async () => {
      const trustee = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        zoomInfo: VALID_ZOOM_INFO,
      });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      const linkInput = screen.getByTestId('trustee-zoom-link');
      await userEvent.clear(linkInput);
      await userEvent.type(linkInput, 'invalid');

      await waitFor(() => {
        const saveButton = screen.getByText('Save');
        expect(saveButton).toBeDisabled();
      });
    });

    test('Save button is enabled when all fields are valid', async () => {
      const trustee = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        zoomInfo: VALID_ZOOM_INFO,
      });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      await waitFor(() => {
        const saveButton = screen.getByText('Save');
        expect(saveButton).toBeEnabled();
      });
    });
  });

  describe('cancel functionality', () => {
    test('navigates back to trustee detail on cancel', async () => {
      const trustee = MockData.getTrustee({ trusteeId: TEST_TRUSTEE_ID });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      const cancelButton = screen.getByText('Cancel');
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockNavigate.navigateTo).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}`);
      });
    });

    test('Cancel button is disabled while submitting', async () => {
      const trustee = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        zoomInfo: VALID_ZOOM_INFO,
      });

      let resolveSubmit: (value: ResponseBody<Trustee>) => void;
      patchTrusteeSpy.mockImplementation(
        () =>
          new Promise<ResponseBody<Trustee>>((resolve) => {
            resolveSubmit = resolve;
          }),
      );

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      const saveButton = screen.getByText('Save');
      const cancelButton = screen.getByText('Cancel');

      expect(cancelButton).toBeEnabled();

      await userEvent.click(saveButton);

      // Cancel button should be disabled while submitting
      await waitFor(() => {
        expect(cancelButton).toBeDisabled();
      });

      // Resolve the promise to complete the submission
      resolveSubmit!({ data: trustee });

      // Cancel button should be enabled again after submission completes
      await waitFor(() => {
        expect(cancelButton).toBeEnabled();
      });
    });
  });

  describe('submit functionality', () => {
    test('successfully submits form and navigates to trustee detail', async () => {
      const trustee = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        zoomInfo: VALID_ZOOM_INFO,
      });

      patchTrusteeSpy.mockResolvedValue({ data: trustee });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      const saveButton = screen.getByText('Save');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(patchTrusteeSpy).toHaveBeenCalledWith(TEST_TRUSTEE_ID, {
          zoomInfo: VALID_ZOOM_INFO,
        });
        expect(mockNavigate.navigateTo).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}`);
      });
    });

    test('displays error message when trustee ID is missing', async () => {
      const trustee = MockData.getTrustee({
        trusteeId: '',
        zoomInfo: VALID_ZOOM_INFO,
      });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      const saveButton = screen.getByText('Save');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockGlobalAlert.error).toHaveBeenCalledWith(
          'Cannot save zoom information: Trustee ID is missing',
        );
        expect(patchTrusteeSpy).not.toHaveBeenCalled();
      });
    });

    test('displays validation errors on submit when form is invalid', async () => {
      const trustee = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        zoomInfo: undefined,
      });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      // Fill in only some fields
      const linkInput = screen.getByTestId('trustee-zoom-link');
      await userEvent.type(linkInput, 'https://zoom.us/j/1234567890');

      const saveButton = screen.getByText('Save');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(patchTrusteeSpy).not.toHaveBeenCalled();
        expect(mockNavigate.navigateTo).not.toHaveBeenCalled();
      });
    });

    test('handles API error gracefully', async () => {
      const trustee = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        zoomInfo: VALID_ZOOM_INFO,
      });

      const errorMessage = 'Failed to update trustee';
      patchTrusteeSpy.mockRejectedValue(new Error(errorMessage));

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      const saveButton = screen.getByText('Save');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockGlobalAlert.error).toHaveBeenCalledWith(
          `Failed to update zoom information: ${errorMessage}`,
        );
        expect(mockNavigate.navigateTo).not.toHaveBeenCalled();
      });
    });

    test('disables Save button while submitting', async () => {
      const trustee = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        zoomInfo: VALID_ZOOM_INFO,
      });

      patchTrusteeSpy.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: trustee }), 1000)),
      );

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      const saveButton = screen.getByText('Save');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });
    });

    test('does not navigate when API response has no data', async () => {
      const trustee = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        zoomInfo: VALID_ZOOM_INFO,
      });

      patchTrusteeSpy.mockResolvedValue({ data: undefined } as unknown as ResponseBody<Trustee>);

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      const saveButton = screen.getByText('Save');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(patchTrusteeSpy).toHaveBeenCalled();
        expect(mockNavigate.navigateTo).not.toHaveBeenCalled();
      });
    });
  });

  describe('form updates', () => {
    test('updates all fields correctly', async () => {
      const trustee = MockData.getTrustee({
        trusteeId: TEST_TRUSTEE_ID,
        zoomInfo: undefined,
      });

      patchTrusteeSpy.mockResolvedValue({ data: trustee });

      render(<TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />);

      // Fill in all fields
      const linkInput = screen.getByTestId('trustee-zoom-link');
      const phoneInput = screen.getByTestId('trustee-zoom-phone');
      const meetingIdInput = screen.getByTestId('trustee-zoom-meeting-id');
      const passcodeInput = screen.getByTestId('trustee-zoom-passcode');

      await userEvent.type(linkInput, VALID_ZOOM_INFO.link);
      await userEvent.type(phoneInput, VALID_ZOOM_INFO.phone);
      await userEvent.type(meetingIdInput, VALID_ZOOM_INFO.meetingId);
      await userEvent.type(passcodeInput, VALID_ZOOM_INFO.passcode);

      const saveButton = screen.getByTestId('button-button-trustee-zoom-info-form-submit');
      await waitFor(
        () => {
          expect(saveButton).toBeEnabled();
        },
        { timeout: 2000 },
      );

      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(patchTrusteeSpy).toHaveBeenCalledWith(TEST_TRUSTEE_ID, {
          zoomInfo: VALID_ZOOM_INFO,
        });
      });
    });
  });
});
