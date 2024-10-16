import { useRef, useState } from 'react';
import { Accordion } from '@/lib/components/uswds/Accordion';
import { CourtDivisionDetails } from '@common/cams/courts';
import { TransferOrder } from '@common/cams/orders';
import { formatDate } from '@/lib/utils/datetime';
import { AlertDetails } from '@/lib/components/uswds/Alert';
import {
  PendingTransferOrder,
  PendingTransferOrderImperative,
} from './transfer/PendingTransferOrder';
import { ApprovedTransferOrder } from './transfer/ApprovedTransferOrder';
import { RejectedTransferOrder } from './transfer/RejectedTransferOrder';
import './TransferOrderAccordion.scss';

export interface TransferOrderAccordionProps {
  order: TransferOrder;
  statusType: Map<string, string>;
  orderType: Map<string, string>;
  courts: Array<CourtDivisionDetails>;
  regionsMap: Map<string, string>;
  onOrderUpdate: (alertDetails: AlertDetails, order?: TransferOrder) => void;
  onExpand?: (id: string) => void;
  expandedId?: string;
  hidden?: boolean;
}

export function TransferOrderAccordion(props: TransferOrderAccordionProps) {
  const { order, hidden, statusType, orderType, courts, expandedId, onExpand } = props;
  const [expanded, setExpanded] = useState<boolean>(false);

  const pendingTransferOrderRef = useRef<PendingTransferOrderImperative>(null);

  function onCollapse() {
    pendingTransferOrderRef?.current?.cancel();
  }

  function handleOnExpand(expandedId: string) {
    if (onExpand) onExpand(expandedId);
    setExpanded(true);
  }

  return (
    <Accordion
      key={order.id}
      id={`order-list-${order.id}`}
      expandedId={expandedId}
      onExpand={handleOnExpand}
      onCollapse={onCollapse}
      hidden={hidden}
    >
      <section
        className="accordion-heading grid-row grid-gap-lg"
        data-testid={`accordion-heading-${order.id}`}
      >
        <div
          className="grid-col-6 text-no-wrap"
          aria-label={`Court district – ${order.courtName}.`}
        >
          {order.courtName}
        </div>
        <div
          className="grid-col-2 text-no-wrap"
          title="Event date"
          aria-label={`Event date – ${formatDate(order.orderDate)}.`}
        >
          {formatDate(order.orderDate)}
        </div>
        <div className="grid-col-2 order-type text-no-wrap">
          <span
            className="event-type-label"
            aria-label={`Event type ${orderType.get(order.orderType)}.`}
          >
            {orderType.get(order.orderType)}
          </span>
        </div>
        <div className="grid-col-2 order-status text-no-wrap">
          <span
            className={`${order.status} event-status-label`}
            aria-label={`Event status ${statusType.get(order.status)}.`}
          >
            {statusType.get(order.status)}
          </span>
        </div>
      </section>
      <section className="accordion-content" data-testid={`accordion-content-${order.id}`}>
        {expanded && (
          <>
            {order.status === 'pending' && (
              <PendingTransferOrder
                order={order}
                onOrderUpdate={props.onOrderUpdate}
                officesList={courts}
                ref={pendingTransferOrderRef}
              />
            )}
            {order.status === 'approved' && (
              <ApprovedTransferOrder order={order} onOrderUpdate={props.onOrderUpdate} />
            )}
            {order.status === 'rejected' && (
              <RejectedTransferOrder order={order} onOrderUpdate={props.onOrderUpdate} />
            )}
          </>
        )}
      </section>
      )
    </Accordion>
  );
}
