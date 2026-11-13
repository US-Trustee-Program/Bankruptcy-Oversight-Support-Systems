import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  TrusteeAppointmentRefreshResult,
  TrusteeAppointmentVerificationDetail,
  TrusteeAppointmentVerificationListItem,
} from '@common/cams/trustee-appointment-verification';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
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

function renderRow(order = task, hidden = false, onOrderUpdate = vi.fn()) {
  render(
    <BrowserRouter>
      <TrusteeAppointmentVerificationRow
        order={order}
        taskType={taskType}
        statusType={orderStatusType}
        fieldHeaders={fieldHeaders}
        hidden={hidden}
        onOrderUpdate={onOrderUpdate}
      />
    </BrowserRouter>,
  );
}

/** Renders the row under a parent that applies onOrderUpdate, as the queue does. */
function renderRowWithParentState(initialOrder = task) {
  function Parent() {
    const [order, setOrder] = useState(initialOrder);
    return (
      <TrusteeAppointmentVerificationRow
        order={order}
        taskType={taskType}
        statusType={orderStatusType}
        fieldHeaders={fieldHeaders}
        onOrderUpdate={(_alert, updated) => setOrder(updated)}
      />
    );
  }
  render(
    <BrowserRouter>
      <Parent />
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
            onOrderUpdate={vi.fn()}
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

  test('shows a red alert, announced to screen readers, when loading details fails', async () => {
    vi.spyOn(Api2, 'getTrusteeAppointmentVerificationDetail').mockRejectedValue(new Error('boom'));
    renderRow();

    fireEvent.click(expandButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to load task details. Please try again.');
  });

  test("requests the task's detail with its trustee id, the collection's shard key", async () => {
    const detailSpy = vi
      .spyOn(Api2, 'getTrusteeAppointmentVerificationDetail')
      .mockResolvedValue({ data: detail } as never);
    renderRow();

    fireEvent.click(expandButton());

    await waitFor(() => expect(detailSpy).toHaveBeenCalledWith(task.id, task.trusteeId));
  });

  test('refetches detail on each new expand, so stale data is never shown and a retry after a failure can succeed', async () => {
    const detailSpy = vi
      .spyOn(Api2, 'getTrusteeAppointmentVerificationDetail')
      .mockResolvedValue({ data: detail } as never);
    renderRow();

    fireEvent.click(expandButton());
    await screen.findByTestId('problem-statement');
    fireEvent.click(expandButton()); // collapse
    fireEvent.click(expandButton()); // expand again

    await waitFor(() => expect(detailSpy).toHaveBeenCalledTimes(2));
  });

  test('retries after a failed load: re-expanding fetches again and can clear the error', async () => {
    const detailSpy = vi
      .spyOn(Api2, 'getTrusteeAppointmentVerificationDetail')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ data: detail } as never);
    renderRow();

    fireEvent.click(expandButton());
    await screen.findByRole('alert');
    fireEvent.click(expandButton()); // collapse
    fireEvent.click(expandButton()); // expand again, retrying

    await screen.findByTestId('problem-statement');
    expect(detailSpy).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
        expect(Api2.getTrusteeAppointmentVerificationDetail).toHaveBeenCalledWith(
          secondTask.id,
          secondTask.trusteeId,
        ),
      );
    });
  });

  /** Focus is inside the element (not dropped to <body>), as after a control is disabled or unmounted. */
  async function expectFocusInside(testId: string) {
    await waitFor(() => {
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).toContainElement(screen.getByTestId(testId));
    });
  }

  describe('Refresh Trustee Appointments', () => {
    const resolved: TrusteeAppointmentRefreshResult = {
      outcome: 'resolved',
      trusteeName: 'Jane Smith',
      updatedCaseCount: 3,
      task: { ...task, status: 'approved' },
    };
    const stillUncovered: TrusteeAppointmentRefreshResult = {
      outcome: 'still-uncovered',
      courtId: '091',
      courtName: 'Eastern District of Missouri',
      divisionCode: '081',
      courtDivisionName: 'St. Louis',
      chapter: '7',
    };
    const newAppointment = {
      id: 'appointment-new',
      trusteeId: 'trustee-1',
      chapter: '13',
      appointmentType: 'standing',
      courtId: '091',
      courtName: 'Western District of Missouri',
      divisionCodes: ['081'],
      appointedDate: '2026-11-10',
      status: 'active',
      effectiveDate: '2026-11-10',
      createdOn: '2026-11-10T00:00:00.000Z',
      createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
      updatedOn: '2026-11-10T00:00:00.000Z',
      updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
      agreement: {
        matchesCourt: true,
        matchesDivision: true,
        matchesChapter: false,
        isActive: true,
        score: 3,
      },
    } as TrusteeAppointmentVerificationDetail['appointments'][number];
    let detailSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      detailSpy = vi
        .spyOn(Api2, 'getTrusteeAppointmentVerificationDetail')
        .mockResolvedValue({ data: detail } as never);
    });

    async function expandAndLoad(order = task, onOrderUpdate = vi.fn()) {
      renderRow(order, false, onOrderUpdate);
      fireEvent.click(expandButton(order.id));
      await screen.findByTestId('problem-statement');
      return onOrderUpdate;
    }

    function refreshButton() {
      return screen.getByTestId(`button-refresh-trustee-appointments-${task.id}`);
    }

    test('guidance tells the verifier how to fix it, with the refresh as a button styled as a link', async () => {
      await expandAndLoad();

      expect(screen.getByTestId('refresh-guidance')).toHaveTextContent(
        "To fix this, a Trustee Admin must add or reactivate the appointment on the trustee's profile. Then Refresh Trustee Appointments to check again.",
      );
      expect(refreshButton()).toHaveClass('usa-button--unstyled');
    });

    test('offers no Resolve or reject action', async () => {
      await expandAndLoad();

      expect(screen.queryByRole('button', { name: /resolve|reject/i })).not.toBeInTheDocument();
    });

    test('shows a spinner while refreshing, and refreshes the task within its trustee', async () => {
      let finish: (value: unknown) => void = () => {};
      const refreshSpy = vi
        .spyOn(Api2, 'refreshTrusteeAppointmentVerification')
        .mockReturnValue(new Promise((r) => (finish = r)) as never);
      await expandAndLoad();

      fireEvent.click(refreshButton());

      expect(screen.getByTestId(`refresh-progress-${task.id}`)).toHaveTextContent(
        'Refreshing trustee appointments...',
      );
      expect(refreshButton()).toBeDisabled();
      expect(refreshSpy).toHaveBeenCalledWith('task-1', 'trustee-1');
      finish({ data: stillUncovered });
      await waitFor(() =>
        expect(screen.queryByText('Refreshing trustee appointments...')).not.toBeInTheDocument(),
      );
    });

    test('a successful refresh hands the resolved task and a success message to the queue', async () => {
      vi.spyOn(Api2, 'refreshTrusteeAppointmentVerification').mockResolvedValue({
        data: resolved,
      } as never);
      const onOrderUpdate = await expandAndLoad();

      fireEvent.click(refreshButton());

      await waitFor(() =>
        expect(onOrderUpdate).toHaveBeenCalledWith(
          {
            message: "Trustee Jane Smith's appointment verified for 3 cases.",
            type: UswdsAlertStyle.Success,
            timeOut: 8,
          },
          resolved.task,
        ),
      );
      expect(screen.queryByTestId(`alert-refresh-alert-${task.id}`)).not.toBeInTheDocument();
    });

    test('a refresh that still finds no covering appointment warns the verifier and reloads the appointments without the loading spinner', async () => {
      let finishReload: (value: unknown) => void = () => {};
      detailSpy
        .mockResolvedValueOnce({ data: detail } as never)
        .mockReturnValueOnce(new Promise((r) => (finishReload = r)) as never);
      vi.spyOn(Api2, 'refreshTrusteeAppointmentVerification').mockResolvedValue({
        data: stillUncovered,
      } as never);
      const onOrderUpdate = await expandAndLoad();
      expect(screen.getByText('This trustee has no appointments in CAMS.')).toBeInTheDocument();

      fireEvent.click(refreshButton());

      const alert = await screen.findByTestId(`alert-refresh-alert-${task.id}`);
      expect(screen.getByTestId(`alert-message-refresh-alert-${task.id}`)).toHaveTextContent(
        "There's still no active Chapter 7 appointment in Eastern District of Missouri (St. Louis). Ask a Trustee Admin to add or reactivate it, then try again.",
      );
      expect(alert.className).toContain(UswdsAlertStyle.Warning);
      expect(onOrderUpdate).not.toHaveBeenCalled();
      await waitFor(() => expect(detailSpy).toHaveBeenCalledTimes(2));
      expect(screen.queryByText('Loading task details...')).not.toBeInTheDocument();

      finishReload({ data: { ...detail, appointments: [newAppointment] } });

      expect(await screen.findByText('Western District of Missouri')).toBeInTheDocument();
      expect(screen.getByTestId(`alert-refresh-alert-${task.id}`)).toBe(alert);
      await waitFor(() => expect(refreshButton()).toBeEnabled());
    });

    test('keeps the warning and the appointments already shown when the reload after a still-uncovered refresh fails', async () => {
      detailSpy
        .mockResolvedValueOnce({ data: detail } as never)
        .mockRejectedValueOnce(new Error('reload failed'));
      vi.spyOn(Api2, 'refreshTrusteeAppointmentVerification').mockResolvedValue({
        data: stillUncovered,
      } as never);
      await expandAndLoad();

      fireEvent.click(refreshButton());

      await waitFor(() => expect(refreshButton()).toBeEnabled());
      expect(detailSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId(`alert-refresh-alert-${task.id}`).className).toContain(
        UswdsAlertStyle.Warning,
      );
      expect(screen.getByText('This trustee has no appointments in CAMS.')).toBeInTheDocument();
    });

    test('a refresh that fails shows an error and leaves the task open', async () => {
      vi.spyOn(Api2, 'refreshTrusteeAppointmentVerification').mockRejectedValue(new Error('boom'));
      const onOrderUpdate = await expandAndLoad();

      fireEvent.click(refreshButton());

      const alert = await screen.findByTestId(`alert-refresh-alert-${task.id}`);
      expect(screen.getByTestId(`alert-message-refresh-alert-${task.id}`)).toHaveTextContent(
        'Unable to refresh trustee appointments. Try again later.',
      );
      expect(alert.className).toContain(UswdsAlertStyle.Error);
      expect(onOrderUpdate).not.toHaveBeenCalled();
      await waitFor(() => expect(refreshButton()).toBeEnabled());
    });

    test("a new refresh clears the previous refresh's alert", async () => {
      vi.spyOn(Api2, 'refreshTrusteeAppointmentVerification')
        .mockRejectedValueOnce(new Error('boom'))
        .mockReturnValueOnce(new Promise(() => {}) as never);
      await expandAndLoad();
      fireEvent.click(refreshButton());
      await screen.findByTestId(`alert-refresh-alert-${task.id}`);
      await waitFor(() => expect(refreshButton()).toBeEnabled());

      fireEvent.click(refreshButton());

      expect(screen.queryByTestId(`alert-refresh-alert-${task.id}`)).not.toBeInTheDocument();
    });

    test('after a refresh resolves the task, focus moves to a resolved statement saying the appointment is verified', async () => {
      const user = userEvent.setup({ delay: null });
      vi.spyOn(Api2, 'refreshTrusteeAppointmentVerification').mockResolvedValue({
        data: resolved,
      } as never);
      renderRowWithParentState();
      fireEvent.click(expandButton());
      await screen.findByTestId('problem-statement');

      await user.click(refreshButton());

      const statement = await screen.findByTestId('resolved-statement');
      await waitFor(() => expect(statement).toHaveFocus());
      expect(statement).toHaveTextContent("Trustee Jane Smith's appointment is verified.");
    });

    test('a task that the parent flips to approved without a local refresh does not take focus', async () => {
      const user = userEvent.setup({ delay: null });
      const { rerender } = render(
        <BrowserRouter>
          <TrusteeAppointmentVerificationRow
            order={task}
            taskType={taskType}
            statusType={orderStatusType}
            fieldHeaders={fieldHeaders}
            onOrderUpdate={vi.fn()}
          />
        </BrowserRouter>,
      );
      await user.click(expandButton());
      await screen.findByTestId('problem-statement');
      expandButton().focus();

      rerender(
        <BrowserRouter>
          <TrusteeAppointmentVerificationRow
            order={{ ...task, status: 'approved' }}
            taskType={taskType}
            statusType={orderStatusType}
            fieldHeaders={fieldHeaders}
            onOrderUpdate={vi.fn()}
          />
        </BrowserRouter>,
      );

      expect(screen.getByTestId('resolved-statement')).not.toHaveFocus();
      expect(expandButton()).toHaveFocus();
    });

    test('while a refresh runs, focus moves to the progress indicator instead of falling to the body', async () => {
      const user = userEvent.setup({ delay: null });
      vi.spyOn(Api2, 'refreshTrusteeAppointmentVerification').mockReturnValue(
        new Promise(() => {}) as never,
      );
      await expandAndLoad();

      await user.click(refreshButton());

      await expectFocusInside(`refresh-progress-${task.id}`);
    });

    test('a refresh that still finds no covering appointment moves focus to the warning alert, not the body', async () => {
      const user = userEvent.setup({ delay: null });
      vi.spyOn(Api2, 'refreshTrusteeAppointmentVerification').mockResolvedValue({
        data: stillUncovered,
      } as never);
      await expandAndLoad();

      await user.click(refreshButton());

      await expectFocusInside(`alert-refresh-alert-${task.id}`);
    });

    test('a refresh that fails moves focus to the error alert, not the body', async () => {
      const user = userEvent.setup({ delay: null });
      vi.spyOn(Api2, 'refreshTrusteeAppointmentVerification').mockRejectedValue(new Error('boom'));
      await expandAndLoad();

      await user.click(refreshButton());

      await expectFocusInside(`alert-refresh-alert-${task.id}`);
    });

    test('a refresh that resolves the task reloads the appointments, showing the covering one', async () => {
      const user = userEvent.setup({ delay: null });
      detailSpy
        .mockResolvedValueOnce({ data: detail } as never)
        .mockResolvedValueOnce({ data: { ...detail, appointments: [newAppointment] } } as never);
      vi.spyOn(Api2, 'refreshTrusteeAppointmentVerification').mockResolvedValue({
        data: resolved,
      } as never);
      renderRowWithParentState();
      fireEvent.click(expandButton());
      await screen.findByTestId('problem-statement');

      await user.click(refreshButton());

      expect(await screen.findByText('Western District of Missouri')).toBeInTheDocument();
    });

    test('a task that loads already approved does not take focus', async () => {
      renderRowWithParentState({ ...task, status: 'approved' });
      fireEvent.click(expandButton());
      await screen.findByTestId('problem-statement');

      expect(screen.getByTestId('problem-statement')).not.toHaveFocus();
    });

    test('a task that is no longer pending offers no refresh', async () => {
      await expandAndLoad({ ...task, status: 'approved' });

      expect(screen.queryByTestId('refresh-guidance')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId(`button-refresh-trustee-appointments-${task.id}`),
      ).not.toBeInTheDocument();
    });
  });
});
