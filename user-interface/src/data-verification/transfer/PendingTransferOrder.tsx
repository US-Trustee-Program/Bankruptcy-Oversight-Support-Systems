import './PendingTransferOrder.scss';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { CaseSummary } from '@common/cams/cases';
import { CaseTable, CaseTableImperative } from './CaseTable';
import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import { OrderStatus, TransferOrder, TransferOrderAction } from '@common/cams/orders';
import { CaseNumber } from '@/lib/components/CaseNumber';
import Alert, { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useEffect, useRef, useState } from 'react';
import { useApi } from '@/lib/hooks/UseApi';
import { Chapter15CaseSummaryResponseData } from '@/lib/type-declarations/chapter-15';
import { ConfirmationModal } from './TransferConfirmationModal';
import { ConfirmationModalImperative } from '../ConsolidationOrderModal';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { FormRequirementsNotice } from '@/lib/components/uswds/FormRequirementsNotice';
import CamsSelect, {
  CamsSelectOptionList,
  SearchableSelectOption,
} from '@/lib/components/CamsSelect';
import { OfficeDetails } from '@common/cams/courts';
import { InputRef } from '@/lib/type-declarations/input-fields';
import { getOfficeList } from '../dataVerificationHelper';
import CaseNumberInput from '@/lib/components/CaseNumberInput';

type FlexibleTransferOrderAction = Partial<TransferOrderAction> & {
  newCase?: Partial<CaseSummary>;
};

enum ValidationStates {
  notValidated,
  found,
  notFound,
}

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

export function getOrderTransferFromOrder(order: TransferOrder): FlexibleTransferOrderAction {
  const { id, caseId } = order;
  return {
    id,
    caseId,
    orderType: order.orderType,
  };
}

type PendingTransferOrderProps = {
  order: TransferOrder;
  onOrderUpdate: (alertDetails: AlertDetails, order?: TransferOrder) => void;
  // TODO: This is a lot of prop drilling. Maybe add a custom hook???
  officesList: Array<OfficeDetails>;
};

export function PendingTransferOrder(props: PendingTransferOrderProps) {
  const { order, officesList } = props;
  const [originalCaseSummary, setOriginalCaseSummary] = useState<CaseSummary | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [suggestedCases, setSuggestedCases] = useState<CaseSummary[] | null>(null);
  const [orderTransfer, setOrderTransfer] = useState<FlexibleTransferOrderAction>(
    getOrderTransferFromOrder(order),
  );
  const [validationState, setValidationState] = useState<ValidationStates>(
    ValidationStates.notValidated,
  );
  const [loadingCaseSummary, setLoadingCaseSummary] = useState<boolean>(false);
  const [newCaseSummary, setNewCaseSummary] = useState<CaseSummary | null>(null);
  const [newCaseDivision, setNewCaseDivision] = useState<OfficeDetails | null>(null);
  const [newCaseNumber, setNewCaseNumber] = useState<string | null>(
    order.docketSuggestedCaseNumber || null,
  );
  const [enableCaseEntry, setEnableCaseEntry] = useState<boolean>(false);

  const suggestedCasesRef = useRef<CaseTableImperative>(null);
  const confirmationModalRef = useRef<ConfirmationModalImperative>(null);
  const approveButtonRef = useRef<ButtonRef>(null);
  const caseNumberRef = useRef<InputRef>(null);
  const courtSelectionRef = useRef<InputRef>(null);

  const api = useApi();

  async function isValidOrderTransfer(transfer: FlexibleTransferOrderAction) {
    if (!transfer.newCase?.caseId) return false;
    setLoadingCaseSummary(true);
    let result = false;
    await api
      .get(`/cases/${transfer.newCase.caseId}/summary`)
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

  // TODO: fmadden 03/11/24 - When a court selection is made, getCaseSummary() seems to be getting called and
  // uses the previously set case number, rather than the value in the New Case input field.
  // as a result, you get the wrong case summary listed.
  function handleCourtSelection(selection: CamsSelectOptionList) {
    const office =
      officesList.find(
        (o) => o.courtDivisionCode === (selection as SearchableSelectOption)?.value,
      ) || null;
    setNewCaseDivision(office);
    if (!office) {
      setValidationState(ValidationStates.notValidated);
      setNewCaseSummary(null);
    }
    caseNumberRef.current?.disable(!office);
    approveButtonRef.current?.disableButton(!office);

    const updatedOrderTransfer = updateOrderTransfer(orderTransfer, office, newCaseNumber);
    setOrderTransfer(updatedOrderTransfer);
    if (office && newCaseNumber) {
      isValidOrderTransfer(updatedOrderTransfer).then((valid) => {
        approveButtonRef.current?.disableButton(!valid);
      });
    }
  }

  function handleCaseInputChange(caseNumber?: string) {
    if (caseNumber) {
      setNewCaseNumber(caseNumber);
    } else {
      setNewCaseNumber(null);
      setValidationState(ValidationStates.notValidated);
      setNewCaseSummary(null);
      approveButtonRef.current?.disableButton(true);
      return;
    }

    const updatedOrderTransfer = updateOrderTransfer(orderTransfer, newCaseDivision, caseNumber);
    setOrderTransfer(updatedOrderTransfer);
    if (caseNumber && newCaseDivision) {
      isValidOrderTransfer(updatedOrderTransfer).then((valid) => {
        approveButtonRef.current?.disableButton(!valid);
      });
    }
  }

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

  function resetState() {
    setOrderTransfer(getOrderTransferFromOrder(order));
    setNewCaseSummary(null);
    setValidationState(ValidationStates.notValidated);
    if (suggestedCasesRef.current) suggestedCasesRef.current.clearAllCheckboxes();
    setLoadingCaseSummary(false);
    approveButtonRef.current?.disableButton(true);
  }

  function cancelUpdate(): void {
    courtSelectionRef.current?.clearValue();
    caseNumberRef.current?.resetValue();
    setEnableCaseEntry(false);
    resetState();
  }

  function confirmAction(status: OrderStatus, reason?: string): void {
    if (status === 'rejected') {
      approveOrderRejection(reason);
    } else if (status === 'approved') {
      confirmOrderApproval();
    }
  }

  function handleSuggestedCaseSelection(bCase: CaseSummary | null) {
    if (bCase) {
      const updated = { ...orderTransfer };
      updated.newCase = bCase;
      setEnableCaseEntry(false);
      setOrderTransfer(updated);
      approveButtonRef.current?.disableButton(false);
    } else {
      setEnableCaseEntry(true);
      approveButtonRef.current?.disableButton(true);
    }
  }

  function getTransferredCaseSuggestions(caseId: string) {
    setLoadingSuggestions(true);
    // approveButtonRef.current?.disableButton(true);
    api
      .get(`/orders-suggestions/${caseId}/`)
      .then((response) => {
        setLoadingSuggestions(false);
        setSuggestedCases(response.body as CaseSummary[]);
      })
      .catch((_reason: Error) => {
        setLoadingSuggestions(false);
        // props.onOrderUpdate({ message: reason.message, type: UswdsAlertStyle.Error, timeOut: 8 });
      });
  }

  async function getCaseSummary(caseId: string) {
    await api
      .get(`/cases/${caseId}/summary`)
      .then((response) => {
        const typedResponse = response as Chapter15CaseSummaryResponseData;
        setOriginalCaseSummary(typedResponse.body);
      })
      .catch((_reason) => {
        //
      });
  }

  useEffect(() => {
    getCaseSummary(order.caseId);
    getTransferredCaseSuggestions(order.caseId);
  }, []);

  return (
    <>
      {' '}
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">The system has identified a case transfer order for case:</div>
        <div className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          {!originalCaseSummary && (
            <LoadingSpinner
              id={`${order.id}-transfer-from-case-loading`}
              caption="Loading case..."
            ></LoadingSpinner>
          )}
          {originalCaseSummary && (
            <CaseTable
              id={`${order.id}-transfer-from-case`}
              cases={[originalCaseSummary]}
            ></CaseTable>
          )}
        </div>
        <div className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg dockets-label">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">Docket entry of the order:</div>
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
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10 select-destination-case--label">
          Select case to transfer to:
        </div>
        <div className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10 select-destination-case--description">
          Select the new case from the list below. If the case is not listed, select the new court
          division and enter the new case number.
        </div>
        <div className="grid-col-1"></div>
      </div>
      <section className="order-form" data-testid={`order-form-${order.id}`}>
        <div className="grid-row grid-gap-lg suggestions-form">
          {loadingSuggestions && (
            <>
              <div className="grid-col-1"></div>
              <div className="grid-col-11">
                <LoadingSpinner
                  id={`loading-spinner-${order.id}-suggestions`}
                  caption="Loading suggestions..."
                ></LoadingSpinner>
              </div>
            </>
          )}
          {!loadingSuggestions && (
            <>
              <div className="grid-col-1"></div>
              <div className="transfer-from-to__div transfer-description grid-col-10">
                <div className="transfer-text" tabIndex={0}>
                  Transfer{' '}
                  <CaseNumber
                    caseId={order.caseId}
                    data-testid={`pending-transfer-original-case-link-${order.caseId}`}
                  ></CaseNumber>{' '}
                  from
                  <span className="transfer-highlight__span">
                    {order.courtName} ({order.courtDivisionName})
                  </span>
                  to
                  {suggestedCases && suggestedCases?.length > 0 && (
                    <CaseTable
                      id="suggested-cases"
                      cases={[...suggestedCases, null]}
                      onSelect={handleSuggestedCaseSelection}
                      ref={suggestedCasesRef}
                    ></CaseTable>
                  )}
                  {suggestedCases && suggestedCases.length < 1 && (
                    <div className="alert-container">
                      <Alert
                        inline={true}
                        show={true}
                        title="No Matching Cases"
                        message="We couldn't find any cases with similar information to the case being transferred. Please try again later. Otherwise, enter the Case Number on the Enter Case tab."
                        type={UswdsAlertStyle.Warning}
                        role="status"
                        className="suggested-cases-alert"
                        id="suggested-cases-not-found"
                      />
                    </div>
                  )}
                </div>
                <div className="grid-col-1"></div>
              </div>
            </>
          )}
        </div>
        {enableCaseEntry && (
          <div className="case-entry-form">
            <div className="court-selection grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="transfer-from-to__div grid-col-10">
                <div>
                  <FormRequirementsNotice />
                </div>
                <div className="form-row">
                  <div className="select-container court-select-container">
                    <label htmlFor={`court-selection-${order.id}`}>New Court</label>
                    <div
                      className="usa-combo-box"
                      data-testid={`court-selection-usa-combo-box-${order.id}`}
                    >
                      <CamsSelect
                        id={`court-selection-${order.id}`}
                        className="new-court__select"
                        closeMenuOnSelect={true}
                        label="Select new court"
                        ref={courtSelectionRef}
                        onChange={handleCourtSelection}
                        options={getOfficeList(officesList)}
                        isSearchable={true}
                        required={true}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid-col-1"></div>
            </div>
            {/*TODO: find a way to remove `!` from below order properties */}
            {newCaseDivision && (
              <div className="preview-results grid-row grid-gap-lg">
                <div className="grid-col-1"></div>
                <div className="grid-col-10">
                  <span data-testid={`preview-description-${order.id}`}>
                    <CaseSelection
                      fromCourt={{
                        region: order.regionId!,
                        courtDivisionName: order.courtDivisionName!,
                      }}
                      toCourt={{
                        region: orderTransfer.newCase?.regionId,
                        courtDivisionName: orderTransfer.newCase?.courtDivisionName,
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
                <div>
                  <CaseNumberInput
                    id={`new-case-input-${order.id}`}
                    data-testid={`new-case-input-${order.id}`}
                    className="usa-input"
                    value={order.docketSuggestedCaseNumber}
                    onChange={handleCaseInputChange}
                    aria-label="New case ID"
                    ref={caseNumberRef}
                    disabled={true}
                    required={true}
                    label="New Case"
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
                    id={`loading-spinner-${order.id}-case-verification`}
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
                    message="We couldn't find a case with that number"
                    type={UswdsAlertStyle.Error}
                    role="status"
                    className="validation-alert"
                    id="validation-not-found"
                  />
                )}
              </div>
              <div className="grid-col-1"></div>
            </div>
          </div>
        )}
        <div className="button-bar grid-row grid-gap-lg">
          <div className="grid-col-1"></div>
          <div className="grid-col-5">
            <Button
              id={`accordion-reject-button-${order.id}`}
              onClick={() => confirmationModalRef.current?.show({ status: 'rejected' })}
              uswdsStyle={UswdsButtonStyle.Secondary}
            >
              Reject
            </Button>
          </div>
          <div className="grid-col-5 text-no-wrap float-right">
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
          fromCaseId={order.caseId}
          toCaseId={orderTransfer.newCase?.caseId}
          fromDivisionName={order.courtDivisionName}
          toDivisionName={orderTransfer.newCase?.courtDivisionName}
          fromCourtName={order.courtName!}
          toCourtName={orderTransfer.newCase?.courtName}
          onCancel={cancelUpdate}
          onConfirm={confirmAction}
        ></ConfirmationModal>
      </section>
    </>
  );
}

function safeToInt(s: string) {
  const intVal = parseInt(s);
  if (isNaN(intVal)) return s;

  return intVal.toString();
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
