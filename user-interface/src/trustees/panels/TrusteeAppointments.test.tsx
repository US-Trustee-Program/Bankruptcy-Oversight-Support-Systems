import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import TrusteeAppointments from './TrusteeAppointments';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import userEvent from '@testing-library/user-event';

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

// Chapter 12 Standing is used as the "generic, still-flat AppointmentCard" fixture
// throughout this file because it has no dedicated accordion body (unlike Chapter 7
// Panel, which is covered by its own "Chapter 7 Panel accordion" describe block below).
const baseAppointment: Omit<TrusteeAppointment, 'id'> = {
  trusteeId: 'trustee-123',
  chapter: '12',
  appointmentType: 'standing',
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
      chapter: '12',
      appointmentType: 'standing',
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
    // The exact heading text format (district/division/chapter/type) is AppointmentCard's
    // own contract, covered by AppointmentCard.test.tsx -- this only confirms the screen
    // renders one card per appointment returned by the API.
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: mockAppointments });

    renderComponent('trustee-123');

    await waitFor(() => {
      expect(getAppointmentCards()).toHaveLength(2);
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
    test('renders appointments sorted by court location', async () => {
      // No `state` is set on either appointment, so sortByCourtLocation falls
      // through to comparing courtName alphabetically: "Eastern" sorts before
      // "Southern" regardless of API return order.
      const southern = makeAppointment('appointment-001', {
        courtName: 'Southern District of New York',
      });
      const eastern = makeAppointment('appointment-002', {
        courtName: 'Eastern District of New York',
      });

      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [southern, eastern] });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(getAppointmentCards()).toHaveLength(2);
      });

      const cards = getAppointmentCards();
      expect(cards[0]).toHaveAttribute('data-testid', `appointment-card-${eastern.id}`);
      expect(cards[1]).toHaveAttribute('data-testid', `appointment-card-${southern.id}`);
    });
  });

  describe('Chapter 11 Case by Case accordion', () => {
    const ch11Active = makeAppointment('ch11-active', {
      chapter: '11',
      appointmentType: 'case-by-case',
      status: 'active',
      courtName: 'Southern District of New York',
    });
    const otherType = makeAppointment('other-type', {
      status: 'active',
      courtName: 'Southern District of New York',
    });

    beforeEach(() => {
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
    });

    test('renders Chapter 11 Case by Case appointments via the accordion and other types via AppointmentCard', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({
        data: [ch11Active, otherType],
      });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch11Active.id}`),
        ).toBeInTheDocument();
      });
      expect(getAppointmentCards()).toHaveLength(1);
    });

    // Default-collapsed rendering and toggle mechanics are generic AppointmentAccordion/
    // useAppointmentExpansion behavior, not specific to Chapter 11 -- already covered by
    // AppointmentAccordion.test.tsx and useAppointmentExpansion.test.ts.
  });

  describe('Chapter 7 Elected accordion', () => {
    const ch7ElectedActive = makeAppointment('ch7-elected-active', {
      chapter: '7',
      appointmentType: 'elected',
      status: 'active',
      courtName: 'Southern District of New York',
    });
    beforeEach(() => {
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
    });

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

    // Default-collapsed rendering and toggle mechanics are generic AppointmentAccordion/
    // useAppointmentExpansion behavior, not specific to Chapter 7 Elected -- already covered
    // by AppointmentAccordion.test.tsx and useAppointmentExpansion.test.ts.
  });

  describe('Chapter 7 Panel accordion', () => {
    const ch7PanelActive = makeAppointment('ch7-panel-active', {
      chapter: '7',
      appointmentType: 'panel',
      status: 'active',
      courtName: 'Southern District of New York',
    });
    beforeEach(() => {
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
    });

    test('renders Chapter 7 Panel via the accordion', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [ch7PanelActive] });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch7PanelActive.id}`),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByTestId(`appointment-accordion-body-${ch7PanelActive.id}`),
      ).toBeInTheDocument();
      expect(getAppointmentCards()).toHaveLength(0);
    });

    // Default-collapsed rendering and toggle mechanics are generic AppointmentAccordion/
    // useAppointmentExpansion behavior, not specific to Chapter 7 Panel -- already covered
    // by AppointmentAccordion.test.tsx and useAppointmentExpansion.test.ts.
  });

  describe('Chapter 11 Subchapter V accordion', () => {
    const ch11SubVPoolActive = makeAppointment('ch11-subv-pool-active', {
      chapter: '11-subchapter-v',
      appointmentType: 'pool',
      status: 'active',
      courtName: 'Southern District of New York',
    });
    const ch11SubVOutOfPoolResigned = makeAppointment('ch11-subv-outofpool-resigned', {
      chapter: '11-subchapter-v',
      appointmentType: 'out-of-pool',
      status: 'resigned',
      courtName: 'Southern District of New York',
    });

    beforeEach(() => {
      window.sessionStorage.clear();
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
    });

    test('renders Chapter 11 Subchapter V Pool via the accordion', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [ch11SubVPoolActive] });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch11SubVPoolActive.id}`),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByTestId(`appointment-accordion-body-${ch11SubVPoolActive.id}`),
      ).toBeInTheDocument();
      expect(getAppointmentCards()).toHaveLength(0);
    });

    test('renders Chapter 11 Subchapter V Out of Pool via the accordion', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({
        data: [ch11SubVOutOfPoolResigned],
      });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch11SubVOutOfPoolResigned.id}`),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByTestId(`appointment-accordion-body-${ch11SubVOutOfPoolResigned.id}`),
      ).toBeInTheDocument();
      expect(getAppointmentCards()).toHaveLength(0);
    });

    test('a Chapter 11 Subchapter V Pool appointment is collapsed by default', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [ch11SubVPoolActive] });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch11SubVPoolActive.id}`),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByTestId(`appointment-accordion-body-${ch11SubVPoolActive.id}`),
      ).not.toBeVisible();
    });

    test('a Chapter 11 Subchapter V Out of Pool appointment is collapsed by default', async () => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({
        data: [ch11SubVOutOfPoolResigned],
      });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch11SubVOutOfPoolResigned.id}`),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByTestId(`appointment-accordion-body-${ch11SubVOutOfPoolResigned.id}`),
      ).not.toBeVisible();
    });
  });
});
