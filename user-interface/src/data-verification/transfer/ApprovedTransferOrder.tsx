import { CaseNumber } from '@/lib/components/CaseNumber';
import { AlertDetails } from '@/lib/components/uswds/Alert';
import { TransferOrder } from '@common/cams/orders';

import { FromCaseSummary } from './FromCaseSummary';

type ApprovedTransferOrderProps = {
  onOrderUpdate: (alertDetails: AlertDetails, order?: TransferOrder) => void;
  order: TransferOrder;
};

export function ApprovedTransferOrder(props: ApprovedTransferOrderProps) {
  const { order } = props;
  return (
    <>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <h3>Verified Transfer</h3>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="transfer-text grid-col-10" data-testid={`action-text-${order.id}`}>
          Transferred{' '}
          <CaseNumber
            caseId={order.caseId}
            data-testid={`approved-transfer-original-case-link-${order.caseId}`}
          ></CaseNumber>{' '}
          from{' '}
          <strong>
            {order.courtName} ({order.courtDivisionName})
          </strong>{' '}
          to{' '}
          <CaseNumber
            caseId={order.newCase!.caseId}
            data-testid={`approved-transfer-new-case-link-${order.newCase!.caseId}`}
          ></CaseNumber>{' '}
          and court{' '}
          <strong>
            {order.newCase?.courtName} ({order.newCase?.courtDivisionName}).
          </strong>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <h3>Order that was Verified</h3>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <FromCaseSummary onOrderUpdate={props.onOrderUpdate} order={order} />
    </>
  );
}
