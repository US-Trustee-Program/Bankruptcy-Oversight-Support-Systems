import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TrusteeAppointments from './TrusteeAppointments';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

describe('TrusteeAppointments', () => {
  const mockAppointments: TrusteeAppointment[] = [
    {
      id: 'appointment-001',
      documentType: 'TRUSTEE_APPOINTMENT',
      trusteeId: 'trustee-123',
      chapter: '7-panel',
      courtId: '081',
      divisionCode: '1',
      status: 'active',
      appointedDate: 'January 15, 2020',
      effectiveDate: '2020-01-15T00:00:00.000Z',
      createdOn: '2020-01-10T14:30:00.000Z',
      createdBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2020-01-10T14:30:00.000Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    },
    {
      id: 'appointment-002',
      documentType: 'TRUSTEE_APPOINTMENT',
      trusteeId: 'trustee-123',
      chapter: '11',
      courtId: '081',
      divisionCode: '2',
      status: 'active',
      appointedDate: '03/22/2019',
      effectiveDate: '2019-03-22T00:00:00.000Z',
      createdOn: '2019-03-15T10:00:00.000Z',
      createdBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2019-03-15T10:00:00.000Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('should display loading spinner while fetching appointments', () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves to keep loading state
        }),
    );

    render(<TrusteeAppointments trusteeId="trustee-123" />);

    expect(screen.getByText(/Loading appointments.../i)).toBeInTheDocument();
  });

  test('should display error alert when API call fails', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockRejectedValue(new Error('API Error'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<TrusteeAppointments trusteeId="trustee-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load trustee appointments/i)).toBeInTheDocument();
    });
  });

  test('should display info alert when no appointments are found', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: [] });

    render(<TrusteeAppointments trusteeId="trustee-123" />);

    await waitFor(() => {
      expect(screen.getByText(/No appointments found for this trustee./i)).toBeInTheDocument();
    });
  });

  test('should display appointments when API call succeeds', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: mockAppointments });

    render(<TrusteeAppointments trusteeId="trustee-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Court 081 - Chapter 7 - Panel/i)).toBeInTheDocument();
      expect(screen.getByText(/Court 081 - Chapter 11/i)).toBeInTheDocument();
    });
  });

  test('should call getTrusteeAppointments with correct trusteeId', async () => {
    const getTrusteeAppointmentsSpy = vi
      .spyOn(Api2, 'getTrusteeAppointments')
      .mockResolvedValue({ data: mockAppointments });

    render(<TrusteeAppointments trusteeId="trustee-123" />);

    await waitFor(() => {
      expect(getTrusteeAppointmentsSpy).toHaveBeenCalledWith('trustee-123');
      expect(getTrusteeAppointmentsSpy).toHaveBeenCalledTimes(1);
    });
  });

  test('should reload appointments when trusteeId changes', async () => {
    const getTrusteeAppointmentsSpy = vi
      .spyOn(Api2, 'getTrusteeAppointments')
      .mockResolvedValue({ data: mockAppointments });

    const { rerender } = render(<TrusteeAppointments trusteeId="trustee-123" />);

    await waitFor(() => {
      expect(getTrusteeAppointmentsSpy).toHaveBeenCalledWith('trustee-123');
    });

    rerender(<TrusteeAppointments trusteeId="trustee-456" />);

    await waitFor(() => {
      expect(getTrusteeAppointmentsSpy).toHaveBeenCalledWith('trustee-456');
      expect(getTrusteeAppointmentsSpy).toHaveBeenCalledTimes(2);
    });
  });

  test('should handle null data from API', async () => {
    // @ts-expect-error - Testing edge case where API returns null despite type contract
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: null });

    render(<TrusteeAppointments trusteeId="trustee-123" />);

    await waitFor(() => {
      expect(screen.getByText(/No appointments found for this trustee./i)).toBeInTheDocument();
    });
  });

  test('should handle undefined data from API', async () => {
    // @ts-expect-error - Testing edge case where API returns undefined despite type contract
    vi.spyOn(Api2, 'getTrusteeAppointments').mockResolvedValue({ data: undefined });

    render(<TrusteeAppointments trusteeId="trustee-123" />);

    await waitFor(() => {
      expect(screen.getByText(/No appointments found for this trustee./i)).toBeInTheDocument();
    });
  });
});
