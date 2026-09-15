import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
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
  const mockNavigate = vi.fn();

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
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  function renderBody(appointment: TrusteeAppointment = mockAppointment) {
    return render(
      <BrowserRouter>
        <Chapter11CaseByCaseAppointmentBody appointment={appointment} />
      </BrowserRouter>,
    );
  }

  test('renders the appointed date', () => {
    renderBody();

    expect(screen.getByText(/Appointed/i)).toBeInTheDocument();
    expect(screen.getByText('01/15/2020')).toBeInTheDocument();
  });

  test('renders the status effective date', () => {
    renderBody();

    expect(screen.getByText(/Status Effective/i)).toBeInTheDocument();
    expect(screen.getByText('06/01/2021')).toBeInTheDocument();
  });

  test('displays "Not Specified" for Unix epoch sentinel dates', () => {
    renderBody({
      ...mockAppointment,
      appointedDate: '1970-01-01T00:00:00.000Z',
      effectiveDate: '1970-01-01T00:00:00.000Z',
    });

    expect(screen.getAllByText('Not Specified').length).toBe(2);
  });

  test('renders an Edit link when user has TrusteeAdmin role', () => {
    renderBody();

    expect(screen.getByRole('button', { name: /edit trustee appointment/i })).toBeInTheDocument();
  });

  test('navigates to the edit page when Edit is clicked', async () => {
    const user = userEvent.setup();
    renderBody();

    await user.click(screen.getByRole('button', { name: /edit trustee appointment/i }));

    expect(mockNavigate).toHaveBeenCalledWith(
      `/trustees/${mockAppointment.trusteeId}/appointments/${mockAppointment.id}/edit`,
    );
  });

  test('does not render an Edit link when user lacks TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderBody();

    expect(
      screen.queryByRole('button', { name: /edit trustee appointment/i }),
    ).not.toBeInTheDocument();
  });
});
