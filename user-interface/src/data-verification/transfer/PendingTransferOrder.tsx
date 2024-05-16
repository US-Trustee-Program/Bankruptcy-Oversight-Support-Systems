import { useRef, useState } from 'react';
import { CaseSummary } from '@common/cams/cases';
import { OrderStatus, TransferOrder, TransferOrderAction } from '@common/cams/orders';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useApi } from '@/lib/hooks/UseApi';
import { TransferConfirmationModal } from './TransferConfirmationModal';
import { ConfirmationModalImperative } from '../ConsolidationOrderModal';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { OfficeDetails } from '@common/cams/courts';
import { SuggestedTransferCases, SuggestedTransferCasesImperative } from './SuggestedTransferCases';
import { FromCaseSummary } from './FromCaseSummary';
import './PendingTransferOrder.scss';

export type PendingTransferOrderProps = {
  order: TransferOrder;
  onOrderUpdate: (alertDetails: AlertDetails, order?: TransferOrder) => void;
  // TODO: This is a lot of prop drilling. Maybe add a custom hook???
  officesList: Array<OfficeDetails>;
};

export type FlexibleTransferOrderAction = Partial<TransferOrderAction> & {
  newCase?: Partial<CaseSummary>;
};

export function getOrderTransferFromOrder(order: TransferOrder): FlexibleTransferOrderAction {
  const { id, caseId, orderType } = order;
  return {
    id,
    caseId,
    orderType,
  };
}

export function PendingTransferOrder(props: PendingTransferOrderProps) {
  const { order, officesList } = props;
  const [orderTransfer, setOrderTransfer] = useState<FlexibleTransferOrderAction>(
    getOrderTransferFromOrder(order),
  );

  const confirmationModalRef = useRef<ConfirmationModalImperative>(null);
  const approveButtonRef = useRef<ButtonRef>(null);
  const suggestedCasesRef = useRef<SuggestedTransferCasesImperative>(null);

  const api = useApi();

  function confirmOrderApproval(): void {
    orderTransfer.status = 'approved';

    const updatedOrder: TransferOrder = {
      ...order,
      ...orderTransfer,
    } as TransferOrder;

    api
      .patch(`/orders/${orderTransfer.id}`, orderTransfer)
      .then(() => {
        props.onOrderUpdate(
          {
            message: `Transfer of case to ${getCaseNumber(orderTransfer.newCase?.caseId)} in ${
              orderTransfer.newCase?.courtName
            } (${orderTransfer.newCase?.courtDivisionName}) was ${orderTransfer.status}.`,
            type: UswdsAlertStyle.Success,
            timeOut: 8,
          },
          updatedOrder,
        );
      })
      .catch((reason) => {
        // TODO: make the error message more meaningful
        props.onOrderUpdate({ message: reason.message, type: UswdsAlertStyle.Error, timeOut: 8 });
      });
  }

  function approveOrderRejection(rejectionReason?: string) {
    const rejection: TransferOrderAction = {
      id: order.id,
      caseId: order.caseId,
      orderType: 'transfer',
      reason: rejectionReason,
      status: 'rejected',
    };

    api
      .patch(`/orders/${order.id}`, rejection)
      .then((_foo) => {
        props.onOrderUpdate(
          {
            message: `Transfer of case ${getCaseNumber(order.caseId)} was rejected.`,
            type: UswdsAlertStyle.Success,
            timeOut: 8,
          },
          {
            ...order,
            ...rejection,
          },
        );
      })
      .catch((reason) => {
        // TODO: make the error message more meaningful
        props.onOrderUpdate({
          message: reason.message,
          type: UswdsAlertStyle.Error,
          timeOut: 8,
        });
      });
  }

  function cancelUpdate(): void {
    suggestedCasesRef.current?.cancel();
    setOrderTransfer(getOrderTransferFromOrder(order));
    approveButtonRef.current?.disableButton(true);
  }

  function confirmAction(status: OrderStatus, reason?: string): void {
    if (status === 'rejected') {
      approveOrderRejection(reason);
    } else if (status === 'approved') {
      confirmOrderApproval();
    }
  }

  function handleAlert(alertDetails: AlertDetails) {
    props.onOrderUpdate(alertDetails);
  }

  function handleSuggestedCaseSelection(bCase: CaseSummary | null) {
    if (bCase) {
      const updated = { ...orderTransfer };
      updated.newCase = bCase;
      setOrderTransfer(updated);
      approveButtonRef.current?.disableButton(false);
    } else {
      approveButtonRef.current?.disableButton(true);
    }
  }

  return (
    <div className="pending-transfer-accordion-content">
      {' '}
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <h3>Case with Transfer Order</h3>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <FromCaseSummary order={order} onOrderUpdate={handleAlert} />
      <SuggestedTransferCases
        order={order}
        officesList={officesList}
        onCaseSelection={handleSuggestedCaseSelection}
        onAlert={handleAlert}
        ref={suggestedCasesRef}
      ></SuggestedTransferCases>
      <div className="button-bar grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10 text-no-wrap float-right">
          <Button
            id={`accordion-cancel-button-${order.id}`}
            onClick={cancelUpdate}
            uswdsStyle={UswdsButtonStyle.Unstyled}
            className="unstyled-button"
          >
            Clear
          </Button>
          <Button
            id={`accordion-reject-button-${order.id}`}
            onClick={() => confirmationModalRef.current?.show({ status: 'rejected' })}
            uswdsStyle={UswdsButtonStyle.Outline}
            className="margin-right-2"
          >
            Reject
          </Button>
          <Button
            id={`accordion-approve-button-${order.id}`}
            onClick={() => confirmationModalRef.current?.show({ status: 'approved' })}
            disabled={true}
            ref={approveButtonRef}
          >
            Approve
          </Button>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <TransferConfirmationModal
        ref={confirmationModalRef}
        id={`confirmation-modal-${order.id}`}
        fromCaseId={order.caseId}
        toCaseId={orderTransfer.newCase?.caseId}
        fromDivisionName={order.courtDivisionName}
        toDivisionName={orderTransfer.newCase?.courtDivisionName}
        fromCourtName={order.courtName!}
        toCourtName={orderTransfer.newCase?.courtName}
        onCancel={cancelUpdate}
        onConfirm={confirmAction}
      ></TransferConfirmationModal>
    </div>
  );
}
