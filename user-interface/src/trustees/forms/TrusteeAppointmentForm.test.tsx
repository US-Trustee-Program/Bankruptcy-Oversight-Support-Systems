import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrusteeAppointmentForm, { TrusteeAppointmentFormProps } from './TrusteeAppointmentForm';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { FeatureFlagSet } from '@common/feature-flags';
import Api2 from '@/lib/models/api2';
import MockData from '@common/cams/test-utilities/mock-data';
import * as useCamsNavigatorModule from '@/lib/hooks/UseCamsNavigator';

const TEST_TRUSTEE_ID = 'test-trustee-123';
const TEST_TRUSTEE_NAME = 'Test Trustee';
const TEST_EFFECTIVE_DATE = '2024-01-15';
const TEST_APPOINTED_DATE = '2024-01-01';

function renderWithProps(
  props: TrusteeAppointmentFormProps = {
    trusteeId: TEST_TRUSTEE_ID,
    trusteeName: TEST_TRUSTEE_NAME,
  },
) {
  return render(
    <MemoryRouter>
      <TrusteeAppointmentForm {...props} />
    </MemoryRouter>,
  );
}

describe('TrusteeAppointmentForm Tests', () => {
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
    vi.spyOn(useCamsNavigatorModule, 'default').mockReturnValue(navigatorMock);

    // Mock getCourts API call
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({
      data: MockData.getCourts(),
    });
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
      disabledMessage = screen.getByTestId('trustee-appointment-create-disabled');
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
    expect(forbiddenAlert).toHaveTextContent(
      'You do not have permission to manage Trustee Appointments',
    );
  });

  test('should show loading spinner while districts are loading', () => {
    renderWithProps();

    const spinner = screen.getByText('Loading districts...');
    expect(spinner).toBeInTheDocument();
  });

  test('should load districts and display form', async () => {
    renderWithProps();

    await waitFor(() => {
      expect(document.querySelector('#district')).toBeInTheDocument();
    });

    expect(document.querySelector('#district')).toBeInTheDocument();
    expect(document.querySelector('#chapter')).toBeInTheDocument();
    expect(document.querySelector('#status')).toBeInTheDocument();
    expect(screen.getByLabelText(/status date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/appointment date/i)).toBeInTheDocument();
  });

  test('should display trustee name in form header', async () => {
    const trusteeName = 'John Doe';
    renderWithProps({ trusteeId: 'test-123', trusteeName });

    await waitFor(() => {
      expect(screen.getByText(trusteeName)).toBeInTheDocument();
    });

    expect(screen.getByText('Add Trustee Appointments')).toBeInTheDocument();
  });

  test('should have submit button disabled when form is incomplete', async () => {
    renderWithProps();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /save/i });
    expect(submitButton).toBeDisabled();
  });

  test('should enable submit button when all required fields are filled', async () => {
    renderWithProps();

    await waitFor(() => {
      expect(document.querySelector('#district')).toBeInTheDocument();
    });

    const effectiveDateInput = screen.getByLabelText(/status date/i) as HTMLInputElement;
    const appointedDateInput = screen.getByLabelText(/appointment date/i) as HTMLInputElement;

    // Fill all required fields
    // Open district combo and click first item
    await userEvent.click(document.querySelector('#district-expand')!);
    await waitFor(() => expect(screen.getByTestId('district-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('district-option-item-0'));
    await waitFor(() =>
      expect(document.querySelector('#district .selection-label')).toHaveTextContent(
        'District of Alaska - Juneau',
      ),
    );

    // Open chapter combo and click first item
    await userEvent.click(document.querySelector('#chapter-expand')!);
    await waitFor(() => expect(screen.getByTestId('chapter-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('chapter-option-item-0'));
    await waitFor(() =>
      expect(document.querySelector('#chapter .selection-label')).toHaveTextContent(
        'Chapter 7 - Panel',
      ),
    );

    // Open status combo and click first item
    await userEvent.click(document.querySelector('#status-expand')!);
    await waitFor(() => expect(screen.getByTestId('status-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('status-option-item-0'));
    await waitFor(() =>
      expect(document.querySelector('#status .selection-label')).toHaveTextContent('Active'),
    );

    fireEvent.change(effectiveDateInput, { target: { value: TEST_APPOINTED_DATE } });
    fireEvent.change(appointedDateInput, { target: { value: TEST_APPOINTED_DATE } });

    // Verify ComboBox selections are showing
    const districtSelection = document.querySelector('#district .selection-label');
    const chapterSelection = document.querySelector('#chapter .selection-label');
    const statusSelection = document.querySelector('#status .selection-label');

    expect(districtSelection).toHaveTextContent('District of Alaska - Juneau');
    expect(chapterSelection).toHaveTextContent('Chapter 7 - Panel');
    expect(statusSelection).toHaveTextContent('Active');

    // Verify date inputs have values
    expect(effectiveDateInput.value).toBe(TEST_APPOINTED_DATE);
    expect(appointedDateInput.value).toBe(TEST_APPOINTED_DATE);

    const submitButton = screen.getByRole('button', { name: /save/i });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  test('should handle successful form submission', async () => {
    const postSpy = vi.spyOn(Api2, 'postTrusteeAppointment').mockResolvedValue(undefined);

    renderWithProps({ trusteeId: TEST_TRUSTEE_ID, trusteeName: 'Jane Smith' });

    await waitFor(() => {
      expect(document.querySelector('#district')).toBeInTheDocument();
    });

    const effectiveDateInput = screen.getByLabelText(/status date/i) as HTMLInputElement;
    const appointedDateInput = screen.getByLabelText(/appointment date/i) as HTMLInputElement;

    // Fill ComboBox fields
    await userEvent.click(document.querySelector('#district-expand')!);
    await waitFor(() => expect(screen.getByTestId('district-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('district-option-item-0'));

    await userEvent.click(document.querySelector('#chapter-expand')!);
    await waitFor(() => expect(screen.getByTestId('chapter-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('chapter-option-item-0')); // '7-panel'

    await userEvent.click(document.querySelector('#status-expand')!);
    await waitFor(() => expect(screen.getByTestId('status-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('status-option-item-0')); // 'active'

    fireEvent.change(effectiveDateInput, { target: { value: TEST_EFFECTIVE_DATE } });
    fireEvent.change(appointedDateInput, { target: { value: TEST_APPOINTED_DATE } });

    const submitButton = screen.getByRole('button', { name: /save/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        TEST_TRUSTEE_ID,
        expect.objectContaining({
          chapter: '7-panel',
          status: 'active',
          appointedDate: TEST_APPOINTED_DATE,
          effectiveDate: TEST_EFFECTIVE_DATE,
        }),
      );
    });

    expect(navigateTo).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}`);
  });

  test('should show error alert when district is not selected on submit', async () => {
    const postSpy = vi.spyOn(Api2, 'postTrusteeAppointment').mockResolvedValue(undefined);
    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    renderWithProps();

    await waitFor(() => {
      expect(document.querySelector('#district')).toBeInTheDocument();
    });

    const effectiveDateInput = screen.getByLabelText(/status date/i) as HTMLInputElement;
    const appointedDateInput = screen.getByLabelText(/appointment date/i) as HTMLInputElement;

    // Fill all fields except district (leave it unselected)
    await userEvent.click(document.querySelector('#chapter-expand')!);
    await waitFor(() => expect(screen.getByTestId('chapter-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('chapter-option-item-0'));
    await waitFor(() =>
      expect(document.querySelector('#chapter-item-list-container')!.classList).toContain('closed'),
    );

    await userEvent.click(document.querySelector('#status-expand')!);
    await waitFor(() => expect(screen.getByTestId('status-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('status-option-item-0'));
    await waitFor(() =>
      expect(document.querySelector('#status-item-list-container')!.classList).toContain('closed'),
    );

    await userEvent.type(effectiveDateInput, TEST_EFFECTIVE_DATE);
    await userEvent.type(appointedDateInput, TEST_APPOINTED_DATE);

    // Try to submit with empty district - button should be disabled
    const submitButton = screen.getByRole('button', { name: /save/i });
    expect(submitButton).toBeDisabled();

    // Verify the API was not called
    expect(postSpy).not.toHaveBeenCalled();
    expect(globalAlertSpy.error).not.toHaveBeenCalled();
  });

  test('should handle API error on form submission', async () => {
    const error = new Error('Network failure');
    vi.spyOn(Api2, 'postTrusteeAppointment').mockRejectedValue(error);

    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    renderWithProps({ trusteeId: TEST_TRUSTEE_ID });

    await waitFor(() => {
      expect(document.querySelector('#district')).toBeInTheDocument();
    });

    const effectiveDateInput = screen.getByLabelText(/status date/i) as HTMLInputElement;
    const appointedDateInput = screen.getByLabelText(/appointment date/i) as HTMLInputElement;

    await userEvent.click(document.querySelector('#district-expand')!);
    await waitFor(() => expect(screen.getByTestId('district-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('district-option-item-0'));

    await userEvent.click(document.querySelector('#chapter-expand')!);
    await waitFor(() => expect(screen.getByTestId('chapter-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('chapter-option-item-0'));

    await userEvent.click(document.querySelector('#status-expand')!);
    await waitFor(() => expect(screen.getByTestId('status-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('status-option-item-0'));

    fireEvent.change(effectiveDateInput, { target: { value: TEST_EFFECTIVE_DATE } });
    fireEvent.change(appointedDateInput, { target: { value: TEST_APPOINTED_DATE } });

    const submitButton = screen.getByRole('button', { name: /save/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalled();
      expect(globalAlertSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to create appointment/),
      );
    });
  });

  test('should handle cancel button functionality', async () => {
    renderWithProps({ trusteeId: 'trustee-456' });

    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    await userEvent.click(cancelButton);

    expect(navigateTo).toHaveBeenCalledWith('/trustees/trustee-456');
  });

  test('should show error when getCourts fails', async () => {
    vi.spyOn(Api2, 'getCourts').mockRejectedValue(new Error('Failed to fetch courts'));

    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    renderWithProps();

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalledWith('Failed to load districts');
    });
  });

  test('should display chapter options correctly', async () => {
    renderWithProps();

    await waitFor(() => {
      expect(document.querySelector('#chapter')).toBeInTheDocument();
    });

    // Open the chapter combobox to see options
    const chapterExpandButton = document.querySelector('#chapter-expand');
    expect(chapterExpandButton).toBeInTheDocument();
    await userEvent.click(chapterExpandButton!);

    await waitFor(() => {
      expect(screen.getByText('Chapter 7 - Panel')).toBeInTheDocument();
    });

    expect(screen.getByText('Chapter 7 - Non-Panel')).toBeInTheDocument();
    expect(screen.getByText('Chapter 11')).toBeInTheDocument();
    expect(screen.getByText('Chapter 11 Subchapter V')).toBeInTheDocument();
    expect(screen.getByText('Chapter 12')).toBeInTheDocument();
    expect(screen.getByText('Chapter 13')).toBeInTheDocument();
  });

  test('should display status options correctly', async () => {
    renderWithProps();

    await waitFor(() => {
      expect(document.querySelector('#status')).toBeInTheDocument();
    });

    // Open the status combobox to see options
    const statusExpandButton = document.querySelector('#status-expand');
    expect(statusExpandButton).toBeInTheDocument();
    await userEvent.click(statusExpandButton!);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  test('should show "Saving…" text on submit button while submitting', async () => {
    vi.spyOn(Api2, 'postTrusteeAppointment').mockImplementation(
      () => new Promise<void>((resolve) => setTimeout(() => resolve(undefined), 1000)),
    );

    renderWithProps();

    await waitFor(() => {
      expect(document.querySelector('#district')).toBeInTheDocument();
    });

    const effectiveDateInput = screen.getByLabelText(/status date/i) as HTMLInputElement;
    const appointedDateInput = screen.getByLabelText(/appointment date/i) as HTMLInputElement;

    await userEvent.click(document.querySelector('#district-expand')!);
    await waitFor(() => expect(screen.getByTestId('district-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('district-option-item-0'));

    await userEvent.click(document.querySelector('#chapter-expand')!);
    await waitFor(() => expect(screen.getByTestId('chapter-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('chapter-option-item-0'));

    await userEvent.click(document.querySelector('#status-expand')!);
    await waitFor(() => expect(screen.getByTestId('status-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('status-option-item-0'));

    fireEvent.change(effectiveDateInput, { target: { value: TEST_EFFECTIVE_DATE } });
    fireEvent.change(appointedDateInput, { target: { value: TEST_APPOINTED_DATE } });

    const submitButton = screen.getByRole('button', { name: /save/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
    });
  });
});
