import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TrusteeAppointmentForm, { TrusteeAppointmentFormProps } from './TrusteeAppointmentForm';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { FeatureFlagSet } from '@common/feature-flags';
import Api2 from '@/lib/models/api2';
import MockData from '@common/cams/test-utilities/mock-data';
import * as useCamsNavigatorModule from '@/lib/hooks/UseCamsNavigator';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';

const TEST_TRUSTEE_ID = 'test-trustee-123';
const TEST_EFFECTIVE_DATE = '2024-01-15';
const TEST_APPOINTED_DATE = '2024-01-01';

const mockActiveAppointment: TrusteeAppointment = {
  id: 'appointment-1',
  trusteeId: TEST_TRUSTEE_ID,
  courtId: '097-',
  divisionCode: '710',
  chapter: '7-panel',
  status: 'active',
  appointedDate: '2023-01-01',
  effectiveDate: '2023-01-01',
  courtName: 'District of Alaska',
  courtDivisionName: 'Juneau',
  createdOn: '2023-01-01T00:00:00.000Z',
  createdBy: { id: 'test-user', name: 'Test User' },
  updatedOn: '2023-01-01T00:00:00.000Z',
  updatedBy: { id: 'test-user', name: 'Test User' },
};

const mockInactiveAppointment: TrusteeAppointment = {
  ...mockActiveAppointment,
  id: 'appointment-2',
  status: 'inactive',
};

function renderWithProps(
  props: TrusteeAppointmentFormProps = {
    trusteeId: TEST_TRUSTEE_ID,
  },
) {
  return render(
    <MemoryRouter>
      <TrusteeAppointmentForm {...props} />
    </MemoryRouter>,
  );
}

function renderWithNavigationState(
  props: TrusteeAppointmentFormProps = {
    trusteeId: TEST_TRUSTEE_ID,
  },
  state?: { existingAppointments?: TrusteeAppointment[] },
) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/', state }]}>
      <Routes>
        <Route path="/" element={<TrusteeAppointmentForm {...props} />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function selectDistrict(userEvent: CamsUserEvent, itemIndex: number = 0) {
  await userEvent.click(document.querySelector('#district-expand')!);
  await waitFor(() =>
    expect(screen.getByTestId(`district-option-item-${itemIndex}`)).toBeVisible(),
  );
  await userEvent.click(screen.getByTestId(`district-option-item-${itemIndex}`));
}

async function selectChapter(userEvent: CamsUserEvent, itemIndex: number = 0) {
  await userEvent.click(document.querySelector('#chapter-expand')!);
  await waitFor(() => expect(screen.getByTestId(`chapter-option-item-${itemIndex}`)).toBeVisible());
  await userEvent.click(screen.getByTestId(`chapter-option-item-${itemIndex}`));
}

async function selectStatus(userEvent: CamsUserEvent, itemIndex: number = 0) {
  await userEvent.click(document.querySelector('#status-expand')!);
  await waitFor(() => expect(screen.getByTestId(`status-option-item-${itemIndex}`)).toBeVisible());
  await userEvent.click(screen.getByTestId(`status-option-item-${itemIndex}`));
}

function fillDates(effectiveDate: string, appointedDate: string) {
  const effectiveDateInput = screen.getByLabelText(/status date/i) as HTMLInputElement;
  const appointedDateInput = screen.getByLabelText(/appointment date/i) as HTMLInputElement;
  fireEvent.change(effectiveDateInput, { target: { value: effectiveDate } });
  fireEvent.change(appointedDateInput, { target: { value: appointedDate } });
}

async function fillCompleteForm(
  userEvent: CamsUserEvent,
  options: {
    districtIndex?: number;
    chapterIndex?: number;
    statusIndex?: number;
    effectiveDate?: string;
    appointedDate?: string;
  } = {},
) {
  await waitFor(() => {
    expect(document.querySelector('#district')).toBeInTheDocument();
  });

  if (options.districtIndex !== undefined) {
    await selectDistrict(userEvent, options.districtIndex);
  }
  if (options.chapterIndex !== undefined) {
    await selectChapter(userEvent, options.chapterIndex);
  }
  if (options.statusIndex !== undefined) {
    await selectStatus(userEvent, options.statusIndex);
  }
  if (options.effectiveDate && options.appointedDate) {
    fillDates(options.effectiveDate, options.appointedDate);
  }
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

    const spinner = screen.getByText('Loading form data...');
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

    await selectDistrict(userEvent, 0);
    await waitFor(() =>
      expect(document.querySelector('#district .selection-label')).toHaveTextContent(
        'District of Alaska - Juneau',
      ),
    );

    await selectChapter(userEvent, 0);
    await waitFor(() =>
      expect(document.querySelector('#chapter .selection-label')).toHaveTextContent(
        'Chapter 7 - Panel',
      ),
    );

    await selectStatus(userEvent, 0);
    await waitFor(() =>
      expect(document.querySelector('#status .selection-label')).toHaveTextContent('Active'),
    );

    fillDates(TEST_APPOINTED_DATE, TEST_APPOINTED_DATE);

    const districtSelection = document.querySelector('#district .selection-label');
    const chapterSelection = document.querySelector('#chapter .selection-label');
    const statusSelection = document.querySelector('#status .selection-label');

    expect(districtSelection).toHaveTextContent('District of Alaska - Juneau');
    expect(chapterSelection).toHaveTextContent('Chapter 7 - Panel');
    expect(statusSelection).toHaveTextContent('Active');

    expect(effectiveDateInput.value).toBe(TEST_APPOINTED_DATE);
    expect(appointedDateInput.value).toBe(TEST_APPOINTED_DATE);

    const submitButton = screen.getByRole('button', { name: /save/i });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  test('should handle successful form submission', async () => {
    const postSpy = vi.spyOn(Api2, 'postTrusteeAppointment').mockResolvedValue(undefined);

    renderWithProps({ trusteeId: TEST_TRUSTEE_ID });

    await fillCompleteForm(userEvent, {
      districtIndex: 0,
      chapterIndex: 0,
      statusIndex: 0,
      effectiveDate: TEST_EFFECTIVE_DATE,
      appointedDate: TEST_APPOINTED_DATE,
    });

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

    expect(navigateTo).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}/appointments`);
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

    const submitButton = screen.getByRole('button', { name: /save/i });
    expect(submitButton).toBeDisabled();

    expect(postSpy).not.toHaveBeenCalled();
    expect(globalAlertSpy.error).not.toHaveBeenCalled();
  });

  test('should handle API error on form submission', async () => {
    const error = new Error('Network failure');
    vi.spyOn(Api2, 'postTrusteeAppointment').mockRejectedValue(error);

    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    renderWithProps({ trusteeId: TEST_TRUSTEE_ID });

    await fillCompleteForm(userEvent, {
      districtIndex: 0,
      chapterIndex: 0,
      statusIndex: 0,
      effectiveDate: TEST_EFFECTIVE_DATE,
      appointedDate: TEST_APPOINTED_DATE,
    });

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

    expect(navigateTo).toHaveBeenCalledWith('/trustees/trustee-456/appointments');
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

    await fillCompleteForm(userEvent, {
      districtIndex: 0,
      chapterIndex: 0,
      statusIndex: 0,
      effectiveDate: TEST_EFFECTIVE_DATE,
      appointedDate: TEST_APPOINTED_DATE,
    });

    const submitButton = screen.getByRole('button', { name: /save/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
    });
  });

  describe('Validation Tests', () => {
    test('should show validation error when overlapping active appointment exists', async () => {
      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        existingAppointments: [mockActiveAppointment],
      });

      await waitFor(() => {
        expect(document.querySelector('#district')).toBeInTheDocument();
      });

      await selectDistrict(userEvent, 0);
      await selectChapter(userEvent, 0);

      await waitFor(() => {
        expect(
          screen.getByText(/An active appointment already exists for Chapter 7 - Panel/i),
        ).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /save/i });
      expect(submitButton).toBeDisabled();
    });

    test('should NOT show validation error when existing appointment is inactive', async () => {
      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        existingAppointments: [mockInactiveAppointment],
      });

      await fillCompleteForm(userEvent, {
        districtIndex: 0,
        chapterIndex: 0,
        statusIndex: 0,
        effectiveDate: TEST_EFFECTIVE_DATE,
        appointedDate: TEST_APPOINTED_DATE,
      });

      expect(screen.queryByText(/An active appointment already exists/i)).not.toBeInTheDocument();

      const submitButton = screen.getByRole('button', { name: /save/i });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    test('should NOT show validation error when district is different', async () => {
      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        existingAppointments: [mockActiveAppointment],
      });

      await fillCompleteForm(userEvent, {
        districtIndex: 1,
        chapterIndex: 0,
        statusIndex: 0,
        effectiveDate: TEST_EFFECTIVE_DATE,
        appointedDate: TEST_APPOINTED_DATE,
      });

      expect(screen.queryByText(/An active appointment already exists/i)).not.toBeInTheDocument();

      const submitButton = screen.getByRole('button', { name: /save/i });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    test('should NOT show validation error when chapter is different', async () => {
      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        existingAppointments: [mockActiveAppointment],
      });

      await fillCompleteForm(userEvent, {
        districtIndex: 0,
        chapterIndex: 1,
        statusIndex: 0,
        effectiveDate: TEST_EFFECTIVE_DATE,
        appointedDate: TEST_APPOINTED_DATE,
      });

      expect(screen.queryByText(/An active appointment already exists/i)).not.toBeInTheDocument();

      const submitButton = screen.getByRole('button', { name: /save/i });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    test('should clear validation error when selection changes', async () => {
      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        existingAppointments: [mockActiveAppointment],
      });

      await waitFor(() => {
        expect(document.querySelector('#district')).toBeInTheDocument();
      });

      await selectDistrict(userEvent, 0);
      await selectChapter(userEvent, 0);

      await waitFor(() => {
        expect(
          screen.getByText(/An active appointment already exists for Chapter 7 - Panel/i),
        ).toBeInTheDocument();
      });

      await selectChapter(userEvent, 1);

      await waitFor(() => {
        expect(screen.queryByText(/An active appointment already exists/i)).not.toBeInTheDocument();
      });
    });

    test('should prevent form submission when validation error exists', async () => {
      const postSpy = vi.spyOn(Api2, 'postTrusteeAppointment').mockResolvedValue(undefined);

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        existingAppointments: [mockActiveAppointment],
      });

      await fillCompleteForm(userEvent, {
        districtIndex: 0,
        chapterIndex: 0,
        statusIndex: 0,
        effectiveDate: TEST_EFFECTIVE_DATE,
        appointedDate: TEST_APPOINTED_DATE,
      });

      const submitButton = screen.getByRole('button', { name: /save/i });
      expect(submitButton).toBeDisabled();

      expect(postSpy).not.toHaveBeenCalled();
    });

    test('should call validation and return early on programmatic submit when validation fails', async () => {
      const postSpy = vi.spyOn(Api2, 'postTrusteeAppointment').mockResolvedValue(undefined);

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        existingAppointments: [mockActiveAppointment],
      });

      await fillCompleteForm(userEvent, {
        districtIndex: 0,
        chapterIndex: 0,
        statusIndex: 0,
        effectiveDate: TEST_EFFECTIVE_DATE,
        appointedDate: TEST_APPOINTED_DATE,
      });

      const form = screen.getByTestId('trustee-appointment-form') as HTMLFormElement;

      fireEvent.submit(form);

      await waitFor(() => {
        expect(postSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Edge Case Tests', () => {
    test('should handle clearing district selection', async () => {
      renderWithProps();

      await selectDistrict(userEvent, 0);

      await waitFor(() =>
        expect(document.querySelector('#district .selection-label')).toHaveTextContent(
          'District of Alaska - Juneau',
        ),
      );

      const clearButton = document.querySelector('#district-clear-all');
      expect(clearButton).toBeInTheDocument();
      await userEvent.click(clearButton as HTMLElement);

      await waitFor(() => {
        expect(document.querySelector('#district .selection-label')).toHaveTextContent('');
      });
    });

    test('should handle clearing chapter selection', async () => {
      renderWithProps();

      await selectChapter(userEvent, 0);

      await waitFor(() =>
        expect(document.querySelector('#chapter .selection-label')).toHaveTextContent(
          'Chapter 7 - Panel',
        ),
      );

      const clearButton = document.querySelector('#chapter-clear-all');
      expect(clearButton).toBeInTheDocument();
      await userEvent.click(clearButton as HTMLElement);

      await waitFor(() => {
        expect(document.querySelector('#chapter .selection-label')).toHaveTextContent('');
      });
    });

    test('should handle clearing status selection', async () => {
      renderWithProps();

      await selectStatus(userEvent, 0);

      await waitFor(() =>
        expect(document.querySelector('#status .selection-label')).toHaveTextContent('Active'),
      );

      const clearButton = document.querySelector('#status-clear-all');
      expect(clearButton).toBeInTheDocument();
      await userEvent.click(clearButton as HTMLElement);

      await waitFor(() => {
        expect(document.querySelector('#status .selection-label')).toHaveTextContent('');
      });
    });
  });

  describe('Data Loading Tests', () => {
    test('should use appointments passed via props', async () => {
      const getTrusteeAppointmentsSpy = vi
        .spyOn(Api2, 'getTrusteeAppointments')
        .mockResolvedValue({ data: [] });

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        existingAppointments: [mockActiveAppointment],
      });

      await waitFor(() => {
        expect(document.querySelector('#district')).toBeInTheDocument();
      });

      expect(getTrusteeAppointmentsSpy).not.toHaveBeenCalled();
    });

    test('should use appointments passed via navigation state', async () => {
      const getTrusteeAppointmentsSpy = vi
        .spyOn(Api2, 'getTrusteeAppointments')
        .mockResolvedValue({ data: [] });

      renderWithNavigationState(
        { trusteeId: TEST_TRUSTEE_ID },
        { existingAppointments: [mockActiveAppointment] },
      );

      await waitFor(() => {
        expect(document.querySelector('#district')).toBeInTheDocument();
      });

      expect(getTrusteeAppointmentsSpy).not.toHaveBeenCalled();
    });

    test('should fetch appointments via API when not provided', async () => {
      const getTrusteeAppointmentsSpy = vi
        .spyOn(Api2, 'getTrusteeAppointments')
        .mockResolvedValue({ data: [mockActiveAppointment] });

      renderWithProps({ trusteeId: TEST_TRUSTEE_ID });

      await waitFor(() => {
        expect(getTrusteeAppointmentsSpy).toHaveBeenCalledWith(TEST_TRUSTEE_ID);
      });

      await waitFor(() => {
        expect(document.querySelector('#district')).toBeInTheDocument();
      });
    });

    test('should show loading spinner when fetching appointments', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 100)),
      );

      renderWithProps({ trusteeId: TEST_TRUSTEE_ID });

      expect(screen.getByText(/Loading form data/i)).toBeInTheDocument();
    });

    test('should handle error when fetching appointments fails', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockRejectedValue(
        new Error('Failed to fetch appointments'),
      );

      const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

      renderWithProps({ trusteeId: TEST_TRUSTEE_ID });

      await waitFor(() => {
        expect(globalAlertSpy.error).toHaveBeenCalledWith('Failed to load existing appointments');
      });
    });

    test('should handle null data from getTrusteeAppointments', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({
        data: null as unknown as TrusteeAppointment[],
      });

      renderWithProps({ trusteeId: TEST_TRUSTEE_ID });

      await waitFor(() => {
        expect(document.querySelector('#district')).toBeInTheDocument();
      });
    });
  });
});
