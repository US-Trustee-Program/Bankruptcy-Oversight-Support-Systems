import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  ConsolidationOrderCase,
  ConsolidationType,
} from '@common/cams/orders';
import { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';
import { ConsolidationControls } from '@/data-verification/consolidation/consolidationControls';
import { getCaseId } from './consolidationOrderAccordionUtils';
import Api2 from '@/lib/models/api2';
import { CaseSummary } from '@common/cams/cases';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { ConfirmActionResults } from './ConsolidationOrderModal';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { CaseAssignment } from '@common/cams/assignments';
import { Consolidation } from '@common/cams/events';
import { ResponseBody } from '@common/api/response';
import { ComboOption, ComboOptionList } from '@/lib/components/combobox/ComboBox';
import { sanitizeText } from '@/lib/utils/sanitize-text';
import { delay } from '@common/delay';

type MemberCaseFacts = { isConsolidationMemberCase: boolean; leadCase?: CaseSummary };

export type OnOrderUpdate = (
  alertDetails: AlertDetails,
  orders?: ConsolidationOrder[],
  deletedOrder?: ConsolidationOrder,
) => void;
type OnExpand = (id: string) => void;

export interface ConsolidationsUseCase {
  updateSubmitButtonsState(): void;
  updateAllSelections(caseList: ConsolidationOrderCase[]): void;
  verifyCaseCanBeAdded(): void;

  handleAddCaseAction(): void;
  handleAddCaseReset(): void;
  handleApproveButtonClick(): void;
  handleCaseAssociationResponse(
    response: ResponseBody<Consolidation[]>,
    currentLeadCaseId: string,
  ): Consolidation[];
  handleClearInputs(): void;
  handleConfirmAction(action: ConfirmActionResults): void;
  handleIncludeCase(bCase: ConsolidationOrderCase): void;
  handleMarkLeadCase(bCase: ConsolidationOrderCase): void;
  handleOnExpand(): Promise<void>;
  handleRejectButtonClick(): void;
  handleSelectConsolidationType(value: string): void;
  handleSelectLeadCaseCourt(option: ComboOptionList): void;
  handleAddCaseNumberInputChange(caseNumber?: string): void;
  handleAddCaseCourtSelectChange(option: ComboOptionList): void;
}

function isLeadCase(caseId: string, associations: Consolidation[]): boolean {
  return associations.some((a) => a.documentType === 'CONSOLIDATION_FROM' && a.caseId === caseId);
}

function isMemberCase(caseId: string, associations: Consolidation[]): boolean {
  return associations.some((a) => a.documentType === 'CONSOLIDATION_TO' && a.caseId === caseId);
}

const consolidationUseCase = (
  store: ConsolidationStore,
  controls: ConsolidationControls,
  onOrderUpdate: OnOrderUpdate,
  onExpand?: OnExpand,
): ConsolidationsUseCase => {
  const clearLeadCase = (): void => {
    store.setLeadCase(null);
    store.setLeadCaseId('');
    store.setLeadCaseNumber('');
    store.setLeadCaseNumberError('');
    store.setFoundValidCaseNumber(false);
  };

  const clearSelectedCases = (): void => {
    store.setSelectedCases([]);
    controls.clearAllCheckBoxes();
  };

  const handleAddCaseAction = () => {
    if (store.caseToAdd) {
      store.order.memberCases.push(store.caseToAdd);
      if (store.caseToAdd.isLeadCase) {
        handleMarkLeadCase(store.caseToAdd);
      }
    }
    handleAddCaseReset();
  };

  const handleCaseAssociationResponse = (
    response: ResponseBody<Consolidation[]>,
    currentLeadCaseId: string,
  ) => {
    const associations = response.data;
    const memberCaseFactsList = associations
      .filter((reference) => reference.caseId === currentLeadCaseId)
      .filter((reference) => reference.documentType === 'CONSOLIDATION_TO')
      .map((reference) => {
        return {
          isConsolidationMemberCase: true,
          leadCase: reference.otherCase,
        } as MemberCaseFacts;
      });
    const memberCaseFacts: MemberCaseFacts =
      memberCaseFactsList.length === 1
        ? memberCaseFactsList[0]
        : { isConsolidationMemberCase: false };

    if (memberCaseFacts.isConsolidationMemberCase) {
      const message =
        `Case ${getCaseNumber(currentLeadCaseId)} is a consolidated ` +
        `member case of case ${getCaseNumber(memberCaseFacts.leadCase!.caseId)}.`;
      store.setLeadCaseNumberError(message);
      store.setIsValidatingLeadCaseNumber(false);
      store.setFoundValidCaseNumber(false);
      throw new Error(message);
    } else {
      return response.data as Consolidation[];
    }
  };

  const verifyCaseCanBeAdded = () => {
    const caseIdToVerify = getCaseId({
      court: store.caseToAddCourt,
      caseNumber: store.caseToAddCaseNumber,
    });
    const currentInput = document.activeElement;
    if (caseIdToVerify && caseIdToVerify.length === 12) {
      controls.additionalCaseDivisionRef.current?.disable(true);
      controls.additionalCaseNumberRef.current?.disable(true);
      store.setIsLookingForCase(true);
      store.setAddCaseNumberError('');
      store.setCaseToAdd(null);
      const caseExists = !!store.order.memberCases.find((bCase) => bCase.caseId === caseIdToVerify);
      if (caseExists) {
        store.setAddCaseNumberError('This case is already included in the consolidation.');
        store.setIsLookingForCase(false);
        controls.additionalCaseDivisionRef.current?.disable(false);
        controls.additionalCaseNumberRef.current?.disable(false);
        return;
      }

      const calls = [];
      calls.push(
        Api2.getCaseSummary(caseIdToVerify)
          .then((response) => {
            return response.data as CaseSummary;
          })
          .catch((error) => {
            const isNotFound = (error.message as string).startsWith('404');
            const message = isNotFound
              ? "We couldn't find a case with that number."
              : 'Cannot verify case number.';
            throw new Error(message);
          }),
      );
      calls.push(
        Api2.getCaseAssociations(caseIdToVerify)
          .then((response) => handleCaseAssociationResponse(response, caseIdToVerify))
          .catch((error) => {
            throw new Error(error.message);
          }),
      );
      calls.push(
        Api2.getCaseAssignments(caseIdToVerify)
          .then((response) => {
            return response.data as CaseAssignment[];
          })
          .catch((reason) => {
            const message = 'Cannot verify case assignments. ' + reason.message;
            throw new Error(message);
          }),
      );
      Promise.all(calls)
        .then((responses) => {
          const caseSummary = responses[0] as CaseSummary;
          const associations = responses[1] as Consolidation[];
          const attorneyAssignments = responses[2] as CaseAssignment[];

          store.setCaseToAdd({
            ...caseSummary,
            docketEntries: [],
            orderDate: store.order.orderDate,
            attorneyAssignments,
            associations,
            isLeadCase: isLeadCase(caseSummary.caseId, associations),
            isMemberCase: isMemberCase(caseSummary.caseId, associations),
          });
          store.setIsLookingForCase(false);
          store.setFoundValidCaseNumber(true);
        })
        .catch((reason) => {
          store.setAddCaseNumberError(reason.message);
          store.setIsLookingForCase(false);
          store.setFoundValidCaseNumber(false);
        })
        .finally(() => {
          controls.additionalCaseDivisionRef.current?.disable(false);
          controls.additionalCaseNumberRef.current?.disable(false);
          delay(100, () => {
            (currentInput as HTMLElement).focus();
          });
        });
    }
  };

  const approveConsolidation = (action: ConfirmActionResults) => {
    const genericErrorMessage =
      'An unknown error has occurred and has been logged.  Please try again later.';

    if (action.status === 'approved' && store.leadCase && store.consolidationType) {
      const leadCaseId = store.leadCase.caseId;
      const data: ConsolidationOrderActionApproval = {
        consolidationId: store.order.consolidationId,
        consolidationType: store.consolidationType,
        approvedCases: store.selectedCases
          .map((bCase) => bCase.caseId)
          .filter((caseId) => caseId !== leadCaseId),
        leadCase: store.leadCase,
      };

      store.setIsProcessing(true);
      Api2.putConsolidationOrderApproval(data)
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
  };

  const rejectConsolidation = (action: ConfirmActionResults) => {
    const genericErrorMessage =
      'An unknown error has occurred and has been logged.  Please try again later.';
    if (action.status === 'rejected') {
      const data: ConsolidationOrderActionRejection = {
        consolidationId: store.order.consolidationId,
        rejectedCases: store.selectedCases.map((bCase) => bCase.caseId),
        reason: sanitizeText(action.rejectionReason ?? ''),
      };

      store.setIsProcessing(true);
      Api2.putConsolidationOrderRejection(data)
        .then((response) => {
          if (response?.data) {
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
          }
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
  };

  const updateSubmitButtonsState = () => {
    if (store.selectedCases.length) {
      const alreadyConsolidatedLeadCase = store.selectedCases.find((bCase) => bCase.isLeadCase);

      let disableApprove;
      if (alreadyConsolidatedLeadCase && store.leadCaseId !== alreadyConsolidatedLeadCase.caseId) {
        disableApprove = true;
      } else {
        disableApprove =
          store.selectedCases.length === 1 && store.leadCaseId === store.selectedCases[0].caseId;
        disableApprove =
          disableApprove ||
          !store.isDataEnhanced ||
          store.leadCaseId === '' ||
          store.consolidationType === null ||
          areAnySelectedCasesConsolidated();
      }

      controls.disableButton(controls.rejectButton, false);
      controls.disableButton(controls.approveButton, disableApprove);
    } else {
      controls.disableButton(controls.rejectButton, true);
      controls.disableButton(controls.approveButton, true);
    }
    controls.disableButton(controls.clearButton, store.isProcessing);
  };

  const areAnySelectedCasesConsolidated = () => {
    return store.selectedCases.some((bCase) => bCase.isMemberCase);
  };

  const setOrderWithDataEnhancement = (order: ConsolidationOrder) => {
    store.setOrder({ ...order });
  };

  const updateAllSelections = (caseList: ConsolidationOrderCase[]) => {
    store.setSelectedCases(caseList);
  };

  const handleApproveButtonClick = () => {
    controls.showConfirmationModal(
      store.selectedCases!,
      store.leadCase!,
      'approved',
      store.consolidationType!,
    );
  };

  const handleRejectButtonClick = () => {
    controls.showConfirmationModal(store.selectedCases, store.leadCase!, 'rejected');
  };

  const handleClearInputs = (): void => {
    clearLeadCase();
    clearSelectedCases();
    controls.unsetConsolidationType();
  };

  const handleAddCaseReset = (): void => {
    store.setCaseToAddCaseNumber('');
    store.setCaseToAddCourt('');
    controls.additionalCaseDivisionRef.current?.clearSelections();
    controls.additionalCaseNumberRef.current?.clearValue();
    store.setAddCaseNumberError(null);
    store.setCaseToAdd(null);
  };

  const handleConfirmAction = (action: ConfirmActionResults): void => {
    switch (action.status) {
      case 'approved':
        approveConsolidation(action);
        break;
      case 'rejected':
        rejectConsolidation(action);
        break;
    }
  };

  const handleIncludeCase = (bCase: ConsolidationOrderCase) => {
    let tempSelectedCases: ConsolidationOrderCase[];
    if (store.selectedCases.includes(bCase)) {
      tempSelectedCases = store.selectedCases.filter((aCase) => bCase !== aCase);
    } else {
      tempSelectedCases = [...store.selectedCases, bCase];
    }
    store.setSelectedCases(tempSelectedCases);
    updateSubmitButtonsState();
  };

  const handleAddCaseNumberInputChange = async (caseNumber?: string) => {
    if (caseNumber) {
      store.setCaseToAddCaseNumber(caseNumber);
    } else {
      store.setCaseToAddCaseNumber('');
      store.setCaseToAdd(null);
    }
  };

  const handleAddCaseCourtSelectChange = (option: ComboOption[]): void => {
    const court = option[0]?.value ?? '';
    if (court) {
      store.setCaseToAddCourt(court);
    } else {
      store.setCaseToAddCourt('');
      store.setCaseToAdd(null);
    }
  };

  const handleMarkLeadCase = (bCase: ConsolidationOrderCase) => {
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
  };

  const handleOnExpand = async () => {
    if (onExpand) {
      onExpand(`order-list-${store.order.id}`);
    }
    if (!store.isDataEnhanced) {
      let isDataEnhanced = true;
      const assignmentCalls = [];
      const associationCalls = [];
      for (const bCase of store.order.memberCases) {
        assignmentCalls.push(
          Api2.getCaseAssignments(bCase.caseId)
            .then((response) => {
              bCase.attorneyAssignments = response.data;
            })
            .catch(() => {
              // The member case assignments are not critical to perform the consolidation. Catch any error
              // and don't set the attorney assignment for this specific case.
            }),
        );
        associationCalls.push(
          Api2.getCaseAssociations(bCase.caseId)
            .then((response) => {
              bCase.associations = response.data;
              bCase.isLeadCase = isLeadCase(bCase.caseId, bCase.associations);
              bCase.isMemberCase = isMemberCase(bCase.caseId, bCase.associations);
            })
            .catch(() => {
              isDataEnhanced = false;
            }),
        );
      }

      await Promise.allSettled([...assignmentCalls, ...associationCalls]);
      setOrderWithDataEnhancement(store.order);
      store.setIsDataEnhanced(isDataEnhanced);
    }
  };

  const handleSelectConsolidationType = (value: string): void => {
    store.setConsolidationType(value as ConsolidationType);
  };

  const handleSelectLeadCaseCourt = (option: ComboOption[]): void => {
    const court = option[0]?.value ?? '';
    store.setLeadCaseCourt(court);
  };

  return {
    verifyCaseCanBeAdded,
    updateSubmitButtonsState,
    updateAllSelections,
    handleAddCaseAction,
    handleAddCaseReset,
    handleApproveButtonClick,
    handleCaseAssociationResponse,
    handleClearInputs,
    handleConfirmAction,
    handleIncludeCase,
    handleMarkLeadCase,
    handleOnExpand,
    handleRejectButtonClick,
    handleSelectConsolidationType,
    handleSelectLeadCaseCourt,
    handleAddCaseCourtSelectChange,
    handleAddCaseNumberInputChange,
  };
};

export { consolidationUseCase };
