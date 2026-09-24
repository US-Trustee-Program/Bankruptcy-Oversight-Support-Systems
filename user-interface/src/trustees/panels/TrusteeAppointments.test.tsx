import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import TrusteeAppointments from './TrusteeAppointments';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import userEvent from '@testing-library/user-event';
import * as featureFlagsHook from '@/lib/hooks/UseFeatureFlags';
import { DISPLAY_CHPT13_STANDING_KEY_DATES } from '@/lib/hooks/UseFeatureFlags';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';

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

// Chapter 13 Standing is used as the "generic, still-flat AppointmentCard" fixture
// throughout this file because it has no dedicated accordion body (unlike Chapter 7
// Panel, Chapter 11 Case-by-Case/SubV, Chapter 7 Elected, and Chapter 12 Standing, each
// covered by their own accordion describe block below).
const baseAppointment: Omit<TrusteeAppointment, 'id'> = {
  trusteeId: 'trustee-123',
  chapter: '13',
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
    sessionStorage.clear();
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
    // Accordion bodies fetch key dates on mount. Stub it here so tests about
    // listing and routing don't fire unmocked requests that settle after they end.
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
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
    // One rendering per appointment returned by the API. Both Chapter 12 Standing
    // (CAMS-914) and Chapter 12 Case by Case (CAMS-913) now route to their own
    // accordion body, so neither mock appointment falls through to the legacy
    // flat AppointmentCard.
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: mockAppointments });

    renderComponent('trustee-123');

    await waitFor(() => {
      expect(
        screen.getByTestId(`appointment-accordion-header-${mockAppointments[0].id}`),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId(`appointment-accordion-header-${mockAppointments[1].id}`),
    ).toBeInTheDocument();
    expect(getAppointmentCards()).toHaveLength(0);
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
    // Detailed state/district/chapter/appointment-type ordering rules are unit-tested
    // directly against sortByCourtLocation in court-utils.test.ts; this only confirms
    // TrusteeAppointments actually renders appointments in that sorted order.
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

    // Default-collapsed rendering and toggle mechanics are generic AppointmentAccordion/
    // useAppointmentExpansion behavior, not specific to Chapter 11 Subchapter V -- already
    // covered by AppointmentAccordion.test.tsx and useAppointmentExpansion.test.ts.
  });

  describe('Chapter 13 Standing accordion default-closed behavior', () => {
    beforeEach(() => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT13_STANDING_KEY_DATES]: true,
      });
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
    });

    test('an active Chapter 13 Standing appointment defaults closed', async () => {
      const activeCh13: TrusteeAppointment = makeAppointment('ch13-active', {
        chapter: '13',
        appointmentType: 'standing',
        status: 'active',
        courtName: 'Southern District of New York',
      });
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [activeCh13] });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(screen.getByTestId(`accordion-button-${activeCh13.id}`)).toBeInTheDocument();
      });
      expect(screen.getByTestId('accordion-content-ch13-active')).not.toBeVisible();
    });

    test('a non-active Chapter 13 Standing appointment defaults closed', async () => {
      const inactiveCh13: TrusteeAppointment = makeAppointment('ch13-inactive', {
        chapter: '13',
        appointmentType: 'standing',
        status: 'inactive',
        courtName: 'Southern District of New York',
      });
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [inactiveCh13] });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(screen.getByTestId(`accordion-button-${inactiveCh13.id}`)).toBeInTheDocument();
      });
      expect(screen.getByTestId('accordion-content-ch13-inactive')).not.toBeVisible();
    });

    test('opening one Chapter 13 Standing accordion collapses another open one', async () => {
      const appt1 = makeAppointment('ch13-001', {
        chapter: '13',
        appointmentType: 'standing',
        status: 'active',
        courtName: 'Southern District of New York',
      });
      const appt2 = makeAppointment('ch13-002', {
        chapter: '13',
        appointmentType: 'standing',
        status: 'active',
        courtId: '082',
        courtName: 'Eastern District of New York',
      });
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [appt1, appt2] });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(screen.getByTestId('accordion-button-ch13-002')).toBeInTheDocument();
      });
      expect(screen.getByTestId('accordion-content-ch13-001')).not.toBeVisible();
      expect(screen.getByTestId('accordion-content-ch13-002')).not.toBeVisible();

      fireEvent.click(screen.getByTestId('accordion-button-ch13-002'));
      expect(screen.getByTestId('accordion-content-ch13-002')).toBeVisible();

      fireEvent.click(screen.getByTestId('accordion-button-ch13-001'));

      expect(screen.getByTestId('accordion-content-ch13-001')).toBeVisible();
      expect(screen.getByTestId('accordion-content-ch13-002')).not.toBeVisible();
    });

    test('does not persist the expanded appointment across a remount', async () => {
      const appt1 = makeAppointment('ch13-persist-001', {
        chapter: '13',
        appointmentType: 'standing',
        status: 'inactive',
        courtName: 'Southern District of New York',
      });
      const appt2 = makeAppointment('ch13-persist-002', {
        chapter: '13',
        appointmentType: 'standing',
        status: 'inactive',
        courtId: '082',
        courtName: 'Eastern District of New York',
      });
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({
        data: [appt1, appt2],
      });

      const { unmount } = renderComponent('trustee-123');

      await waitFor(() => {
        expect(screen.getByTestId('accordion-button-ch13-persist-001')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('accordion-button-ch13-persist-002'));
      expect(screen.getByTestId('accordion-content-ch13-persist-002')).toBeVisible();

      unmount();
      renderComponent('trustee-123');

      await waitFor(() => {
        expect(screen.getByTestId('accordion-button-ch13-persist-001')).toBeInTheDocument();
      });
      expect(screen.getByTestId('accordion-content-ch13-persist-001')).not.toBeVisible();
      expect(screen.getByTestId('accordion-content-ch13-persist-002')).not.toBeVisible();
    });

    test('preserves sort order interleaving Chapter 13 Standing with other appointment types', async () => {
      const appointments: TrusteeAppointment[] = [
        makeAppointment('appointment-001', {
          chapter: '13',
          appointmentType: 'standing',
          courtId: '082',
          courtName: 'Eastern District of New York',
        }),
        makeAppointment('appointment-002', {
          chapter: '12',
          appointmentType: 'standing',
          courtName: 'Southern District of New York',
        }),
        makeAppointment('appointment-005', {
          chapter: '12',
          appointmentType: 'case-by-case',
          courtId: '082',
          courtName: 'Eastern District of New York',
        }),
      ];
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: appointments });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          document.querySelectorAll(
            '[data-testid="accordion-group"] > .appointment-card-container, [data-testid="accordion-group"] > .appointment-accordion',
          ),
        ).toHaveLength(3);
      });

      // Chapter 12/13 Case by Case renders via the generic AppointmentAccordion (no
      // `.appointment-card-container`), while Chapter 13 Standing and the still-flat
      // Chapter 12 Standing both use `.appointment-card-container`, so combine both
      // markups to verify interleaved DOM order directly.
      const items = document.querySelectorAll(
        '[data-testid="accordion-group"] > .appointment-card-container, [data-testid="accordion-group"] > .appointment-accordion',
      );
      const headingTexts = Array.from(items).map(
        (item) =>
          item.querySelector('.appointment-card-heading')?.textContent ??
          item.querySelector('.chapter13-standing-accordion-header')?.textContent ??
          item.querySelector('.appointment-accordion-header')?.textContent ??
          '',
      );
      expect(headingTexts[0]).toContain('Eastern District of New York');
      expect(headingTexts[0]).toContain('Chapter 12');
      expect(headingTexts[1]).toContain('Eastern District of New York');
      expect(headingTexts[1]).toContain('Chapter 13');
      expect(headingTexts[2]).toContain('Southern District of New York');
      expect(headingTexts[2]).toContain('Chapter 12');
    });
  });

  describe('Chapter 12 and 13 Case by Case accordion', () => {
    const ch12CaseByCase = makeAppointment('ch12-cbc-active', {
      chapter: '12',
      appointmentType: 'case-by-case',
      status: 'active',
      courtName: 'Southern District of New York',
    });
    const ch13CaseByCase = makeAppointment('ch13-cbc-inactive', {
      chapter: '13',
      appointmentType: 'case-by-case',
      status: 'inactive',
      courtName: 'Southern District of New York',
    });

    test.each([
      ['Chapter 12', ch12CaseByCase],
      ['Chapter 13', ch13CaseByCase],
    ])('renders a %s Case by Case appointment via the accordion', async (_label, appointment) => {
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [appointment] });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${appointment.id}`),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByTestId(`appointment-accordion-body-${appointment.id}`),
      ).toBeInTheDocument();
      expect(getAppointmentCards()).toHaveLength(0);
    });
  });

  describe('Chapter 12 Standing accordion', () => {
    const ch12StandingActive = makeAppointment('ch12-standing-active', {
      chapter: '12',
      appointmentType: 'standing',
      status: 'active',
      courtName: 'Southern District of New York',
    });
    beforeEach(() => {
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
    });

    test('renders Chapter 12 Standing via the accordion', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [ch12StandingActive] });

      renderComponent('trustee-123');

      await waitFor(() => {
        expect(
          screen.getByTestId(`appointment-accordion-header-${ch12StandingActive.id}`),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByTestId(`appointment-accordion-body-${ch12StandingActive.id}`),
      ).toBeInTheDocument();
      expect(getAppointmentCards()).toHaveLength(0);
    });

    // Default-collapsed rendering and toggle mechanics are generic AppointmentAccordion/
    // useAppointmentExpansion behavior, not specific to Chapter 12 Standing -- already
    // covered by AppointmentAccordion.test.tsx and useAppointmentExpansion.test.ts.
  });
});
