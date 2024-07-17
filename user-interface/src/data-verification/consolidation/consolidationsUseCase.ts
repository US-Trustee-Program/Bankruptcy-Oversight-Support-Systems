import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  ConsolidationOrderCase,
  ConsolidationType,
} from '@common/cams/orders';
import { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';
import { ConsolidationControls } from '@/data-verification/consolidation/consolidationControls';
import { getCurrentLeadCaseId } from './consolidationOrderAccordionUtils';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { useGenericApi } from '@/lib/hooks/UseApi';
import { CaseSummary } from '@common/cams/cases';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { CamsSelectOptionList, SearchableSelectOption } from '@/lib/components/CamsSelect';
import { ConfirmActionResults } from '../ConsolidationOrderModal';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { CaseAssignment } from '@common/cams/assignments';
import { Consolidation } from '@common/cams/events';
import { ResponseBodySuccess } from '@common/api/response';

type ChildCaseFacts = { isConsolidationChildCase: boolean; leadCase?: CaseSummary };
type PreviousLeadConsolidationFacts = {
  isAlreadyConsolidated: boolean;
  consolidationType?: ConsolidationType;
  childCase?: CaseSummary;
};
export type OnOrderUpdate = (
  alertDetails: AlertDetails,
  orders?: ConsolidationOrder[],
  deletedOrder?: ConsolidationOrder,
) => void;
export type OnExpand = (id: string) => void;

export interface ConsolidationsUseCase {
  updateSubmitButtonsState(): void;
  updateAllSelections(caseList: ConsolidationOrderCase[]): void;
  getValidLeadCase(): void; //Promise<void>;

  handleApproveButtonClick(): void;
  handleCaseAssociationResponse(
    response: ResponseBodySuccess<Consolidation[]>,
    currentLeadCaseId: string,
  ): Consolidation[];
  handleClearInputs(): void;
  handleConfirmAction(action: ConfirmActionResults): void;
  handleIncludeCase(bCase: ConsolidationOrderCase): void;
  handleLeadCaseInputChange(caseNumber?: string): void;
  handleMarkLeadCase(bCase: ConsolidationOrderCase): void;
  handleOnExpand(): Promise<void>;
  handleRejectButtonClick(): void;
  handleSelectConsolidationType(value: string): void;
  handleSelectLeadCaseCourt(option: CamsSelectOptionList): void;
  handleToggleLeadCaseForm(checked: boolean): void;
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
    store.setLeadCaseNumber('');
    store.setLeadCaseNumberError('');
    store.setFoundValidCaseNumber(false);
  }

  function clearSelectedCases(): void {
    store.setSelectedCases([]);
    controls.clearAllCheckBoxes();
  }

  function handleCaseAssociationResponse(
    response: ResponseBodySuccess<Consolidation[]>,
    currentLeadCaseId: string,
  ) {
    // TODO: implement the stubs at the bottom of the test file
    const associations = response.data;
    // if lead is a child of another case
    const childCaseFactsList = associations
      .filter((reference) => reference.caseId === currentLeadCaseId)
      .filter((reference) => reference.documentType === 'CONSOLIDATION_TO')
      .map((reference) => {
        return {
          isConsolidationChildCase: true,
          leadCase: reference.otherCase,
        } as ChildCaseFacts;
      });
    const childCaseFacts: ChildCaseFacts =
      childCaseFactsList.length === 1 ? childCaseFactsList[0] : { isConsolidationChildCase: false };

    const previousConsolidationFactsList = associations
      .filter((reference) => reference.caseId === currentLeadCaseId)
      .filter((reference) => reference.documentType === 'CONSOLIDATION_FROM')
      .map((reference) => {
        return {
          isAlreadyConsolidated: true,
          consolidationType: reference.consolidationType,
          childCase: reference.otherCase,
        } as PreviousLeadConsolidationFacts;
      });
    const previousConsolidationFacts: PreviousLeadConsolidationFacts =
      previousConsolidationFactsList.length > 0
        ? previousConsolidationFactsList[0]
        : { isAlreadyConsolidated: false };

    if (childCaseFacts.isConsolidationChildCase) {
      const message =
        `Case ${getCaseNumber(currentLeadCaseId)} is a consolidated ` +
        `child case of case ${getCaseNumber(childCaseFacts.leadCase!.caseId)}.`;
      store.setLeadCaseNumberError(message);
      store.setIsValidatingLeadCaseNumber(false);
      controls.disableLeadCaseForm(false);
      store.setFoundValidCaseNumber(false);
      throw new Error(message);
    } else if (
      previousConsolidationFacts.isAlreadyConsolidated &&
      previousConsolidationFacts.consolidationType !== store.consolidationType
    ) {
      const message = `This case is already part of a consolidation with the same consolidation type.`;
      store.setLeadCaseNumberError(message);
      store.setIsValidatingLeadCaseNumber(false);
      controls.disableLeadCaseForm(false);
      store.setFoundValidCaseNumber(false);
      throw new Error(message);
    } else {
      return response.data as Consolidation[];
    }
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
      const calls = [];
      calls.push(
        api2
          .getCaseSummary(currentLeadCaseId)
          .then((response) => {
            return response.data as CaseSummary;
          })
          .catch((error) => {
            // Brittle way to determine if we have encountered a 404...
            const isNotFound = (error.message as string).startsWith('404');
            const message = isNotFound
              ? "We couldn't find a case with that number."
              : 'Cannot verify lead case number.';
            throw new Error(message);
          }),
      );
      calls.push(
        api2
          .getCaseAssociations(currentLeadCaseId)
          .then((response) => handleCaseAssociationResponse(response, currentLeadCaseId))
          .catch((error) => {
            const message =
              'Cannot verify lead case is not part of another consolidation. ' + error.message;
            throw new Error(message);
          }),
      );
      calls.push(
        api2
          .getCaseAssignments(currentLeadCaseId)
          .then((response) => {
            return response.data as CaseAssignment[];
          })
          .catch((reason) => {
            const message = 'Cannot verify lead case assignments. ' + reason.message;
            throw new Error(message);
          }),
      );
      Promise.all(calls)
        .then((responses) => {
          const caseSummary = responses[0] as CaseSummary;
          const attorneyAssignments = responses[1] as CaseAssignment[];
          const associations = responses[2] as Consolidation[];
          store.setLeadCase({
            ...caseSummary,
            docketEntries: [],
            orderDate: store.order.orderDate,
            attorneyAssignments,
            associations,
          });
          store.setLeadCaseId(currentLeadCaseId);
          store.setIsValidatingLeadCaseNumber(false);
          store.setFoundValidCaseNumber(true);
          controls.disableLeadCaseForm(false);
        })
        .catch((reason) => {
          store.setLeadCaseNumberError(reason.message);
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
      const leadCaseId = store.leadCase.caseId;
      const data: ConsolidationOrderActionApproval = {
        ...store.order,
        consolidationType: store.consolidationType,
        approvedCases: store.selectedCases
          .map((bCase) => bCase.caseId)
          .filter((caseId) => caseId !== leadCaseId),
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
        areAnySelectedCasesConsolidated();

      controls.disableButton(controls.rejectButton, false);
      controls.disableButton(controls.approveButton, disableApprove);
    } else {
      controls.disableButton(controls.rejectButton, true);
      controls.disableButton(controls.approveButton, true);
    }
    controls.disableButton(controls.clearButton, store.isProcessing);
  }

  function areAnySelectedCasesConsolidated() {
    const consolidatedSelections = store.selectedCases.filter(
      (bCase) => bCase.associations!.length > 0,
    );
    return consolidatedSelections.length !== 0;
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
    handleToggleLeadCaseForm(false);
    controls.unsetConsolidationType();
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
      clearLeadCase();
      controls.disableButton(controls.approveButton, true);
    }
  }

  function handleMarkLeadCase(bCase: ConsolidationOrderCase) {
    store.setShowLeadCaseForm(false);
    store.setLeadCaseNumber('');
    store.setLeadCaseCourt('');

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
      let isDataEnhanced = true;
      for (const bCase of store.order.childCases) {
        try {
          const assignmentsResponse = await api2.getCaseAssignments(bCase.caseId);
          bCase.attorneyAssignments = assignmentsResponse.data;
        } finally {
          // The child case assignments are not critical to perform the consolidation. Catch any error
          // and don't set the attorney assignment for this specific case.
        }

        try {
          const associatedResponse = await api2.getCaseAssociations(bCase.caseId);
          bCase.associations = associatedResponse.data;
        } catch (reason) {
          isDataEnhanced = false;
        }
      }
      setOrderWithDataEnhancement(store.order);
      store.setIsDataEnhanced(isDataEnhanced);
    }
  }

  function handleSelectConsolidationType(value: string): void {
    store.setConsolidationType(value as ConsolidationType);
  }

  function handleSelectLeadCaseCourt(option: CamsSelectOptionList): void {
    store.setLeadCaseCourt((option as SearchableSelectOption)?.value || '');
  }

  function handleToggleLeadCaseForm(checked: boolean): void {
    clearLeadCase();
    store.setShowLeadCaseForm(checked);
  }

  return {
    getValidLeadCase,
    updateSubmitButtonsState,
    updateAllSelections,
    handleApproveButtonClick,
    handleCaseAssociationResponse,
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
