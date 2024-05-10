import { Accordion } from '@/lib/components/uswds/Accordion';
import { OfficeDetails } from '@common/cams/courts';
import { TransferOrder } from '@common/cams/orders';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { AlertDetails } from '@/lib/components/uswds/Alert';
import './TransferOrderAccordion.scss';
import { PendingTransferOrder } from './transfer/PendingTransferOrder';
import { ApprovedTransferOrder } from '@/data-verification/transfer/ApprovedTransferOrder';
import { RejectedTransferOrder } from '@/data-verification/transfer/RejectedTransferOrder';

export interface TransferOrderAccordionProps {
  order: TransferOrder;
  statusType: Map<string, string>;
  orderType: Map<string, string>;
  officesList: Array<OfficeDetails>;
  regionsMap: Map<string, string>;
  onOrderUpdate: (alertDetails: AlertDetails, order?: TransferOrder) => void;
  onExpand?: (id: string) => void;
  expandedId?: string;
  hidden?: boolean;
}

export function TransferOrderAccordion(props: TransferOrderAccordionProps) {
  const { order, hidden, statusType, orderType, officesList, expandedId, onExpand } = props;
  // const [activeButtonId, setActiveButtonId] = useState<string>(`suggested-cases-${order.id}`);

  function onCollapse() {
    // TODO: Need imperitive API on pendingtransferOrder component to expose reset/
    // cancelUpdate();
    // approveButtonRef.current?.disableButton(true);
    // setActiveButtonId(`enter-case-${order.id}`);
  }

  return (
    <>
      <Accordion
        key={order.id}
        id={`order-list-${order.id}`}
        expandedId={expandedId}
        onExpand={onExpand}
        onCollapse={onCollapse}
        hidden={hidden}
      >
        <section
          className="accordion-heading grid-row grid-gap-lg"
          data-testid={`accordion-heading-${order.id}`}
        >
          <div
            className="grid-col-6 text-no-wrap"
            aria-label={`Court district – ${getCaseNumber(order.courtName)}`}
          >
            {order.courtName}
          </div>
          <div
            className="grid-col-2 text-no-wrap"
            title="Event date"
            aria-label={`Event date – ${formatDate(order.orderDate)}`}
          >
            {formatDate(order.orderDate)}
          </div>
          <div className="grid-col-2 order-type text-no-wrap">
            <span aria-label={`Event type ${orderType.get(order.orderType)}`}>
              {orderType.get(order.orderType)}
            </span>
          </div>
          <div className="grid-col-2 order-status text-no-wrap">
            <span
              className={order.status}
              aria-label={`Event status ${statusType.get(order.status)}`}
            >
              {statusType.get(order.status)}
            </span>
          </div>
        </section>
        <section className="accordion-content" data-testid={`accordion-content-${order.id}`}>
          {order.status === 'pending' && (
            <PendingTransferOrder
              order={order}
              onOrderUpdate={props.onOrderUpdate}
              officesList={officesList}
            />
          )}
          {order.status === 'approved' && <ApprovedTransferOrder order={order} />}
          {order.status === 'rejected' && <RejectedTransferOrder order={order} />}
        </section>
      </Accordion>
    </>
  );
}
