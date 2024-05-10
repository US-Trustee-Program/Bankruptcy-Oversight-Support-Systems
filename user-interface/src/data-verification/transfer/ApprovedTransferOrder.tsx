import { CaseNumber } from '@/lib/components/CaseNumber';
import { TransferOrder } from '@common/cams/orders';

type ApprovedTransferOrderProps = {
  order: TransferOrder;
};

export function ApprovedTransferOrder(props: ApprovedTransferOrderProps) {
  const { order } = props;
  return (
    <div className="grid-row grid-gap-lg">
      <div className="grid-col-1"></div>
      <div
        className="transfer-text grid-col-10"
        tabIndex={0}
        data-testid={`action-text-${order.id}`}
      >
        Transferred{' '}
        <CaseNumber
          caseId={order.caseId}
          data-testid={`approved-transfer-original-case-link-${order.caseId}`}
        ></CaseNumber>{' '}
        from
        <span className="transfer-highlight__span">
          {order.courtName} ({order.courtDivisionName})
        </span>
        to{' '}
        <CaseNumber
          caseId={order.newCase!.caseId}
          data-testid={`approved-transfer-new-case-link-${order.newCase!.caseId}`}
        ></CaseNumber>{' '}
        and court
        <span className="transfer-highlight__span">
          {order.newCase?.courtName} ({order.newCase?.courtDivisionName}).
        </span>
      </div>
      <div className="grid-col-1"></div>
    </div>
  );
}
