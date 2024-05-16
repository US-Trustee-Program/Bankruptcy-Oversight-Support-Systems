import { CaseNumber } from '@/lib/components/CaseNumber';
import { AlertDetails } from '@/lib/components/uswds/Alert';
import { TransferOrder } from '@common/cams/orders';
import { FromCaseSummary } from './FromCaseSummary';

type RejectedTransferOrderProps = {
  order: TransferOrder;
  onOrderUpdate: (alertDetails: AlertDetails, order?: TransferOrder) => void;
};

export function RejectedTransferOrder(props: RejectedTransferOrderProps) {
  const { order } = props;
  return (
    <>
      <FromCaseSummary order={order} onOrderUpdate={props.onOrderUpdate} />
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div
          className="transfer-text grid-col-10"
          tabIndex={0}
          data-testid={`accordion-content-reject-message-${order.caseId}`}
        >
          Rejected transfer of{' '}
          <CaseNumber
            caseId={order.caseId}
            data-testid={`rejected-transfer-case-link-${order.caseId}`}
          ></CaseNumber>
          {order.reason && order.reason.length && (
            <>
              {' '}
              for the following reason:
              <blockquote>{order.reason}</blockquote>
            </>
          )}
          {!order.reason && <>.</>}
        </div>
        <div className="grid-col-1"></div>
      </div>
    </>
  );
}
