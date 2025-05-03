import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { CaseSummary } from '@common/cams/cases';
import { CourtDivisionDetails } from '@common/cams/courts';
import {
  FlexibleTransferOrderAction,
  OrderStatus,
  TransferOrder,
  TransferOrderAction,
} from '@common/cams/orders';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { FromCaseSummary } from './FromCaseSummary';
import { SuggestedTransferCases, SuggestedTransferCasesImperative } from './SuggestedTransferCases';
import {
  TransferConfirmationModal,
  TransferConfirmationModalImperative,
} from './TransferConfirmationModal';
import './PendingTransferOrder.scss';

export type PendingTransferOrderImperative = {
  cancel: () => void;
};

export type PendingTransferOrderProps = {
  // TODO: This is a lot of prop drilling. Maybe add a custom hook???
  officesList: Array<CourtDivisionDetails>;
  onOrderUpdate: (alertDetails: AlertDetails, order?: TransferOrder) => void;
  order: TransferOrder;
};

export function getOrderTransferFromOrder(order: TransferOrder): FlexibleTransferOrderAction {
  const { caseId, id, orderType } = order;
  return {
    caseId,
    id,
    orderType,
  };
}

function _PendingTransferOrder(
  props: PendingTransferOrderProps,
  PendingTransferOrderRef: React.Ref<PendingTransferOrderImperative>,
) {
  const { officesList, order } = props;
  const [orderTransfer, setOrderTransfer] = useState<FlexibleTransferOrderAction>(
    getOrderTransferFromOrder(order),
  );

  const modalRef = useRef<TransferConfirmationModalImperative>(null);
  const approveButtonRef = useRef<ButtonRef>(null);
  const suggestedCasesRef = useRef<SuggestedTransferCasesImperative>(null);

  const api = useApi2();

  function confirmOrderApproval(): void {
    const approvedTransferOrder: FlexibleTransferOrderAction = {
      ...orderTransfer,
      status: 'approved',
    };
    const updatedOrder: TransferOrder = {
      ...order,
      ...approvedTransferOrder,
    } as TransferOrder;

    api
      .patchTransferOrderApproval(approvedTransferOrder)
      .then(() => {
        props.onOrderUpdate(
          {
            message: `Transfer of case to ${getCaseNumber(orderTransfer.newCase?.caseId)} in ${
              orderTransfer.newCase?.courtName
            } (${orderTransfer.newCase?.courtDivisionName}) was ${orderTransfer.status === 'approved' ? 'verified' : 'rejected'}.`,
            timeOut: 8,
            type: UswdsAlertStyle.Success,
          },
          updatedOrder,
        );
      })
      .catch((reason) => {
        // TODO: make the error message more meaningful
        props.onOrderUpdate({ message: reason.message, timeOut: 8, type: UswdsAlertStyle.Error });
      });
  }

  function approveOrderRejection(rejectionReason?: string) {
    const rejection: TransferOrderAction = {
      caseId: order.caseId,
      id: order.id,
      orderType: 'transfer',
      reason: rejectionReason,
      status: 'rejected',
    };

    api
      .patchTransferOrderRejection(rejection)
      .then((_foo) => {
        props.onOrderUpdate(
          {
            message: `Transfer of case ${getCaseNumber(order.caseId)} was rejected.`,
            timeOut: 8,
            type: UswdsAlertStyle.Success,
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
          timeOut: 8,
          type: UswdsAlertStyle.Error,
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
      <FromCaseSummary onOrderUpdate={handleAlert} order={order} />
      <SuggestedTransferCases
        officesList={officesList}
        onAlert={handleAlert}
        onCaseSelection={handleSuggestedCaseSelection}
        onInvalidCaseNumber={handleInvalidCaseNumber}
        order={order}
        ref={suggestedCasesRef}
      ></SuggestedTransferCases>
      <div className="button-bar grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10 text-no-wrap float-right">
          <Button
            className="unstyled-button"
            id={`accordion-cancel-button-${order.id}`}
            onClick={cancel}
            uswdsStyle={UswdsButtonStyle.Unstyled}
          >
            Clear
          </Button>
          <Button
            className="margin-right-2"
            id={`accordion-reject-button-${order.id}`}
            onClick={() => modalRef.current?.show({ status: 'rejected' })}
            uswdsStyle={UswdsButtonStyle.Outline}
          >
            Reject
          </Button>
          <Button
            disabled={true}
            id={`accordion-approve-button-${order.id}`}
            onClick={() => modalRef.current?.show({ status: 'approved' })}
            ref={approveButtonRef}
          >
            Verify
          </Button>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <TransferConfirmationModal
        fromCaseId={order.caseId}
        fromCourtName={order.courtName!}
        fromDivisionName={order.courtDivisionName}
        id={`confirmation-modal-${order.id}`}
        onConfirm={confirmAction}
        ref={modalRef}
        toCaseId={orderTransfer.newCase?.caseId}
        toCourtName={orderTransfer.newCase?.courtName}
        toDivisionName={orderTransfer.newCase?.courtDivisionName}
      ></TransferConfirmationModal>
    </div>
  );
}

export const PendingTransferOrder = forwardRef(_PendingTransferOrder);
