import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import AppointmentCard, { AppointmentCardProps } from './AppointmentCard';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import userEvent from '@testing-library/user-event';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import * as featureFlagsHook from '@/lib/hooks/UseFeatureFlags';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import {
  DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES,
  DISPLAY_CHPT12_STANDING_KEY_DATES,
  DISPLAY_CHPT13_STANDING_KEY_DATES,
  TPR_DISPLAY_UPDATES,
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
  default: (props: {
    data: unknown;
    isLoading: boolean;
    variant?: string;
    tprDisplayUpdates?: boolean;
    trusteeId?: string;
    appointmentId?: string;
    appointmentHeading?: string;
  }) => (
    <div
      data-testid="upcoming-key-dates-card"
      data-is-loading={String(props.isLoading)}
      data-has-data={String(props.data !== null)}
      data-variant={String(props.variant)}
      data-tpr-display-updates={String(props.tprDisplayUpdates)}
      data-trustee-id={String(props.trusteeId)}
      data-appointment-id={String(props.appointmentId)}
      data-appointment-heading={String(props.appointmentHeading)}
    />
  ),
}));
vi.mock('./PastKeyDates', () => ({
  default: (props: {
    data: unknown;
    isLoading: boolean;
    variant?: string;
    trusteeId?: string;
    appointmentId?: string;
    appointmentHeading?: string;
  }) => (
    <div
      data-testid="past-key-dates-card"
      data-is-loading={String(props.isLoading)}
      data-has-data={String(props.data !== null)}
      data-variant={String(props.variant)}
      data-trustee-id={String(props.trusteeId)}
      data-appointment-id={String(props.appointmentId)}
      data-appointment-heading={String(props.appointmentHeading)}
    />
  ),
}));

// Chapter13StandingAppointmentBody's own internals (header text, status tag color,
// the four themed cards, Edit Appointment navigation) are covered by
// Chapter13StandingAppointmentBody.test.tsx. AppointmentCard's job for this branch is
// just deciding to render this component and forwarding the right props -- that's all
// this stub needs to expose.
vi.mock('./Chapter13StandingAppointmentBody', () => ({
  default: (props: {
    appointment: TrusteeAppointment;
    keyDatesData: unknown;
    isKeyDatesLoading: boolean;
    expandedId?: string;
    onExpand?: (id: string) => void;
    onCollapse?: (id: string) => void;
  }) => (
    <div
      data-testid="chapter13-standing-appointment-body"
      data-appointment-id={props.appointment.id}
      data-has-key-dates-data={String(props.keyDatesData !== null)}
      data-is-key-dates-loading={String(props.isKeyDatesLoading)}
      data-expanded-id={String(props.expandedId)}
    >
      <button
        data-testid={`accordion-button-${props.appointment.id}`}
        onClick={() => props.onExpand?.(props.appointment.id)}
      >
        Expand
      </button>
      <button
        data-testid={`accordion-collapse-button-${props.appointment.id}`}
        onClick={() => props.onCollapse?.(props.appointment.id)}
      >
        Collapse
      </button>
    </div>
  ),
}));

describe('AppointmentCard', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseCourts.mockReturnValue({ courts: [], loading: false, error: null });
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
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
    expect(editButton).toHaveAttribute('id', 'edit-trustee-appointment-appointment-001');
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

    test('forwards tprDisplayUpdates derived from the TPR_DISPLAY_UPDATES flag', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: true,
        [TPR_DISPLAY_UPDATES]: true,
      });

      renderWithProps({ appointment: ch12CaseByCaseAppointment });

      expect(screen.getByTestId('upcoming-key-dates-card')).toHaveAttribute(
        'data-tpr-display-updates',
        'true',
      );
    });

    test('forwards tprDisplayUpdates as false when the TPR_DISPLAY_UPDATES flag is disabled', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: true,
      });

      renderWithProps({ appointment: ch12CaseByCaseAppointment });

      expect(screen.getByTestId('upcoming-key-dates-card')).toHaveAttribute(
        'data-tpr-display-updates',
        'false',
      );
    });

    test('does not render a PastKeyDates card for Ch12/13 case-by-case appointment', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: true,
      });

      renderWithProps({ appointment: ch12CaseByCaseAppointment });

      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
      expect(screen.queryByTestId('past-key-dates-card')).not.toBeInTheDocument();
    });

    test('does not render UpcomingKeyDates card when DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES is disabled', () => {
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

    // Ch12/13 case-by-case key dates have no canManage gate — this locks in
    // that behavior.
    test('renders UpcomingKeyDates card for non-TrusteeAdmin user when flag enabled (no canManage gate)', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: true,
      });
      TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

      renderWithProps({ appointment: ch12CaseByCaseAppointment });

      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
    });

    test('includes courtDivisionName in the appointmentHeading passed to key-dates cards', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: true,
      });

      renderWithProps({
        appointment: { ...ch12CaseByCaseAppointment, courtDivisionName: 'Brooklyn' },
      });

      const heading = screen
        .getByTestId('upcoming-key-dates-card')
        .getAttribute('data-appointment-heading');
      expect(heading).toContain('(Brooklyn)');
    });

    test('omits the division parenthetical from appointmentHeading when courtDivisionName is missing', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: true,
      });

      renderWithProps({
        appointment: { ...ch12CaseByCaseAppointment, courtDivisionName: undefined },
      });

      const heading = screen
        .getByTestId('upcoming-key-dates-card')
        .getAttribute('data-appointment-heading');
      expect(heading).not.toContain('(');
    });
  });

  describe('shared upcoming key dates fetch', () => {
    const mockKeyDatesData: TrusteeUpcomingKeyDates = {
      trusteeId: 'trustee-123',
      appointmentId: 'appointment-001',
    } as TrusteeUpcomingKeyDates;

    test('fetches key dates once and forwards the same data/isLoading to UpcomingKeyDates and PastKeyDates', async () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_STANDING_KEY_DATES]: true,
      });
      const getUpcomingKeyDatesSpy = vi
        .spyOn(Api2, 'getUpcomingKeyDates')
        .mockResolvedValue({ data: mockKeyDatesData });

      renderWithProps({
        appointment: { ...mockAppointment, chapter: '12', appointmentType: 'standing' },
      });

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
        [DISPLAY_CHPT12_STANDING_KEY_DATES]: true,
      });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('failed to load'));

      renderWithProps({
        appointment: { ...mockAppointment, chapter: '12', appointmentType: 'standing' },
      });

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

    test('renders both UpcomingKeyDates and PastKeyDates cards for chapter 12 standing appointment', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_STANDING_KEY_DATES]: true,
      });

      renderWithProps({ appointment: ch12StandingAppointment });

      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
    });

    test('does not render UpcomingKeyDates card when DISPLAY_CHPT12_STANDING_KEY_DATES is disabled', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_STANDING_KEY_DATES]: false,
      });

      renderWithProps({ appointment: ch12StandingAppointment });

      expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
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

      expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
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

      expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
    });

    // Ch12 standing key dates have no canManage gate — this locks in that
    // behavior.
    test('renders cards for non-TrusteeAdmin user when flag enabled (no canManage gate)', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_STANDING_KEY_DATES]: true,
      });
      TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

      renderWithProps({ appointment: ch12StandingAppointment });

      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
    });
  });

  describe('when DISPLAY_CHPT13_STANDING_KEY_DATES flag is enabled', () => {
    const ch13StandingAppointment: TrusteeAppointment = {
      ...mockAppointment,
      chapter: '13',
      appointmentType: 'standing',
    };

    // Chapter13StandingAppointmentBody's own rendering (header text, status tag color,
    // the four themed cards, Edit Appointment navigation, no-canManage-gate behavior) is
    // covered by Chapter13StandingAppointmentBody.test.tsx. These tests only verify
    // AppointmentCard's own responsibility: deciding to render that component instead of
    // the generic flat card, gating the key-dates fetch on accordion expansion, and
    // forwarding the right props.

    test('renders Chapter13StandingAppointmentBody instead of the generic Key Information card', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT13_STANDING_KEY_DATES]: true,
      });

      renderWithProps({ appointment: ch13StandingAppointment });

      expect(screen.getByTestId('chapter13-standing-appointment-body')).toBeInTheDocument();
      expect(screen.queryByText('Key Information')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /edit trustee appointment/i }),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
      expect(screen.queryByTestId('past-key-dates-card')).not.toBeInTheDocument();
    });

    test('does not render Chapter13StandingAppointmentBody when flag is disabled', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT13_STANDING_KEY_DATES]: false,
      });

      renderWithProps({ appointment: ch13StandingAppointment });

      expect(screen.queryByTestId('chapter13-standing-appointment-body')).not.toBeInTheDocument();
    });

    test('does not render Chapter13StandingAppointmentBody for a ch12 standing appointment', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT13_STANDING_KEY_DATES]: true,
      });
      const ch12StandingAppointment: TrusteeAppointment = {
        ...mockAppointment,
        chapter: '12',
        appointmentType: 'standing',
      };

      renderWithProps({ appointment: ch12StandingAppointment });

      expect(screen.queryByTestId('chapter13-standing-appointment-body')).not.toBeInTheDocument();
    });

    test('passes the appointment through to Chapter13StandingAppointmentBody', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT13_STANDING_KEY_DATES]: true,
      });

      renderWithProps({ appointment: ch13StandingAppointment });

      expect(screen.getByTestId('chapter13-standing-appointment-body')).toHaveAttribute(
        'data-appointment-id',
        ch13StandingAppointment.id,
      );
    });

    test('does not fetch key dates until the accordion is expanded, then passes the fetched data down', async () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT13_STANDING_KEY_DATES]: true,
      });
      const getUpcomingKeyDatesSpy = vi
        .spyOn(Api2, 'getUpcomingKeyDates')
        .mockResolvedValue({ data: {} as TrusteeUpcomingKeyDates });

      renderWithProps({ appointment: ch13StandingAppointment });

      expect(getUpcomingKeyDatesSpy).not.toHaveBeenCalled();
      expect(screen.getByTestId('chapter13-standing-appointment-body')).toHaveAttribute(
        'data-has-key-dates-data',
        'false',
      );

      fireEvent.click(screen.getByTestId(`accordion-button-${ch13StandingAppointment.id}`));

      await waitFor(() => {
        expect(getUpcomingKeyDatesSpy).toHaveBeenCalledTimes(1);
      });
      expect(getUpcomingKeyDatesSpy).toHaveBeenCalledWith(
        ch13StandingAppointment.trusteeId,
        ch13StandingAppointment.id,
      );
      await waitFor(() => {
        expect(screen.getByTestId('chapter13-standing-appointment-body')).toHaveAttribute(
          'data-has-key-dates-data',
          'true',
        );
      });
    });

    test('accordion expand state is controlled by expandedId/onExpand/onCollapse props', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT13_STANDING_KEY_DATES]: true,
      });
      const onExpand = vi.fn();
      const onCollapse = vi.fn();

      render(
        <BrowserRouter>
          <AppointmentCard
            appointment={ch13StandingAppointment}
            onExpand={onExpand}
            onCollapse={onCollapse}
          />
        </BrowserRouter>,
      );

      const button = screen.getByTestId(`accordion-button-${ch13StandingAppointment.id}`);

      fireEvent.click(button);
      expect(onExpand).toHaveBeenCalledWith(ch13StandingAppointment.id);
      expect(onCollapse).not.toHaveBeenCalled();

      fireEvent.click(
        screen.getByTestId(`accordion-collapse-button-${ch13StandingAppointment.id}`),
      );
      expect(onCollapse).toHaveBeenCalledWith(ch13StandingAppointment.id);
      expect(onExpand).toHaveBeenCalledTimes(1);
    });

    // Ch13 standing key dates have no canManage gate — this locks in that
    // behavior at the point AppointmentCard decides whether to render the branch at all.
    test('renders Chapter13StandingAppointmentBody for non-TrusteeAdmin user when flag enabled (no canManage gate)', () => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT13_STANDING_KEY_DATES]: true,
      });
      TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

      renderWithProps({ appointment: ch13StandingAppointment });

      expect(screen.getByTestId('chapter13-standing-appointment-body')).toBeInTheDocument();
    });
  });

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
