import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Chapter13StandingAppointmentBody, {
  Chapter13StandingAppointmentBodyProps,
} from './Chapter13StandingAppointmentBody';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

const mockUseNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: mockUseNavigate,
  };
});

const appointment: TrusteeAppointment = {
  id: 'appointment-001',
  trusteeId: 'trustee-123',
  chapter: '13',
  appointmentType: 'standing',
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

const defaultProps: Chapter13StandingAppointmentBodyProps = {
  appointment,
  keyDatesData: null,
  isKeyDatesLoading: false,
};

function renderComponent(props?: Partial<Chapter13StandingAppointmentBodyProps>) {
  return render(
    <BrowserRouter>
      <Chapter13StandingAppointmentBody {...defaultProps} {...props} />
    </BrowserRouter>,
  );
}

describe('Chapter13StandingAppointmentBody', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  test('renders the header text matching the mockup format', () => {
    renderComponent();
    expect(
      screen.getByText('Southern District of New York (Manhattan) - Chapter 13 - Standing'),
    ).toBeInTheDocument();
  });

  test('renders a green Active tag for an active appointment', () => {
    renderComponent();
    const tag = screen.getByTestId('tag-appointment-status');
    expect(tag).toHaveTextContent('Active');
    expect(tag.className).toContain('bg-success');
  });

  test('renders a gray status tag with the specific label for a non-active appointment', () => {
    renderComponent({ appointment: { ...appointment, status: 'inactive' } });
    const tag = screen.getByTestId('tag-appointment-status');
    expect(tag).toHaveTextContent('Inactive');
    expect(tag).toHaveStyle({ backgroundColor: '#71767A' });
  });

  test('shows a loading spinner instead of the cards while key dates are loading', () => {
    renderComponent({ isKeyDatesLoading: true });
    fireEvent.click(screen.getByTestId(`accordion-button-${appointment.id}`));
    expect(screen.getByTestId('chapter13-standing-key-dates-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('chapter13-standing-cards-stack')).not.toBeInTheDocument();
  });

  test('renders the four themed cards once loaded', () => {
    renderComponent();
    fireEvent.click(screen.getByTestId(`accordion-button-${appointment.id}`));
    const stack = screen.getByTestId('chapter13-standing-cards-stack');
    expect(stack).toContainElement(screen.getByTestId('chapter13-standing-audit-card'));
    expect(stack).toContainElement(screen.getByTestId('chapter13-standing-tpr-card'));
    expect(stack).toContainElement(screen.getByTestId('chapter13-standing-budget-card'));
    expect(stack).toContainElement(screen.getByTestId('chapter13-standing-other-card'));
  });

  test('Edit Appointment button navigates to the edit appointment route', () => {
    renderComponent();
    fireEvent.click(screen.getByTestId(`accordion-button-${appointment.id}`));
    fireEvent.click(screen.getByRole('button', { name: /edit appointment/i }));

    expect(mockNavigate).toHaveBeenCalledWith(
      `/trustees/${appointment.trusteeId}/appointments/${appointment.id}/edit`,
    );
  });

  test('accordion expand state is controlled by expandedId/onExpand/onCollapse props', () => {
    const onExpand = vi.fn();
    const onCollapse = vi.fn();
    renderComponent({ onExpand, onCollapse });

    fireEvent.click(screen.getByTestId(`accordion-button-${appointment.id}`));

    expect(onExpand).toHaveBeenCalledWith(appointment.id);
    expect(onCollapse).toHaveBeenCalledWith(appointment.id);
  });
});
