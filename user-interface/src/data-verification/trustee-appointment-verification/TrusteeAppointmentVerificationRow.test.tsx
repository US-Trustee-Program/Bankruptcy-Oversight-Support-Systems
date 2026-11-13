import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { TrusteeAppointmentVerificationListItem } from '@common/cams/trustee-appointment-verification';
import { orderStatusType, taskType } from '@/lib/utils/labels';
import { TrusteeAppointmentVerificationRow } from './TrusteeAppointmentVerificationRow';

const fieldHeaders = ['Task Type', 'Subject', 'Task Created', 'Task Status'];

const task: TrusteeAppointmentVerificationListItem = {
  id: 'task-1',
  documentType: 'TRUSTEE_APPOINTMENT_VERIFICATION',
  taskType: 'trustee-appointment',
  trusteeId: 'trustee-1',
  courtId: '091',
  courtName: 'Eastern District of New York',
  divisionCode: '081',
  courtDivisionName: 'Brooklyn',
  chapter: '7',
  reason: 'no-appointment',
  status: 'pending',
  taskDate: '2026-11-01T00:00:00.000Z',
  caseCount: 1,
};

function renderRow(order = task, hidden = false) {
  render(
    <TrusteeAppointmentVerificationRow
      order={order}
      taskType={taskType}
      statusType={orderStatusType}
      fieldHeaders={fieldHeaders}
      hidden={hidden}
    />,
  );
}

describe('TrusteeAppointmentVerificationRow', () => {
  test('shows the task type, created date and status', () => {
    renderRow();

    const row = screen.getByTestId('accordion-heading-task-1');
    expect(row).toHaveTextContent('Trustee Appointment');
    expect(row).toHaveTextContent('11/01/2026');
    expect(row).toHaveTextContent('Pending Review');
  });

  test.each([
    {
      case: 'both court and division are named',
      overrides: {},
      subject: 'Eastern District of New York (Brooklyn): Chapter 7',
    },
    {
      case: 'the court name is unknown, so the court id is used',
      overrides: { courtName: undefined },
      subject: '091 (Brooklyn): Chapter 7',
    },
    {
      case: 'the division name is unknown, so the division code is used',
      overrides: { courtDivisionName: undefined },
      subject: 'Eastern District of New York (081): Chapter 7',
    },
    {
      case: 'both names are unknown, so the court id and division code are used',
      overrides: { courtName: undefined, courtDivisionName: undefined },
      subject: '091 (081): Chapter 7',
    },
  ])('subject shows $subject when $case', ({ overrides, subject }) => {
    renderRow({ ...task, ...overrides });

    expect(screen.getByTestId('accordion-heading-task-1')).toHaveTextContent(subject);
  });

  test('has no expand control, since the task has no detail to show yet', () => {
    renderRow();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('is hidden when filtered out', () => {
    renderRow(task, true);

    expect(screen.getByTestId('accordion-task-1')).not.toBeVisible();
  });
});
