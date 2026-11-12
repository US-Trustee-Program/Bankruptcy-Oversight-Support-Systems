import { TrusteeAppointmentVerificationListItem } from '@common/cams/trustee-appointment-verification';
import { formatDate } from '@/lib/utils/datetime';

export interface TrusteeAppointmentVerificationRowProps {
  order: TrusteeAppointmentVerificationListItem;
  statusType: Map<string, string>;
  taskType: Map<string, string>;
  fieldHeaders: string[];
  hidden?: boolean;
}

function subjectOf(order: TrusteeAppointmentVerificationListItem): string {
  const court = order.courtName ?? order.courtId;
  const division = order.courtDivisionName ?? order.divisionCode;
  return `${court} (${division}): Chapter ${order.chapter}`;
}

/**
 * A trustee appointment task (CAMS-956) in the Data Verification queue. Laid out like the other
 * task rows, but with no expand control: the task has no detail view yet (Slice 2).
 */
export function TrusteeAppointmentVerificationRow(props: TrusteeAppointmentVerificationRowProps) {
  const { order, statusType, taskType, fieldHeaders, hidden } = props;
  const taskTypeLabel = taskType.get(order.taskType);
  const subject = subjectOf(order);
  const statusLabel = statusType.get(order.status);

  return (
    <h4
      className="usa-accordion__heading static-task-row"
      data-testid={`accordion-${order.id}`}
      hidden={hidden}
    >
      <div className="usa-accordion__button">
        <section
          className="accordion-heading grid-row grid-gap-lg"
          data-testid={`accordion-heading-${order.id}`}
        >
          <div
            className="accordion-header-field grid-col-2 order-type text-no-wrap"
            data-cell={fieldHeaders[0]}
          >
            <span
              className="event-type-label"
              aria-label={`${fieldHeaders[0]} - ${taskTypeLabel}.`}
            >
              {taskTypeLabel}
            </span>
          </div>
          <div
            className="accordion-header-field grid-col-6 text-no-wrap"
            aria-label={`${fieldHeaders[1]} – ${subject}.`}
            data-cell={fieldHeaders[1]}
          >
            {subject}
          </div>
          <div
            className="accordion-header-field grid-col-2 text-no-wrap"
            aria-label={`${fieldHeaders[2]} on ${formatDate(order.taskDate)}.`}
            data-cell={fieldHeaders[2]}
          >
            {formatDate(order.taskDate)}
          </div>
          <div
            className="accordion-header-field grid-col-2 order-status text-no-wrap"
            data-cell={fieldHeaders[3]}
          >
            <span
              className={`${order.status} event-status-label`}
              aria-label={`${fieldHeaders[3]} - ${statusLabel}.`}
            >
              {statusLabel}
            </span>
          </div>
        </section>
      </div>
    </h4>
  );
}

// Has no expand state, so it opts out of AccordionGroup's single-open behavior. See Accordion.tsx.
TrusteeAppointmentVerificationRow.excludeFromAccordionGroup = true;
