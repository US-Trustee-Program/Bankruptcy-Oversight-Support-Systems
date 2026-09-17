import { render, screen, waitFor, within } from '@testing-library/react';
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
    window.sessionStorage.clear();
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

      const cards = getAppointmentCards();
      expect(cards[0]).toHaveAttribute('data-testid', `appointment-card-${appointments[1].id}`);
      expect(cards[1]).toHaveAttribute('data-testid', `appointment-card-${appointments[0].id}`);
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

      expect(
        within(screen.getByTestId(`appointment-card-${appointments[0].id}`)).getAllByText(
          /Southern District of New York/i,
        ),
      ).not.toHaveLength(0);
      expect(
        within(screen.getByTestId(`appointment-card-${appointments[1].id}`)).getAllByText(
          /Court 999/i,
        ),
      ).not.toHaveLength(0);
    });
  });

  describe('Chapter 11 Case by Case accordion', () => {
    const ch11Active = makeAppointment('ch11-active', {
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

    test('an active Chapter 11 Case by Case appointment is collapsed by default', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [ch11Active] });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch11Active.id}`),
        ).toBeInTheDocument();
      });
      expect(isAppointmentExpanded(ch11Active.id)).toBe(false);
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

    test('toggling a collapsed appointment expands it, toggling again collapses it', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [ch11Active] });
      const user = userEvent.setup();

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Active.id)).toBe(false);
      });

      await user.click(screen.getByTestId(`accordion-button-${ch11Active.id}`));

      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Active.id)).toBe(true);
      });

      await user.click(screen.getByTestId(`accordion-button-${ch11Active.id}`));

      await waitFor(() => {
        expect(isAppointmentExpanded(ch11Active.id)).toBe(false);
      });
    });
  });

  describe('Chapter 7 Elected accordion', () => {
    const ch7ElectedActive = makeAppointment('ch7-elected-active', {
      chapter: '7',
      appointmentType: 'elected',
      status: 'active',
      courtName: 'Southern District of New York',
    });
    const ch7ElectedInactive = makeAppointment('ch7-elected-inactive', {
      chapter: '7',
      appointmentType: 'elected',
      status: 'inactive',
      courtName: 'Southern District of New York',
    });

    beforeEach(() => {
      window.sessionStorage.clear();
    });

    function isAppointmentExpanded(appointmentId: string): boolean {
      return !screen.getByTestId(`appointment-accordion-body-${appointmentId}`).closest('[hidden]');
    }

    test('renders Chapter 7 Elected via the accordion', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [ch7ElectedActive] });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch7ElectedActive.id}`),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByTestId(`appointment-accordion-body-${ch7ElectedActive.id}`),
      ).toBeInTheDocument();
      expect(getAppointmentCards()).toHaveLength(0);
    });

    test('an active Chapter 7 Elected appointment is collapsed by default', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [ch7ElectedActive] });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch7ElectedActive.id}`),
        ).toBeInTheDocument();
      });
      expect(isAppointmentExpanded(ch7ElectedActive.id)).toBe(false);
    });

    test('an inactive Chapter 7 Elected appointment is collapsed by default', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [ch7ElectedInactive] });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch7ElectedInactive.id}`),
        ).toBeInTheDocument();
      });
      expect(isAppointmentExpanded(ch7ElectedInactive.id)).toBe(false);
    });
  });
});
