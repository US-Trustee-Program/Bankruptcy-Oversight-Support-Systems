import { formatDate } from '@/lib/utils/datetime';
import { useEffect } from 'react';
import { ConsolidationOrder } from '@common/cams/orders';
import { CourtDivisionDetails } from '@common/cams/courts';
import './ConsolidationOrderAccordion.scss';
import { getDivisionComboOptions } from '@/data-verification/dataVerificationHelper';
import { getUniqueDivisionCodeOrUndefined } from '@/data-verification/consolidation/consolidationOrderAccordionUtils';
import type { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';
import { useConsolidationStoreReact } from '@/data-verification/consolidation/consolidationStoreReact';
import { ConsolidationControls } from '@/data-verification/consolidation/consolidationControls';
import { useConsolidationControlsReact } from '@/data-verification/consolidation/consolidationControlsReact';
import {
  OnOrderUpdate,
  consolidationUseCase,
} from '@/data-verification/consolidation/consolidationsUseCase';
import { ConsolidationOrderAccordionView } from '@/data-verification/consolidation/ConsolidationOrderAccordionView';
import { ConsolidationViewModel } from '@/data-verification/consolidation/consolidationViewModel';

export interface ConsolidationOrderAccordionProps {
  order: ConsolidationOrder;
  statusType: Map<string, string>;
  orderType: Map<string, string>;
  courts: Array<CourtDivisionDetails>;
  regionsMap: Map<string, string>;
  onOrderUpdate: OnOrderUpdate;
  onExpand?: (id: string) => void;
  expandedId?: string;
  fieldHeaders: string[];
  hidden?: boolean;
}

export function ConsolidationOrderAccordion(props: ConsolidationOrderAccordionProps) {
  const consolidationStore: ConsolidationStore = useConsolidationStoreReact(props, []);
  const consolidationControls: ConsolidationControls = useConsolidationControlsReact();
  const useCase = consolidationUseCase(
    consolidationStore,
    consolidationControls,
    props.onOrderUpdate,
    props.onExpand,
  );

  const { hidden, statusType, orderType, expandedId, fieldHeaders } = props;

  useEffect(() => {
    useCase.updateSubmitButtonsState();
  }, [
    consolidationStore.isProcessing,
    consolidationStore.selectedCases,
    consolidationStore.leadCaseId,
    consolidationStore.isDataEnhanced,
    consolidationStore.consolidationType,
  ]);

  const viewModel: ConsolidationViewModel = {
    caseToAddCaseNumber: consolidationStore.caseToAddCaseNumber,
    caseToAddCourt: consolidationStore.caseToAddCourt,
    accordionFieldHeaders: fieldHeaders,
    approveButton: consolidationControls.approveButton,
    caseTableActions: consolidationControls.caseTableActions,
    clearButton: consolidationControls.clearButton,
    confirmationModal: consolidationControls.confirmationModal,
    divisionCode: getUniqueDivisionCodeOrUndefined(consolidationStore.order.memberCases),
    expandedAccordionId: expandedId!,
    filteredOfficeRecords: getDivisionComboOptions(
      consolidationStore.filteredOfficesList ?? props.courts,
    ),
    formattedOrderFiledDate: formatDate(consolidationStore.order.orderDate),
    foundValidCaseNumber: consolidationStore.foundValidCaseNumber,
    hidden: hidden ?? false,
    isDataEnhanced: consolidationStore.isDataEnhanced,
    isProcessing: consolidationStore.isProcessing,
    isValidatingLeadCaseNumber: consolidationStore.isValidatingLeadCaseNumber,
    jointAdministrationRadio: consolidationControls.jointAdministrationRadio,
    leadCase: consolidationStore.leadCase,
    order: consolidationStore.order,
    orderType: orderType, // TODO: why is orderType a Map<string, string>?
    rejectButton: consolidationControls.rejectButton,
    selectedCases: consolidationStore.selectedCases,
    showLeadCaseForm: consolidationStore.showLeadCaseForm,
    statusType: statusType, // TODO: why is statusType a Map<string, string>?
    substantiveRadio: consolidationControls.substantiveRadio,
    leadCaseFormToggle: consolidationControls.leadCaseFormToggle,

    handleApproveButtonClick: useCase.handleApproveButtonClick,
    handleClearInputs: useCase.handleClearInputs,
    handleConfirmAction: useCase.handleConfirmAction,
    handleIncludeCase: useCase.handleIncludeCase,
    handleMarkLeadCase: useCase.handleMarkLeadCase,
    handleOnExpand: useCase.handleOnExpand,
    handleRejectButtonClick: useCase.handleRejectButtonClick,
    handleSelectConsolidationType: useCase.handleSelectConsolidationType,
    handleSelectLeadCaseCourt: useCase.handleSelectLeadCaseCourt,
    showConfirmationModal: consolidationControls.showConfirmationModal,
    updateAllSelections: useCase.updateAllSelections,

    handleAddCaseReset: useCase.handleAddCaseReset,
    handleAddCaseNumberInputChange: useCase.handleAddCaseNumberInputChange,
    handleAddCaseCourtSelectChange: useCase.handleAddCaseCourtSelectChange,
    addCaseModal: consolidationControls.addCaseModal,
    handleAddCaseAction: useCase.handleAddCaseAction,
    additionalCaseDivisionRef: consolidationControls.additionalCaseDivisionRef,
    additionalCaseNumberRef: consolidationControls.additionalCaseNumberRef,
    addCaseNumberError: consolidationStore.addCaseNumberError,
    isLookingForCase: consolidationStore.isLookingForCase,
    caseToAdd: consolidationStore.caseToAdd,
    verifyCaseCanBeAdded: useCase.verifyCaseCanBeAdded,
  };

  return <ConsolidationOrderAccordionView viewModel={viewModel}></ConsolidationOrderAccordionView>;
}
