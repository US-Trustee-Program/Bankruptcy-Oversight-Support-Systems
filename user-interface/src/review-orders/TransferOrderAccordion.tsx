import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import { Accordion } from '@/lib/components/uswds/Accordion';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Input from '@/lib/components/uswds/Input';
import Api from '../lib/models/api';
import MockApi from '../lib/models/chapter15-mock.api.cases';
import {
  CaseDetailType,
  Chapter15CaseSummaryResponseData,
  OfficeDetails,
  Order,
  OrderStatus,
  OrderTransfer,
} from '@/lib/type-declarations/chapter-15';
import { InputRef } from '@/lib/type-declarations/input-fields';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import SearchableSelect, { SearchableSelectOption } from '@/lib/components/SearchableSelect';
import { AlertDetails } from '@/review-orders/ReviewOrdersScreen';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import './TransferOrderAccordion.scss';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { CaseTable } from './CaseTable';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';

export function getOrderTransferFromOrder(order: Order): OrderTransfer {
  const { id, caseId, status, newCaseId, sequenceNumber } = order;
  return {
    id,
    caseId,
    newCaseId,
    status,
    sequenceNumber,
  };
}

export function getOfficeList(officesList: Array<OfficeDetails>) {
  const mapOutput = officesList.map((court) => {
    return {
      value: court.divisionCode,
      label: `${court.courtName} ${court.courtDivisionName}`,
    };
  });
  mapOutput.splice(0, 0, { value: '', label: ' ' });
  return mapOutput;
}

export function isValidOrderTransfer(transfer: OrderTransfer) {
  return transfer.newCaseId && transfer.newCourtDivisionName;
}

function safeToInt(s: string) {
  const intVal = parseInt(s);
  if (isNaN(intVal)) return s;

  return intVal.toString();
}

export function validateNewCaseIdInput(ev: React.ChangeEvent<HTMLInputElement>) {
  // TODO: Move this logic into a CaseIdInput component based on Input.
  const allowedCharsPattern = /[0-9]/g;
  const filteredInput = ev.target.value.match(allowedCharsPattern) ?? [];
  if (filteredInput.length > 7) {
    filteredInput.splice(7);
  }
  if (filteredInput.length > 2) {
    filteredInput.splice(2, 0, '-');
  }
  const joinedInput = filteredInput?.join('') || '';
  const caseIdPattern = /^\d{2}-\d{5}$/;
  const newCaseId = caseIdPattern.test(joinedInput) ? joinedInput : undefined;
  return { newCaseId, joinedInput };
}

export function updateOrderTransfer(
  selection: SearchableSelectOption,
  orderTransfer: OrderTransfer,
  officesList: Array<OfficeDetails>,
) {
  const updated = { ...orderTransfer };
  const office = officesList.find((o) => o.divisionCode === selection?.value);
  updated.newRegionId = office?.regionId;
  updated.newRegionName = office?.regionName;
  updated.newCourtName = office?.courtName;
  updated.newCourtDivisionName = office?.courtDivisionName;
  updated.newDivisionCode = office?.divisionCode;
  return updated;
}

enum ValidationStates {
  notValidated,
  found,
  notFound,
}

export interface TransferOrderAccordionProps {
  order: Order;
  statusType: Map<string, string>;
  orderType: Map<string, string>;
  officesList: Array<OfficeDetails>;
  regionsMap: Map<string, string>;
  onOrderUpdate: (alertDetails: AlertDetails, order?: Order) => void;
  onExpand?: (id: string) => void;
  expandedId?: string;
}

export function TransferOrderAccordion(props: TransferOrderAccordionProps) {
  const { order, statusType, orderType, officesList, expandedId, onExpand } = props;

  const courtSelectionRef = useRef<InputRef>(null);
  const caseIdRef = useRef<InputRef>(null);
  const approveButtonRef = useRef<ButtonRef>(null);
  const confirmationModalRef = useRef<ConfirmationModalImperative>(null);

  const api = import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi : Api;

  const [orderTransfer, setOrderTransfer] = useState<OrderTransfer>(
    getOrderTransferFromOrder(order),
  );
  const [validationState, setValidationState] = useState<ValidationStates>(
    ValidationStates.notValidated,
  );
  const [newCaseSummary, setNewCaseSummary] = useState<CaseDetailType | null>(null);
  const [loadingCaseSummary, setLoadingCaseSummary] = useState<boolean>(false);

  async function isValidOrderTransfer(transfer: OrderTransfer) {
    if (!(transfer.newCaseId && transfer.newDivisionCode)) {
      return false;
    }

    setLoadingCaseSummary(true);

    let result = false;
    const caseId = `${transfer.newDivisionCode}-${transfer.newCaseId}`;
    await api
      .get(`/cases/${caseId}/summary`)
      .then((response) => {
        const typedResponse = response as Chapter15CaseSummaryResponseData;
        setNewCaseSummary(typedResponse.body);
        setValidationState(ValidationStates.found);
        result = true;
      })
      .catch((_reason) => {
        setValidationState(ValidationStates.notFound);
        result = false;
      });

    setLoadingCaseSummary(false);
    return result;
  }

  function isCourtSelected(orderTransfer: OrderTransfer) {
    return orderTransfer.newRegionId && orderTransfer.newCourtDivisionName;
  }
  function handleCourtSelection(selection: SearchableSelectOption) {
    const updatedSelection = updateOrderTransfer(selection, orderTransfer, officesList);
    isValidOrderTransfer(updatedSelection).then((valid) => {
      approveButtonRef.current?.disableButton(!valid);
    });
    setOrderTransfer(updatedSelection);
  }
  function handleCaseInputChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const { newCaseId, joinedInput } = validateNewCaseIdInput(ev);
    caseIdRef.current?.setValue(joinedInput);

    const updated = { ...orderTransfer };
    updated.newCaseId = newCaseId;
    isValidOrderTransfer(updated).then((valid) => {
      approveButtonRef.current?.disableButton(!valid);
    });
    setOrderTransfer(updated);
  }

  function confirmOrderApproval(): void {
    orderTransfer.status = 'approved';
    orderTransfer.newCaseId = orderTransfer.newDivisionCode + '-' + orderTransfer.newCaseId;

    const updatedOrder: Order = {
      ...order,
      ...orderTransfer,
    };

    api
      .patch(`/orders/${orderTransfer.id}`, orderTransfer)
      .then(() => {
        props.onOrderUpdate(
          {
            message: `Transfer of case to ${getCaseNumber(orderTransfer.newCaseId)} in ${
              orderTransfer.newCourtName
            } (${orderTransfer.newCourtDivisionName}) was ${orderTransfer.status}.`,
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

  function cancelUpdate(): void {
    courtSelectionRef.current?.clearValue();
    caseIdRef.current?.resetValue();
    approveButtonRef.current?.disableButton(true);
    setOrderTransfer(getOrderTransferFromOrder(order));
  }

  function confirmAction(status: OrderStatus, reason?: string): void {
    if (status === 'rejected') {
      approveOrderRejection(reason);
    } else if (status === 'approved') {
      confirmOrderApproval();
    }
  }

  function approveOrderRejection(rejectionReason?: string) {
    const rejection: OrderTransfer = {
      id: order.id,
      caseId: order.caseId,
      sequenceNumber: order.sequenceNumber,
      reason: rejectionReason,
      status: 'rejected',
    };

    api
      .patch(`/orders/${order.id}`, rejection)
      .then(() => {
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

  return (
    <>
      <Accordion
        key={order.id}
        id={`order-list-${order.id}`}
        expandedId={expandedId}
        onExpand={onExpand}
      >
        <section
          className="accordion-heading grid-row grid-gap-lg"
          data-testid={`accordion-heading-${order.id}`}
        >
          <div
            className="grid-col-1 case-id text-no-wrap"
            aria-label={`Case ID ${getCaseNumber(order.caseId).split('').join(' ')}`}
          >
            {getCaseNumber(order.caseId)}
          </div>
          <div
            className="grid-col-4 case-title text-no-wrap"
            aria-label={`Case title ${order.caseTitle}`}
          >
            {order.caseTitle}
          </div>
          <div
            className="grid-col-1 order-date text-no-wrap"
            title="Order date"
            aria-label={`Order date ${formatDate(order.orderDate)}`}
          >
            {formatDate(order.orderDate)}
          </div>
          <div className="grid-col-2"></div>
          <div className="grid-col-2 order-type text-no-wrap">
            <span aria-label={`Order type ${orderType.get(order.orderType)}`}>
              {orderType.get(order.orderType)}
            </span>
          </div>
          <div className="grid-col-2 order-status text-no-wrap">
            <span
              className={order.status}
              aria-label={`Order status ${statusType.get(order.status)}`}
            >
              {statusType.get(order.status)}
            </span>
          </div>
        </section>
        <section className="accordion-content" data-testid={`accordion-content-${order.id}`}>
          <div className="grid-row grid-gap-lg">
            <div className="grid-col-1"></div>
            <div className="order-legal-statement grid-col-10">
              <Link
                to={`/case-detail/${order.caseId}/court-docket?document=${order.documentNumber}`}
                target="_blank"
                title={`Open case ${order.caseId} docket in new window`}
              >
                {order.documentNumber && (
                  <span className="document-number">#{order.documentNumber} - </span>
                )}
                {formatDate(order.orderDate)} - {order.summaryText}
              </Link>
              <p tabIndex={0} className="measure-6">
                {order.fullText}
              </p>
              {order.documents && <DocketEntryDocumentList documents={order.documents} />}
            </div>
            <div className="grid-col-1"></div>
          </div>
          {order.status === 'approved' && (
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="transfer-text grid-col-10" tabIndex={0}>
                Transferred{' '}
                <Link
                  to={`/case-detail/${order.caseId}/`}
                  className="usa-link case-detail-item-value"
                  data-testid={`approved-transfer-original-case-link-${order.caseId}`}
                  title={`Open case ${order.caseId}`}
                  target="_blank"
                  reloadDocument={true}
                >
                  {getCaseNumber(order.caseId)}
                </Link>{' '}
                from
                <span className="transfer-highlight__span">
                  {order.courtName} ({order.courtDivisionName})
                </span>
                to{' '}
                <Link
                  to={`/case-detail/${order.newCaseId}/`}
                  className="usa-link case-detail-item-value"
                  data-testid={`approved-transfer-new-case-link-${order.newCaseId}`}
                  title={`Open case ${order.newCaseId}`}
                  target="_blank"
                >
                  {getCaseNumber(order.newCaseId)}
                </Link>{' '}
                and court
                <span className="transfer-highlight__span">
                  {order.newCourtName} ({order.newCourtDivisionName}).
                </span>
              </div>
              <div className="grid-col-1"></div>
            </div>
          )}
          {order.status === 'rejected' && (
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="transfer-text grid-col-10" tabIndex={0}>
                Rejected transfer of{' '}
                <Link
                  to={`/case-detail/${order.caseId}/`}
                  className="usa-link case-detail-item-value"
                  data-testid={`rejected-transfer-case-link-${order.caseId}`}
                  title={`Open case ${order.caseId}`}
                  target="_blank"
                  reloadDocument={true}
                >
                  {getCaseNumber(order.caseId)}
                </Link>
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
          )}
          {order.status !== 'approved' && order.status !== 'rejected' && (
            <section className="order-form" data-testid={`order-form-${order.id}`}>
              <div className="court-selection grid-row grid-gap-lg">
                <div className="grid-col-1"></div>
                <div className="transfer-from-to__div grid-col-10">
                  <div className="transfer-text" tabIndex={0}>
                    Transfer{' '}
                    <Link
                      to={`/case-detail/${order.caseId}/`}
                      className="usa-link case-detail-item-value"
                      data-testid={`pending-transfer-original-case-link-${order.caseId}`}
                      title={`Open case ${order.caseId}`}
                      target="_blank"
                      reloadDocument={true}
                    >
                      {getCaseNumber(order.caseId)}
                    </Link>{' '}
                    from
                    <span className="transfer-highlight__span">
                      {order.courtName} ({order.courtDivisionName})
                    </span>
                    to
                  </div>
                  <div className="form-row">
                    <div className="select-container court-select-container">
                      <label htmlFor={`court-selection-${order.id}`}>New Court</label>
                      <div
                        className="usa-combo-box"
                        data-testid={`court-selection-usa-combo-box-${order.id}`}
                      >
                        <SearchableSelect
                          id={`court-selection-${order.id}`}
                          className="new-court__select"
                          closeMenuOnSelect={true}
                          label="Select new court"
                          ref={courtSelectionRef}
                          onChange={handleCourtSelection}
                          options={getOfficeList(officesList)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid-col-1"></div>
              </div>
              {isCourtSelected(orderTransfer) && (
                <div className="preview-results grid-row grid-gap-lg">
                  <div className="grid-col-1"></div>
                  <div className="grid-col-10">
                    <span data-testid={`preview-description-${order.id}`}>
                      <CaseSelection
                        fromCourt={{
                          region: order.regionId,
                          courtDivisionName: order.courtDivisionName,
                        }}
                        toCourt={{
                          region: orderTransfer.newRegionId,
                          courtDivisionName: orderTransfer.newCourtDivisionName,
                        }}
                      ></CaseSelection>
                    </span>
                  </div>
                  <div className="grid-col-1"></div>
                </div>
              )}
              <div className="case-selection grid-row grid-gap-lg">
                <div className="grid-col-1"></div>
                <div className="grid-col-4">
                  <label htmlFor={`new-case-input-${order.id}`}>New Case</label>
                  <div>
                    <Input
                      id={`new-case-input-${order.id}`}
                      data-testid={`new-case-input-${order.id}`}
                      className="usa-input"
                      value={order.newCaseId}
                      onChange={handleCaseInputChange}
                      aria-label="New case ID"
                      ref={caseIdRef}
                    />
                  </div>
                </div>
                <div className="grid-col-6"></div>
                <div className="grid-col-1"></div>
              </div>
              <div className="case-verification grid-row grid-gap-lg">
                <div className="grid-col-1"></div>
                <div className="grid-col-10">
                  {loadingCaseSummary && (
                    <LoadingSpinner
                      id="loading-spinner"
                      caption="Loading cases..."
                    ></LoadingSpinner>
                  )}
                  {!loadingCaseSummary && validationState === ValidationStates.found && (
                    <CaseTable id="validated-cases" cases={[newCaseSummary!]}></CaseTable>
                  )}
                  {!loadingCaseSummary && validationState === ValidationStates.notFound && (
                    <Alert
                      inline={true}
                      show={true}
                      slim={true}
                      message="We couldn't find a case with that number"
                      type={UswdsAlertStyle.Error}
                      role="status"
                      className="validation-alert"
                      id="validation-not-found"
                    ></Alert>
                  )}
                </div>
                <div className="grid-col-1"></div>
              </div>
              <div className="button-bar grid-row grid-gap-lg">
                <div className="grid-col-1"></div>
                <div className="grid-col-2">
                  <Button
                    id={`accordion-reject-button-${order.id}`}
                    onClick={() => confirmationModalRef.current?.show({ status: 'rejected' })}
                    uswdsStyle={UswdsButtonStyle.Secondary}
                  >
                    Reject
                  </Button>
                </div>
                <div className="grid-col-6"></div>
                <div className="grid-col-2 text-no-wrap">
                  <Button
                    id={`accordion-cancel-button-${order.id}`}
                    onClick={cancelUpdate}
                    uswdsStyle={UswdsButtonStyle.Outline}
                  >
                    Cancel
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
              <ConfirmationModal
                ref={confirmationModalRef}
                id={`confirmation-modal-${order.id}`}
                sequenceNumber={order.sequenceNumber}
                fromCaseId={order.caseId}
                toCaseId={orderTransfer.newCaseId}
                fromDivisionName={order.courtDivisionName}
                toDivisionName={orderTransfer.newCourtDivisionName}
                fromCourtName={order.courtName}
                toCourtName={orderTransfer.newCourtName}
                onCancel={cancelUpdate}
                onConfirm={confirmAction}
              ></ConfirmationModal>
            </section>
          )}
        </section>
      </Accordion>
    </>
  );
}

interface CaseSelectionAttributes {
  courtDivisionName: string;
  region: string;
}

interface CaseSelectionProps {
  fromCourt: CaseSelectionAttributes;
  toCourt: Partial<CaseSelectionAttributes>;
}

export function CaseSelection(props: CaseSelectionProps) {
  const { fromCourt, toCourt } = props;

  return (
    <>
      USTP Office: transfer from
      <span className="from-location transfer-highlight__span">
        Region {safeToInt(fromCourt.region)} - {fromCourt.courtDivisionName}
      </span>
      {toCourt.region && toCourt.courtDivisionName && (
        <>
          to
          <span className="to-location transfer-highlight__span">
            Region {safeToInt(toCourt.region)} - {toCourt.courtDivisionName}
          </span>
        </>
      )}
    </>
  );
}

interface ConfirmationModalProps {
  id: string;
  sequenceNumber: number;
  fromCaseId: string;
  toCaseId?: string;
  fromDivisionName: string;
  toDivisionName?: string;
  fromCourtName: string;
  toCourtName?: string;
  onCancel: () => void;
  onConfirm: (status: OrderStatus, reason?: string) => void;
}

type ShowOptionParams = {
  status: OrderStatus;
};

type ShowOptions = {
  status: OrderStatus;
  title: string;
};

type ConfirmationModalImperative = ModalRefType & {
  show: (options: ShowOptionParams) => void;
};

function ConfirmationModalComponent(
  props: ConfirmationModalProps,
  ConfirmationModalRef: React.Ref<ConfirmationModalImperative>,
) {
  const {
    id,
    sequenceNumber,
    fromCaseId,
    toCaseId,
    fromDivisionName,
    toDivisionName,
    fromCourtName,
    toCourtName,
    onConfirm,
  }: ConfirmationModalProps = props;

  const modalRef = useRef<ModalRefType>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [reason] = useState<string>('');
  const [options, setOptions] = useState<ShowOptions>({
    status: 'pending',
    title: '',
  });

  function confirmAction() {
    const confirmationData: OrderTransfer = {
      id,
      sequenceNumber,
      caseId: fromCaseId,
      status: options.status,
    };
    confirmationData.reason = reasonRef.current?.value;
    onConfirm(confirmationData.status, confirmationData.reason);
  }

  function clearReason() {
    if (reasonRef.current) reasonRef.current.value = '';
  }

  const actionButtonGroup = {
    modalId: `confirmation-modal-${id}`,
    modalRef: modalRef,
    submitButton: {
      label: options.title,
      onClick: confirmAction,
      className: options.status === 'rejected' ? 'usa-button--secondary' : '',
    },
    cancelButton: {
      label: 'Go back',
      onClick: () => {
        clearReason();
        hide();
      },
    },
  };

  function show(options: ShowOptionParams) {
    const title = options.status === 'approved' ? 'Approve' : 'Reject';

    setOptions({
      status: options.status,
      title,
    });

    if (modalRef.current?.show) {
      modalRef.current?.show({});
    }
  }

  function hide() {
    if (modalRef.current?.hide) {
      modalRef.current?.hide({});
    }
  }

  useImperativeHandle(ConfirmationModalRef, () => ({
    show,
    hide,
  }));

  return (
    <Modal
      ref={modalRef}
      modalId={`confirm-modal-${id}`}
      className="confirm-modal"
      heading={`${options.title} case transfer?`}
      data-testid={`confirm-modal-${id}`}
      onClose={clearReason}
      content={
        <>
          This will {options.status === 'approved' ? 'approve' : 'stop'} the transfer of case
          <span className="transfer-highlight__span">{getCaseNumber(fromCaseId)}</span>
          in
          <span className="transfer-highlight__span">
            {fromCourtName} ({fromDivisionName})
          </span>
          {toCaseId && (
            <>
              to case
              <span className="transfer-highlight__span">{toCaseId}</span>
            </>
          )}
          {toCourtName && (
            <>
              in
              <span className="transfer-highlight__span">
                {toCourtName} ({toDivisionName})
              </span>
            </>
          )}
          .
          {options.status === 'rejected' && (
            <div>
              <label htmlFor={`rejection-reason-${id}`} className="usa-label">
                Reason for rejection
              </label>
              <div>
                <textarea
                  id={`rejection-reason-${id}`}
                  data-testid={`rejection-reason-input-${id}`}
                  ref={reasonRef}
                  className="rejection-reason-input usa-textarea"
                  defaultValue={reason}
                ></textarea>
              </div>
            </div>
          )}
        </>
      }
      actionButtonGroup={actionButtonGroup}
    ></Modal>
  );
}

const ConfirmationModal = forwardRef(ConfirmationModalComponent);
