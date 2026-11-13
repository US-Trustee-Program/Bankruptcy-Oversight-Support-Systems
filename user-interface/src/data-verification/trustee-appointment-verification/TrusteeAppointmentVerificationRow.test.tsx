import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  TrusteeAppointmentVerificationDetail,
  TrusteeAppointmentVerificationListItem,
} from '@common/cams/trustee-appointment-verification';
import { orderStatusType, taskType } from '@/lib/utils/labels';
import Api2 from '@/lib/models/api2';
import { AccordionGroup } from '@/lib/components/uswds/Accordion';
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

const detail: TrusteeAppointmentVerificationDetail = {
  id: 'task-1',
  documentType: 'TRUSTEE_APPOINTMENT_VERIFICATION',
  taskType: 'trustee-appointment',
  trusteeId: 'trustee-1',
  trusteeName: 'Jane Smith',
  courtId: '091',
  courtName: 'Eastern District of New York',
  divisionCode: '081',
  courtDivisionName: 'Brooklyn',
  chapter: '7',
  reason: 'no-appointment',
  caseIds: ['081-24-00001'],
  status: 'pending',
  createdOn: '2026-11-01T00:00:00.000Z',
  createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
  updatedOn: '2026-11-01T00:00:00.000Z',
  updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
  appointments: [],
};

function renderRow(order = task, hidden = false) {
  render(
    <BrowserRouter>
      <TrusteeAppointmentVerificationRow
        order={order}
        taskType={taskType}
        statusType={orderStatusType}
        fieldHeaders={fieldHeaders}
        hidden={hidden}
      />
    </BrowserRouter>,
  );
}

function expandButton(id: string = task.id) {
  return screen.getByTestId(`accordion-button-order-list-${id}`);
}

function renderInAccordionGroup(orders: TrusteeAppointmentVerificationListItem[]) {
  render(
    <BrowserRouter>
      <AccordionGroup>
        {orders.map((order) => (
          <TrusteeAppointmentVerificationRow
            key={order.id}
            order={order}
            taskType={taskType}
            statusType={orderStatusType}
            fieldHeaders={fieldHeaders}
            hidden={false}
          />
        ))}
      </AccordionGroup>
    </BrowserRouter>,
  );
}

describe('TrusteeAppointmentVerificationRow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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

  test('is hidden when filtered out', () => {
    renderRow(task, true);

    expect(screen.getByTestId('accordion-order-list-task-1')).not.toBeVisible();
  });

  test('expanding shows a loading spinner, then the task details', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointmentVerificationDetail').mockResolvedValue({
      data: detail,
    } as never);
    renderRow();

    fireEvent.click(expandButton());

    expect(screen.getByText('Loading task details...')).toBeInTheDocument();
    await screen.findByTestId('problem-statement');
    expect(screen.queryByText('Loading task details...')).not.toBeInTheDocument();
  });

  test('shows a red alert when loading details fails', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointmentVerificationDetail').mockRejectedValue(new Error('boom'));
    renderRow();

    fireEvent.click(expandButton());

    expect(
      await screen.findByText('Unable to load task details. Please try again.'),
    ).toBeInTheDocument();
  });

  test('does not refetch on a second expand once details are loaded', async () => {
    const detailSpy = vi
      .spyOn(Api2, 'getTrusteeAppointmentVerificationDetail')
      .mockResolvedValue({ data: detail } as never);
    renderRow();

    fireEvent.click(expandButton());
    await screen.findByTestId('problem-statement');
    fireEvent.click(expandButton());
    fireEvent.click(expandButton());

    expect(detailSpy).toHaveBeenCalledTimes(1);
  });

  test("the reason sentence for 'no-appointment' links the trustee's name to their profile", async () => {
    vi.spyOn(Api2, 'getTrusteeAppointmentVerificationDetail').mockResolvedValue({
      data: { ...detail, reason: 'no-appointment' },
    } as never);
    renderRow();

    fireEvent.click(expandButton());

    const statement = await screen.findByTestId('problem-statement');
    expect(statement).toHaveTextContent(
      'Trustee Jane Smith is not appointed in this court, division and chapter. Affects 1 case:',
    );
    const trusteeLink = screen.getByRole('link', { name: /Jane Smith/ });
    expect(trusteeLink).toHaveAttribute('href', '/trustees/trustee-1');
  });

  test("the reason sentence for 'appointment-inactive'", async () => {
    vi.spyOn(Api2, 'getTrusteeAppointmentVerificationDetail').mockResolvedValue({
      data: { ...detail, reason: 'appointment-inactive' },
    } as never);
    renderRow();

    fireEvent.click(expandButton());

    const statement = await screen.findByTestId('problem-statement');
    expect(statement).toHaveTextContent(
      'The appointment for Trustee Jane Smith in this court, division and chapter is not active. Affects 1 case:',
    );
  });

  test('each affected case is linked, sorted regardless of input order', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointmentVerificationDetail').mockResolvedValue({
      data: { ...detail, caseIds: ['081-26-00002', '081-26-00001'] },
    } as never);
    renderRow();

    fireEvent.click(expandButton());

    await screen.findByTestId('affected-cases');
    const links = screen.getAllByRole('link', { name: /26-0000\d/ });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/case-detail/081-26-00001',
      '/case-detail/081-26-00002',
    ]);
  });

  test('a single affected case is linked without a case count', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointmentVerificationDetail').mockResolvedValue({
      data: { ...detail, caseIds: ['081-26-00001'] },
    } as never);
    renderRow();

    fireEvent.click(expandButton());

    const link = await screen.findByRole('link', { name: /26-00001/ });
    expect(link).toHaveAttribute('href', '/case-detail/081-26-00001');
    expect(screen.queryByTestId('affected-cases')).not.toBeInTheDocument();
  });

  test('shows the Appointments table once details load', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointmentVerificationDetail').mockResolvedValue({
      data: { ...detail, appointments: [] },
    } as never);
    renderRow();

    fireEvent.click(expandButton());

    expect(
      await screen.findByText('This trustee has no appointments in CAMS.'),
    ).toBeInTheDocument();
  });

  test('does not retry after a failed load; re-expanding shows the same error', async () => {
    const detailSpy = vi
      .spyOn(Api2, 'getTrusteeAppointmentVerificationDetail')
      .mockRejectedValue(new Error('boom'));
    renderRow();

    fireEvent.click(expandButton());
    await screen.findByText('Unable to load task details. Please try again.');
    fireEvent.click(expandButton());
    fireEvent.click(expandButton());

    expect(detailSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Unable to load task details. Please try again.')).toBeInTheDocument();
  });

  describe('inside an accordion group', () => {
    const secondTask: TrusteeAppointmentVerificationListItem = { ...task, id: 'task-2' };

    beforeEach(() => {
      vi.spyOn(Api2, 'getTrusteeAppointmentVerificationDetail').mockImplementation(
        async (id: string) => ({ data: { ...detail, id } }) as never,
      );
    });

    test('expanding a second task collapses the first', async () => {
      renderInAccordionGroup([task, secondTask]);

      fireEvent.click(expandButton(task.id));
      await waitFor(() => expect(expandButton(task.id)).toHaveAttribute('aria-expanded', 'true'));
      fireEvent.click(expandButton(secondTask.id));

      await waitFor(() =>
        expect(expandButton(secondTask.id)).toHaveAttribute('aria-expanded', 'true'),
      );
      expect(expandButton(task.id)).toHaveAttribute('aria-expanded', 'false');
    });

    test('still loads the task details when expanded inside a group', async () => {
      renderInAccordionGroup([task, secondTask]);

      fireEvent.click(expandButton(secondTask.id));

      await waitFor(() =>
        expect(Api2.getTrusteeAppointmentVerificationDetail).toHaveBeenCalledWith(secondTask.id),
      );
    });
  });
});
