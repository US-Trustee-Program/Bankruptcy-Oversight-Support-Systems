import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  ConsolidationOrderCase,
  ConsolidationType,
} from '@common/cams/orders';
import { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';
import { ConsolidationControls } from '@/data-verification/consolidation/consolidationControls';
import { getCurrentLeadCaseId } from './consolidationOrderAccordion';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { useGenericApi } from '@/lib/hooks/UseApi';
import { CaseSummary } from '@common/cams/cases';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { CamsSelectOptionList, SearchableSelectOption } from '@/lib/components/CamsSelect';
import { ChangeEvent } from 'react';
import { ConfirmActionResults } from '../ConsolidationOrderModal';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';

// TODO: we may only need one of these.
type ChildCaseFacts = { isConsolidationChildCase: boolean; leadCase?: CaseSummary };
type PreviousConsolidationFacts = { isAlreadyConsolidated: boolean; childCase?: CaseSummary };
export type OnOrderUpdate = (
  alertDetails: AlertDetails,
  orders?: ConsolidationOrder[],
  deletedOrder?: ConsolidationOrder,
) => void;
export type OnExpand = (id: string) => void;

export interface ConsolidationsUseCase {
  // clearLeadCase(): void;
  // clearSelectedCases(): void;
  updateSubmitButtonsState(): void;
  // selectedCasesAreConsolidationCases(): void;
  // setOrderWithDataEnhancement(order: ConsolidationOrder): void;
  updateAllSelections(caseList: ConsolidationOrderCase[]): void;
  getValidLeadCase(): void;

  handleApproveButtonClick(): void;
  handleClearInputs(): void;
  handleConfirmAction(action: ConfirmActionResults): void;
  handleIncludeCase(bCase: ConsolidationOrderCase): void;
  handleLeadCaseInputChange(): void;
  handleMarkLeadCase(bCase: ConsolidationOrderCase): void;
  handleOnExpand(): void;
  handleRejectButtonClick(): void;
  handleSelectConsolidationType(value: string): void;
  handleSelectLeadCaseCourt(option: CamsSelectOptionList): void;
  handleToggleLeadCaseForm(ev: ChangeEvent<HTMLInputElement>): void;
}

const consolidationUseCase = (
  store: ConsolidationStore,
  controls: ConsolidationControls,
  onOrderUpdate: OnOrderUpdate,
  onExpand?: OnExpand,
): ConsolidationsUseCase => {
  function clearLeadCase(): void {
    store.setLeadCase(null);
    store.setLeadCaseId('');
    store.setLeadCaseCourt('');
    controls.clearLeadCase();
  }

  function clearSelectedCases(): void {
    store.setSelectedCases([]);
    controls.clearAllCheckBoxes();
  }

  function getValidLeadCase() {
    const api2 = useApi2();
    const currentLeadCaseId = getCurrentLeadCaseId({
      leadCaseCourt: store.leadCaseCourt,
      leadCaseNumber: store.leadCaseNumber,
    });
    if (currentLeadCaseId && currentLeadCaseId.length === 12) {
      controls.disableLeadCaseForm(true);
      store.setIsValidatingLeadCaseNumber(true);
      store.setLeadCaseNumberError('');
      store.setLeadCaseId('');
      api2
        .getCaseSummary(currentLeadCaseId)
        .then((response) => {
          const caseSummary = response.data;
          api2
            .getCaseAssociations(caseSummary.caseId)
            .then((response) => {
              const associations = response.data;
              const childCaseFactsList = associations
                .filter((reference) => reference.caseId === caseSummary.caseId)
                .filter((reference) => reference.documentType === 'CONSOLIDATION_TO')
                .map((reference) => {
                  return {
                    isConsolidationChildCase: true,
                    leadCase: reference.otherCase,
                  } as ChildCaseFacts;
                });
              if (childCaseFactsList.length > 1) {
                throw new Error();
              }
              const childCaseFacts: ChildCaseFacts =
                childCaseFactsList.length === 1
                  ? childCaseFactsList[0]
                  : { isConsolidationChildCase: false };

              const previousConsolidationFactsList = associations
                .filter((reference) => reference.caseId === caseSummary.caseId)
                .filter((reference) => reference.documentType === 'CONSOLIDATION_FROM')
                .map((reference) => {
                  return {
                    isAlreadyConsolidated: true,
                    childCase: reference.otherCase,
                  } as PreviousConsolidationFacts;
                });
              const previousConsolidationFacts: PreviousConsolidationFacts =
                previousConsolidationFactsList.length > 0
                  ? previousConsolidationFactsList[0]
                  : { isAlreadyConsolidated: false };

              if (childCaseFacts.isConsolidationChildCase) {
                const message =
                  `Case ${getCaseNumber(caseSummary.caseId)} is a consolidated ` +
                  `child case of case ${getCaseNumber(childCaseFacts.leadCase!.caseId)}.`;
                store.setLeadCaseNumberError(message);
                store.setIsValidatingLeadCaseNumber(false);
                controls.disableLeadCaseForm(false);
                store.setFoundValidCaseNumber(false);
              } else if (previousConsolidationFacts.isAlreadyConsolidated) {
                const message = `This case is already part of a consolidation.`;
                store.setLeadCaseNumberError(message);
                store.setIsValidatingLeadCaseNumber(false);
                controls.disableLeadCaseForm(false);
                store.setFoundValidCaseNumber(false);
              } else {
                api2.getCaseAssignments(currentLeadCaseId).then((response) => {
                  const attorneys = response.data;
                  store.setLeadCase({
                    ...caseSummary,
                    docketEntries: [],
                    orderDate: store.order.orderDate,
                    attorneyAssignments: attorneys,
                    associations,
                  });
                  store.setLeadCaseId(currentLeadCaseId);
                  store.setIsValidatingLeadCaseNumber(false);
                  store.setFoundValidCaseNumber(true);
                  controls.disableLeadCaseForm(false);
                });
              }
            })
            .catch((error) => {
              const message =
                'Cannot verify lead case is not part of another consolidation. ' + error.message;
              store.setLeadCaseNumberError(message);
              store.setIsValidatingLeadCaseNumber(false);
              controls.disableLeadCaseForm(false);
              store.setFoundValidCaseNumber(false);
            });
        })
        .catch((error) => {
          // Brittle way to determine if we have encountered a 404...
          const isNotFound = (error.message as string).startsWith('404');
          const message = isNotFound
            ? "We couldn't find a case with that number."
            : 'Cannot verify lead case number.';
          store.setLeadCaseNumberError(message);
          store.setIsValidatingLeadCaseNumber(false);
          controls.disableLeadCaseForm(false);
          store.setFoundValidCaseNumber(false);
        });
    }
  }
  function approveConsolidation(action: ConfirmActionResults) {
    const genericApi = useGenericApi();
    const genericErrorMessage =
      'An unknown error has occurred and has been logged.  Please try again later.';

    if (action.status === 'approved' && store.leadCase && store.consolidationType) {
      const data: ConsolidationOrderActionApproval = {
        ...store.order,
        consolidationType: store.consolidationType,
        approvedCases: store.selectedCases
          .map((bCase) => bCase.caseId)
          .filter((caseId) => (store.leadCase ? caseId !== store.leadCase.caseId : false)),
        leadCase: store.leadCase,
      };

      store.setIsProcessing(true);
      genericApi
        .put<ConsolidationOrder[]>('/consolidations/approve', data)
        .then((response) => {
          const newOrders = response.data;
          const approvedOrder = newOrders.find((o) => o.status === 'approved')!;
          store.setIsProcessing(false);
          onOrderUpdate(
            {
              message: `Consolidation to lead case ${getCaseNumber(approvedOrder.leadCase?.caseId)} in ${
                approvedOrder.leadCase?.courtName
              } (${approvedOrder.leadCase?.courtDivisionName}) was successful.`,
              type: UswdsAlertStyle.Success,
              timeOut: 8,
            },
            newOrders,
            store.order,
          );
        })
        .catch((_reason) => {
          store.setIsProcessing(false);
          onOrderUpdate({
            message: genericErrorMessage,
            type: UswdsAlertStyle.Error,
            timeOut: 8,
          });
        });
    }
  }

  function rejectConsolidation(action: ConfirmActionResults) {
    const genericApi = useGenericApi();
    const genericErrorMessage =
      'An unknown error has occurred and has been logged.  Please try again later.';
    if (action.status === 'rejected') {
      const data: ConsolidationOrderActionRejection = {
        ...store.order,
        rejectedCases: store.selectedCases.map((bCase) => bCase.caseId),
        reason: action.rejectionReason ?? '',
      };

      store.setIsProcessing(true);
      genericApi
        .put<ConsolidationOrder[]>('/consolidations/reject', data)
        .then((response) => {
          const newOrders = response.data;
          store.setIsProcessing(false);
          onOrderUpdate(
            {
              message: `Rejection of consolidation order was successful.`,
              type: UswdsAlertStyle.Success,
              timeOut: 8,
            },
            newOrders,
            store.order,
          );
        })
        .catch((_reason) => {
          store.setIsProcessing(false);
          onOrderUpdate({
            message: genericErrorMessage,
            type: UswdsAlertStyle.Error,
            timeOut: 8,
          });
        });
    }
  }
  function updateSubmitButtonsState() {
    if (store.selectedCases.length) {
      const disableApprove =
        !store.isDataEnhanced ||
        store.leadCaseId === '' ||
        store.consolidationType === null ||
        selectedCasesAreConsolidationCases();

      controls.disableButton(controls.rejectButton, false);
      controls.disableButton(controls.approveButton, disableApprove);
    } else {
      controls.disableButton(controls.rejectButton, true);
      controls.disableButton(controls.approveButton, true);
    }
    controls.disableButton(controls.clearButton, store.isProcessing);
  }

  function selectedCasesAreConsolidationCases() {
    return store.order.childCases.reduce((itDoes, bCase) => {
      if (!store.selectedCases.includes(bCase)) {
        return itDoes;
      }
      return itDoes || !!bCase.associations?.length;
    }, false);
  }

  function setOrderWithDataEnhancement(order: ConsolidationOrder) {
    store.setOrder({ ...order });
  }

  function updateAllSelections(caseList: ConsolidationOrderCase[]) {
    store.setSelectedCases(caseList);
  }

  //========== HANDLERS ==========
  function handleApproveButtonClick() {
    controls.showConfirmationModal(
      store.selectedCases!,
      store.leadCase!,
      'approved',
      store.consolidationType!,
    );
  }

  function handleRejectButtonClick() {
    controls.showConfirmationModal(store.selectedCases, store.leadCase!, 'rejected');
  }

  function handleClearInputs(): void {
    clearLeadCase();
    clearSelectedCases();
    store.setLeadCaseNumber('');
    store.setLeadCaseNumberError('');
    store.setFoundValidCaseNumber(false);
    store.setShowLeadCaseForm(false);
    controls.unsetConsolidationType();
    controls.enableLeadCaseForm(false);
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
    if (store.selectedCases.includes(bCase)) {
      tempSelectedCases = store.selectedCases.filter((aCase) => bCase !== aCase);
    } else {
      tempSelectedCases = [...store.selectedCases, bCase];
    }
    store.setSelectedCases(tempSelectedCases);
    updateSubmitButtonsState();
  }

  async function handleLeadCaseInputChange(caseNumber?: string) {
    if (caseNumber) {
      store.setLeadCaseNumber(caseNumber);
    } else {
      store.setLeadCaseNumber('');
      store.setFoundValidCaseNumber(false);
      store.setLeadCase(null);
      store.setLeadCaseNumberError('');
      controls.disableButton(controls.approveButton, true);
    }
  }

  function handleMarkLeadCase(bCase: ConsolidationOrderCase) {
    controls.enableLeadCaseForm(false);
    store.setShowLeadCaseForm(false);
    store.setFoundValidCaseNumber(false);

    if (store.leadCaseId === bCase.caseId) {
      store.setLeadCaseId('');
      store.setLeadCase(null);
    } else {
      store.setLeadCaseId(bCase.caseId);
      store.setLeadCase(bCase);
    }
  }

  async function handleOnExpand() {
    const api2 = useApi2();
    if (onExpand) {
      onExpand(`order-list-${store.order.id}`);
    }
    if (!store.isDataEnhanced) {
      for (const bCase of store.order.childCases) {
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
      setOrderWithDataEnhancement(store.order);
      store.setIsDataEnhanced(true);
    }
  }

  function handleSelectConsolidationType(value: string): void {
    store.setConsolidationType(value as ConsolidationType);
  }

  function handleSelectLeadCaseCourt(option: CamsSelectOptionList): void {
    store.setLeadCaseCourt((option as SearchableSelectOption)?.value || '');
  }

  function handleToggleLeadCaseForm(ev: ChangeEvent<HTMLInputElement>): void {
    clearLeadCase();
    store.setShowLeadCaseForm(ev.target.checked);
  }

  return {
    // clearLeadCase,
    // clearSelectedCases,
    getValidLeadCase,
    updateSubmitButtonsState,
    // selectedCasesAreConsolidationCases,
    // setOrderWithDataEnhancement,
    updateAllSelections,
    handleApproveButtonClick,
    handleClearInputs,
    handleConfirmAction,
    handleIncludeCase,
    handleLeadCaseInputChange,
    handleMarkLeadCase,
    handleOnExpand,
    handleRejectButtonClick,
    handleSelectConsolidationType,
    handleSelectLeadCaseCourt,
    handleToggleLeadCaseForm,
  };
};

export { consolidationUseCase };
