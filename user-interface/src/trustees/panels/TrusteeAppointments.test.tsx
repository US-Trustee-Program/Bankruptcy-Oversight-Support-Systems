import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import TrusteeAppointments from './TrusteeAppointments';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import userEvent from '@testing-library/user-event';
import * as courtUtils from '@/lib/utils/court-utils';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

// ============================================================================
// Test Utilities: Appointment Factory
// ============================================================================

const baseAppointment: Omit<TrusteeAppointment, 'id'> = {
  trusteeId: 'trustee-123',
  chapter: '7',
  appointmentType: 'panel',
  courtId: '081',
  courtDivisionName: undefined,
  courtName: 'Southern District of New York',
  divisionCode: '1',
  status: 'active',
  appointedDate: '2020-01-15T00:00:00.000Z',
  effectiveDate: '2020-01-15T00:00:00.000Z',
  createdOn: '2020-01-10T14:30:00.000Z',
  createdBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2020-01-10T14:30:00.000Z',
  updatedBy: SYSTEM_USER_REFERENCE,
};

const makeAppointment = (
  id: string,
  overrides: Partial<TrusteeAppointment> = {},
): TrusteeAppointment => ({
  id,
  ...baseAppointment,
  ...overrides,
});

// ============================================================================
// Test Utilities: DOM Helpers
// ============================================================================

const getAppointmentCards = () =>
  Array.from(document.querySelectorAll('.appointment-card-container'));

// ============================================================================
// Tests
// ============================================================================

describe('TrusteeAppointments', () => {
  const EMPTY_APPOINTMENTS_MESSAGE = /There are no appointments for this Trustee./i;
  const mockNavigate = vi.fn();

  const mockAppointments: TrusteeAppointment[] = [
    makeAppointment('appointment-001', {
      chapter: '7',
      courtDivisionName: 'Manhattan',
      courtName: 'Southern District of New York',
    }),
    makeAppointment('appointment-002', {
      chapter: '12',
      appointmentType: 'case-by-case',
      courtDivisionName: 'New York',
      courtName: 'Northern District of New York',
      divisionCode: '2',
    }),
  ];

  function renderComponent(trusteeId: string) {
    return render(
      <MemoryRouter>
        <TrusteeAppointments trusteeId={trusteeId} />
      </MemoryRouter>,
    );
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  test('should display loading spinner while fetching appointments', () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves to keep loading state
        }),
    );

    renderComponent('trustee-123');

    expect(screen.getByText(/Loading appointments.../i)).toBeInTheDocument();
  });

  test('should display error alert when API call fails', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockRejectedValue(new Error('API Error'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    renderComponent('trustee-123');

    await waitFor(() => {
      expect(screen.getByText(/Failed to load trustee appointments/i)).toBeInTheDocument();
    });
  });

  test('should display add button and message when no appointments are found', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [] });

    renderComponent('trustee-123');

    await waitFor(() => {
      expect(screen.getByText(/Add New Appointment/i)).toBeInTheDocument();
      expect(screen.getByText(EMPTY_APPOINTMENTS_MESSAGE)).toBeInTheDocument();
      expect(screen.getByTestId('button-add-appointment-button')).toBeInTheDocument();
    });
  });

  test('should display appointments when API call succeeds', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: mockAppointments });

    renderComponent('trustee-123');

    await waitFor(() => {
      expect(
        screen.getByText(/Southern District of New York: Chapter 7 - Panel/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Northern District of New York: Chapter 12/i)).toBeInTheDocument();
    });
  });

  test('should display add button when appointments exist', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: mockAppointments });

    renderComponent('trustee-123');

    await waitFor(() => {
      expect(screen.getByText(/Add New Appointment/i)).toBeInTheDocument();
      expect(screen.getByTestId('button-add-appointment-button')).toBeInTheDocument();
      // Should not show the empty message
      expect(screen.queryByText(EMPTY_APPOINTMENTS_MESSAGE)).not.toBeInTheDocument();
    });
  });

  test('should call getTrusteeAppointments with correct trusteeId', async () => {
    const getTrusteeAppointmentsSpy = vi
      .spyOn(Api2, 'getTrusteeAppointments')
      .mockResolvedValue({ data: mockAppointments });

    renderComponent('trustee-123');

    await waitFor(() => {
      expect(getTrusteeAppointmentsSpy).toHaveBeenCalledWith('trustee-123');
      expect(getTrusteeAppointmentsSpy).toHaveBeenCalledTimes(1);
    });
  });

  test('should reload appointments when trusteeId changes', async () => {
    const getTrusteeAppointmentsSpy = vi
      .spyOn(Api2, 'getTrusteeAppointments')
      .mockResolvedValue({ data: mockAppointments });

    const { rerender } = render(
      <MemoryRouter>
        <TrusteeAppointments trusteeId="trustee-123" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getTrusteeAppointmentsSpy).toHaveBeenCalledWith('trustee-123');
    });

    rerender(
      <MemoryRouter>
        <TrusteeAppointments trusteeId="trustee-456" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getTrusteeAppointmentsSpy).toHaveBeenCalledWith('trustee-456');
      expect(getTrusteeAppointmentsSpy).toHaveBeenCalledTimes(2);
    });
  });

  test.each([['null', null] as const, ['undefined', undefined] as const])(
    'should handle %s data from API',
    async (_label, dataValue) => {
      // @ts-expect-error - Testing edge case where API returns null/undefined despite type contract
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: dataValue });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(screen.getByText(EMPTY_APPOINTMENTS_MESSAGE)).toBeInTheDocument();
      });
    },
  );

  test('should navigate with appointments data when add button is clicked with no appointments', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [] });

    renderComponent('trustee-123');

    await waitFor(() => {
      expect(screen.getByText(/Add New Appointment/i)).toBeInTheDocument();
    });

    const addButton = screen.getByTestId('button-add-appointment-button');
    await userEvent.click(addButton);

    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-123/appointments/create', {
      state: { existingAppointments: [] },
    });
  });

  test('should navigate with appointments data when add button is clicked with existing appointments', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: mockAppointments });

    renderComponent('trustee-123');

    await waitFor(() => {
      expect(screen.getByText(/Add New Appointment/i)).toBeInTheDocument();
    });

    const addButton = screen.getByTestId('button-add-appointment-button');
    await userEvent.click(addButton);

    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-123/appointments/create', {
      state: { existingAppointments: mockAppointments },
    });
  });

  describe('Appointment Grouping and Sorting', () => {
    test('should call sortByCourtLocation with includeAppointmentDetails option', async () => {
      const sortSpy = vi.spyOn(courtUtils, 'sortByCourtLocation');
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: mockAppointments });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(sortSpy).toHaveBeenCalledWith(mockAppointments, { includeAppointmentDetails: true });
      });
    });

    test('renders appointments in the order returned by sortByCourtLocation', async () => {
      const appointments: TrusteeAppointment[] = [
        makeAppointment('appointment-001', { courtName: 'First Court' }),
        makeAppointment('appointment-002', { courtName: 'Second Court' }),
      ];

      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: appointments });
      vi.spyOn(courtUtils, 'sortByCourtLocation').mockReturnValue([
        appointments[1],
        appointments[0],
      ]);

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(getAppointmentCards()).toHaveLength(2);
      });

      const cardTexts = getAppointmentCards().map((card) => card.textContent);
      expect(cardTexts[0]).toContain('Second Court');
      expect(cardTexts[1]).toContain('First Court');
    });

    test('should handle appointments with missing courtName gracefully', async () => {
      const appointments: TrusteeAppointment[] = [
        makeAppointment('appointment-001', {
          courtName: 'Southern District of New York',
        }),
        makeAppointment('appointment-002', {
          chapter: '12',
          appointmentType: 'case-by-case',
          courtId: '999',
          courtName: undefined,
        }),
      ];

      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: appointments });
      renderComponent('trustee-123');

      await waitFor(() => {
        expect(getAppointmentCards()).toHaveLength(2);
      });

      const cards = getAppointmentCards();

      expect(cards[0].textContent).toContain('Court 999');
      expect(cards[1].textContent).toContain('Southern District of New York');
    });
  });

  describe('Chapter 11 Case by Case accordion', () => {
    const ch11Active = makeAppointment('ch11-active', {
      chapter: '11',
      appointmentType: 'case-by-case',
      status: 'active',
      courtName: 'Southern District of New York',
    });
    const ch11ActiveTwo = makeAppointment('ch11-active-two', {
      chapter: '11',
      appointmentType: 'case-by-case',
      status: 'active',
      courtName: 'Southern District of New York',
    });
    const ch11Inactive = makeAppointment('ch11-inactive', {
      chapter: '11',
      appointmentType: 'case-by-case',
      status: 'inactive',
      courtName: 'Southern District of New York',
    });
    const ch7Panel = makeAppointment('ch7-panel', {
      chapter: '7',
      appointmentType: 'panel',
      status: 'active',
      courtName: 'Southern District of New York',
    });

    beforeEach(() => {
      window.sessionStorage.clear();
    });

    // Body content is now always mounted (see AppointmentAccordion); expand/collapse
    // is expressed via the `hidden` attribute on an ancestor, not DOM presence.
    function isAppointmentExpanded(appointmentId: string): boolean {
      return !screen.getByTestId(`appointment-accordion-body-${appointmentId}`).closest('[hidden]');
    }

    test('renders Chapter 11 Case by Case appointments via the accordion and other types via AppointmentCard', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({
        data: [ch11Active, ch7Panel],
      });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch11Active.id}`),
        ).toBeInTheDocument();
      });
      expect(getAppointmentCards()).toHaveLength(1);
    });

    test('an active Chapter 11 Case by Case appointment is expanded by default', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [ch11Active] });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Active.id)).toBe(true);
      });
    });

    test('a non-active Chapter 11 Case by Case appointment is collapsed by default', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [ch11Inactive] });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch11Inactive.id}`),
        ).toBeInTheDocument();
      });
      expect(isAppointmentExpanded(ch11Inactive.id)).toBe(false);
    });

    test('multiple active Chapter 11 Case by Case appointments can be expanded simultaneously', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({
        data: [ch11Active, ch11ActiveTwo],
      });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Active.id)).toBe(true);
        expect(isAppointmentExpanded(ch11ActiveTwo.id)).toBe(true);
      });
    });

    test('toggling one appointment does not affect another appointment expand state', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({
        data: [ch11Active, ch11Inactive],
      });
      const user = userEvent.setup();

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Active.id)).toBe(true);
        expect(isAppointmentExpanded(ch11Inactive.id)).toBe(false);
      });

      await user.click(screen.getByTestId(`accordion-button-${ch11Inactive.id}`));

      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Active.id)).toBe(true);
        expect(isAppointmentExpanded(ch11Inactive.id)).toBe(true);
      });
    });

    test('toggling an expanded active appointment collapses it', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [ch11Active] });
      const user = userEvent.setup();

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Active.id)).toBe(true);
      });

      await user.click(screen.getByTestId(`accordion-button-${ch11Active.id}`));

      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Active.id)).toBe(false);
      });
    });

    test('an appointment explicitly expanded while active collapses once its status changes to inactive', async () => {
      const getTrusteeAppointmentsSpy = vi
        .spyOn(Api2, 'getTrusteeAppointments')
        .mockResolvedValue({ data: [ch11Active] });
      const user = userEvent.setup();

      const { unmount } = renderComponent('trustee-123');

      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Active.id)).toBe(true);
      });

      // Explicitly collapse it, then re-expand it, recording an explicit
      // toggle for the "active" status in session state.
      await user.click(screen.getByTestId(`accordion-button-${ch11Active.id}`));
      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Active.id)).toBe(false);
      });
      await user.click(screen.getByTestId(`accordion-button-${ch11Active.id}`));
      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Active.id)).toBe(true);
      });

      unmount();

      // Simulate the appointment's status changing to inactive (e.g. via edit).
      getTrusteeAppointmentsSpy.mockResolvedValue({
        data: [{ ...ch11Active, status: 'inactive' }],
      });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch11Active.id}`),
        ).toBeInTheDocument();
      });
      expect(isAppointmentExpanded(ch11Active.id)).toBe(false);
    });

    test('toggling an appointment persists its expand state across simulated navigation within the same session', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [ch11Inactive] });
      const user = userEvent.setup();

      const { unmount } = renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch11Inactive.id}`),
        ).toBeInTheDocument();
      });
      expect(isAppointmentExpanded(ch11Inactive.id)).toBe(false);

      await user.click(screen.getByTestId(`accordion-button-${ch11Inactive.id}`));

      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Inactive.id)).toBe(true);
      });

      unmount();

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Inactive.id)).toBe(true);
      });
    });

    test('an explicit toggle recorded for one status is not reused after the status cycles away and back', async () => {
      const getTrusteeAppointmentsSpy = vi
        .spyOn(Api2, 'getTrusteeAppointments')
        .mockResolvedValue({ data: [ch11Inactive] });
      const user = userEvent.setup();

      const { unmount: unmountFirst } = renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch11Inactive.id}`),
        ).toBeInTheDocument();
      });
      expect(isAppointmentExpanded(ch11Inactive.id)).toBe(false);

      // Explicitly expand it while inactive, recording an override for "inactive".
      await user.click(screen.getByTestId(`accordion-button-${ch11Inactive.id}`));
      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Inactive.id)).toBe(true);
      });

      unmountFirst();

      // Cycle the status to active, then back to inactive (e.g. via edits).
      getTrusteeAppointmentsSpy.mockResolvedValue({
        data: [{ ...ch11Inactive, status: 'active' }],
      });
      const { unmount: unmountSecond } = renderComponent('trustee-123');
      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Inactive.id)).toBe(true);
      });
      unmountSecond();

      getTrusteeAppointmentsSpy.mockResolvedValue({ data: [ch11Inactive] });
      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch11Inactive.id}`),
        ).toBeInTheDocument();
      });
      // The stale "inactive" override from before the cycle must not be reused.
      expect(isAppointmentExpanded(ch11Inactive.id)).toBe(false);
    });

    test('toggling two different appointments in the same update batch updates both independently', async () => {
      const ch11InactiveTwo = makeAppointment('ch11-inactive-two', {
        chapter: '11',
        appointmentType: 'case-by-case',
        status: 'inactive',
        courtName: 'Southern District of New York',
      });
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({
        data: [ch11Inactive, ch11InactiveTwo],
      });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch11Inactive.id}`),
        ).toBeInTheDocument();
      });
      expect(isAppointmentExpanded(ch11Inactive.id)).toBe(false);
      expect(isAppointmentExpanded(ch11InactiveTwo.id)).toBe(false);

      // Fire both toggles within a single update batch so a closure-captured
      // (rather than functional) state update would drop one of them.
      act(() => {
        screen.getByTestId(`accordion-button-${ch11Inactive.id}`).click();
        screen.getByTestId(`accordion-button-${ch11InactiveTwo.id}`).click();
      });

      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Inactive.id)).toBe(true);
        expect(isAppointmentExpanded(ch11InactiveTwo.id)).toBe(true);
      });
    });
  });
});
