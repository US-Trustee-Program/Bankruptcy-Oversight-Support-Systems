import { render, screen, within } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import AppointmentBasicFields from './AppointmentBasicFields';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import useEditTrusteeAppointment from '@/lib/hooks/UseEditTrusteeAppointment';

vi.mock('@/lib/hooks/UseEditTrusteeAppointment');

describe('AppointmentBasicFields', () => {
  const mockOpenEditTrustee = vi.fn();

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
    vi.mocked(useEditTrusteeAppointment).mockReturnValue({
      canManage: true,
      openEditTrustee: mockOpenEditTrustee,
    });
  });

  function renderBody(appointment: TrusteeAppointment = mockAppointment) {
    return render(<AppointmentBasicFields appointment={appointment} />);
  }

  test('renders the appointed date in the appointed date field', () => {
    renderBody();

    const appointedField = within(screen.getByTestId('appointment-body-appointed-date'));
    expect(appointedField.getByText(/Appointed/i)).toBeInTheDocument();
    expect(appointedField.getByText('01/15/2020')).toBeInTheDocument();
  });

  test('renders the status effective date in the status effective field', () => {
    renderBody();

    const effectiveField = within(screen.getByTestId('appointment-body-status-effective-date'));
    expect(effectiveField.getByText(/Status Effective/i)).toBeInTheDocument();
    expect(effectiveField.getByText('06/01/2021')).toBeInTheDocument();
  });

  test('displays "Not Specified" for Unix epoch sentinel dates', () => {
    renderBody({
      ...mockAppointment,
      appointedDate: '1970-01-01T00:00:00.000Z',
      effectiveDate: '1970-01-01T00:00:00.000Z',
    });

    expect(screen.getAllByText('Not Specified')).toHaveLength(2);
  });

  test('renders an Edit button when the hook reports canManage', () => {
    renderBody();

    expect(
      screen.getByTestId(`button-edit-trustee-appointment-${mockAppointment.id}`),
    ).toBeInTheDocument();
  });

  test('calls openEditTrustee when Edit is clicked', async () => {
    const user = userEvent.setup();
    renderBody();

    await user.click(screen.getByTestId(`button-edit-trustee-appointment-${mockAppointment.id}`));

    expect(mockOpenEditTrustee).toHaveBeenCalled();
  });

  test('does not render an Edit button when the hook reports canManage as false', () => {
    vi.mocked(useEditTrusteeAppointment).mockReturnValue({
      canManage: false,
      openEditTrustee: mockOpenEditTrustee,
    });

    renderBody();

    expect(
      screen.queryByTestId(`button-edit-trustee-appointment-${mockAppointment.id}`),
    ).not.toBeInTheDocument();
  });
});
