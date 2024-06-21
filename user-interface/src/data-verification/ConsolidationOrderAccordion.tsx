import { Accordion } from '@/lib/components/uswds/Accordion';
import { formatDate } from '@/lib/utils/datetime';
import { CaseTable } from './transfer/CaseTable';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { ConsolidationCaseTable, OrderTableImperative } from './ConsolidationCasesTable';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  ConsolidationOrderCase,
  ConsolidationType,
} from '@common/cams/orders';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { filterCourtByDivision, OfficeDetails } from '@common/cams/courts';
import {
  ConsolidationOrderModal,
  ConfirmationModalImperative,
  ConfirmActionResults,
} from '@/data-verification/ConsolidationOrderModal';
import Alert, { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { CaseNumber } from '@/lib/components/CaseNumber';
import './ConsolidationOrderAccordion.scss';
import { useGenericApi } from '@/lib/hooks/UseApi';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import Radio from '@/lib/components/uswds/Radio';
import Checkbox, { CheckboxRef } from '@/lib/components/uswds/Checkbox';
import CamsSelect, {
  CamsSelectOptionList,
  SearchableSelectOption,
} from '@/lib/components/CamsSelect';
import { getOfficeList } from '@/data-verification/dataVerificationHelper';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import { InputRef, RadioRef } from '@/lib/type-declarations/input-fields';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { CaseSummary } from '@common/cams/cases';
import { CaseAssignment } from '@common/cams/assignments';
import { FormRequirementsNotice } from '@/lib/components/uswds/FormRequirementsNotice';
import { useApi2 } from '@/lib/hooks/UseApi2';

const genericErrorMessage =
  'An unknown error has occurred and has been logged.  Please try again later.';

export async function fetchLeadCaseAttorneys(leadCaseId: string) {
  const caseAssignments: CaseAssignment[] = (await useApi2().getCaseAssignments(leadCaseId)).data;
  if (caseAssignments.length && caseAssignments[0].name) {
    return caseAssignments.map((assignment) => assignment.name);
  } else {
    return [];
  }
}

export function getUniqueDivisionCodeOrUndefined(cases: CaseSummary[]) {
  const divisionCodeSet = cases.reduce((set, bCase) => {
    set.add(bCase.courtDivisionCode);
    return set;
  }, new Set<string>());
  return divisionCodeSet.size === 1 ? Array.from<string>(divisionCodeSet)[0] : undefined;
}

export interface ConsolidationOrderAccordionProps {
  order: ConsolidationOrder;
  statusType: Map<string, string>;
  orderType: Map<string, string>;
  officesList: Array<OfficeDetails>;
  regionsMap: Map<string, string>;
  onOrderUpdate: (
    alertDetails: AlertDetails,
    orders?: ConsolidationOrder[],
    deletedOrder?: ConsolidationOrder,
  ) => void;
  onExpand?: (id: string) => void;
  expandedId?: string;
  hidden?: boolean;
}

export function ConsolidationOrderAccordion(props: ConsolidationOrderAccordionProps) {
  const { hidden, statusType, orderType, officesList, expandedId } = props;

  //========== REFS ==========

  const caseTableRef = useRef<OrderTableImperative>(null);
  const clearButtonRef = useRef<ButtonRef>(null);
  const approveButtonRef = useRef<ButtonRef>(null);
  const confirmationModalRef = useRef<ConfirmationModalImperative>(null);
  const jointAdministrationRef = useRef<RadioRef>(null);
  const leadCaseDivisionRef = useRef<InputRef>(null);
  const leadCaseNumberRef = useRef<InputRef>(null);
  const rejectButtonRef = useRef<ButtonRef>(null);
  const substantiveRef = useRef<RadioRef>(null);
  const toggleLeadCaseFormRef = useRef<CheckboxRef>(null);

  //========== STATE ==========

  const [consolidationType, setConsolidationType] = useState<ConsolidationType | null>(null);
  const [filteredOfficesList] = useState<OfficeDetails[] | null>(
    filterCourtByDivision(props.order.courtDivisionCode, officesList),
  );
  const [foundValidCaseNumber, setFoundValidCaseNumber] = useState<boolean>(false);
  const [isConsolidationProcessing, setIsConsolidationProcessing] = useState<boolean>(false);
  const [isDataEnhanced, setIsDataEnhanced] = useState<boolean>(false);
  const [isValidatingLeadCaseNumber, setIsValidatingLeadCaseNumber] = useState<boolean>(false);
  const [leadCaseId, setLeadCaseId] = useState<string>('');
  const [leadCase, setLeadCase] = useState<ConsolidationOrderCase | null>(null);
  const [leadCaseCourt, setLeadCaseCourt] = useState<string>('');
  const [leadCaseNumber, setLeadCaseNumber] = useState<string>('');
  const [leadCaseNumberError, setLeadCaseNumberError] = useState<string>('');
  const [order, setOrder] = useState<ConsolidationOrder>(props.order);
  const [selectedCases, setSelectedCases] = useState<Array<ConsolidationOrderCase>>([]);
  const [showLeadCaseForm, setShowLeadCaseForm] = useState<boolean>(false);

  const genericApi = useGenericApi();
  const api2 = useApi2();

  //========== MISC FUNCTIONS ==========

  function clearLeadCase(): void {
    setLeadCase(null);
    setLeadCaseId('');
    caseTableRef.current?.clearLeadCase();
    leadCaseNumberRef.current?.clearValue();
  }

  function clearSelectedCases(): void {
    setSelectedCases([]);
    caseTableRef.current?.clearAllCheckboxes();
  }

  function disableLeadCaseForm(disabled: boolean) {
    leadCaseDivisionRef.current?.disable(disabled);
    leadCaseNumberRef.current?.disable(disabled);
  }

  function updateSubmitButtonsState() {
    if (selectedCases.length) {
      rejectButtonRef.current?.disableButton(false);

      approveButtonRef.current?.disableButton(
        !isDataEnhanced ||
          leadCaseId === '' ||
          consolidationType === null ||
          selectedCasesAreConsolidationCases(),
      );
    } else {
      rejectButtonRef.current?.disableButton(true);
      approveButtonRef.current?.disableButton(true);
    }
  }

  function getCurrentLeadCaseId(leadCaseNumber: string) {
    if (leadCaseCourt && leadCaseNumber) {
      return `${leadCaseCourt}-${leadCaseNumber}`;
    } else {
      return '';
    }
  }

  function selectedCasesAreConsolidationCases() {
    return order.childCases.reduce((itDoes, bCase) => {
      if (!selectedCases.includes(bCase)) {
        return itDoes;
      }
      return itDoes || !!bCase.associations?.length;
    }, false);
  }

  function setOrderWithDataEnhancement(order: ConsolidationOrder) {
    setOrder({ ...order });
  }

  function updateAllSelections(caseList: ConsolidationOrderCase[]) {
    setSelectedCases(caseList);
  }

  //========== HANDLERS ==========

  function handleApproveButtonClick() {
    confirmationModalRef.current?.show({
      status: 'approved',
      cases: selectedCases,
      leadCase: leadCase,
      consolidationType: consolidationType,
    });
  }

  function handleClearInputs(): void {
    clearLeadCase();
    clearSelectedCases();
    setLeadCaseNumber('');
    setLeadCaseNumberError('');
    setFoundValidCaseNumber(false);
    setShowLeadCaseForm(false);
    jointAdministrationRef.current?.check(false);
    substantiveRef.current?.check(false);
    toggleLeadCaseFormRef.current?.setChecked(false);
    updateSubmitButtonsState();
  }

  function handleConfirmAction(action: ConfirmActionResults): void {
    switch (action.status) {
      case 'approved':
        approveConsolidation(action);
        break;
      case 'rejected':
        rejectConsolidation(action);
        break;
    }
  }

  function handleIncludeCase(bCase: ConsolidationOrderCase) {
    let tempSelectedCases: ConsolidationOrderCase[];
    if (selectedCases.includes(bCase)) {
      tempSelectedCases = selectedCases.filter((aCase) => bCase !== aCase);
    } else {
      tempSelectedCases = [...selectedCases, bCase];
    }
    setSelectedCases(tempSelectedCases);
    updateSubmitButtonsState();
  }

  async function handleLeadCaseInputChange(caseNumber?: string) {
    if (caseNumber) {
      setLeadCaseNumber(caseNumber);
    } else {
      setLeadCaseNumber('');
      setFoundValidCaseNumber(false);
      setLeadCase(null);
      setLeadCaseNumberError('');
      approveButtonRef.current?.disableButton(true);
    }
  }

  function handleMarkLeadCase(bCase: ConsolidationOrderCase) {
    toggleLeadCaseFormRef.current?.setChecked(false);
    leadCaseNumberRef.current?.clearValue();
    setShowLeadCaseForm(false);
    setFoundValidCaseNumber(false);

    if (leadCaseId === bCase.caseId) {
      setLeadCaseId('');
      setLeadCase(null);
    } else {
      setLeadCaseId(bCase.caseId);
      setLeadCase(bCase);
    }
  }

  async function handleOnExpand() {
    if (props.onExpand) {
      props.onExpand(`order-list-${order.id}`);
    }
    if (!isDataEnhanced) {
      for (const bCase of order.childCases) {
        try {
          const assignmentsResponse = await api2.getCaseAssignments(bCase.caseId);
          bCase.attorneyAssignments = assignmentsResponse.data;

          const associatedResponse = await api2.getCaseAssociations(bCase.caseId);
          bCase.associations = associatedResponse.data;
        } catch (reason) {
          console.error('enhancing data error', reason);
          // The child case assignments are not critical to perform the consolidation. Catch any error
          // and don't set the attorney assignment for this specific case.
        }
      }
      setOrderWithDataEnhancement(order);
      setIsDataEnhanced(true);
    }
  }

  function handleSelectConsolidationType(value: string): void {
    setConsolidationType(value as ConsolidationType);
  }

  function handleSelectLeadCaseCourt(option: CamsSelectOptionList): void {
    setLeadCaseCourt((option as SearchableSelectOption)?.value || '');
  }

  function handleToggleLeadCaseForm(ev: ChangeEvent<HTMLInputElement>): void {
    clearLeadCase();
    setShowLeadCaseForm(ev.target.checked);
  }

  //========== USE EFFECTS ==========

  useEffect(() => {
    updateSubmitButtonsState();
    if (isConsolidationProcessing) {
      clearButtonRef.current?.disableButton(true);
    } else {
      clearButtonRef.current?.disableButton(false);
    }
  }, [isConsolidationProcessing]);

  useEffect(() => {
    updateSubmitButtonsState();
  }, [selectedCases, leadCaseId, isDataEnhanced, consolidationType]);

  useEffect(() => {
    const currentLeadCaseId = getCurrentLeadCaseId(leadCaseNumber);
    if (currentLeadCaseId && currentLeadCaseId.length === 12) {
      disableLeadCaseForm(true);
      setIsValidatingLeadCaseNumber(true);
      setLeadCaseNumberError('');
      setLeadCaseId('');
      api2
        .getCaseSummary(currentLeadCaseId)
        .then((response) => {
          const caseSummary = response.data;
          api2
            .getCaseAssociations(caseSummary.caseId)
            .then((response) => {
              const associations = response.data;
              type ChildCaseFacts = { isConsolidationChildCase: boolean; leadCase?: CaseSummary };
              const childCaseFacts = associations
                .filter((reference) => reference.caseId === caseSummary.caseId)
                .reduce(
                  (acc: ChildCaseFacts, reference) => {
                    if (reference.documentType === 'CONSOLIDATION_TO') {
                      acc.isConsolidationChildCase = true;
                      acc.leadCase = reference.otherCase;
                    }
                    return acc || reference.documentType === 'CONSOLIDATION_TO';
                  },
                  { isConsolidationChildCase: false },
                );

              type PreviousConsolidationFacts = {
                isAlreadyConsolidated: boolean;
                leadCase?: CaseSummary;
              };
              const previousConsolidationFacts = associations
                .filter((reference) => reference.caseId === caseSummary.caseId)
                .reduce(
                  (acc: PreviousConsolidationFacts, reference) => {
                    if (reference.documentType === 'CONSOLIDATION_FROM') {
                      acc.isAlreadyConsolidated = true;
                      acc.leadCase = reference.otherCase;
                    }
                    return acc || reference.documentType === 'CONSOLIDATION_FROM';
                  },
                  { isAlreadyConsolidated: false },
                );

              if (childCaseFacts.isConsolidationChildCase) {
                const message =
                  `Case ${getCaseNumber(caseSummary.caseId)} is a consolidated ` +
                  `child case of case ${getCaseNumber(childCaseFacts.leadCase!.caseId)}.`;
                setLeadCaseNumberError(message);
                setIsValidatingLeadCaseNumber(false);
                disableLeadCaseForm(false);
                setFoundValidCaseNumber(false);
              } else if (previousConsolidationFacts.isAlreadyConsolidated) {
                const message = `This case is already part of a consolidation.`;
                setLeadCaseNumberError(message);
                setIsValidatingLeadCaseNumber(false);
                disableLeadCaseForm(false);
                setFoundValidCaseNumber(false);
              } else {
                api2.getCaseAssignments(currentLeadCaseId).then((response) => {
                  const attorneys = response.data;
                  setLeadCase({
                    ...caseSummary,
                    docketEntries: [],
                    orderDate: order.orderDate,
                    attorneyAssignments: attorneys,
                    associations,
                  });
                  setLeadCaseId(currentLeadCaseId);
                  setIsValidatingLeadCaseNumber(false);
                  setFoundValidCaseNumber(true);
                  disableLeadCaseForm(false);
                });
              }
            })
            .catch((error) => {
              const message =
                'Cannot verify lead case is not part of another consolidation. ' + error.message;
              setLeadCaseNumberError(message);
              setIsValidatingLeadCaseNumber(false);
              disableLeadCaseForm(false);
              setFoundValidCaseNumber(false);
            });
        })
        .catch((error) => {
          // Brittle way to determine if we have encountred a 404...
          const isNotFound = (error.message as string).startsWith('404');
          const message = isNotFound
            ? "We couldn't find a case with that number."
            : 'Cannot verify lead case number.';
          setLeadCaseNumberError(message);
          setIsValidatingLeadCaseNumber(false);
          disableLeadCaseForm(false);
          setFoundValidCaseNumber(false);
        });
    }
  }, [leadCaseNumber, leadCaseCourt]);

  //========== FORM SUBMISION ==========

  function approveConsolidation(action: ConfirmActionResults) {
    if (action.status === 'approved' && leadCase && consolidationType) {
      const data: ConsolidationOrderActionApproval = {
        ...order,
        consolidationType,
        approvedCases: selectedCases
          .map((bCase) => bCase.caseId)
          .filter((caseId) => caseId !== leadCase.caseId),
        leadCase,
      };

      setIsConsolidationProcessing(true);
      genericApi
        .put<ConsolidationOrder[]>('/consolidations/approve', data)
        .then((response) => {
          const newOrders = response.data;
          const approvedOrder = newOrders.find((o) => o.status === 'approved')!;
          setIsConsolidationProcessing(false);
          props.onOrderUpdate(
            {
              message: `Consolidation to lead case ${getCaseNumber(approvedOrder.leadCase?.caseId)} in ${
                approvedOrder.leadCase?.courtName
              } (${approvedOrder.leadCase?.courtDivisionName}) was successful.`,
              type: UswdsAlertStyle.Success,
              timeOut: 8,
            },
            newOrders,
            order,
          );
        })
        .catch((_reason) => {
          setIsConsolidationProcessing(false);
          props.onOrderUpdate({
            message: genericErrorMessage,
            type: UswdsAlertStyle.Error,
            timeOut: 8,
          });
        });
    }
  }

  function rejectConsolidation(action: ConfirmActionResults) {
    if (action.status === 'rejected') {
      const data: ConsolidationOrderActionRejection = {
        ...order,
        rejectedCases: selectedCases.map((bCase) => bCase.caseId),
        reason: action.rejectionReason,
      };

      setIsConsolidationProcessing(true);
      genericApi
        .put<ConsolidationOrder[]>('/consolidations/reject', data)
        .then((response) => {
          const newOrders = response.data;
          setIsConsolidationProcessing(false);
          props.onOrderUpdate(
            {
              message: `Rejection of consolidation order was successful.`,
              type: UswdsAlertStyle.Success,
              timeOut: 8,
            },
            newOrders,
            order,
          );
        })
        .catch((_reason) => {
          setIsConsolidationProcessing(false);
          props.onOrderUpdate({
            message: genericErrorMessage,
            type: UswdsAlertStyle.Error,
            timeOut: 8,
          });
        });
    }
  }

  //========== JSX ==========

  return (
    <Accordion
      key={order.id}
      id={`order-list-${order.id}`}
      expandedId={expandedId}
      onExpand={handleOnExpand}
      onCollapse={handleClearInputs}
      hidden={hidden}
    >
      <section
        className="accordion-heading grid-row grid-gap-lg"
        data-testid={`accordion-heading-${order.id}`}
      >
        <div className="grid-col-6 text-no-wrap" aria-label={`Court district ${order.courtName}`}>
          {order.courtName}
        </div>
        <div
          className="grid-col-2 text-no-wrap"
          title="Order Filed"
          aria-label={`Order Filed ${formatDate(order.orderDate)}`}
        >
          {formatDate(order.orderDate)}
        </div>
        <div className="grid-col-2 order-type text-no-wrap">
          <span
            className="event-type-label"
            aria-label={`Event type ${orderType.get(order.orderType)}`}
          >
            {orderType.get(order.orderType)}
          </span>
        </div>
        <div className="grid-col-2 order-status text-no-wrap">
          <span
            className={`${order.status} event-status-label`}
            aria-label={`Event status ${statusType.get(order.status)}`}
          >
            {statusType.get(order.status)}
          </span>
        </div>
      </section>
      <>
        {order.status === 'pending' && (
          <section
            className="accordion-content order-form"
            data-testid={`accordion-content-${order.id}`}
          >
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <p aria-details="" className="form-instructions measure-6">
                  Choose a consolidation type. Use the checkboxes to include cases in the
                  consolidation (at least two cases), and then mark a lead case. If the lead case is
                  not listed, enter it at the bottom. When finished, click Verify to review your
                  changes before approving them.
                </p>
                <FormRequirementsNotice />
                <RadioGroup
                  className="consolidation-type-container"
                  label="Consolidation Type"
                  required={true}
                >
                  <Radio
                    id={`joint-admin-${order.id}`}
                    name="consolidation-type"
                    label="Joint Administration"
                    value="administrative"
                    className="text-no-wrap"
                    onChange={handleSelectConsolidationType}
                    ref={jointAdministrationRef}
                  />
                  <Radio
                    id={`substantive-${order.id}`}
                    name="consolidation-type"
                    label="Substantive Consolidation"
                    value="substantive"
                    onChange={handleSelectConsolidationType}
                    ref={substantiveRef}
                  />
                </RadioGroup>
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <ConsolidationCaseTable
                  id={`case-list-${order.id}`}
                  data-testid={`${order.id}-case-list`}
                  cases={order.childCases}
                  onSelect={handleIncludeCase}
                  updateAllSelections={updateAllSelections}
                  isDataEnhanced={isDataEnhanced}
                  ref={caseTableRef}
                  onMarkLead={handleMarkLeadCase}
                ></ConsolidationCaseTable>
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div
              className="lead-case-form grid-row grid-gap-lg"
              data-testid={`lead-case-form-${order.id}`}
            >
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <Checkbox
                  id={`lead-case-form-checkbox-toggle-${order.id}`}
                  className="lead-case-form-toggle"
                  onChange={handleToggleLeadCaseForm}
                  value=""
                  ref={toggleLeadCaseFormRef}
                  label="Lead Case Not Listed"
                ></Checkbox>
                {showLeadCaseForm && (
                  <section
                    className={`lead-case-form-container lead-case-form-container-${order.id}`}
                  >
                    <h3>Enter lead case details:</h3>
                    <div className="lead-case-court-container">
                      <CamsSelect
                        id={'lead-case-court'}
                        required={true}
                        options={getOfficeList(filteredOfficesList ?? props.officesList)}
                        onChange={handleSelectLeadCaseCourt}
                        ref={leadCaseDivisionRef}
                        label="Select a court"
                        value={getUniqueDivisionCodeOrUndefined(order.childCases)}
                        isSearchable={true}
                      />
                    </div>
                    <div className="lead-case-number-container">
                      <CaseNumberInput
                        id={`lead-case-input-${order.id}`}
                        data-testid={`lead-case-input-${order.id}`}
                        className="usa-input"
                        onChange={handleLeadCaseInputChange}
                        allowPartialCaseNumber={false}
                        required={true}
                        label="Enter a case number"
                        ref={leadCaseNumberRef}
                      />
                      {leadCaseNumberError ? (
                        <Alert
                          id={`lead-case-number-alert-${order.id}`}
                          message={leadCaseNumberError}
                          type={UswdsAlertStyle.Error}
                          show={true}
                          slim={true}
                          inline={true}
                        ></Alert>
                      ) : (
                        <LoadingSpinner
                          id={`lead-case-number-loading-spinner-${order.id}`}
                          caption="Verifying lead case number..."
                          height="40px"
                          hidden={!isValidatingLeadCaseNumber}
                        />
                      )}
                      {foundValidCaseNumber && leadCase && (
                        <>
                          <h4>Selected Lead Case</h4>
                          <CaseTable
                            id={`valid-case-number-found-${order.id}`}
                            cases={[leadCase]}
                          ></CaseTable>
                        </>
                      )}
                    </div>
                  </section>
                )}
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="button-bar grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10 text-no-wrap float-right">
                <LoadingSpinner
                  id={`processing-consolidation-loading-spinner-${order.id}`}
                  caption="Updating..."
                  height="40px"
                  hidden={!isConsolidationProcessing}
                />
                <Button
                  id={`accordion-cancel-button-${order.id}`}
                  onClick={handleClearInputs}
                  uswdsStyle={UswdsButtonStyle.Unstyled}
                  className="unstyled-button"
                  ref={clearButtonRef}
                >
                  Clear
                </Button>
                <Button
                  id={`accordion-reject-button-${order.id}`}
                  onClick={() =>
                    confirmationModalRef.current?.show({
                      status: 'rejected',
                      cases: selectedCases,
                      leadCase: leadCase,
                    })
                  }
                  uswdsStyle={UswdsButtonStyle.Outline}
                  className="margin-right-2"
                  ref={rejectButtonRef}
                >
                  Reject
                </Button>
                <Button
                  id={`accordion-approve-button-${order.id}`}
                  onClick={handleApproveButtonClick}
                  disabled={true}
                  ref={approveButtonRef}
                >
                  Verify
                </Button>
              </div>
              <div className="grid-col-1"></div>
            </div>
            <ConsolidationOrderModal
              ref={confirmationModalRef}
              id={`confirmation-modal-${order.id}`}
              onCancel={() => {}}
              onConfirm={handleConfirmAction}
            ></ConsolidationOrderModal>
          </section>
        )}
        {order.status === 'approved' && (
          <section
            className="accordion-content order-form"
            data-testid={`accordion-content-${order.id}`}
          >
            <div className="grid-row grid-gap-lg consolidation-text">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                Consolidated the following cases to lead case{' '}
                <CaseNumber
                  data-testid={'lead-case-number'}
                  caseId={order.leadCase!.caseId}
                  renderAs="link"
                  openLinkIn="new-window"
                ></CaseNumber>{' '}
                {order.leadCase?.caseTitle}.
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <CaseTable
                  id={`order-${order.id}-child-cases`}
                  cases={order.childCases}
                ></CaseTable>
              </div>
              <div className="grid-col-1"></div>
            </div>
          </section>
        )}
        {order.status === 'rejected' && (
          <section
            className="accordion-content order-form"
            data-testid={`accordion-content-${order.id}`}
          >
            <div className="grid-row grid-gap-lg consolidation-text">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                Rejected the consolidation of the cases below
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
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <ConsolidationCaseTable
                  id={`${order.id}-case-list`}
                  data-testid={`${order.id}-case-list`}
                  cases={order.childCases}
                  isDataEnhanced={isDataEnhanced}
                ></ConsolidationCaseTable>
              </div>
              <div className="grid-col-1"></div>
            </div>
          </section>
        )}
      </>
    </Accordion>
  );
}
