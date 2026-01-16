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
import { AppointmentType } from '@common/cams/trustees';

const TEST_TRUSTEE_ID = 'test-trustee-123';
const TEST_APPOINTED_DATE = '2024-01-01';
const chapter = {
  seven: 'Chapter 7',
  eleven: 'Chapter 11',
  elevenV: 'Chapter 11 Subchapter V',
  twelve: 'Chapter 12',
  thirteen: 'Chapter 13',
};

const courtDivisionName = {
  alaskaJ: 'District of Alaska - Juneau',
  alaskaN: 'District of Alaska - Nome',
};

const appointmentType = {
  panel: 'panel',
  offPanel: 'off-panel',
};

const mockActiveAppointment: TrusteeAppointment = {
  id: 'appointment-1',
  trusteeId: TEST_TRUSTEE_ID,
  courtId: '097-',
  divisionCode: '710',
  chapter: '7',
  appointmentType: 'panel',
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

async function selectDistrict(userEvent: CamsUserEvent, optionLabel: string) {
  await userEvent.click(document.querySelector('#district-expand')!);
  await waitFor(() => expect(screen.getByText(optionLabel)).toBeVisible());
  await userEvent.click(screen.getByText(optionLabel));
}

async function selectChapter(userEvent: CamsUserEvent, optionLabel: string) {
  await userEvent.click(document.querySelector('#chapter-expand')!);
  await waitFor(() => expect(screen.getByText(optionLabel)).toBeVisible());
  await userEvent.click(screen.getByText(optionLabel));
}

async function selectAppointmentType(userEvent: CamsUserEvent, optionLabel: string) {
  await userEvent.click(document.querySelector('#appointmentType-expand')!);
  await waitFor(() => expect(screen.getByText(optionLabel)).toBeVisible());
  await userEvent.click(screen.getByText(optionLabel));
}

async function selectStatus(userEvent: CamsUserEvent, optionLabel: string) {
  await userEvent.click(document.querySelector('#status-expand')!);
  await waitFor(() => expect(screen.getByText(optionLabel)).toBeVisible());
  await userEvent.click(screen.getByText(optionLabel));
}

function fillDate(appointedDate: string) {
  const appointedDateInput = screen.getByLabelText(/appointment date/i) as HTMLInputElement;
  fireEvent.change(appointedDateInput, { target: { value: appointedDate } });
}

async function fillCompleteForm(
  userEvent: CamsUserEvent,
  options: {
    district?: string;
    chapter?: string;
    appointmentType?: string;
    status?: string;
    appointedDate?: string;
    isEditMode?: boolean;
  } = {},
) {
  await waitFor(() => {
    expect(document.querySelector('#district')).toBeInTheDocument();
  });

  if (options.district !== undefined) {
    await selectDistrict(userEvent, options.district);
  }
  if (options.chapter !== undefined) {
    await selectChapter(userEvent, options.chapter);
    // Wait for appointmentType to be enabled after selecting chapter
    await waitFor(() => {
      const appointmentTypeContainer = document.querySelector(
        '#appointmentType .input-container',
      ) as HTMLElement;
      expect(appointmentTypeContainer).not.toHaveClass('disabled');
    });
  }
  if (options.appointmentType !== undefined) {
    await selectAppointmentType(userEvent, options.appointmentType);
    // Wait for appointment type selection to complete
    await waitFor(() => {
      const appointmentTypeItemListContainer = document.querySelector(
        '#appointmentType-item-list-container',
      );
      if (appointmentTypeItemListContainer) {
        expect(appointmentTypeItemListContainer.classList).toContain('closed');
      }
    });
  }
  if (options.status !== undefined && options.isEditMode) {
    // Wait for status to be enabled after selecting appointment type
    await waitFor(
      () => {
        const statusExpandButton = document.querySelector('#status-expand') as HTMLButtonElement;
        expect(statusExpandButton).not.toBeDisabled();
      },
      { timeout: 3000 },
    );
    await selectStatus(userEvent, options.status);
  }
  if (options.appointedDate) {
    fillDate(options.appointedDate);
  }
}

async function setAppointmentTypeOnDefaultCompleteForm(
  userEvent: CamsUserEvent,
  appointmentType: string,
) {
  await fillCompleteForm(userEvent, {
    district: courtDivisionName.alaskaJ,
    chapter: chapter.seven,
    appointmentType: appointmentType,
    appointedDate: TEST_APPOINTED_DATE,
  });
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
    expect(document.querySelector('#status')).not.toBeInTheDocument();
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

    const appointedDateInput = screen.getByLabelText(/appointment date/i) as HTMLInputElement;

    await selectDistrict(userEvent, courtDivisionName.alaskaJ);
    await waitFor(() =>
      expect(document.querySelector('#district .selection-label')).toHaveTextContent(
        courtDivisionName.alaskaJ,
      ),
    );

    await selectChapter(userEvent, chapter.seven);
    await waitFor(() =>
      expect(document.querySelector('#chapter .selection-label')).toHaveTextContent(chapter.seven),
    );

    // Manually select appointment type since Chapter 7 has multiple options
    await selectAppointmentType(userEvent, 'Panel');
    await waitFor(() =>
      expect(document.querySelector('#appointmentType .selection-label')).toHaveTextContent(
        'Panel',
      ),
    );

    fillDate(TEST_APPOINTED_DATE);

    const districtSelection = document.querySelector('#district .selection-label');
    const chapterSelection = document.querySelector('#chapter .selection-label');
    const appointmentTypeSelection = document.querySelector('#appointmentType .selection-label');

    expect(districtSelection).toHaveTextContent(courtDivisionName.alaskaJ);
    expect(chapterSelection).toHaveTextContent(chapter.seven);
    expect(appointmentTypeSelection).toHaveTextContent('Panel');

    expect(appointedDateInput.value).toBe(TEST_APPOINTED_DATE);

    const submitButton = screen.getByRole('button', { name: /save/i });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  test('should handle successful form submission', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [] });
    const postSpy = vi.spyOn(Api2, 'postTrusteeAppointment').mockResolvedValue(undefined);

    renderWithProps({ trusteeId: TEST_TRUSTEE_ID });

    await setAppointmentTypeOnDefaultCompleteForm(userEvent, 'Panel');

    const submitButton = screen.getByRole('button', { name: /save/i });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        TEST_TRUSTEE_ID,
        expect.objectContaining({
          chapter: '7',
          appointmentType: appointmentType.panel,
          status: 'active',
          appointedDate: TEST_APPOINTED_DATE,
          effectiveDate: TEST_APPOINTED_DATE,
        }),
      );
    });

    expect(navigateTo).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}/appointments`);
  });

  test('should show error alert when district is not selected on submit', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [] });
    const postSpy = vi.spyOn(Api2, 'postTrusteeAppointment').mockResolvedValue(undefined);
    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    renderWithProps();

    await waitFor(() => {
      expect(document.querySelector('#district')).toBeInTheDocument();
    });

    const appointedDateInput = screen.getByLabelText(/appointment date/i) as HTMLInputElement;

    await userEvent.click(document.querySelector('#chapter-expand')!);
    await waitFor(() => expect(screen.getByTestId('chapter-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('chapter-option-item-0'));
    await waitFor(() =>
      expect(document.querySelector('#chapter-item-list-container')!.classList).toContain('closed'),
    );

    // Wait for appointment type to be enabled and select it
    await waitFor(() => {
      const appointmentTypeContainer = document.querySelector(
        '#appointmentType .input-container',
      ) as HTMLElement;
      expect(appointmentTypeContainer).not.toHaveClass('disabled');
    });

    await userEvent.click(document.querySelector('#appointmentType-expand')!);
    await waitFor(() => expect(screen.getByTestId('appointmentType-option-item-0')).toBeVisible());
    await userEvent.click(screen.getByTestId('appointmentType-option-item-0'));
    await waitFor(() =>
      expect(document.querySelector('#appointmentType-item-list-container')!.classList).toContain(
        'closed',
      ),
    );

    await userEvent.type(appointedDateInput, TEST_APPOINTED_DATE);

    const submitButton = screen.getByRole('button', { name: /save/i });
    expect(submitButton).toBeDisabled();

    expect(postSpy).not.toHaveBeenCalled();
    expect(globalAlertSpy.error).not.toHaveBeenCalled();
  });

  test('should handle API error on form submission', async () => {
    const error = new Error('Network failure');
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [] });
    vi.spyOn(Api2, 'postTrusteeAppointment').mockRejectedValue(error);

    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    renderWithProps({ trusteeId: TEST_TRUSTEE_ID });

    await setAppointmentTypeOnDefaultCompleteForm(userEvent, 'Panel');

    const submitButton = screen.getByRole('button', { name: /save/i });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
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
      expect(screen.getByText(chapter.seven)).toBeInTheDocument();
    });

    expect(screen.getByText(chapter.eleven)).toBeInTheDocument();
    expect(screen.getByText(chapter.elevenV)).toBeInTheDocument();
    expect(screen.getByText(chapter.twelve)).toBeInTheDocument();
    expect(screen.getByText(chapter.thirteen)).toBeInTheDocument();
  });

  test('should disable appointmentType dropdown when chapter is not selected', async () => {
    renderWithProps();

    await waitFor(() => {
      expect(document.querySelector('#appointmentType')).toBeInTheDocument();
    });

    const appointmentTypeContainer = document.querySelector(
      '#appointmentType .input-container',
    ) as HTMLElement;
    expect(appointmentTypeContainer).toHaveClass('disabled');

    const appointmentTypeExpandButton = document.querySelector(
      '#appointmentType-expand',
    ) as HTMLButtonElement;
    expect(appointmentTypeExpandButton).toBeDisabled();
  });

  test('should enable appointmentType dropdown when chapter is selected', async () => {
    renderWithProps();

    await waitFor(() => {
      expect(document.querySelector('#chapter')).toBeInTheDocument();
    });

    // Initially, appointmentType should be disabled
    let appointmentTypeContainer = document.querySelector(
      '#appointmentType .input-container',
    ) as HTMLElement;
    expect(appointmentTypeContainer).toHaveClass('disabled');

    // Select a chapter
    await selectChapter(userEvent, chapter.seven);

    // Wait for appointmentType to be enabled
    await waitFor(() => {
      appointmentTypeContainer = document.querySelector(
        '#appointmentType .input-container',
      ) as HTMLElement;
      expect(appointmentTypeContainer).not.toHaveClass('disabled');
    });

    const appointmentTypeExpandButton = document.querySelector(
      '#appointmentType-expand',
    ) as HTMLButtonElement;
    expect(appointmentTypeExpandButton).not.toBeDisabled();

    // Verify appointment type options are displayed for Chapter 7
    await userEvent.click(appointmentTypeExpandButton);
    await waitFor(() => {
      expect(screen.getByText('Panel')).toBeInTheDocument();
    });
    // 'Off Panel' should not be visible in create mode
    expect(screen.queryByText('Off Panel')).not.toBeInTheDocument();
  });

  test('should show "Saving…" text on submit button while submitting', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [] });
    vi.spyOn(Api2, 'postTrusteeAppointment').mockImplementation(
      () => new Promise<void>((resolve) => setTimeout(() => resolve(undefined), 1000)),
    );

    renderWithProps();

    await setAppointmentTypeOnDefaultCompleteForm(userEvent, 'Panel');

    const submitButton = screen.getByRole('button', { name: /save/i });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
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

      await selectDistrict(userEvent, courtDivisionName.alaskaJ);
      await selectChapter(userEvent, chapter.seven);
      await selectAppointmentType(userEvent, 'Panel');

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

      await setAppointmentTypeOnDefaultCompleteForm(userEvent, 'Panel');

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
        district: courtDivisionName.alaskaN,
        chapter: chapter.seven,
        appointmentType: 'Panel',
        status: 'Active',
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
        district: courtDivisionName.alaskaJ,
        chapter: chapter.eleven, // Chapter 11 auto-selects its single appointment type
        // No appointmentType needed since Chapter 11 has only one option
        status: 'Active',
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

      await selectDistrict(userEvent, courtDivisionName.alaskaJ);
      await selectChapter(userEvent, chapter.seven);
      await selectAppointmentType(userEvent, 'Panel');

      await waitFor(() => {
        expect(
          screen.getByText(/An active appointment already exists for Chapter 7 - Panel/i),
        ).toBeInTheDocument();
      });

      // Change to a different chapter to clear the validation error
      await selectChapter(userEvent, chapter.eleven);

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

      await setAppointmentTypeOnDefaultCompleteForm(userEvent, 'Panel');

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

      await setAppointmentTypeOnDefaultCompleteForm(userEvent, 'Panel');

      const form = screen.getByTestId('trustee-appointment-form') as HTMLFormElement;

      fireEvent.submit(form);

      await waitFor(() => {
        expect(postSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Dynamic Status Options Tests', () => {
    test('should not show status dropdown in create mode', async () => {
      renderWithProps();

      await waitFor(() => {
        expect(document.querySelector('#district')).toBeInTheDocument();
      });

      expect(document.querySelector('#status')).not.toBeInTheDocument();
    });

    test('should show status dropdown in edit mode', async () => {
      const appointmentToEdit: TrusteeAppointment = {
        ...mockActiveAppointment,
        chapter: '7',
        appointmentType: appointmentType.panel as AppointmentType,
      };

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        appointment: appointmentToEdit,
      });

      await waitFor(() => {
        expect(document.querySelector('#status')).toBeInTheDocument();
      });
    });

    test('should disable status dropdown when appointmentType is not selected in edit mode', async () => {
      const appointmentToEdit: TrusteeAppointment = {
        ...mockActiveAppointment,
        chapter: '7',
        appointmentType: appointmentType.panel as AppointmentType,
        status: 'active',
      };

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        appointment: appointmentToEdit,
      });

      await waitFor(() => {
        expect(document.querySelector('#status')).toBeInTheDocument();
      });

      // Clear the appointment type selection by changing to Chapter 12 (has multiple types)
      await selectChapter(userEvent, chapter.twelve); // Chapter 12 has 2 types, won't auto-select

      // Wait for status to be disabled after appointmentType is cleared
      await waitFor(() => {
        const statusContainer = document.querySelector('#status .input-container') as HTMLElement;
        expect(statusContainer).toHaveClass('disabled');
      });

      const statusExpandButton = document.querySelector('#status-expand') as HTMLButtonElement;
      expect(statusExpandButton).toBeDisabled();
    });

    test('should show correct status options for Chapter 7 Panel in edit mode', async () => {
      const appointmentToEdit: TrusteeAppointment = {
        ...mockActiveAppointment,
        chapter: '7',
        appointmentType: appointmentType.panel as AppointmentType,
        status: 'active',
      };

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        appointment: appointmentToEdit,
      });

      await waitFor(() => {
        const statusExpandButton = document.querySelector('#status-expand') as HTMLButtonElement;
        expect(statusExpandButton).not.toBeDisabled();
      });

      const statusExpandButton = document.querySelector('#status-expand') as HTMLButtonElement;
      await userEvent.click(statusExpandButton);

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
      });

      expect(screen.getByText('Voluntarily Suspended')).toBeInTheDocument();
      expect(screen.getByText('Involuntarily Suspended')).toBeInTheDocument();
      expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
    });

    test('should show correct status options for Chapter 7 Off Panel in edit mode', async () => {
      const appointmentToEdit: TrusteeAppointment = {
        ...mockActiveAppointment,
        chapter: '7',
        appointmentType: appointmentType.offPanel as AppointmentType,
        status: 'deceased',
      };

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        appointment: appointmentToEdit,
      });

      await waitFor(() => {
        expect(document.querySelector('#status')).toBeInTheDocument();
      });

      await waitFor(() => {
        const statusExpandButton = document.querySelector('#status-expand') as HTMLButtonElement;
        expect(statusExpandButton).not.toBeDisabled();
      });

      const statusExpandButton = document.querySelector('#status-expand') as HTMLButtonElement;
      await userEvent.click(statusExpandButton);

      await waitFor(() => {
        expect(screen.getByText('Deceased')).toBeInTheDocument();
      });

      expect(screen.getByText('Resigned')).toBeInTheDocument();
      expect(screen.getByText('Terminated')).toBeInTheDocument();
      expect(screen.queryByText('Active')).not.toBeInTheDocument();
    });
  });

  describe('Edge Case Tests', () => {
    test('should handle clearing district selection', async () => {
      renderWithProps();

      await selectDistrict(userEvent, courtDivisionName.alaskaJ);

      await waitFor(() =>
        expect(document.querySelector('#district .selection-label')).toHaveTextContent(
          courtDivisionName.alaskaJ,
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

      await selectChapter(userEvent, chapter.seven);

      await waitFor(() =>
        expect(document.querySelector('#chapter .selection-label')).toHaveTextContent(
          chapter.seven,
        ),
      );

      const clearButton = document.querySelector('#chapter-clear-all');
      expect(clearButton).toBeInTheDocument();
      await userEvent.click(clearButton as HTMLElement);

      await waitFor(() => {
        expect(document.querySelector('#chapter .selection-label')).toHaveTextContent('');
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
  });

  describe('Edit Mode Tests', () => {
    test('should pre-populate form when appointment is provided', async () => {
      const appointmentToEdit: TrusteeAppointment = {
        ...mockActiveAppointment,
        courtId: '097-',
        divisionCode: '710',
        chapter: '7',
        appointmentType: appointmentType.panel as AppointmentType,
        status: 'active',
        effectiveDate: '2024-06-15',
        appointedDate: '2024-06-01',
      };

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        appointment: appointmentToEdit,
      });

      await waitFor(() => {
        expect(document.querySelector('#district')).toBeInTheDocument();
      });

      const appointedDateInput = screen.getByLabelText(/appointment date/i) as HTMLInputElement;

      expect(appointedDateInput.value).toBe('2024-06-01');
    });

    test('should have Edit Trustee Appointment aria-label in edit mode', async () => {
      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        appointment: mockActiveAppointment,
      });

      await waitFor(() => {
        expect(document.querySelector('#district')).toBeInTheDocument();
      });

      const form = screen.getByLabelText('Edit Trustee Appointment');
      expect(form).toBeInTheDocument();
    });

    test('should call putTrusteeAppointment on submit in edit mode', async () => {
      const appointmentToEdit: TrusteeAppointment = {
        ...mockActiveAppointment,
        id: 'appointment-to-edit',
        courtId: '097-',
        divisionCode: '710',
        chapter: '7',
        appointmentType: appointmentType.panel as AppointmentType,
        status: 'active',
        effectiveDate: '2024-06-15',
        appointedDate: '2024-06-01',
      };

      const putSpy = vi.spyOn(Api2, 'putTrusteeAppointment').mockResolvedValue({
        data: appointmentToEdit,
      });

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        appointment: appointmentToEdit,
        existingAppointments: [appointmentToEdit],
      });

      await waitFor(() => {
        expect(document.querySelector('#district')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(putSpy).toHaveBeenCalledWith(
          TEST_TRUSTEE_ID,
          'appointment-to-edit',
          expect.objectContaining({
            courtId: '097-',
            divisionCode: '710',
            chapter: '7',
            appointmentType: appointmentType.panel,
            status: 'active',
            effectiveDate: '2024-06-15',
            appointedDate: '2024-06-01',
          }),
        );
      });
    });

    test('should NOT show validation error for the appointment being edited', async () => {
      const appointmentToEdit: TrusteeAppointment = {
        ...mockActiveAppointment,
        id: 'appointment-being-edited',
        courtId: '097-',
        divisionCode: '710',
        chapter: '7',
        appointmentType: appointmentType.panel as AppointmentType,
        status: 'active',
        effectiveDate: '2024-06-15',
        appointedDate: '2024-06-01',
      };

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        appointment: appointmentToEdit,
        existingAppointments: [appointmentToEdit],
      });

      await waitFor(() => {
        expect(document.querySelector('#district')).toBeInTheDocument();
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('should show validation error if editing creates overlap with different appointment', async () => {
      const appointmentToEdit: TrusteeAppointment = {
        ...mockActiveAppointment,
        id: 'appointment-being-edited',
        courtId: '097-',
        divisionCode: '720',
        chapter: '13',
        appointmentType: 'standing',
        status: 'active',
      };

      const conflictingAppointment: TrusteeAppointment = {
        ...mockActiveAppointment,
        id: 'different-appointment',
        courtId: '097-',
        divisionCode: '710',
        chapter: '7',
        appointmentType: appointmentType.panel as AppointmentType,
        status: 'active',
      };

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        appointment: appointmentToEdit,
        existingAppointments: [appointmentToEdit, conflictingAppointment],
      });

      await waitFor(() => {
        expect(document.querySelector('#district')).toBeInTheDocument();
      });

      await selectDistrict(userEvent, courtDivisionName.alaskaJ);
      await selectChapter(userEvent, chapter.seven);
      await selectAppointmentType(userEvent, 'Panel');

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent(
          /An active appointment already exists for Chapter 7 - Panel/,
        );
      });
    });

    test('should show error message on failed PUT request', async () => {
      const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();
      const appointmentToEdit: TrusteeAppointment = {
        ...mockActiveAppointment,
        id: 'appointment-to-edit',
      };

      const putSpy = vi
        .spyOn(Api2, 'putTrusteeAppointment')
        .mockRejectedValue(new Error('API Error'));

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        appointment: appointmentToEdit,
      });

      await waitFor(() => {
        expect(document.querySelector('#district')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(putSpy).toHaveBeenCalled();
        expect(globalAlertSpy.error).toHaveBeenCalledWith(
          'Failed to update appointment: API Error',
        );
      });
    });

    test('should show Off Panel and Out of Pool options in edit mode', async () => {
      const appointmentToEdit: TrusteeAppointment = {
        ...mockActiveAppointment,
        chapter: '7',
        appointmentType: appointmentType.panel as AppointmentType,
      };

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        appointment: appointmentToEdit,
      });

      await waitFor(() => {
        expect(document.querySelector('#appointmentType')).toBeInTheDocument();
      });

      const appointmentTypeExpandButton = document.querySelector(
        '#appointmentType-expand',
      ) as HTMLButtonElement;
      await userEvent.click(appointmentTypeExpandButton);

      await waitFor(() => {
        expect(screen.getByText('Off Panel')).toBeInTheDocument();
      });

      await selectChapter(userEvent, chapter.elevenV);

      await waitFor(() => {
        const appointmentTypeExpandButton2 = document.querySelector(
          '#appointmentType-expand',
        ) as HTMLButtonElement;
        expect(appointmentTypeExpandButton2).not.toBeDisabled();
      });

      const appointmentTypeExpandButton2 = document.querySelector(
        '#appointmentType-expand',
      ) as HTMLButtonElement;
      await userEvent.click(appointmentTypeExpandButton2);

      await waitFor(() => {
        expect(screen.getByText('Out of Pool')).toBeInTheDocument();
      });
    });
  });

  describe('Alphabetical Ordering Tests', () => {
    test('should display appointment type options in alphabetical order for Chapter 7', async () => {
      renderWithProps();

      await waitFor(() => {
        expect(document.querySelector('#chapter')).toBeInTheDocument();
      });

      await selectChapter(userEvent, chapter.seven); // Chapter 7

      await waitFor(() => {
        const appointmentTypeContainer = document.querySelector(
          '#appointmentType .input-container',
        ) as HTMLElement;
        expect(appointmentTypeContainer).not.toHaveClass('disabled');
      });

      const appointmentTypeExpandButton = document.querySelector(
        '#appointmentType-expand',
      ) as HTMLButtonElement;
      await userEvent.click(appointmentTypeExpandButton);

      await waitFor(() => {
        expect(screen.getByText('Panel')).toBeInTheDocument();
      });

      // Get all appointment type options
      const optionItems = document.querySelectorAll('[id^="appointmentType-option-item-"]');
      const optionTexts = Array.from(optionItems).map((item) => item.textContent || '');

      // Verify they are in alphabetical order
      const sortedTexts = [...optionTexts].sort((a, b) => a.localeCompare(b));
      expect(optionTexts).toEqual(sortedTexts);
    });

    test('should display appointment type options in alphabetical order for Chapter 7 in edit mode', async () => {
      const appointmentToEdit: TrusteeAppointment = {
        ...mockActiveAppointment,
        chapter: '7',
        appointmentType: appointmentType.panel as AppointmentType,
      };

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        appointment: appointmentToEdit,
      });

      await waitFor(() => {
        expect(document.querySelector('#appointmentType')).toBeInTheDocument();
      });

      const appointmentTypeExpandButton = document.querySelector(
        '#appointmentType-expand',
      ) as HTMLButtonElement;
      await userEvent.click(appointmentTypeExpandButton);

      await waitFor(() => {
        expect(screen.getByText('Off Panel')).toBeInTheDocument();
      });

      // Get all appointment type options
      const optionItems = document.querySelectorAll('[id^="appointmentType-option-item-"]');
      const optionTexts = Array.from(optionItems).map((item) => item.textContent || '');

      // Verify they are in alphabetical order
      const sortedTexts = [...optionTexts].sort((a, b) => a.localeCompare(b));
      expect(optionTexts).toEqual(sortedTexts);
    });

    test('should display status options in alphabetical order for Chapter 7 Panel', async () => {
      const appointmentToEdit: TrusteeAppointment = {
        ...mockActiveAppointment,
        chapter: '7',
        appointmentType: appointmentType.panel as AppointmentType,
        status: 'active',
      };

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        appointment: appointmentToEdit,
      });

      await waitFor(() => {
        const statusExpandButton = document.querySelector('#status-expand') as HTMLButtonElement;
        expect(statusExpandButton).not.toBeDisabled();
      });

      const statusExpandButton = document.querySelector('#status-expand') as HTMLButtonElement;
      await userEvent.click(statusExpandButton);

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
      });

      // Get all status options
      const optionItems = document.querySelectorAll('[id^="status-option-item-"]');
      const optionTexts = Array.from(optionItems).map((item) => item.textContent || '');

      // Verify they are in alphabetical order
      const sortedTexts = [...optionTexts].sort((a, b) => a.localeCompare(b));
      expect(optionTexts).toEqual(sortedTexts);
    });

    test('should display status options in alphabetical order for Chapter 7 Off Panel', async () => {
      const appointmentToEdit: TrusteeAppointment = {
        ...mockActiveAppointment,
        chapter: '7',
        appointmentType: appointmentType.offPanel as AppointmentType,
        status: 'deceased',
      };

      renderWithProps({
        trusteeId: TEST_TRUSTEE_ID,
        appointment: appointmentToEdit,
      });

      await waitFor(() => {
        expect(document.querySelector('#status')).toBeInTheDocument();
      });

      await waitFor(() => {
        const statusExpandButton = document.querySelector('#status-expand') as HTMLButtonElement;
        expect(statusExpandButton).not.toBeDisabled();
      });

      const statusExpandButton = document.querySelector('#status-expand') as HTMLButtonElement;
      await userEvent.click(statusExpandButton);

      await waitFor(() => {
        expect(screen.getByText('Deceased')).toBeInTheDocument();
      });

      // Get all status options
      const optionItems = document.querySelectorAll('[id^="status-option-item-"]');
      const optionTexts = Array.from(optionItems).map((item) => item.textContent || '');

      // Verify they are in alphabetical order
      const sortedTexts = [...optionTexts].sort((a, b) => a.localeCompare(b));
      expect(optionTexts).toEqual(sortedTexts);
    });

    test('should display appointment type options in alphabetical order for Chapter 12', async () => {
      renderWithProps();

      await waitFor(() => {
        expect(document.querySelector('#chapter')).toBeInTheDocument();
      });

      await selectChapter(userEvent, chapter.twelve); // Chapter 12

      await waitFor(() => {
        const appointmentTypeContainer = document.querySelector(
          '#appointmentType .input-container',
        ) as HTMLElement;
        expect(appointmentTypeContainer).not.toHaveClass('disabled');
      });

      const appointmentTypeExpandButton = document.querySelector(
        '#appointmentType-expand',
      ) as HTMLButtonElement;
      await userEvent.click(appointmentTypeExpandButton);

      await waitFor(() => {
        expect(screen.getByText('Standing')).toBeInTheDocument();
      });

      // Get all appointment type options
      const optionItems = document.querySelectorAll('[id^="appointmentType-option-item-"]');
      const optionTexts = Array.from(optionItems).map((item) => item.textContent || '');

      // Verify they are in alphabetical order
      const sortedTexts = [...optionTexts].sort((a, b) => a.localeCompare(b));
      expect(optionTexts).toEqual(sortedTexts);
    });
  });
});
