import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import AppointmentCard, { AppointmentCardProps } from './AppointmentCard';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import userEvent from '@testing-library/user-event';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import * as featureFlagsHook from '@/lib/hooks/UseFeatureFlags';
import Api2 from '@/lib/models/api2';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import {
  DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES,
  DISPLAY_CHPT11_SUBV_PAST_KEY_DATES,
  DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES,
  DISPLAY_CHPT12_STANDING_KEY_DATES,
  DISPLAY_CHPT13_STANDING_KEY_DATES,
} from '@/lib/hooks/UseFeatureFlags';

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

vi.mock('./UpcomingKeyDates', () => ({
  default: (props: { data: unknown; isLoading: boolean }) => (
    <div
      data-testid="upcoming-key-dates-card"
      data-is-loading={String(props.isLoading)}
      data-has-data={String(props.data !== null)}
    />
  ),
}));
vi.mock('./PastKeyDates', () => ({
  default: (props: { data: unknown; isLoading: boolean }) => (
    <div
      data-testid="past-key-dates-card"
      data-is-loading={String(props.isLoading)}
      data-has-data={String(props.data !== null)}
    />
  ),
}));
vi.mock('./Chapter12StandingUpcomingKeyDates', () => ({
  default: () => <div data-testid="ch12-upcoming-key-dates-card" />,
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

  test('should format chapter 11 correctly', () => {
    const appointment11: TrusteeAppointment = {
      ...mockAppointment,
      chapter: '11',
    };

    renderWithProps({ appointment: appointment11 });

    expect(screen.getByText(/Chapter 11/i)).toBeInTheDocument();
  });

  test('should format chapter 13 correctly', () => {
    const appointment13: TrusteeAppointment = {
      ...mockAppointment,
      chapter: '13',
    };

    renderWithProps({ appointment: appointment13 });

    expect(screen.getByText(/Chapter 13/i)).toBeInTheDocument();
  });

  test('should format chapter 11-subchapter-v correctly', () => {
    const appointment11v: TrusteeAppointment = {
      ...mockAppointment,
      chapter: '11-subchapter-v',
    };

    renderWithProps({ appointment: appointment11v });

    expect(screen.getByText(/Chapter 11 Subchapter V/i)).toBeInTheDocument();
  });

  test('should format chapter 7 off-panel correctly', () => {
    const appointment7OffPanel: TrusteeAppointment = {
      ...mockAppointment,
      chapter: '7',
      appointmentType: 'off-panel',
    };

    renderWithProps({ appointment: appointment7OffPanel });

    expect(screen.getByText(/Chapter 7 - Off Panel/i)).toBeInTheDocument();
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

  test('should display voluntarily suspended status correctly', () => {
    renderWithProps({
      appointment: { ...mockAppointment, status: 'voluntarily-suspended' },
    });

    expect(screen.getByText(/^Voluntarily Suspended$/, { selector: 'li' })).toBeInTheDocument();
  });

  test('should display involuntarily suspended status correctly', () => {
    renderWithProps({
      appointment: { ...mockAppointment, status: 'involuntarily-suspended' },
    });

    expect(screen.getByText(/^Involuntarily Suspended$/, { selector: 'li' })).toBeInTheDocument();
  });

  test('should display terminated status correctly', () => {
    renderWithProps({
      appointment: { ...mockAppointment, status: 'terminated' },
    });

    expect(screen.getByText(/^Terminated$/, { selector: 'li' })).toBeInTheDocument();
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
    expect(screen.getAllByText(/Southern District of New York/i).length).toBeGreaterThan(0);
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
    expect(screen.getAllByText(/Court information not available/i).length).toBeGreaterThan(0);
  });

  test('should render Edit button when user has TrusteeAdmin role', () => {
    renderWithProps();

    const editButton = screen.getByRole('button', { name: /edit trustee appointment/i });
    expect(editButton).toBeInTheDocument();
    expect(editButton).toHaveAttribute('id', 'edit-trustee-appointment');
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

  describe('when DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES flag is enabled', () => {
    beforeEach(() => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES]: true,
      });
    });

    test('renders UpcomingKeyDates card for panel Ch7 appointment with TrusteeAdmin role', () => {
      renderWithProps({
        appointment: { ...mockAppointment, chapter: '7', appointmentType: 'panel' },
      });

      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
    });

    test('renders PastKeyDates card for panel Ch7 appointment with TrusteeAdmin role', () => {
      renderWithProps({
        appointment: { ...mockAppointment, chapter: '7', appointmentType: 'panel' },
      });

      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
    });
  });

  test('does not render UpcomingKeyDates for non-panel appointment', () => {
    renderWithProps({
      appointment: { ...mockAppointment, chapter: '7', appointmentType: 'converted-case' },
    });

    expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
  });

  test('does not render UpcomingKeyDates for non-Ch7 appointment', () => {
    renderWithProps({
      appointment: { ...mockAppointment, chapter: '13', appointmentType: 'panel' },
    });

    expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
  });

  test('does not render UpcomingKeyDates for non-TrusteeAdmin user', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderWithProps({
      appointment: { ...mockAppointment, chapter: '7', appointmentType: 'panel' },
    });

    expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
  });

  test('does not render UpcomingKeyDates when DISPLAY_CHPT7_PANEL_UPCOMING_REPORT_DATES flag is disabled', () => {
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
      [DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES]: false,
    });

    renderWithProps({
      appointment: { ...mockAppointment, chapter: '7', appointmentType: 'panel' },
    });

    expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
  });

  describe('Chapter 11 Subchapter V Pool past key dates', () => {
    const subVAppointment: TrusteeAppointment = {
      ...mockAppointment,
      chapter: '11-subchapter-v',
      appointmentType: 'pool',
    };

    // AppointmentCard's own concern is whether the PastKeyDates card renders
    // at all (the flag/chapter/appointmentType gate) — NOT whether its Edit
    // button shows for a given role. That role-based visibility is
    // PastKeyDates' own contract and is covered in PastKeyDates.test.tsx.
    test('renders PastKeyDates card for non-TrusteeAdmin user when flag enabled (no canManage gate)', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT11_SUBV_PAST_KEY_DATES]: true,
      });
      TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

      renderWithProps({ appointment: subVAppointment });

      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
    });

    test('renders PastKeyDates card for TrusteeAdmin when flag enabled', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT11_SUBV_PAST_KEY_DATES]: true,
      });

      renderWithProps({ appointment: subVAppointment });

      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
    });

    test('does not render UpcomingKeyDates card for Ch11-SubV appointment', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT11_SUBV_PAST_KEY_DATES]: true,
      });

      renderWithProps({ appointment: subVAppointment });

      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
      expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
    });

    test('does not render PastKeyDates card when flag is disabled', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT11_SUBV_PAST_KEY_DATES]: false,
      });

      renderWithProps({ appointment: subVAppointment });

      expect(screen.queryByTestId('past-key-dates-card')).not.toBeInTheDocument();
    });

    test('does not render PastKeyDates card for a non-pool Ch11-SubV appointment type', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT11_SUBV_PAST_KEY_DATES]: true,
      });

      renderWithProps({
        appointment: { ...mockAppointment, chapter: '11-subchapter-v', appointmentType: 'panel' },
      });

      expect(screen.queryByTestId('past-key-dates-card')).not.toBeInTheDocument();
    });
  });

  describe('Chapter 12/13 Case by Case upcoming key dates', () => {
    const ch12CaseByCaseAppointment: TrusteeAppointment = {
      ...mockAppointment,
      chapter: '12',
      appointmentType: 'case-by-case',
    };

    test('renders UpcomingKeyDates card for Ch12 case-by-case appointment when flag enabled', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: true,
      });

      renderWithProps({ appointment: ch12CaseByCaseAppointment });

      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
    });

    test('renders UpcomingKeyDates card for Ch13 case-by-case appointment when flag enabled', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: true,
      });

      renderWithProps({
        appointment: { ...ch12CaseByCaseAppointment, chapter: '13' },
      });

      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
    });

    test('does not render a PastKeyDates card for Ch12/13 case-by-case appointment', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: true,
      });

      renderWithProps({ appointment: ch12CaseByCaseAppointment });

      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
      expect(screen.queryByTestId('past-key-dates-card')).not.toBeInTheDocument();
    });

    test('does not render UpcomingKeyDates card when flag is disabled', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: false,
      });

      renderWithProps({ appointment: ch12CaseByCaseAppointment });

      expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
    });

    test('does not render UpcomingKeyDates card for Ch12/13 Standing appointment type', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: true,
      });

      renderWithProps({
        appointment: { ...ch12CaseByCaseAppointment, appointmentType: 'standing' },
      });

      expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
    });
  });

  describe('shared upcoming key dates fetch', () => {
    const mockKeyDatesData: TrusteeUpcomingKeyDates = {
      trusteeId: 'trustee-123',
      appointmentId: 'appointment-001',
    } as TrusteeUpcomingKeyDates;

    test('fetches key dates once and forwards the same data/isLoading to UpcomingKeyDates and PastKeyDates', async () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES]: true,
      });
      const getUpcomingKeyDatesSpy = vi
        .spyOn(Api2, 'getUpcomingKeyDates')
        .mockResolvedValue({ data: mockKeyDatesData });

      renderWithProps();

      await waitFor(() => {
        expect(screen.getByTestId('upcoming-key-dates-card')).toHaveAttribute(
          'data-is-loading',
          'false',
        );
      });

      expect(getUpcomingKeyDatesSpy).toHaveBeenCalledTimes(1);
      expect(getUpcomingKeyDatesSpy).toHaveBeenCalledWith('trustee-123', 'appointment-001');

      const upcomingCard = screen.getByTestId('upcoming-key-dates-card');
      const pastCard = screen.getByTestId('past-key-dates-card');
      expect(upcomingCard).toHaveAttribute('data-has-data', 'true');
      expect(pastCard).toHaveAttribute('data-has-data', 'true');
      expect(upcomingCard).toHaveAttribute('data-is-loading', 'false');
      expect(pastCard).toHaveAttribute('data-is-loading', 'false');
    });

    test('sets isLoading false and data null when the fetch rejects', async () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES]: true,
      });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('failed to load'));

      renderWithProps();

      await waitFor(() => {
        expect(screen.getByTestId('upcoming-key-dates-card')).toHaveAttribute(
          'data-is-loading',
          'false',
        );
      });

      expect(screen.getByTestId('upcoming-key-dates-card')).toHaveAttribute(
        'data-has-data',
        'false',
      );
      expect(screen.getByTestId('past-key-dates-card')).toHaveAttribute('data-has-data', 'false');
    });
  });

  describe('when DISPLAY_CHPT12_STANDING_KEY_DATES flag is enabled', () => {
    const ch12StandingAppointment: TrusteeAppointment = {
      ...mockAppointment,
      chapter: '12',
      appointmentType: 'standing',
    };

    test('renders PastKeyDates card for chapter 12 standing appointment', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_STANDING_KEY_DATES]: true,
      });

      renderWithProps({ appointment: ch12StandingAppointment });

      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
    });

    test('does not render PastKeyDates card when flag is disabled', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_STANDING_KEY_DATES]: false,
      });

      renderWithProps({ appointment: ch12StandingAppointment });

      expect(screen.queryByTestId('past-key-dates-card')).not.toBeInTheDocument();
    });

    test('does not render Ch7 UpcomingKeyDates card for chapter 12 standing appointment', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_STANDING_KEY_DATES]: true,
      });

      renderWithProps({ appointment: ch12StandingAppointment });

      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
      expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
    });

    test('renders Chapter12StandingUpcomingKeyDates card when flag is enabled', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_STANDING_KEY_DATES]: true,
      });

      renderWithProps({ appointment: ch12StandingAppointment });

      expect(screen.getByTestId('ch12-upcoming-key-dates-card')).toBeInTheDocument();
    });

    test('does not render Chapter12StandingUpcomingKeyDates card when flag is disabled', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_STANDING_KEY_DATES]: false,
      });

      renderWithProps({ appointment: ch12StandingAppointment });

      expect(screen.queryByTestId('ch12-upcoming-key-dates-card')).not.toBeInTheDocument();
    });

    test('does not render Ch12 card for chapter 12 case-by-case appointment', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_STANDING_KEY_DATES]: true,
      });
      const ch12CaseByCaseAppointment: TrusteeAppointment = {
        ...mockAppointment,
        chapter: '12',
        appointmentType: 'case-by-case',
      };

      renderWithProps({ appointment: ch12CaseByCaseAppointment });

      expect(screen.queryByTestId('ch12-upcoming-key-dates-card')).not.toBeInTheDocument();
    });

    test('does not render Ch12 card for chapter 13 standing appointment', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_STANDING_KEY_DATES]: true,
      });
      const ch13StandingAppointment: TrusteeAppointment = {
        ...mockAppointment,
        chapter: '13',
        appointmentType: 'standing',
      };

      renderWithProps({ appointment: ch13StandingAppointment });

      expect(screen.queryByTestId('ch12-upcoming-key-dates-card')).not.toBeInTheDocument();
    });
  });

  describe('when DISPLAY_CHPT13_STANDING_KEY_DATES flag is enabled', () => {
    const ch13StandingAppointment: TrusteeAppointment = {
      ...mockAppointment,
      chapter: '13',
      appointmentType: 'standing',
    };

    test('renders UpcomingKeyDates card with variant chapter13-standing when flag is enabled', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT13_STANDING_KEY_DATES]: true,
      });

      renderWithProps({ appointment: ch13StandingAppointment });

      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
    });

    test('does not render UpcomingKeyDates card for ch13 standing when flag is disabled', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT13_STANDING_KEY_DATES]: false,
      });

      renderWithProps({ appointment: ch13StandingAppointment });

      expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
    });

    test('does not render ch12 standing card for ch13 standing appointment', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT13_STANDING_KEY_DATES]: true,
        [DISPLAY_CHPT12_STANDING_KEY_DATES]: true,
      });

      renderWithProps({ appointment: ch13StandingAppointment });

      expect(screen.queryByTestId('ch12-upcoming-key-dates-card')).not.toBeInTheDocument();
    });

    test('does not render ch13 standing card for ch12 standing appointment', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT13_STANDING_KEY_DATES]: true,
      });
      const ch12StandingAppointment: TrusteeAppointment = {
        ...mockAppointment,
        chapter: '12',
        appointmentType: 'standing',
      };

      renderWithProps({ appointment: ch12StandingAppointment });

      expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
    });

    test('renders PastKeyDates card alongside UpcomingKeyDates when flag is enabled', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT13_STANDING_KEY_DATES]: true,
      });

      renderWithProps({ appointment: ch13StandingAppointment });

      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
    });
  });

  test('still renders when courts fail to load', () => {
    mockUseCourts.mockReturnValue({
      courts: [],
      loading: false,
      error: new Error('courts unavailable'),
    });

    renderWithProps();

    expect(screen.getByText(/District:/i)).toBeInTheDocument();
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
