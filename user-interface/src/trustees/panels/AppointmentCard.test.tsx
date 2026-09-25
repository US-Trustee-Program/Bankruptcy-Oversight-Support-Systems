import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import AppointmentCard, { AppointmentCardProps } from './AppointmentCard';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import userEvent from '@testing-library/user-event';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';

const mockUseNavigate = vi.hoisted(() => vi.fn());
const mockUseCourts = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: mockUseNavigate,
  };
});

vi.mock('@/lib/hooks/UseCourts', () => ({
  default: mockUseCourts,
}));

describe('AppointmentCard', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseCourts.mockReturnValue({ courts: [], loading: false, error: null });
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  const mockAppointment: TrusteeAppointment = {
    id: 'appointment-001',
    trusteeId: 'trustee-123',
    chapter: '7',
    appointmentType: 'panel',
    courtDivisionName: 'Manhattan',
    courtId: '0208',
    courtName: 'Southern District of New York',
    divisionCode: '081',
    status: 'active',
    appointedDate: '2020-01-15T00:00:00.000Z',
    effectiveDate: '2020-01-15T00:00:00.000Z',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  function renderWithProps(props?: AppointmentCardProps) {
    const defaultProps: AppointmentCardProps = {
      appointment: props?.appointment || mockAppointment,
    };

    return render(
      <BrowserRouter>
        <AppointmentCard {...defaultProps} />
      </BrowserRouter>,
    );
  }

  test('should render appointment card with court name in heading when available', () => {
    renderWithProps();

    expect(
      screen.getByText(/Southern District of New York: Chapter 7 - Panel/i),
    ).toBeInTheDocument();
  });

  test('should display appointment details correctly', () => {
    renderWithProps({
      appointment: {
        ...mockAppointment,
        courtName: 'Eastern District of New York',
        courtDivisionName: 'Brooklyn',
      },
    });

    expect(screen.getByText(/District:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Eastern District of New York/i, { selector: 'li' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Chapter:/i)).toBeInTheDocument();
    expect(screen.getByText(/^7$/, { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText(/Type:/i)).toBeInTheDocument();
    expect(screen.getByText(/Panel/i, { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText(/Appointed:/i)).toBeInTheDocument();
    expect(screen.getByText(/Status:/i)).toBeInTheDocument();
    expect(screen.getByText(/^Active$/, { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText(/Status Effective:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/01\/15\/2020/).length).toBe(2);
  });

  test.each([
    ['11', 'panel', /Chapter 11/i],
    ['13', 'panel', /Chapter 13/i],
    ['11-subchapter-v', 'panel', /Chapter 11 Subchapter V/i],
    ['7', 'off-panel', /Chapter 7 - Off Panel/i],
  ] as const)('should format chapter %s / %s correctly', (chapter, appointmentType, expected) => {
    renderWithProps({ appointment: { ...mockAppointment, chapter, appointmentType } });

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  test('should display inactive status correctly', () => {
    const inactiveAppointment: TrusteeAppointment = {
      ...mockAppointment,
      status: 'inactive',
      effectiveDate: '2018-06-01T00:00:00.000Z',
    };

    renderWithProps({ appointment: inactiveAppointment });

    expect(screen.getByText(/Status:/i)).toBeInTheDocument();
    expect(screen.getByText(/^Inactive$/i, { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText(/Status Effective:/i)).toBeInTheDocument();
    expect(screen.getByText(/06\/01\/2018/)).toBeInTheDocument();
  });

  test.each([
    ['voluntarily-suspended', 'Voluntarily Suspended'],
    ['involuntarily-suspended', 'Involuntarily Suspended'],
    ['terminated', 'Terminated'],
  ] as const)('should display %s status correctly', (status, expectedLabel) => {
    renderWithProps({ appointment: { ...mockAppointment, status } });

    expect(
      screen.getByText(new RegExp(`^${expectedLabel}$`), { selector: 'li' }),
    ).toBeInTheDocument();
  });

  test('should display appointedDate with standardized mm/dd/yyyy formatting', () => {
    const appointmentWithDate: TrusteeAppointment = {
      ...mockAppointment,
      appointedDate: '2025-12-01T00:00:00.000Z',
    };

    renderWithProps({ appointment: appointmentWithDate });

    expect(screen.getByText('12/01/2025')).toBeInTheDocument();
  });

  test('should display "Not Specified" for Unix epoch sentinel dates', () => {
    const appointmentWithSentinelDates: TrusteeAppointment = {
      ...mockAppointment,
      appointedDate: '1970-01-01T00:00:00.000Z',
      effectiveDate: '1970-01-01T00:00:00.000Z',
    };

    renderWithProps({ appointment: appointmentWithSentinelDates });

    expect(screen.getAllByText('Not Specified').length).toBe(2);
  });

  test('should display court ID when courtName is missing', () => {
    const appointmentWithoutCourtName: TrusteeAppointment = {
      ...mockAppointment,
      courtName: undefined,
      courtDivisionName: 'Manhattan',
      courtId: '0208',
    };

    renderWithProps({ appointment: appointmentWithoutCourtName });

    expect(screen.getByText(/Court 0208: Chapter 7 - Panel/i)).toBeInTheDocument();
  });

  test('should display court name when courtDivisionName is missing', () => {
    const appointmentWithoutDivisionName: TrusteeAppointment = {
      ...mockAppointment,
      courtDivisionName: undefined,
    };

    renderWithProps({ appointment: appointmentWithoutDivisionName });

    expect(
      screen.getByText(/Southern District of New York: Chapter 7 - Panel/i),
    ).toBeInTheDocument();
  });

  test('should display "Court information not available" when courtName, courtDivisionName, and courtId are missing', () => {
    const appointmentWithoutCourt = {
      ...mockAppointment,
      courtName: undefined,
      courtDivisionName: undefined,
      courtId: undefined,
    } as unknown as TrusteeAppointment;

    renderWithProps({ appointment: appointmentWithoutCourt });

    expect(
      screen.getByText(/Court information not available: Chapter 7 - Panel/i),
    ).toBeInTheDocument();
  });

  test('should render Edit button when user has TrusteeAdmin role', () => {
    renderWithProps();

    const editButton = screen.getByRole('button', { name: /edit trustee appointment/i });
    expect(editButton).toBeInTheDocument();
    expect(editButton).toHaveAttribute('id', `edit-trustee-appointment-${mockAppointment.id}`);
  });

  test('should navigate to edit page when Edit button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProps();

    const editButton = screen.getByRole('button', { name: /edit trustee appointment/i });
    await user.click(editButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      `/trustees/${mockAppointment.trusteeId}/appointments/${mockAppointment.id}/edit`,
    );
  });

  test('should not render Edit button when user lacks TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderWithProps();

    const editButton = screen.queryByRole('button', { name: /edit trustee appointment/i });
    expect(editButton).not.toBeInTheDocument();
  });

  test('should not render Edit button when user has no roles', () => {
    TestingUtilities.setUserWithRoles([]);

    renderWithProps();

    const editButton = screen.queryByRole('button', { name: /edit trustee appointment/i });
    expect(editButton).not.toBeInTheDocument();
  });

  // Chapter 12/13 Case by Case no longer reaches AppointmentCard -- TrusteeAppointments
  // routes it to Chapter12And13CaseByCaseAppointmentBody (CAMS-913), and Chapter 13
  // Standing no longer reaches it either -- TrusteeAppointments now routes it to
  // Chapter13StandingAppointmentBody via the shared AppointmentAccordion (CAMS-909/915),
  // covered by Chapter13StandingAppointmentBody.test.tsx and TrusteeAppointments.test.tsx.

  test('still renders when courts fail to load', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const courtsError = new Error('courts unavailable');
    mockUseCourts.mockReturnValue({
      courts: [],
      loading: false,
      error: courtsError,
    });

    renderWithProps();

    expect(screen.getByText(/District:/i)).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test('Divisions field resolves a division code to its name using loaded courts', () => {
    mockUseCourts.mockReturnValue({
      courts: [
        {
          officeName: 'Manhattan Office',
          officeCode: '08',
          courtId: '0208',
          courtName: 'Southern District of New York',
          courtDivisionCode: '081',
          courtDivisionName: 'Manhattan Division',
          groupDesignator: 'NY',
          regionId: '02',
          regionName: 'Region 2',
          state: 'NY',
        },
      ],
      loading: false,
      error: null,
    });

    renderWithProps({
      appointment: {
        ...mockAppointment,
        courtDivisionName: undefined,
        divisionCode: '081',
      },
    });

    expect(screen.getByText('Manhattan Division', { selector: 'li' })).toBeInTheDocument();
  });

  test('Divisions field falls back to the raw division code when no match is found', () => {
    mockUseCourts.mockReturnValue({ courts: [], loading: false, error: null });

    renderWithProps({
      appointment: {
        ...mockAppointment,
        courtDivisionName: undefined,
        divisionCode: '081',
      },
    });

    expect(screen.getByText('081', { selector: 'li' })).toBeInTheDocument();
  });
});
