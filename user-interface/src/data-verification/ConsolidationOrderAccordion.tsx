import { formatDate } from '@/lib/utils/datetime';
import React, { ChangeEvent, useEffect } from 'react';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  ConsolidationOrderCase,
  ConsolidationType,
} from '@common/cams/orders';
import { OfficeDetails } from '@common/cams/courts';
import { ConfirmActionResults } from '@/data-verification/ConsolidationOrderModal';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import './ConsolidationOrderAccordion.scss';
import { useGenericApi } from '@/lib/hooks/UseApi';
import { CamsSelectOptionList, SearchableSelectOption } from '@/lib/components/CamsSelect';
import { getOfficeList } from '@/data-verification/dataVerificationHelper';
import { CaseSummary } from '@common/cams/cases';
import { useApi2 } from '@/lib/hooks/UseApi2';
import {
  getCurrentLeadCaseId,
  getUniqueDivisionCodeOrUndefined,
} from '@/data-verification/consolidation/consolidationOrderAccordion';
import type { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';
import { useConsolidationStoreReact } from '@/data-verification/consolidation/consolidationStoreReact';
import { ConsolidationControls } from '@/data-verification/consolidation/consolidationControls';
import { useConsolidationControlsReact } from '@/data-verification/consolidation/consolidationControlsReact';
import { consolidationUseCase } from '@/data-verification/consolidation/consolidationsUseCase';
import { ConsolidationOrderAccordionView } from '@/data-verification/consolidation/ConsolidationOrderAccordionView';
import { ConsolidationViewModel } from '@/data-verification/consolidation/consolidationViewModel';

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
  const consolidationStore: ConsolidationStore = useConsolidationStoreReact(props, []);
  // TODO: remove this explicit use of useConsolidationControlsImpl
  const consolidationControls: ConsolidationControls = useConsolidationControlsReact();
  const useCase = consolidationUseCase(consolidationStore, consolidationControls);

  const { hidden, statusType, orderType, expandedId } = props;

  const genericApi = useGenericApi();
  const api2 = useApi2();

  //========== HANDLERS ==========
  // TODO: move more stuff into the use case
  function handleApproveButtonClick() {
    consolidationControls.confirmationModalRef.current?.show({
      status: 'approved',
      cases: consolidationStore.selectedCases,
      leadCase: consolidationStore.leadCase,
      consolidationType: consolidationStore.consolidationType,
    });
  }

  function handleClearInputs(): void {
    useCase.clearLeadCase();
    useCase.clearSelectedCases();
    consolidationStore.setLeadCaseNumber('');
    consolidationStore.setLeadCaseNumberError('');
    consolidationStore.setFoundValidCaseNumber(false);
    consolidationStore.setShowLeadCaseForm(false);
    consolidationControls.jointAdministrationRef.current?.check(false);
    consolidationControls.substantiveRef.current?.check(false);
    consolidationControls.toggleLeadCaseFormRef.current?.setChecked(false);
    useCase.updateSubmitButtonsState();
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
    useCase.updateSubmitButtonsState();
  }

  async function handleLeadCaseInputChange(caseNumber?: string) {
    if (caseNumber) {
      consolidationStore.setLeadCaseNumber(caseNumber);
    } else {
      consolidationStore.setLeadCaseNumber('');
      consolidationStore.setFoundValidCaseNumber(false);
      consolidationStore.setLeadCase(null);
      consolidationStore.setLeadCaseNumberError('');
      consolidationControls.approveButtonRef.current?.disableButton(true);
    }
  }

  function handleMarkLeadCase(bCase: ConsolidationOrderCase) {
    consolidationControls.toggleLeadCaseFormRef.current?.setChecked(false);
    consolidationControls.leadCaseNumberRef.current?.clearValue();
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
      useCase.setOrderWithDataEnhancement(consolidationStore.order);
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
    useCase.clearLeadCase();
    consolidationStore.setShowLeadCaseForm(ev.target.checked);
  }

  //========== USE EFFECTS ==========

  useEffect(() => {
    useCase.updateSubmitButtonsState();
    if (consolidationStore.isProcessing) {
      consolidationControls.clearButtonRef.current?.disableButton(true);
    } else {
      consolidationControls.clearButtonRef.current?.disableButton(false);
    }
  }, [consolidationStore.isProcessing]);

  useEffect(() => {
    useCase.updateSubmitButtonsState();
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
      useCase.disableLeadCaseForm(true);
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
                useCase.disableLeadCaseForm(false);
                consolidationStore.setFoundValidCaseNumber(false);
              } else if (previousConsolidationFacts.isAlreadyConsolidated) {
                const message = `This case is already part of a consolidation.`;
                consolidationStore.setLeadCaseNumberError(message);
                consolidationStore.setIsValidatingLeadCaseNumber(false);
                useCase.disableLeadCaseForm(false);
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
                  useCase.disableLeadCaseForm(false);
                });
              }
            })
            .catch((error) => {
              const message =
                'Cannot verify lead case is not part of another consolidation. ' + error.message;
              consolidationStore.setLeadCaseNumberError(message);
              consolidationStore.setIsValidatingLeadCaseNumber(false);
              useCase.disableLeadCaseForm(false);
              consolidationStore.setFoundValidCaseNumber(false);
            });
        })
        .catch((error) => {
          // Brittle way to determine if we have encountered a 404...
          const isNotFound = (error.message as string).startsWith('404');
          const message = isNotFound
            ? "We couldn't find a case with that number."
            : 'Cannot verify lead case number.';
          consolidationStore.setLeadCaseNumberError(message);
          consolidationStore.setIsValidatingLeadCaseNumber(false);
          useCase.disableLeadCaseForm(false);
          consolidationStore.setFoundValidCaseNumber(false);
        });
    }
  }, [consolidationStore.leadCaseNumber, consolidationStore.leadCaseCourt]);

  //========== FORM SUBMISSION ==========

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

  const viewModel: ConsolidationViewModel = {
    approveButtonRef: consolidationControls.approveButtonRef,
    caseTableRef: consolidationControls.caseTableRef,
    clearButtonRef: consolidationControls.clearButtonRef,
    confirmationModalRef: consolidationControls.confirmationModalRef,
    divisionCode: getUniqueDivisionCodeOrUndefined(consolidationStore.order.childCases),
    expandedAccordionId: expandedId!,
    filteredOfficeRecords: getOfficeList(
      consolidationStore.filteredOfficesList ?? props.officesList,
    ),
    formattedOrderFiledDate: formatDate(consolidationStore.order.orderDate),
    foundValidCaseNumber: consolidationStore.foundValidCaseNumber,
    hidden: hidden ?? false,
    isDataEnhanced: consolidationStore.isDataEnhanced,
    isProcessing: consolidationStore.isProcessing,
    isValidatingLeadCaseNumber: consolidationStore.isValidatingLeadCaseNumber,
    jointAdministrationRef: consolidationControls.jointAdministrationRef,
    leadCase: consolidationStore.leadCase,
    leadCaseDivisionRef: consolidationControls.leadCaseDivisionRef,
    leadCaseNumberError: consolidationStore.leadCaseNumberError,
    leadCaseNumberRef: consolidationControls.leadCaseNumberRef,
    order: consolidationStore.order,
    orderType: orderType, // TODO: why is orderType a Map<string, string>?
    rejectButtonRef: consolidationControls.rejectButtonRef,
    selectedCases: consolidationStore.selectedCases,
    showLeadCaseForm: consolidationStore.showLeadCaseForm,
    statusType: statusType, // TODO: why is statusType a Map<string, string>?
    substantiveRef: consolidationControls.substantiveRef,
    toggleLeadCaseFormRef: consolidationControls.toggleLeadCaseFormRef,

    handleApproveButtonClick: handleApproveButtonClick,
    handleClearInputs: handleClearInputs,
    handleConfirmAction: handleConfirmAction,
    handleIncludeCase: handleIncludeCase,
    handleLeadCaseInputChange: handleLeadCaseInputChange,
    handleMarkLeadCase: handleMarkLeadCase,
    handleOnExpand: handleOnExpand,
    handleSelectConsolidationType: handleSelectConsolidationType,
    handleSelectLeadCaseCourt: handleSelectLeadCaseCourt,
    handleToggleLeadCaseForm: handleToggleLeadCaseForm,
    showConfirmationModal: consolidationControls.showConfirmationModal,
    updateAllSelections: useCase.updateAllSelections,
  };

  return <ConsolidationOrderAccordionView viewModel={viewModel}></ConsolidationOrderAccordionView>;
}
