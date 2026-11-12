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
  test('shows the task type, court and division subject, created date and status', () => {
    renderRow();

    const row = screen.getByTestId('accordion-heading-task-1');
    expect(row).toHaveTextContent('Trustee Appointment');
    expect(row).toHaveTextContent('Eastern District of New York (Brooklyn): Chapter 7');
    expect(row).toHaveTextContent('11/01/2026');
    expect(row).toHaveTextContent('Pending Review');
  });

  test('falls back to the court id and division code when their names are unknown', () => {
    const { courtName: _court, courtDivisionName: _division, ...unnamed } = task;

    renderRow(unnamed);

    expect(screen.getByTestId('accordion-heading-task-1')).toHaveTextContent(
      '091 (081): Chapter 7',
    );
  });

  test('falls back to the division code alone when only the court is named', () => {
    const { courtDivisionName: _division, ...courtOnly } = task;

    renderRow(courtOnly);

    expect(screen.getByTestId('accordion-heading-task-1')).toHaveTextContent(
      'Eastern District of New York (081): Chapter 7',
    );
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
