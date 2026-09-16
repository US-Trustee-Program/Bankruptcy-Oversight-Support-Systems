import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Chapter11CaseByCaseAppointmentBody from './Chapter11CaseByCaseAppointmentBody';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
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

describe('Chapter11CaseByCaseAppointmentBody', () => {
  const mockAppointment: TrusteeAppointment = {
    id: 'appointment-001',
    trusteeId: 'trustee-123',
    chapter: '11',
    appointmentType: 'case-by-case',
    courtDivisionName: 'Manhattan',
    courtId: '0208',
    courtName: 'Southern District of New York',
    status: 'inactive',
    appointedDate: '2020-01-15T00:00:00.000Z',
    effectiveDate: '2021-06-01T00:00:00.000Z',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseNavigate.mockReturnValue(vi.fn());
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  test('renders AppointmentBasicFields content for the appointment', () => {
    render(
      <BrowserRouter>
        <Chapter11CaseByCaseAppointmentBody appointment={mockAppointment} />
      </BrowserRouter>,
    );

    expect(screen.getByTestId('appointment-body-appointed-date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit trustee appointment/i })).toBeInTheDocument();
  });
});
