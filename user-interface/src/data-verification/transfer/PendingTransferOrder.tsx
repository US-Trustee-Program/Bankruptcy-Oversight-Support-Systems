import './PendingTransferOrder.scss';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { CaseSummary } from '@common/cams/cases';
import { CaseTable } from './CaseTable';
import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import { OrderStatus, TransferOrder, TransferOrderAction } from '@common/cams/orders';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useEffect, useRef, useState } from 'react';
import { useApi } from '@/lib/hooks/UseApi';
import { Chapter15CaseSummaryResponseData } from '@/lib/type-declarations/chapter-15';
import { TransferConfirmationModal } from './TransferConfirmationModal';
import { ConfirmationModalImperative } from '../ConsolidationOrderModal';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { OfficeDetails } from '@common/cams/courts';
import {
  FlexibleTransferOrderAction,
  getOrderTransferFromOrder,
  SuggestedTransferCases,
  SuggestedTransferCasesImperative,
} from './SuggestedTransferCases';

export function updateOrderTransfer(
  orderTransfer: FlexibleTransferOrderAction,
  office: OfficeDetails | null,
  caseNumber: string | null,
) {
  const updated: FlexibleTransferOrderAction = { ...orderTransfer };
  updated.newCase = {
    ...updated.newCase,
    regionId: office?.regionId,
    regionName: office?.regionName,
    courtName: office?.courtName,
    courtDivisionName: office?.courtDivisionName,
    courtDivisionCode: office?.courtDivisionCode,
    caseId: `${office?.courtDivisionCode}-${caseNumber}`,
  };

  return updated;
}

export type PendingTransferOrderProps = {
  order: TransferOrder;
  onOrderUpdate: (alertDetails: AlertDetails, order?: TransferOrder) => void;
  // TODO: This is a lot of prop drilling. Maybe add a custom hook???
  officesList: Array<OfficeDetails>;
};

export function PendingTransferOrder(props: PendingTransferOrderProps) {
  const { order, officesList } = props;
  const [originalCaseSummary, setOriginalCaseSummary] = useState<CaseSummary | null>(null);
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

  function resetState() {
    suggestedCasesRef.current?.reset();
    setOrderTransfer(getOrderTransferFromOrder(order));
    approveButtonRef.current?.disableButton(true);
  }

  function cancelUpdate(): void {
    suggestedCasesRef.current?.cancel();
    resetState();
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

  async function getCaseSummary(caseId: string) {
    await api
      .get(`/cases/${caseId}/summary`)
      .then((response) => {
        const typedResponse = response as Chapter15CaseSummaryResponseData;
        setOriginalCaseSummary(typedResponse.body);
      })
      .catch((_reason) => {
        // TODO
      });
  }

  useEffect(() => {
    getCaseSummary(order.caseId);
  }, []);

  return (
    <div className="pending-transfer-accordion-content">
      {' '}
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        {/*<div className="grid-col-10">The system has identified a case transfer order for case:</div>*/}
        <div className="grid-col-10">
          <h3>Case with Transfer Order</h3>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          {!originalCaseSummary && (
            // NOTE!: Do not start an id attribute value with a GUID.  Id's can not start with a number.
            <LoadingSpinner
              id={`transfer-from-case-loading-${order.id}`}
              caption="Loading case..."
            ></LoadingSpinner>
          )}
          {originalCaseSummary && (
            <CaseTable
              id={`transfer-from-case-${order.id}`}
              cases={[originalCaseSummary]}
            ></CaseTable>
          )}
        </div>
        <div className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg dockets-label">
        <div className="grid-col-2"></div>
        <div className="grid-col-9">
          <h4>Docket Entry</h4>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-2"></div>
        <div className="grid-col-9">
          {order.docketEntries.map((docketEntry, idx) => {
            return (
              <div key={idx}>
                <Link
                  to={`/case-detail/${order.caseId}/court-docket?document=${docketEntry.documentNumber}`}
                  target="_blank"
                  title={`Open case ${order.caseId} docket in new window`}
                >
                  {docketEntry.documentNumber && (
                    <span className="document-number">#{docketEntry.documentNumber} - </span>
                  )}
                  {formatDate(order.orderDate)} - {docketEntry.summaryText}
                </Link>
                <p tabIndex={0} className="measure-6 text-wrap">
                  {docketEntry.fullText}
                </p>
                {docketEntry.documents && (
                  <DocketEntryDocumentList documents={docketEntry.documents} />
                )}
              </div>
            );
          })}
        </div>
        <div className="grid-col-1"></div>
      </div>
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
            className="padding-right-2"
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
