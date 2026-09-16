import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import AppointmentAccordion from './AppointmentAccordion';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

const mockUseCourts = vi.hoisted(() => vi.fn());

vi.mock('@/lib/hooks/UseCourts', () => ({
  default: mockUseCourts,
}));

describe('AppointmentAccordion', () => {
  const mockAppointment: TrusteeAppointment = {
    id: 'appointment-001',
    trusteeId: 'trustee-123',
    chapter: '11',
    appointmentType: 'case-by-case',
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

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseCourts.mockReturnValue({ courts: [], loading: false, error: null });
  });

  function renderAccordion(
    overrides: Partial<{
      appointment: TrusteeAppointment;
      expanded: boolean;
      onToggle: (id: string) => void;
    }> = {},
  ) {
    const onToggle = overrides.onToggle ?? vi.fn();
    return {
      onToggle,
      ...render(
        <AppointmentAccordion
          appointment={overrides.appointment ?? mockAppointment}
          expanded={overrides.expanded ?? false}
          onToggle={onToggle}
        >
          <div data-testid="accordion-body-content">Body content</div>
        </AppointmentAccordion>,
      ),
    };
  }

  test('logs an error but still renders when courts fail to load', () => {
    mockUseCourts.mockReturnValue({
      courts: [],
      loading: false,
      error: new Error('courts unavailable'),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderAccordion();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading courts:', expect.any(Error));
    expect(screen.getByText(/Southern District of New York/i)).toBeInTheDocument();
  });

  test('renders the district and division in the header', () => {
    renderAccordion();

    expect(screen.getByText(/Southern District of New York.*Manhattan/i)).toBeInTheDocument();
  });

  test('renders the chapter and appointment type in the header', () => {
    renderAccordion();

    expect(screen.getByText(/Chapter 11 - Case by Case/i)).toBeInTheDocument();
  });

  test('shows a Success tag with text "Active" when status is active', () => {
    renderAccordion({ appointment: { ...mockAppointment, status: 'active' } });

    const tag = screen.getByText('Active');
    expect(tag).toHaveClass('bg-success-vivid');
  });

  test('shows an InactiveGray tag with the formatted status when status is not active', () => {
    renderAccordion({ appointment: { ...mockAppointment, status: 'terminated' } });

    const tag = screen.getByText('Terminated');
    expect(tag).toHaveClass('bg-gray-cool-50');
  });

  test('shows children content and marks the button expanded when expanded is true', () => {
    renderAccordion({ expanded: true });

    expect(screen.getByTestId('accordion-body-content')).toBeVisible();
    expect(screen.getByTestId(`accordion-button-${mockAppointment.id}`)).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  test('hides children content and marks the button collapsed when expanded is false', () => {
    renderAccordion({ expanded: false });

    expect(screen.getByTestId('accordion-body-content')).not.toBeVisible();
    expect(screen.getByTestId(`accordion-button-${mockAppointment.id}`)).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  test('calls onToggle with the appointment id when the header is clicked', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderAccordion({ expanded: false });

    await user.click(screen.getByTestId(`accordion-button-${mockAppointment.id}`));

    expect(onToggle).toHaveBeenCalledWith(mockAppointment.id);
  });
});
