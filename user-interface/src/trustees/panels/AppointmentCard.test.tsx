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
    appointedDate: 'January 15, 2020',
    effectiveDate: '2020-01-15T00:00:00.000Z',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  function renderWithProps(props?: Partial<TrusteeAppointment>) {
    const overrideAppointment = {
      ...mockAppointment,
      ...props,
    };
    const defaultProps: AppointmentCardProps = {
      appointment: overrideAppointment,
    };

    return render(<AppointmentCard {...defaultProps} {...props} />);
  }

  test('should render appointment card with correct heading', () => {
    renderWithProps();

    expect(
      screen.getByText(/Southern District of New York \(Manhattan\) - Chapter 7 - Panel/i),
    ).toBeInTheDocument();
  });

  test('should render appointment card with district name when provided', () => {
    renderWithProps({ courtName: 'Eastern District of New York' });

    expect(
      screen.getByText(/Eastern District of New York \(Manhattan\) - Chapter 7 - Panel/i),
    ).toBeInTheDocument();
  });

  test('should render appointment card with city name when provided', () => {
    renderWithProps({ courtName: 'Eastern District of New York', courtDivisionName: 'Brooklyn' });

    expect(
      screen.getByText(/Eastern District of New York \(Brooklyn\) - Chapter 7 - Panel/i),
    ).toBeInTheDocument();
  });

  test('should display appointment details correctly', () => {
    renderWithProps({ courtName: 'Eastern District of New York', courtDivisionName: 'Brooklyn' });

    expect(screen.getByText(/District:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Eastern District of New York \(Brooklyn\)/i, { selector: 'li' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Chapter:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/7 - Panel/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Status:/i)).toBeInTheDocument();
    expect(screen.getByText(/Active 01\/15\/2020/i)).toBeInTheDocument();
    expect(screen.getByText(/Appointed:/i)).toBeInTheDocument();
    expect(screen.getByText(/January 15, 2020/i)).toBeInTheDocument();
  });

  test('should format chapter 11 correctly', () => {
    const appointment11: TrusteeAppointment = {
      ...mockAppointment,
      chapter: '11',
    };

    renderWithProps(appointment11);

    expect(screen.getByText(/Chapter 11/i)).toBeInTheDocument();
  });

  test('should format chapter 13 correctly', () => {
    const appointment13: TrusteeAppointment = {
      ...mockAppointment,
      chapter: '13',
    };

    renderWithProps(appointment13);

    expect(screen.getByText(/Chapter 13/i)).toBeInTheDocument();
  });

  test('should format chapter 11-subchapter-v correctly', () => {
    const appointment11v: TrusteeAppointment = {
      ...mockAppointment,
      chapter: '11-subchapter-v',
    };

    renderWithProps(appointment11v);

    expect(screen.getByText(/Chapter 11 - Subchapter V/i)).toBeInTheDocument();
  });

  test('should format chapter 7-non-panel correctly', () => {
    const appointment7NonPanel: TrusteeAppointment = {
      ...mockAppointment,
      chapter: '7-non-panel',
    };

    renderWithProps(appointment7NonPanel);

    expect(screen.getByText(/Chapter 7 - Non-Panel/i)).toBeInTheDocument();
  });

  test('should display inactive status correctly', () => {
    const inactiveAppointment: TrusteeAppointment = {
      ...mockAppointment,
      status: 'inactive',
      effectiveDate: '2018-06-01T00:00:00.000Z',
    };

    renderWithProps(inactiveAppointment);

    expect(screen.getByText(/Inactive 06\/01\/2018/i)).toBeInTheDocument();
  });

  test('should display appointedDate as freeform text without formatting', () => {
    const appointmentWithVariousDateFormats: TrusteeAppointment = {
      ...mockAppointment,
      appointedDate: 'Appointed sometime in 2020',
    };

    renderWithProps(appointmentWithVariousDateFormats);

    expect(screen.getByText('Appointed sometime in 2020')).toBeInTheDocument();
  });
});
