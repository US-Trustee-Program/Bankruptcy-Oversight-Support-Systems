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

describe('TrusteeAppointments', () => {
  const EMPTY_APPOINTMENTS_MESSAGE = /There are no appointments for this Trustee./i;
  const mockNavigate = vi.fn();

  const mockAppointments: TrusteeAppointment[] = [
    {
      id: 'appointment-001',
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
    },
    {
      id: 'appointment-002',
      trusteeId: 'trustee-123',
      chapter: '11',
      appointmentType: 'case-by-case',
      courtId: '081',
      courtDivisionName: 'New York',
      courtName: 'Northern District of New York',
      divisionCode: '2',
      status: 'active',
      appointedDate: '2019-03-22T00:00:00.000Z',
      effectiveDate: '2019-03-22T00:00:00.000Z',
      createdOn: '2019-03-15T10:00:00.000Z',
      createdBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2019-03-15T10:00:00.000Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    },
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
    test('should group appointments by district (courtName)', async () => {
      const appointments: TrusteeAppointment[] = [
        {
          id: 'appointment-001',
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
        },
        {
          id: 'appointment-002',
          trusteeId: 'trustee-123',
          chapter: '11',
          appointmentType: 'case-by-case',
          courtId: '082',
          courtDivisionName: 'Brooklyn',
          courtName: 'Eastern District of New York',
          divisionCode: '2',
          status: 'active',
          appointedDate: '2019-03-22T00:00:00.000Z',
          effectiveDate: '2019-03-22T00:00:00.000Z',
          createdOn: '2019-03-15T10:00:00.000Z',
          createdBy: SYSTEM_USER_REFERENCE,
          updatedOn: '2019-03-15T10:00:00.000Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        },
        {
          id: 'appointment-003',
          trusteeId: 'trustee-123',
          chapter: '13',
          appointmentType: 'standing',
          courtId: '081',
          courtDivisionName: 'White Plains',
          courtName: 'Southern District of New York',
          divisionCode: '3',
          status: 'active',
          appointedDate: '2021-06-10T00:00:00.000Z',
          effectiveDate: '2021-06-10T00:00:00.000Z',
          createdOn: '2021-06-05T10:00:00.000Z',
          createdBy: SYSTEM_USER_REFERENCE,
          updatedOn: '2021-06-05T10:00:00.000Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        },
      ];

      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: appointments });

      renderComponent('trustee-123');

      await waitFor(() => {
        const appointmentCards = document.querySelectorAll('.appointment-card-container');
        expect(appointmentCards).toHaveLength(3);
      });

      // Get all appointment cards to verify grouping
      const appointmentCards = document.querySelectorAll('.appointment-card-container');
      const appointmentInfo = Array.from(appointmentCards).map((card) => {
        const heading = card.querySelector('.appointment-card-heading');
        const districtMatch = heading?.textContent?.match(/(Eastern|Southern) District/);
        return districtMatch ? districtMatch[1] : '';
      });

      // Verify that Eastern District appointments come before Southern District
      // (alphabetically grouped)
      expect(appointmentInfo[0]).toBe('Eastern');
      expect(appointmentInfo[1]).toBe('Southern');
      expect(appointmentInfo[2]).toBe('Southern');
    });

    test('should sort appointments alphabetically by city (courtDivisionName) within each district group', async () => {
      const appointments: TrusteeAppointment[] = [
        {
          id: 'appointment-001',
          trusteeId: 'trustee-123',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '081',
          courtDivisionName: 'White Plains',
          courtName: 'Southern District of New York',
          divisionCode: '1',
          status: 'active',
          appointedDate: '2020-01-15T00:00:00.000Z',
          effectiveDate: '2020-01-15T00:00:00.000Z',
          createdOn: '2020-01-10T14:30:00.000Z',
          createdBy: SYSTEM_USER_REFERENCE,
          updatedOn: '2020-01-10T14:30:00.000Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        },
        {
          id: 'appointment-002',
          trusteeId: 'trustee-123',
          chapter: '11',
          appointmentType: 'case-by-case',
          courtId: '081',
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
          divisionCode: '2',
          status: 'active',
          appointedDate: '2019-03-22T00:00:00.000Z',
          effectiveDate: '2019-03-22T00:00:00.000Z',
          createdOn: '2019-03-15T10:00:00.000Z',
          createdBy: SYSTEM_USER_REFERENCE,
          updatedOn: '2019-03-15T10:00:00.000Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        },
        {
          id: 'appointment-003',
          trusteeId: 'trustee-123',
          chapter: '13',
          appointmentType: 'standing',
          courtId: '081',
          courtDivisionName: 'Albany',
          courtName: 'Southern District of New York',
          divisionCode: '3',
          status: 'active',
          appointedDate: '2021-06-10T00:00:00.000Z',
          effectiveDate: '2021-06-10T00:00:00.000Z',
          createdOn: '2021-06-05T10:00:00.000Z',
          createdBy: SYSTEM_USER_REFERENCE,
          updatedOn: '2021-06-05T10:00:00.000Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        },
      ];

      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: appointments });

      renderComponent('trustee-123');

      await waitFor(() => {
        const appointmentCards = document.querySelectorAll('.appointment-card-container');
        expect(appointmentCards).toHaveLength(3);
      });

      // Get all appointment cards in order
      const appointmentCards = document.querySelectorAll('.appointment-card-container');
      const cities = Array.from(appointmentCards).map((card) => {
        const heading = card.querySelector('.appointment-card-heading');
        const match = heading?.textContent?.match(/\(([^)]+)\)/);
        return match ? match[1] : '';
      });

      // Verify cities are in alphabetical order: Albany, Manhattan, White Plains
      expect(cities).toEqual(['Albany', 'Manhattan', 'White Plains']);
    });

    test('should sort appointments by chapter in ascending order when in the same district and city', async () => {
      const appointments: TrusteeAppointment[] = [
        {
          id: 'appointment-001',
          trusteeId: 'trustee-123',
          chapter: '13',
          appointmentType: 'standing',
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
        },
        {
          id: 'appointment-002',
          trusteeId: 'trustee-123',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '081',
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
          divisionCode: '2',
          status: 'active',
          appointedDate: '2019-03-22T00:00:00.000Z',
          effectiveDate: '2019-03-22T00:00:00.000Z',
          createdOn: '2019-03-15T10:00:00.000Z',
          createdBy: SYSTEM_USER_REFERENCE,
          updatedOn: '2019-03-15T10:00:00.000Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        },
        {
          id: 'appointment-003',
          trusteeId: 'trustee-123',
          chapter: '11',
          appointmentType: 'case-by-case',
          courtId: '081',
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
          divisionCode: '3',
          status: 'active',
          appointedDate: '2021-06-10T00:00:00.000Z',
          effectiveDate: '2021-06-10T00:00:00.000Z',
          createdOn: '2021-06-05T10:00:00.000Z',
          createdBy: SYSTEM_USER_REFERENCE,
          updatedOn: '2021-06-05T10:00:00.000Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        },
      ];

      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: appointments });

      renderComponent('trustee-123');

      await waitFor(() => {
        const appointmentCards = document.querySelectorAll('.appointment-card-container');
        expect(appointmentCards).toHaveLength(3);
      });

      // Get all appointment cards in order
      const appointmentCards = document.querySelectorAll('.appointment-card-container');
      const chapters = Array.from(appointmentCards).map((card) => {
        const heading = card.querySelector('.appointment-card-heading');
        const match = heading?.textContent?.match(/Chapter (\d+)/);
        return match ? match[1] : '';
      });

      // Verify chapters are in ascending order: 7, 11, 13
      expect(chapters).toEqual(['7', '11', '13']);
    });

    test('should apply all sorting rules together: district grouping, then city alphabetically, then chapter ascending', async () => {
      const appointments: TrusteeAppointment[] = [
        {
          id: 'appointment-001',
          trusteeId: 'trustee-123',
          chapter: '13',
          appointmentType: 'standing',
          courtId: '082',
          courtDivisionName: 'Brooklyn',
          courtName: 'Eastern District of New York',
          divisionCode: '1',
          status: 'active',
          appointedDate: '2020-01-15T00:00:00.000Z',
          effectiveDate: '2020-01-15T00:00:00.000Z',
          createdOn: '2020-01-10T14:30:00.000Z',
          createdBy: SYSTEM_USER_REFERENCE,
          updatedOn: '2020-01-10T14:30:00.000Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        },
        {
          id: 'appointment-002',
          trusteeId: 'trustee-123',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '081',
          courtDivisionName: 'White Plains',
          courtName: 'Southern District of New York',
          divisionCode: '2',
          status: 'active',
          appointedDate: '2019-03-22T00:00:00.000Z',
          effectiveDate: '2019-03-22T00:00:00.000Z',
          createdOn: '2019-03-15T10:00:00.000Z',
          createdBy: SYSTEM_USER_REFERENCE,
          updatedOn: '2019-03-15T10:00:00.000Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        },
        {
          id: 'appointment-003',
          trusteeId: 'trustee-123',
          chapter: '11',
          appointmentType: 'case-by-case',
          courtId: '081',
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
          divisionCode: '3',
          status: 'active',
          appointedDate: '2021-06-10T00:00:00.000Z',
          effectiveDate: '2021-06-10T00:00:00.000Z',
          createdOn: '2021-06-05T10:00:00.000Z',
          createdBy: SYSTEM_USER_REFERENCE,
          updatedOn: '2021-06-05T10:00:00.000Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        },
        {
          id: 'appointment-004',
          trusteeId: 'trustee-123',
          chapter: '7',
          appointmentType: 'panel',
          courtId: '081',
          courtDivisionName: 'Manhattan',
          courtName: 'Southern District of New York',
          divisionCode: '4',
          status: 'active',
          appointedDate: '2018-11-01T00:00:00.000Z',
          effectiveDate: '2018-11-01T00:00:00.000Z',
          createdOn: '2018-10-25T10:00:00.000Z',
          createdBy: SYSTEM_USER_REFERENCE,
          updatedOn: '2018-10-25T10:00:00.000Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        },
        {
          id: 'appointment-005',
          trusteeId: 'trustee-123',
          chapter: '11',
          appointmentType: 'case-by-case',
          courtId: '082',
          courtDivisionName: 'Brooklyn',
          courtName: 'Eastern District of New York',
          divisionCode: '5',
          status: 'active',
          appointedDate: '2022-02-14T00:00:00.000Z',
          effectiveDate: '2022-02-14T00:00:00.000Z',
          createdOn: '2022-02-10T10:00:00.000Z',
          createdBy: SYSTEM_USER_REFERENCE,
          updatedOn: '2022-02-10T10:00:00.000Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        },
      ];

      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: appointments });

      renderComponent('trustee-123');

      await waitFor(() => {
        const appointmentCards = document.querySelectorAll('.appointment-card-container');
        expect(appointmentCards).toHaveLength(5);
      });

      // Get all appointment cards in order
      const appointmentCards = document.querySelectorAll('.appointment-card-container');
      const appointmentInfo = Array.from(appointmentCards).map((card) => {
        const heading = card.querySelector('.appointment-card-heading');
        const districtMatch = heading?.textContent?.match(/(Eastern|Southern) District/);
        const cityMatch = heading?.textContent?.match(/\(([^)]+)\)/);
        const chapterMatch = heading?.textContent?.match(/Chapter (\d+)/);
        return {
          district: districtMatch ? districtMatch[1] : '',
          city: cityMatch ? cityMatch[1] : '',
          chapter: chapterMatch ? chapterMatch[1] : '',
        };
      });

      // Expected order:
      // 1. Eastern District - Brooklyn - Chapter 11
      // 2. Eastern District - Brooklyn - Chapter 13
      // 3. Southern District - Manhattan - Chapter 7
      // 4. Southern District - Manhattan - Chapter 11
      // 5. Southern District - White Plains - Chapter 7
      expect(appointmentInfo).toEqual([
        { district: 'Eastern', city: 'Brooklyn', chapter: '11' },
        { district: 'Eastern', city: 'Brooklyn', chapter: '13' },
        { district: 'Southern', city: 'Manhattan', chapter: '7' },
        { district: 'Southern', city: 'Manhattan', chapter: '11' },
        { district: 'Southern', city: 'White Plains', chapter: '7' },
      ]);
    });

    test('should handle appointments with missing courtName or courtDivisionName gracefully', async () => {
      const appointments: TrusteeAppointment[] = [
        {
          id: 'appointment-001',
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
        },
        {
          id: 'appointment-002',
          trusteeId: 'trustee-123',
          chapter: '11',
          appointmentType: 'case-by-case',
          courtId: '999',
          divisionCode: '2',
          status: 'active',
          appointedDate: '2019-03-22T00:00:00.000Z',
          effectiveDate: '2019-03-22T00:00:00.000Z',
          createdOn: '2019-03-15T10:00:00.000Z',
          createdBy: SYSTEM_USER_REFERENCE,
          updatedOn: '2019-03-15T10:00:00.000Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        },
      ];

      vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: appointments });

      renderComponent('trustee-123');

      await waitFor(() => {
        const appointmentCards = document.querySelectorAll('.appointment-card-container');
        expect(appointmentCards).toHaveLength(2);
      });

      // Verify both appointments are rendered
      const appointmentCards = document.querySelectorAll('.appointment-card-container');
      expect(appointmentCards).toHaveLength(2);

      // The appointment with missing court info should appear first (empty string sorts first)
      const firstCard = appointmentCards[0];
      expect(firstCard.textContent).toContain('Court not found');

      // The appointment with valid court info should appear second
      const secondCard = appointmentCards[1];
      expect(secondCard.textContent).toContain('Southern District of New York');
      expect(secondCard.textContent).toContain('Manhattan');
    });
  });
});
