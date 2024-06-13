import { Accordion } from '@/lib/components/uswds/Accordion';
import { formatDate } from '@/lib/utils/datetime';
import { CaseTable } from './transfer/CaseTable';
import { ChangeEvent, useEffect, useRef } from 'react';
import { ConsolidationCaseTable, OrderTableImperative } from './ConsolidationCasesTable';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  ConsolidationOrderCase,
  ConsolidationType,
} from '@common/cams/orders';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { OfficeDetails } from '@common/cams/courts';
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
import { FormRequirementsNotice } from '@/lib/components/uswds/FormRequirementsNotice';
import { useApi2 } from '@/lib/hooks/UseApi2';
import {
  getCurrentLeadCaseId,
  getUniqueDivisionCodeOrUndefined,
} from '@/data-verification/consolidation/consolidationOrderAccordion';
import type { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';
import { useConsolidationStoreImpl } from '@/data-verification/consolidation/consolidationStoreImpl';

const genericErrorMessage =
  'An unknown error has occurred and has been logged.  Please try again later.';

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
  // TODO: remove this explicit use of useConsolidationStoreImpl
  const consolidationStore: ConsolidationStore = useConsolidationStoreImpl(props, []);

  const { hidden, statusType, orderType, expandedId } = props;

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

  const genericApi = useGenericApi();
  const api2 = useApi2();

  //========== MISC FUNCTIONS ==========

  function clearLeadCase(): void {
    consolidationStore.setLeadCase(null);
    consolidationStore.setLeadCaseId('');
    caseTableRef.current?.clearLeadCase();
    leadCaseNumberRef.current?.clearValue();
  }

  function clearSelectedCases(): void {
    consolidationStore.setSelectedCases([]);
    caseTableRef.current?.clearAllCheckboxes();
  }

  function disableLeadCaseForm(disabled: boolean) {
    leadCaseDivisionRef.current?.disable(disabled);
    leadCaseNumberRef.current?.disable(disabled);
  }

  function updateSubmitButtonsState() {
    if (consolidationStore.selectedCases.length) {
      rejectButtonRef.current?.disableButton(false);

      approveButtonRef.current?.disableButton(
        !consolidationStore.isDataEnhanced ||
          consolidationStore.leadCaseId === '' ||
          consolidationStore.consolidationType === null ||
          selectedCasesAreConsolidationCases(),
      );
    } else {
      rejectButtonRef.current?.disableButton(true);
      approveButtonRef.current?.disableButton(true);
    }
  }

  function selectedCasesAreConsolidationCases() {
    return consolidationStore.order.childCases.reduce((itDoes, bCase) => {
      if (!consolidationStore.selectedCases.includes(bCase)) {
        return itDoes;
      }
      return itDoes || !!bCase.associations?.length;
    }, false);
  }

  function setOrderWithDataEnhancement(order: ConsolidationOrder) {
    consolidationStore.setOrder({ ...order });
  }

  function updateAllSelections(caseList: ConsolidationOrderCase[]) {
    consolidationStore.setSelectedCases(caseList);
  }

  //========== HANDLERS ==========

  function handleApproveButtonClick() {
    confirmationModalRef.current?.show({
      status: 'approved',
      cases: consolidationStore.selectedCases,
      leadCase: consolidationStore.leadCase,
      consolidationType: consolidationStore.consolidationType,
    });
  }

  function handleClearInputs(): void {
    clearLeadCase();
    clearSelectedCases();
    consolidationStore.setLeadCaseNumber('');
    consolidationStore.setLeadCaseNumberError('');
    consolidationStore.setFoundValidCaseNumber(false);
    consolidationStore.setShowLeadCaseForm(false);
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
    if (consolidationStore.selectedCases.includes(bCase)) {
      tempSelectedCases = consolidationStore.selectedCases.filter((aCase) => bCase !== aCase);
    } else {
      tempSelectedCases = [...consolidationStore.selectedCases, bCase];
    }
    consolidationStore.setSelectedCases(tempSelectedCases);
    updateSubmitButtonsState();
  }

  async function handleLeadCaseInputChange(caseNumber?: string) {
    if (caseNumber) {
      consolidationStore.setLeadCaseNumber(caseNumber);
    } else {
      consolidationStore.setLeadCaseNumber('');
      consolidationStore.setFoundValidCaseNumber(false);
      consolidationStore.setLeadCase(null);
      consolidationStore.setLeadCaseNumberError('');
      approveButtonRef.current?.disableButton(true);
    }
  }

  function handleMarkLeadCase(bCase: ConsolidationOrderCase) {
    toggleLeadCaseFormRef.current?.setChecked(false);
    leadCaseNumberRef.current?.clearValue();
    consolidationStore.setShowLeadCaseForm(false);
    consolidationStore.setFoundValidCaseNumber(false);

    if (consolidationStore.leadCaseId === bCase.caseId) {
      consolidationStore.setLeadCaseId('');
      consolidationStore.setLeadCase(null);
    } else {
      consolidationStore.setLeadCaseId(bCase.caseId);
      consolidationStore.setLeadCase(bCase);
    }
  }

  async function handleOnExpand() {
    if (props.onExpand) {
      props.onExpand(`order-list-${consolidationStore.order.id}`);
    }
    if (!consolidationStore.isDataEnhanced) {
      for (const bCase of consolidationStore.order.childCases) {
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
      setOrderWithDataEnhancement(consolidationStore.order);
      consolidationStore.setIsDataEnhanced(true);
    }
  }

  function handleSelectConsolidationType(value: string): void {
    consolidationStore.setConsolidationType(value as ConsolidationType);
  }

  function handleSelectLeadCaseCourt(option: CamsSelectOptionList): void {
    consolidationStore.setLeadCaseCourt((option as SearchableSelectOption)?.value || '');
  }

  function handleToggleLeadCaseForm(ev: ChangeEvent<HTMLInputElement>): void {
    clearLeadCase();
    consolidationStore.setShowLeadCaseForm(ev.target.checked);
  }

  //========== USE EFFECTS ==========

  useEffect(() => {
    updateSubmitButtonsState();
    if (consolidationStore.isProcessing) {
      clearButtonRef.current?.disableButton(true);
    } else {
      clearButtonRef.current?.disableButton(false);
    }
  }, [consolidationStore.isProcessing]);

  useEffect(() => {
    updateSubmitButtonsState();
  }, [
    consolidationStore.selectedCases,
    consolidationStore.leadCaseId,
    consolidationStore.isDataEnhanced,
    consolidationStore.consolidationType,
  ]);

  useEffect(() => {
    const currentLeadCaseId = getCurrentLeadCaseId({
      leadCaseCourt: consolidationStore.leadCaseCourt,
      leadCaseNumber: consolidationStore.leadCaseNumber,
    });
    if (currentLeadCaseId && currentLeadCaseId.length === 12) {
      disableLeadCaseForm(true);
      consolidationStore.setIsValidatingLeadCaseNumber(true);
      consolidationStore.setLeadCaseNumberError('');
      consolidationStore.setLeadCaseId('');
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
                consolidationStore.setLeadCaseNumberError(message);
                consolidationStore.setIsValidatingLeadCaseNumber(false);
                disableLeadCaseForm(false);
                consolidationStore.setFoundValidCaseNumber(false);
              } else if (previousConsolidationFacts.isAlreadyConsolidated) {
                const message = `This case is already part of a consolidation.`;
                consolidationStore.setLeadCaseNumberError(message);
                consolidationStore.setIsValidatingLeadCaseNumber(false);
                disableLeadCaseForm(false);
                consolidationStore.setFoundValidCaseNumber(false);
              } else {
                api2.getCaseAssignments(currentLeadCaseId).then((response) => {
                  const attorneys = response.data;
                  consolidationStore.setLeadCase({
                    ...caseSummary,
                    docketEntries: [],
                    orderDate: consolidationStore.order.orderDate,
                    attorneyAssignments: attorneys,
                    associations,
                  });
                  consolidationStore.setLeadCaseId(currentLeadCaseId);
                  consolidationStore.setIsValidatingLeadCaseNumber(false);
                  consolidationStore.setFoundValidCaseNumber(true);
                  disableLeadCaseForm(false);
                });
              }
            })
            .catch((error) => {
              const message =
                'Cannot verify lead case is not part of another consolidation. ' + error.message;
              consolidationStore.setLeadCaseNumberError(message);
              consolidationStore.setIsValidatingLeadCaseNumber(false);
              disableLeadCaseForm(false);
              consolidationStore.setFoundValidCaseNumber(false);
            });
        })
        .catch((error) => {
          // Brittle way to determine if we have encountred a 404...
          const isNotFound = (error.message as string).startsWith('404');
          const message = isNotFound
            ? "We couldn't find a case with that number."
            : 'Cannot verify lead case number.';
          consolidationStore.setLeadCaseNumberError(message);
          consolidationStore.setIsValidatingLeadCaseNumber(false);
          disableLeadCaseForm(false);
          consolidationStore.setFoundValidCaseNumber(false);
        });
    }
  }, [consolidationStore.leadCaseNumber, consolidationStore.leadCaseCourt]);

  //========== FORM SUBMISION ==========

  function approveConsolidation(action: ConfirmActionResults) {
    if (
      action.status === 'approved' &&
      consolidationStore.leadCase &&
      consolidationStore.consolidationType
    ) {
      const data: ConsolidationOrderActionApproval = {
        ...consolidationStore.order,
        consolidationType: consolidationStore.consolidationType,
        approvedCases: consolidationStore.selectedCases
          .map((bCase) => bCase.caseId)
          .filter((caseId) =>
            consolidationStore.leadCase ? caseId !== consolidationStore.leadCase.caseId : false,
          ),
        leadCase: consolidationStore.leadCase,
      };

      consolidationStore.setIsProcessing(true);
      genericApi
        .put<ConsolidationOrder[]>('/consolidations/approve', data)
        .then((response) => {
          const newOrders = response.data;
          const approvedOrder = newOrders.find((o) => o.status === 'approved')!;
          consolidationStore.setIsProcessing(false);
          props.onOrderUpdate(
            {
              message: `Consolidation to lead case ${getCaseNumber(approvedOrder.leadCase?.caseId)} in ${
                approvedOrder.leadCase?.courtName
              } (${approvedOrder.leadCase?.courtDivisionName}) was successful.`,
              type: UswdsAlertStyle.Success,
              timeOut: 8,
            },
            newOrders,
            consolidationStore.order,
          );
        })
        .catch((_reason) => {
          consolidationStore.setIsProcessing(false);
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
        ...consolidationStore.order,
        rejectedCases: consolidationStore.selectedCases.map((bCase) => bCase.caseId),
        reason: action.rejectionReason,
      };

      consolidationStore.setIsProcessing(true);
      genericApi
        .put<ConsolidationOrder[]>('/consolidations/reject', data)
        .then((response) => {
          const newOrders = response.data;
          consolidationStore.setIsProcessing(false);
          props.onOrderUpdate(
            {
              message: `Rejection of consolidation order was successful.`,
              type: UswdsAlertStyle.Success,
              timeOut: 8,
            },
            newOrders,
            consolidationStore.order,
          );
        })
        .catch((_reason) => {
          consolidationStore.setIsProcessing(false);
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
      key={consolidationStore.order.id}
      id={`order-list-${consolidationStore.order.id}`}
      expandedId={expandedId}
      onExpand={handleOnExpand}
      onCollapse={handleClearInputs}
      hidden={hidden}
    >
      <section
        className="accordion-heading grid-row grid-gap-lg"
        data-testid={`accordion-heading-${consolidationStore.order.id}`}
      >
        <div
          className="grid-col-6 text-no-wrap"
          aria-label={`Court district ${consolidationStore.order.courtName}`}
        >
          {consolidationStore.order.courtName}
        </div>
        <div
          className="grid-col-2 text-no-wrap"
          title="Order Filed"
          aria-label={`Order Filed ${formatDate(consolidationStore.order.orderDate)}`}
        >
          {formatDate(consolidationStore.order.orderDate)}
        </div>
        <div className="grid-col-2 order-type text-no-wrap">
          <span
            className="event-type-label"
            aria-label={`Event type ${orderType.get(consolidationStore.order.orderType)}`}
          >
            {orderType.get(consolidationStore.order.orderType)}
          </span>
        </div>
        <div className="grid-col-2 order-status text-no-wrap">
          <span
            className={`${consolidationStore.order.status} event-status-label`}
            aria-label={`Event status ${statusType.get(consolidationStore.order.status)}`}
          >
            {statusType.get(consolidationStore.order.status)}
          </span>
        </div>
      </section>
      <>
        {consolidationStore.order.status === 'pending' && (
          <section
            className="accordion-content order-form"
            data-testid={`accordion-content-${consolidationStore.order.id}`}
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
                    id={`joint-admin-${consolidationStore.order.id}`}
                    name="consolidation-type"
                    label="Joint Administration"
                    value="administrative"
                    className="text-no-wrap"
                    onChange={handleSelectConsolidationType}
                    ref={jointAdministrationRef}
                  />
                  <Radio
                    id={`substantive-${consolidationStore.order.id}`}
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
                  id={`case-list-${consolidationStore.order.id}`}
                  data-testid={`${consolidationStore.order.id}-case-list`}
                  cases={consolidationStore.order.childCases}
                  onSelect={handleIncludeCase}
                  updateAllSelections={updateAllSelections}
                  isDataEnhanced={consolidationStore.isDataEnhanced}
                  ref={caseTableRef}
                  onMarkLead={handleMarkLeadCase}
                ></ConsolidationCaseTable>
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div
              className="lead-case-form grid-row grid-gap-lg"
              data-testid={`lead-case-form-${consolidationStore.order.id}`}
            >
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <Checkbox
                  id={`lead-case-form-checkbox-toggle-${consolidationStore.order.id}`}
                  className="lead-case-form-toggle"
                  onChange={handleToggleLeadCaseForm}
                  value=""
                  ref={toggleLeadCaseFormRef}
                  label="Lead Case Not Listed"
                ></Checkbox>
                {consolidationStore.showLeadCaseForm && (
                  <section
                    className={`lead-case-form-container lead-case-form-container-${consolidationStore.order.id}`}
                  >
                    <h3>Enter lead case details:</h3>
                    <div className="lead-case-court-container">
                      <CamsSelect
                        id={'lead-case-court'}
                        required={true}
                        options={getOfficeList(
                          consolidationStore.filteredOfficesList ?? props.officesList,
                        )}
                        onChange={handleSelectLeadCaseCourt}
                        ref={leadCaseDivisionRef}
                        label="Select a court"
                        value={getUniqueDivisionCodeOrUndefined(
                          consolidationStore.order.childCases,
                        )}
                        isSearchable={true}
                      />
                    </div>
                    <div className="lead-case-number-container">
                      <CaseNumberInput
                        id={`lead-case-input-${consolidationStore.order.id}`}
                        data-testid={`lead-case-input-${consolidationStore.order.id}`}
                        className="usa-input"
                        onChange={handleLeadCaseInputChange}
                        allowPartialCaseNumber={false}
                        required={true}
                        label="Enter a case number"
                        ref={leadCaseNumberRef}
                      />
                      {consolidationStore.leadCaseNumberError ? (
                        <Alert
                          id={`lead-case-number-alert-${consolidationStore.order.id}`}
                          message={consolidationStore.leadCaseNumberError}
                          type={UswdsAlertStyle.Error}
                          show={true}
                          slim={true}
                          inline={true}
                        ></Alert>
                      ) : (
                        <LoadingSpinner
                          id={`lead-case-number-loading-spinner-${consolidationStore.order.id}`}
                          caption="Verifying lead case number..."
                          height="40px"
                          hidden={!consolidationStore.isValidatingLeadCaseNumber}
                        />
                      )}
                      {consolidationStore.foundValidCaseNumber && consolidationStore.leadCase && (
                        <>
                          <h4>Selected Lead Case</h4>
                          <CaseTable
                            id={`valid-case-number-found-${consolidationStore.order.id}`}
                            cases={[consolidationStore.leadCase]}
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
                  id={`processing-consolidation-loading-spinner-${consolidationStore.order.id}`}
                  caption="Updating..."
                  height="40px"
                  hidden={!consolidationStore.isProcessing}
                />
                <Button
                  id={`accordion-cancel-button-${consolidationStore.order.id}`}
                  onClick={handleClearInputs}
                  uswdsStyle={UswdsButtonStyle.Unstyled}
                  className="unstyled-button"
                  ref={clearButtonRef}
                >
                  Clear
                </Button>
                <Button
                  id={`accordion-reject-button-${consolidationStore.order.id}`}
                  onClick={() =>
                    confirmationModalRef.current?.show({
                      status: 'rejected',
                      cases: consolidationStore.selectedCases,
                      leadCase: consolidationStore.leadCase,
                    })
                  }
                  uswdsStyle={UswdsButtonStyle.Outline}
                  className="margin-right-2"
                  ref={rejectButtonRef}
                >
                  Reject
                </Button>
                <Button
                  id={`accordion-approve-button-${consolidationStore.order.id}`}
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
              id={`confirmation-modal-${consolidationStore.order.id}`}
              onCancel={() => {}}
              onConfirm={handleConfirmAction}
            ></ConsolidationOrderModal>
          </section>
        )}
        {consolidationStore.order.status === 'approved' && (
          <section
            className="accordion-content order-form"
            data-testid={`accordion-content-${consolidationStore.order.id}`}
          >
            <div className="grid-row grid-gap-lg consolidation-text">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                Consolidated the following cases to lead case{' '}
                <CaseNumber
                  data-testid={'lead-case-number'}
                  caseId={consolidationStore.order.leadCase!.caseId}
                  renderAs="link"
                  openLinkIn="new-window"
                ></CaseNumber>{' '}
                {consolidationStore.order.leadCase?.caseTitle}.
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <CaseTable
                  id={`order-${consolidationStore.order.id}-child-cases`}
                  cases={consolidationStore.order.childCases}
                ></CaseTable>
              </div>
              <div className="grid-col-1"></div>
            </div>
          </section>
        )}
        {consolidationStore.order.status === 'rejected' && (
          <section
            className="accordion-content order-form"
            data-testid={`accordion-content-${consolidationStore.order.id}`}
          >
            <div className="grid-row grid-gap-lg consolidation-text">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                Rejected the consolidation of the cases below
                {consolidationStore.order.reason && consolidationStore.order.reason.length && (
                  <>
                    {' '}
                    for the following reason:
                    <blockquote>{consolidationStore.order.reason}</blockquote>
                  </>
                )}
                {!consolidationStore.order.reason && <>.</>}
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <ConsolidationCaseTable
                  id={`${consolidationStore.order.id}-case-list`}
                  data-testid={`${consolidationStore.order.id}-case-list`}
                  cases={consolidationStore.order.childCases}
                  isDataEnhanced={consolidationStore.isDataEnhanced}
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
