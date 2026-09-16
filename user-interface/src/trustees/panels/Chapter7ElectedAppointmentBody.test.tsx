import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Chapter7ElectedAppointmentBody from './Chapter7ElectedAppointmentBody';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { CamsRole } from '@common/cams/roles';
import TestingUtilities from '@/lib/testing/testing-utilities';

const mockUseNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: mockUseNavigate,
  };
});

describe('Chapter7ElectedAppointmentBody', () => {
  const mockAppointment: TrusteeAppointment = {
    id: 'appointment-002',
    trusteeId: 'trustee-456',
    chapter: '7',
    appointmentType: 'elected',
    courtDivisionName: 'Manhattan',
    courtId: '0208',
    courtName: 'Southern District of New York',
    status: 'active',
    appointedDate: '2020-01-15T00:00:00.000Z',
    effectiveDate: '2021-06-01T00:00:00.000Z',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  const keyDates: TrusteeUpcomingKeyDates = {
    id: 'key-dates-001',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-456',
    appointmentId: 'appointment-002',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    bondIssuedDate: '2023-06-01',
    bondRenewalDate: '2026-06-01',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseNavigate.mockReturnValue(vi.fn());
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  function renderBody(appointment: TrusteeAppointment = mockAppointment) {
    return render(
      <BrowserRouter>
        <Chapter7ElectedAppointmentBody appointment={appointment} />
      </BrowserRouter>,
    );
  }

  test('renders AppointmentBasicFields content for the appointment', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    expect(screen.getByTestId('appointment-body-appointed-date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit trustee appointment/i })).toBeInTheDocument();
  });

  test('fetches and renders the Bond key dates card for this appointment', async () => {
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('bond-key-dates-card')).toBeInTheDocument();
    });
    expect(getSpy).toHaveBeenCalledWith('trustee-456', 'appointment-002');
    expect(screen.getByTestId('bond-renewal-date')).toHaveTextContent('06/01/2026');
    expect(screen.getByTestId('bond-issued-date')).toHaveTextContent('06/01/2023');
  });

  test('shows the Bond card in a "no date added" state when no key dates document exists', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('bond-key-dates-card')).toBeInTheDocument();
    });
    expect(screen.getAllByText('No date added')).toHaveLength(2);
  });
});
