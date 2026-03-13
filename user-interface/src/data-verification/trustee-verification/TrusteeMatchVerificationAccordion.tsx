import { Accordion } from '@/lib/components/uswds/Accordion';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { formatDate } from '@/lib/utils/datetime';

export interface TrusteeMatchVerificationAccordionProps {
  order: TrusteeMatchVerification;
  statusType: Map<string, string>;
  orderType: Map<string, string>;
  fieldHeaders: string[];
  hidden?: boolean;
}

export function TrusteeMatchVerificationAccordion(props: TrusteeMatchVerificationAccordionProps) {
  const { order, hidden, statusType, orderType, fieldHeaders } = props;

  return (
    <Accordion key={order.id} id={`order-list-${order.id}`} hidden={hidden}>
      <section
        className="accordion-heading grid-row grid-gap-lg"
        data-testid={`accordion-heading-${order.id}`}
      >
        <div
          className="accordion-header-field grid-col-6 text-no-wrap"
          aria-label={`${fieldHeaders[0]} – ${order.courtId}.`}
          data-cell={fieldHeaders[0]}
        >
          {order.courtId}
        </div>
        <div
          className="accordion-header-field grid-col-2 text-no-wrap"
          title="Event date"
          aria-label={`${fieldHeaders[1]} on ${formatDate(order.createdOn ?? order.updatedOn)}.`}
          data-cell={fieldHeaders[1]}
        >
          {formatDate(order.createdOn ?? order.updatedOn)}
        </div>
        <div
          className="accordion-header-field grid-col-2 order-type text-no-wrap"
          data-cell={fieldHeaders[2]}
        >
          <span
            className="event-type-label"
            aria-label={`${fieldHeaders[2]} - ${orderType.get(order.orderType)}.`}
          >
            {orderType.get(order.orderType)}
          </span>
        </div>
        <div
          className="accordion-header-field grid-col-2 order-status text-no-wrap"
          data-cell={fieldHeaders[3]}
        >
          <span
            className={`${order.status} event-status-label`}
            aria-label={`${fieldHeaders[3]} - ${statusType.get(order.status)}.`}
          >
            {statusType.get(order.status)}
          </span>
        </div>
      </section>
      <section className="accordion-content" data-testid={`accordion-content-${order.id}`}>
        <p>
          <strong>Case:</strong> {order.caseId}
        </p>
        <p>
          <strong>DXTR Trustee:</strong> {order.dxtrTrustee.fullName}
        </p>
        <p>
          <strong>Mismatch Reason:</strong> {order.mismatchReason}
        </p>
      </section>
    </Accordion>
  );
}
