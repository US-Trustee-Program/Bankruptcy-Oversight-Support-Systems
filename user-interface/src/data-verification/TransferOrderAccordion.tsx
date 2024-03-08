import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import { Accordion } from '@/lib/components/uswds/Accordion';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Input from '@/lib/components/uswds/Input';
import Api from '../lib/models/api';
import MockApi from '../lib/models/chapter15-mock.api.cases';
import { OfficeDetails } from '@common/cams/courts';
import {
  Chapter15CaseSummaryResponseData,
  TransferOrder,
} from '@/lib/type-declarations/chapter-15';
import { OrderStatus } from '@common/cams/orders';
import { InputRef } from '@/lib/type-declarations/input-fields';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import SearchableSelect, { SearchableSelectOption } from '@/lib/components/SearchableSelect';
import { AlertDetails } from '@/data-verification/DataVerificationScreen';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import './TransferOrderAccordion.scss';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { CaseTable, CaseTableImperative } from './CaseTable';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import ButtonGroup from '@/lib/components/uswds/ButtonGroup';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { TransferOrderAction } from '@common/cams/orders';
import { CaseSummary } from '@common/cams/cases';
import { getOfficeList, validateCaseNumberInput } from '@/data-verification/dataVerificationHelper';

type FlexibleTransferOrderAction = Partial<TransferOrderAction> & {
  newCase?: Partial<CaseSummary>;
};

export function getOrderTransferFromOrder(order: TransferOrder): FlexibleTransferOrderAction {
  const { id, caseId, newCaseId } = order;
  return {
    id,
    caseId,
    newCase: { caseId: newCaseId },
    orderType: order.orderType,
  };
}

export function isValidOrderTransfer(transfer: {
  newCase?: { caseId?: string; courtDivisionName?: string };
}) {
  return transfer.newCase?.caseId && transfer.newCase?.courtDivisionName;
}

function safeToInt(s: string) {
  const intVal = parseInt(s);
  if (isNaN(intVal)) return s;

  return intVal.toString();
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
    courtDivision: office?.courtDivision,
    caseId: `${office?.courtDivision}-${caseNumber}`,
  };

  return updated;
}

enum ValidationStates {
  notValidated,
  found,
  notFound,
}

export interface TransferOrderAccordionProps {
  order: TransferOrder;
  statusType: Map<string, string>;
  orderType: Map<string, string>;
  officesList: Array<OfficeDetails>;
  regionsMap: Map<string, string>;
  onOrderUpdate: (alertDetails: AlertDetails, order?: TransferOrder) => void;
  onExpand?: (id: string) => void;
  expandedId?: string;
}

const enterCaseButtonId = 'buttonEnterCase';

export function TransferOrderAccordion(props: TransferOrderAccordionProps) {
  const { order, statusType, orderType, officesList, expandedId, onExpand } = props;
  const [activeButtonId, setActiveButtonId] = useState<string>(enterCaseButtonId);

  const api = import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi : Api;

  const courtSelectionRef = useRef<InputRef>(null);
  const caseNumberRef = useRef<InputRef>(null);
  const approveButtonRef = useRef<ButtonRef>(null);
  const confirmationModalRef = useRef<ConfirmationModalImperative>(null);
  const suggestedCasesRef = useRef<CaseTableImperative>(null);

  const [orderTransfer, setOrderTransfer] = useState<FlexibleTransferOrderAction>(
    getOrderTransferFromOrder(order),
  );
  const [validationState, setValidationState] = useState<ValidationStates>(
    ValidationStates.notValidated,
  );
  const [originalCaseSummary, setOriginalCaseSummary] = useState<CaseSummary | null>(null);
  const [newCaseSummary, setNewCaseSummary] = useState<CaseSummary | null>(null);
  const [loadingCaseSummary, setLoadingCaseSummary] = useState<boolean>(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [toggleView, setToggleView] = useState<'default' | 'suggestions'>('default');
  const [suggestedCases, setSuggestedCases] = useState<CaseSummary[] | null>(null);
  const [newCaseDivision, setNewCaseDivision] = useState<OfficeDetails | null>(null);
  const [newCaseNumber, setNewCaseNumber] = useState<string | null>(order.newCaseId || null);

  async function getTransferredCaseSuggestions(caseId: string): Promise<CaseSummary[] | null> {
    const suggestions = await api
      .get(`/orders-suggestions/${caseId}/`)
      .then((response) => {
        return response.body as CaseSummary[];
      })
      .catch((reason: Error) => {
        props.onOrderUpdate({ message: reason.message, type: UswdsAlertStyle.Error, timeOut: 8 });
      });
    return suggestions ?? null;
  }

  function selectCaseInputEntry(_event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
    setToggleView('default');
    approveButtonRef.current?.disableButton(true);
  }

  async function selectSuggestedCaseEntry(
    _event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ): Promise<void> {
    setLoadingSuggestions(true);
    setToggleView('suggestions');
    if (!suggestedCases) {
      const suggestedCases = await getTransferredCaseSuggestions(order.caseId);
      setSuggestedCases(suggestedCases);
    }
    setLoadingSuggestions(false);
    approveButtonRef.current?.disableButton(true);
  }

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

  function handleCourtSelection(selection: SearchableSelectOption) {
    const office = officesList.find((o) => o.courtDivision === selection?.value) || null;
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

  function handleCaseInputChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const { caseNumber, joinedInput } = validateCaseNumberInput(ev);
    caseNumberRef.current?.setValue(joinedInput);

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

  function handleSuggestedCaseSelection(bCase: CaseSummary) {
    if (bCase) {
      const updated = { ...orderTransfer };
      updated.newCase = bCase;
      setOrderTransfer(updated);
      approveButtonRef.current?.disableButton(false);
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

  function cancelUpdate(): void {
    courtSelectionRef.current?.clearValue();
    caseNumberRef.current?.resetValue();
    approveButtonRef.current?.disableButton(true);
    setOrderTransfer(getOrderTransferFromOrder(order));
    setNewCaseSummary(null);
    setValidationState(ValidationStates.notValidated);
    if (suggestedCasesRef.current) suggestedCasesRef.current.clearSelection();
    setLoadingCaseSummary(false);
  }

  function confirmAction(status: OrderStatus, reason?: string): void {
    if (status === 'rejected') {
      approveOrderRejection(reason);
    } else if (status === 'approved') {
      confirmOrderApproval();
    }
  }

  function onCollapse() {
    cancelUpdate();
    setToggleView('default');
    approveButtonRef.current?.disableButton(true);
    setActiveButtonId(enterCaseButtonId);
  }

  function onToggleButtonClick(id: string) {
    cancelUpdate();
    setActiveButtonId(id);
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

  async function getCaseSummary() {
    await api
      .get(`/cases/${order.caseId}/summary`)
      .then((response) => {
        const typedResponse = response as Chapter15CaseSummaryResponseData;
        setOriginalCaseSummary(typedResponse.body);
      })
      .catch((_reason) => {
        //
      });
  }

  useEffect(() => {
    getCaseSummary();
  }, []);

  return (
    <>
      <Accordion
        key={order.id}
        id={`order-list-${order.id}`}
        expandedId={expandedId}
        onExpand={onExpand}
        onCollapse={onCollapse}
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
          <div className="grid-row grid-gap-lg">
            <div className="grid-col-1"></div>
            <div className="grid-col-10">
              <span className="text-bold padding-right-1">
                Case Number:{' '}
                <CaseNumber
                  caseId={order.caseId}
                  data-testid={`approved-transfer-original-case-link-${order.caseId}`}
                ></CaseNumber>
              </span>
              <span className="text-bold">Case Title: </span>
              <span className="padding-right-1">{order.caseTitle}</span>
              <span className="text-bold">Chapter: </span>
              <span className="padding-right-1">{order.chapter}</span>
              <span className="text-bold">Filed Date: </span>
              <span className="padding-right-1">
                {originalCaseSummary && formatDate(originalCaseSummary.dateFiled)}
              </span>
              <span className="text-bold">SSN/EIN: </span>
              <span className="padding-right-1">
                {originalCaseSummary?.debtor?.taxId
                  ? originalCaseSummary?.debtor.taxId
                  : originalCaseSummary?.debtor?.ssn}
              </span>
            </div>
            <div className="grid-col-1"></div>
          </div>
          <div className="grid-row grid-gap-lg">
            <div className="grid-col-1"></div>
            <div className="order-legal-statement grid-col-10">
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
                    <p tabIndex={0} className="measure-6">
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
          {order.status === 'approved' && (
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
          )}
          {order.status === 'rejected' && (
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
          )}
          {order.status !== 'approved' && order.status !== 'rejected' && (
            <>
              <div className="button-group-section grid-row grid-gap-lg">
                <div className="grid-col-1"></div>
                <div className="grid-col-10">
                  <label>Choose an option:</label>
                  <ButtonGroup
                    id={`button-group-${order.id}`}
                    className="entry-option-button-group"
                    activeButtonId={activeButtonId}
                    onButtonClick={onToggleButtonClick}
                  >
                    <Button id="buttonEnterCase" onClick={selectCaseInputEntry}>
                      Enter Case
                    </Button>
                    <Button id="buttonSuggestedCases" onClick={selectSuggestedCaseEntry}>
                      Suggested Cases
                    </Button>
                  </ButtonGroup>
                </div>
                <div className="grid-col-1"></div>
              </div>
              <section className="order-form" data-testid={`order-form-${order.id}`}>
                {toggleView === 'default' && (
                  <div className="case-entry-form">
                    <div className="court-selection grid-row grid-gap-lg">
                      <div className="grid-col-1"></div>
                      <div className="transfer-from-to__div grid-col-10">
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
                        <label htmlFor={`new-case-input-${order.id}`}>New Case</label>
                        <div>
                          <Input
                            id={`new-case-input-${order.id}`}
                            data-testid={`new-case-input-${order.id}`}
                            className="usa-input"
                            value={order.newCaseId}
                            onChange={handleCaseInputChange}
                            aria-label="New case ID"
                            ref={caseNumberRef}
                            disabled={true}
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
                          />
                        )}
                      </div>
                      <div className="grid-col-1"></div>
                    </div>
                  </div>
                )}
                {toggleView === 'suggestions' && (
                  <div className="suggestions-form">
                    {loadingSuggestions && (
                      <div className="grid-row grid-gap-lg">
                        <div className="grid-col-1"></div>
                        <div className="grid-col-10">
                          <LoadingSpinner
                            id="loading-spinner"
                            caption="Loading suggestions..."
                          ></LoadingSpinner>
                        </div>
                      </div>
                    )}
                    {!loadingSuggestions && (
                      <>
                        <div className="grid-row grid-gap-lg transfer-instructions">
                          <div className="grid-col-1"></div>
                          <div className="grid-col-10">
                            These cases have similar information to the case being transferred.
                            Select one of the cases below to set up the transfer. If the correct
                            case {"isn't "}
                            listed, please enter the Case Number on the Enter Case tab instead.
                          </div>
                          <div className="grid-col-1"></div>
                        </div>
                        <div className="grid-row grid-gap-lg transfer-description">
                          <div className="grid-col-1"></div>
                          <div className="transfer-from-to__div grid-col-10">
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
                            </div>
                          </div>
                          <div className="grid-col-1"></div>
                        </div>
                        <div className="grid-row grid-gap-lg suggestion-list">
                          <div className="grid-col-1"></div>
                          <div className="grid-col-10">
                            {suggestedCases && suggestedCases?.length > 0 && (
                              <CaseTable
                                id="suggested-cases"
                                cases={suggestedCases}
                                onSelect={handleSuggestedCaseSelection}
                                ref={suggestedCasesRef}
                              ></CaseTable>
                            )}
                            {suggestedCases && suggestedCases.length < 1 && (
                              <div className="alert-container">
                                <Alert
                                  inline={true}
                                  show={true}
                                  slim={true}
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
                )}
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

  function clearReason() {
    if (reasonRef.current) reasonRef.current.value = '';
  }

  const actionButtonGroup = {
    modalId: `confirmation-modal-${id}`,
    modalRef: modalRef,
    submitButton: {
      label: options.title,
      onClick: () => {
        onConfirm(options.status, reasonRef.current?.value);
      },
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
              <span className="transfer-highlight__span">{getCaseNumber(toCaseId)}</span>
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
