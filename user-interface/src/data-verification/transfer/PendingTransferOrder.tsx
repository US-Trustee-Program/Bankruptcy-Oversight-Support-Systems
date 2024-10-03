import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { CaseSummary } from '@common/cams/cases';
import {
  FlexibleTransferOrderAction,
  OrderStatus,
  TransferOrder,
  TransferOrderAction,
} from '@common/cams/orders';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import {
  TransferConfirmationModal,
  TransferConfirmationModalImperative,
} from './TransferConfirmationModal';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { CourtDivisionDetails } from '@common/cams/courts';
import { SuggestedTransferCases, SuggestedTransferCasesImperative } from './SuggestedTransferCases';
import { FromCaseSummary } from './FromCaseSummary';
import { useApi2 } from '@/lib/hooks/UseApi2';
import './PendingTransferOrder.scss';

export type PendingTransferOrderImperative = {
  cancel: () => void;
};

export type PendingTransferOrderProps = {
  order: TransferOrder;
  onOrderUpdate: (alertDetails: AlertDetails, order?: TransferOrder) => void;
  // TODO: This is a lot of prop drilling. Maybe add a custom hook???
  officesList: Array<CourtDivisionDetails>;
};

export function getOrderTransferFromOrder(order: TransferOrder): FlexibleTransferOrderAction {
  const { id, caseId, orderType } = order;
  return {
    id,
    caseId,
    orderType,
  };
}

function _PendingTransferOrder(
  props: PendingTransferOrderProps,
  PendingTransferOrderRef: React.Ref<PendingTransferOrderImperative>,
) {
  const { order, officesList } = props;
  const [orderTransfer, setOrderTransfer] = useState<FlexibleTransferOrderAction>(
    getOrderTransferFromOrder(order),
  );

  const modalRef = useRef<TransferConfirmationModalImperative>(null);
  const approveButtonRef = useRef<ButtonRef>(null);
  const suggestedCasesRef = useRef<SuggestedTransferCasesImperative>(null);

  const api = useApi2();

  function confirmOrderApproval(): void {
    orderTransfer.status = 'approved';

    const updatedOrder: TransferOrder = {
      ...order,
      ...orderTransfer,
    } as TransferOrder;

    api
      .patchTransferOrder(orderTransfer)
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
      .patchTransferOrder(rejection)
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

  function cancel(): void {
    suggestedCasesRef.current?.cancel();
    setOrderTransfer(getOrderTransferFromOrder(order));
    approveButtonRef.current?.disableButton(true);
  }

  useImperativeHandle(PendingTransferOrderRef, () => ({
    cancel,
  }));

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

  function handleInvalidCaseNumber() {
    approveButtonRef.current?.disableButton(true);
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
        onInvalidCaseNumber={handleInvalidCaseNumber}
        onAlert={handleAlert}
        ref={suggestedCasesRef}
      ></SuggestedTransferCases>
      <div className="button-bar grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10 text-no-wrap float-right">
          <Button
            id={`accordion-cancel-button-${order.id}`}
            onClick={cancel}
            uswdsStyle={UswdsButtonStyle.Unstyled}
            className="unstyled-button"
          >
            Clear
          </Button>
          <Button
            id={`accordion-reject-button-${order.id}`}
            onClick={() => modalRef.current?.show({ status: 'rejected' })}
            uswdsStyle={UswdsButtonStyle.Outline}
            className="margin-right-2"
          >
            Reject
          </Button>
          <Button
            id={`accordion-approve-button-${order.id}`}
            onClick={() => modalRef.current?.show({ status: 'approved' })}
            disabled={true}
            ref={approveButtonRef}
          >
            Approve
          </Button>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <TransferConfirmationModal
        ref={modalRef}
        id={`confirmation-modal-${order.id}`}
        fromCaseId={order.caseId}
        toCaseId={orderTransfer.newCase?.caseId}
        fromDivisionName={order.courtDivisionName}
        toDivisionName={orderTransfer.newCase?.courtDivisionName}
        fromCourtName={order.courtName!}
        toCourtName={orderTransfer.newCase?.courtName}
        onConfirm={confirmAction}
      ></TransferConfirmationModal>
    </div>
  );
}

export const PendingTransferOrder = forwardRef(_PendingTransferOrder);
