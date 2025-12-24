import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import AppointmentCard, { AppointmentCardProps } from './AppointmentCard';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

describe('AppointmentCard', () => {
  const mockAppointment: TrusteeAppointment = {
    id: 'appointment-001',
    trusteeId: 'trustee-123',
    chapter: '7-panel',
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

    return render(<AppointmentCard {...defaultProps} />);
  }

  test('should render appointment card with correct heading', () => {
    renderWithProps();

    expect(
      screen.getByText(/Southern District of New York \(Manhattan\) - Chapter 7 - Panel/i),
    ).toBeInTheDocument();
  });

  test('should render appointment card with district name when provided', () => {
    renderWithProps({
      appointment: { ...mockAppointment, courtName: 'Eastern District of New York' },
    });

    expect(
      screen.getByText(/Eastern District of New York \(Manhattan\) - Chapter 7 - Panel/i),
    ).toBeInTheDocument();
  });

  test('should render appointment card with city name when provided', () => {
    renderWithProps({
      appointment: {
        ...mockAppointment,
        courtName: 'Eastern District of New York',
        courtDivisionName: 'Brooklyn',
      },
    });

    expect(
      screen.getByText(/Eastern District of New York \(Brooklyn\) - Chapter 7 - Panel/i),
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
      screen.getByText(/Eastern District of New York \(Brooklyn\)/i, { selector: 'li' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Chapter:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/7 - Panel/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Status:/i)).toBeInTheDocument();
    expect(screen.getByText(/Active 01\/15\/2020/i)).toBeInTheDocument();
    expect(screen.getByText(/Appointed:/i)).toBeInTheDocument();
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

    expect(screen.getByText(/Chapter 11 - Subchapter V/i)).toBeInTheDocument();
  });

  test('should format chapter 7-non-panel correctly', () => {
    const appointment7NonPanel: TrusteeAppointment = {
      ...mockAppointment,
      chapter: '7-non-panel',
    };

    renderWithProps({ appointment: appointment7NonPanel });

    expect(screen.getByText(/Chapter 7 - Non-Panel/i)).toBeInTheDocument();
  });

  test('should display inactive status correctly', () => {
    const inactiveAppointment: TrusteeAppointment = {
      ...mockAppointment,
      status: 'inactive',
      effectiveDate: '2018-06-01T00:00:00.000Z',
    };

    renderWithProps({ appointment: inactiveAppointment });

    expect(screen.getByText(/Inactive 06\/01\/2018/i)).toBeInTheDocument();
  });

  test('should display appointedDate with standardized mm/dd/yyyy formatting', () => {
    const appointmentWithDate: TrusteeAppointment = {
      ...mockAppointment,
      appointedDate: '2025-12-01T00:00:00.000Z',
    };

    renderWithProps({ appointment: appointmentWithDate });

    expect(screen.getByText('12/01/2025')).toBeInTheDocument();
  });

  test('should display "Court not found" when courtName is missing', () => {
    const appointmentWithoutCourtName: TrusteeAppointment = {
      ...mockAppointment,
      courtName: undefined,
    };

    renderWithProps({ appointment: appointmentWithoutCourtName });

    expect(screen.getByText(/Court not found - Chapter 7 - Panel/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Court not found/i).length).toBeGreaterThan(0);
  });

  test('should display "Court not found" when courtDivisionName is missing', () => {
    const appointmentWithoutDivisionName: TrusteeAppointment = {
      ...mockAppointment,
      courtDivisionName: undefined,
    };

    renderWithProps({ appointment: appointmentWithoutDivisionName });

    expect(screen.getByText(/Court not found - Chapter 7 - Panel/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Court not found/i).length).toBeGreaterThan(0);
  });

  test('should display "Court not found" when both courtName and courtDivisionName are missing', () => {
    const appointmentWithoutCourt: TrusteeAppointment = {
      ...mockAppointment,
      courtName: undefined,
      courtDivisionName: undefined,
    };

    renderWithProps({ appointment: appointmentWithoutCourt });

    expect(screen.getByText(/Court not found - Chapter 7 - Panel/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Court not found/i).length).toBeGreaterThan(0);
  });
});
