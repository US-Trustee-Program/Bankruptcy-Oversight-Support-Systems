import { render, screen, waitFor } from '@testing-library/react';
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
  courtDivisionName: 'Manhattan',
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

const getAppointmentHeading = (card: Element) =>
  card.querySelector('.appointment-card-heading')?.textContent ?? '';

const parseAppointmentHeading = (heading: string) => {
  const stateMatch = heading.match(/District of ([A-Za-z ]+)/);
  const districtMatch = heading.match(/(Eastern|Southern|Northern|Central|Western) District/);
  const divisionMatch = heading.match(/\(([^)]+)\)/);
  const chapterMatch = heading.match(/Chapter (\d+)/);
  const typeMatch = heading.match(/ - ([^-]+)$/);

  return {
    state: stateMatch ? stateMatch[1].trim() : '',
    district: districtMatch ? districtMatch[1] : '',
    division: divisionMatch ? divisionMatch[1] : '',
    chapter: chapterMatch ? chapterMatch[1] : '',
    type: typeMatch ? typeMatch[1].trim() : '',
  };
};

const getParsedAppointments = () =>
  getAppointmentCards().map((card) => parseAppointmentHeading(getAppointmentHeading(card)));

const getAppointmentStates = () => getParsedAppointments().map((a) => a.state);

const getAppointmentDistricts = () => getParsedAppointments().map((a) => a.district);

const getAppointmentDivisions = () => getParsedAppointments().map((a) => a.division);

const getAppointmentChapters = () => getParsedAppointments().map((a) => a.chapter);

const getAppointmentTypes = () => getParsedAppointments().map((a) => a.type);

const getAppointmentInfo = () =>
  getParsedAppointments().map(({ district, division, chapter, type }) => ({
    district,
    division,
    chapter,
    type,
  }));

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
      chapter: '11',
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
        screen.getByText(/Southern District of New York \(Manhattan\): Chapter 7 - Panel/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Northern District of New York \(New York\): Chapter 11/i),
      ).toBeInTheDocument();
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

  test('should handle null data from API', async () => {
    // @ts-expect-error - Testing edge case where API returns null despite type contract
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: null });

    renderComponent('trustee-123');

    await waitFor(() => {
      expect(screen.getByText(EMPTY_APPOINTMENTS_MESSAGE)).toBeInTheDocument();
    });
  });

  test('should handle undefined data from API', async () => {
    // @ts-expect-error - Testing edge case where API returns undefined despite type contract
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: undefined });

    renderComponent('trustee-123');

    await waitFor(() => {
      expect(screen.getByText(EMPTY_APPOINTMENTS_MESSAGE)).toBeInTheDocument();
    });
  });

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

    test('should sort appointments by state first (derived from courtName)', async () => {
      const appointments: TrusteeAppointment[] = [
        makeAppointment('appointment-001', {
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
        }),
        makeAppointment('appointment-002', {
          chapter: '11',
          appointmentType: 'case-by-case',
          courtId: '082',
          courtDivisionName: 'Los Angeles',
          courtName: 'Central District of California',
        }),
        makeAppointment('appointment-003', {
          chapter: '13',
          appointmentType: 'standing',
          courtId: '083',
          courtDivisionName: 'Houston',
          courtName: 'Southern District of Texas',
        }),
      ];

      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: appointments });
      renderComponent('trustee-123');

      await waitFor(() => {
        expect(getAppointmentCards()).toHaveLength(3);
      });

      // Verify appointments are sorted by state alphabetically: California, New York, Texas
      expect(getAppointmentStates()).toEqual(['California', 'New York', 'Texas']);
    });

    test('should sort appointments by district name within each state', async () => {
      const appointments: TrusteeAppointment[] = [
        makeAppointment('appointment-001', {
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
        }),
        makeAppointment('appointment-002', {
          chapter: '11',
          appointmentType: 'case-by-case',
          courtId: '082',
          courtDivisionName: 'Brooklyn',
          courtName: 'Eastern District of New York',
        }),
        makeAppointment('appointment-003', {
          chapter: '13',
          appointmentType: 'standing',
          courtDivisionName: 'White Plains',
          courtName: 'Southern District of New York',
        }),
      ];

      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: appointments });
      renderComponent('trustee-123');

      await waitFor(() => {
        expect(getAppointmentCards()).toHaveLength(3);
      });

      // Verify that Eastern District appointments come before Southern District
      expect(getAppointmentDistricts()).toEqual(['Eastern', 'Southern', 'Southern']);
    });

    test('should sort appointments alphabetically by division (courtDivisionName) within each district', async () => {
      const appointments: TrusteeAppointment[] = [
        makeAppointment('appointment-001', {
          courtDivisionName: 'White Plains',
          courtName: 'Southern District of New York',
        }),
        makeAppointment('appointment-002', {
          chapter: '11',
          appointmentType: 'case-by-case',
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
        }),
        makeAppointment('appointment-003', {
          chapter: '13',
          appointmentType: 'standing',
          courtDivisionName: 'Albany',
          courtName: 'Southern District of New York',
        }),
      ];

      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: appointments });
      renderComponent('trustee-123');

      await waitFor(() => {
        expect(getAppointmentCards()).toHaveLength(3);
      });

      // Verify divisions are in alphabetical order: Albany, Manhattan, White Plains
      expect(getAppointmentDivisions()).toEqual(['Albany', 'Manhattan', 'White Plains']);
    });

    test('should sort appointments by chapter in ascending order when in the same district and division', async () => {
      const appointments: TrusteeAppointment[] = [
        makeAppointment('appointment-001', {
          chapter: '13',
          appointmentType: 'standing',
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
        }),
        makeAppointment('appointment-002', {
          chapter: '7',
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
        }),
        makeAppointment('appointment-003', {
          chapter: '11',
          appointmentType: 'case-by-case',
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
        }),
      ];

      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: appointments });
      renderComponent('trustee-123');

      await waitFor(() => {
        expect(getAppointmentCards()).toHaveLength(3);
      });

      // Verify chapters are in ascending order: 7, 11, 13
      expect(getAppointmentChapters()).toEqual(['7', '11', '13']);
    });

    test('should sort appointments alphabetically by appointment type when in the same district, division, and chapter', async () => {
      const appointments: TrusteeAppointment[] = [
        makeAppointment('appointment-001', {
          chapter: '7',
          appointmentType: 'panel',
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
        }),
        makeAppointment('appointment-002', {
          chapter: '7',
          appointmentType: 'off-panel',
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
        }),
        makeAppointment('appointment-003', {
          chapter: '7',
          appointmentType: 'elected',
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
        }),
      ];

      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: appointments });
      renderComponent('trustee-123');

      await waitFor(() => {
        expect(getAppointmentCards()).toHaveLength(3);
      });

      // Verify appointment types are in alphabetical order: Elected, Off Panel, Panel
      expect(getAppointmentTypes()).toEqual(['Elected', 'Off Panel', 'Panel']);
    });

    test('should apply all sorting rules together: state, then district, then division, then chapter, then appointment type', async () => {
      const appointments: TrusteeAppointment[] = [
        makeAppointment('appointment-001', {
          chapter: '13',
          appointmentType: 'standing',
          courtId: '082',
          courtDivisionName: 'Brooklyn',
          courtName: 'Eastern District of New York',
        }),
        makeAppointment('appointment-002', {
          chapter: '7',
          appointmentType: 'panel',
          courtDivisionName: 'White Plains',
          courtName: 'Southern District of New York',
        }),
        makeAppointment('appointment-003', {
          chapter: '7',
          appointmentType: 'off-panel',
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
        }),
        makeAppointment('appointment-004', {
          chapter: '7',
          appointmentType: 'elected',
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
        }),
        makeAppointment('appointment-005', {
          chapter: '11',
          appointmentType: 'case-by-case',
          courtId: '082',
          courtDivisionName: 'Brooklyn',
          courtName: 'Eastern District of New York',
        }),
      ];

      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: appointments });
      renderComponent('trustee-123');

      await waitFor(() => {
        expect(getAppointmentCards()).toHaveLength(5);
      });

      // Expected order (all same state "New York"):
      // 1. Eastern District - Brooklyn - Chapter 11 - Case by Case
      // 2. Eastern District - Brooklyn - Chapter 13 - Standing
      // 3. Southern District - Manhattan - Chapter 7 - Elected
      // 4. Southern District - Manhattan - Chapter 7 - Off Panel
      // 5. Southern District - White Plains - Chapter 7 - Panel
      expect(getAppointmentInfo()).toEqual([
        { district: 'Eastern', division: 'Brooklyn', chapter: '11', type: 'Case by Case' },
        { district: 'Eastern', division: 'Brooklyn', chapter: '13', type: 'Standing' },
        { district: 'Southern', division: 'Manhattan', chapter: '7', type: 'Elected' },
        { district: 'Southern', division: 'Manhattan', chapter: '7', type: 'Off Panel' },
        { district: 'Southern', division: 'White Plains', chapter: '7', type: 'Panel' },
      ]);
    });

    test('should handle appointments with missing courtName or courtDivisionName gracefully', async () => {
      const appointments: TrusteeAppointment[] = [
        makeAppointment('appointment-001', {
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
        }),
        makeAppointment('appointment-002', {
          chapter: '11',
          appointmentType: 'case-by-case',
          courtId: '999',
          courtDivisionName: undefined,
          courtName: undefined,
        }),
      ];

      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: appointments });
      renderComponent('trustee-123');

      await waitFor(() => {
        expect(getAppointmentCards()).toHaveLength(2);
      });

      const cards = getAppointmentCards();

      // The appointment with missing court info should appear first (empty string sorts first)
      expect(cards[0].textContent).toContain('Court not found');

      // The appointment with valid court info should appear second
      expect(cards[1].textContent).toContain('Southern District of New York');
      expect(cards[1].textContent).toContain('Manhattan');
    });
  });
});
