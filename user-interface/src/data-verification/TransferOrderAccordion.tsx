import './TransferOrderAccordion.scss';

import { Accordion } from '@/lib/components/uswds/Accordion';
import { AlertDetails } from '@/lib/components/uswds/Alert';
import { formatDate } from '@/lib/utils/datetime';
import { CourtDivisionDetails } from '@common/cams/courts';
import { TransferOrder } from '@common/cams/orders';
import { useRef, useState } from 'react';

import { ApprovedTransferOrder } from './transfer/ApprovedTransferOrder';
import {
  PendingTransferOrder,
  PendingTransferOrderImperative,
} from './transfer/PendingTransferOrder';
import { RejectedTransferOrder } from './transfer/RejectedTransferOrder';

export interface TransferOrderAccordionProps {
  courts: Array<CourtDivisionDetails>;
  expandedId?: string;
  fieldHeaders: string[];
  hidden?: boolean;
  onExpand?: (id: string) => void;
  onOrderUpdate: (alertDetails: AlertDetails, order?: TransferOrder) => void;
  order: TransferOrder;
  orderType: Map<string, string>;
  regionsMap: Map<string, string>;
  statusType: Map<string, string>;
}

export function TransferOrderAccordion(props: TransferOrderAccordionProps) {
  const { courts, expandedId, fieldHeaders, hidden, onExpand, order, orderType, statusType } =
    props;
  const [expanded, setExpanded] = useState<boolean>(false);

  const pendingTransferOrderRef = useRef<PendingTransferOrderImperative>(null);

  function onCollapse() {
    pendingTransferOrderRef?.current?.cancel();
  }

  function handleOnExpand(expandedId: string) {
    if (onExpand) onExpand(expandedId);
    setExpanded(true);
  }

  function printAriaLabel() {
    const action = expandedId === `order-list-${order.id}` ? 'Collapse' : 'Expand';
    return `Click to ${action}.`;
  }

  return (
    <Accordion
      expandedId={expandedId}
      hidden={hidden}
      id={`order-list-${order.id}`}
      key={order.id}
      onCollapse={onCollapse}
      onExpand={handleOnExpand}
    >
      <section
        className="accordion-heading grid-row grid-gap-lg"
        data-testid={`accordion-heading-${order.id}`}
      >
        <div
          aria-label={`${fieldHeaders[0]} – ${order.courtName}.`}
          className="accordion-header-field grid-col-6 text-no-wrap"
          data-cell={fieldHeaders[0]}
        >
          {order.courtName}
        </div>
        <div
          aria-label={`${fieldHeaders[1]} on ${formatDate(order.orderDate)}.`}
          className="accordion-header-field grid-col-2 text-no-wrap"
          data-cell={fieldHeaders[1]}
          title="Event date"
        >
          {formatDate(order.orderDate)}
        </div>
        <div
          className="accordion-header-field grid-col-2 order-type text-no-wrap"
          data-cell={fieldHeaders[2]}
        >
          <span
            aria-label={`${fieldHeaders[2]} - ${orderType.get(order.orderType)}.`}
            className="event-type-label"
          >
            {orderType.get(order.orderType)}
          </span>
        </div>
        <div
          className="accordion-header-field grid-col-2 order-status text-no-wrap"
          data-cell={fieldHeaders[3]}
        >
          <span
            aria-label={`${fieldHeaders[3]} - ${statusType.get(order.status)}.`}
            className={`${order.status} event-status-label`}
          >
            {statusType.get(order.status)}
          </span>
        </div>
        <div aria-label={printAriaLabel()} className="expand-aria-label"></div>
      </section>
      <section className="accordion-content" data-testid={`accordion-content-${order.id}`}>
        {expanded && (
          <>
            {order.status === 'pending' && (
              <PendingTransferOrder
                officesList={courts}
                onOrderUpdate={props.onOrderUpdate}
                order={order}
                ref={pendingTransferOrderRef}
              />
            )}
            {order.status === 'approved' && (
              <ApprovedTransferOrder onOrderUpdate={props.onOrderUpdate} order={order} />
            )}
            {order.status === 'rejected' && (
              <RejectedTransferOrder onOrderUpdate={props.onOrderUpdate} order={order} />
            )}
          </>
        )}
      </section>
      )
    </Accordion>
  );
}
