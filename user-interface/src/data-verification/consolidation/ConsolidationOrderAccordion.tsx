import type { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';

import { ConsolidationControls } from '@/data-verification/consolidation/consolidationControls';
import { useConsolidationControlsReact } from '@/data-verification/consolidation/consolidationControlsReact';
import { getUniqueDivisionCodeOrUndefined } from '@/data-verification/consolidation/consolidationOrderAccordionUtils';

import './ConsolidationOrderAccordion.scss';

import { ConsolidationOrderAccordionView } from '@/data-verification/consolidation/ConsolidationOrderAccordionView';
import { useConsolidationStoreReact } from '@/data-verification/consolidation/consolidationStoreReact';
import {
  consolidationUseCase,
  OnOrderUpdate,
} from '@/data-verification/consolidation/consolidationsUseCase';
import { ConsolidationViewModel } from '@/data-verification/consolidation/consolidationViewModel';
import { getDivisionComboOptions } from '@/data-verification/dataVerificationHelper';
import { formatDate } from '@/lib/utils/datetime';
import { CourtDivisionDetails } from '@common/cams/courts';
import { ConsolidationOrder } from '@common/cams/orders';
import { useEffect } from 'react';

export interface ConsolidationOrderAccordionProps {
  courts: Array<CourtDivisionDetails>;
  expandedId?: string;
  fieldHeaders: string[];
  hidden?: boolean;
  onExpand?: (id: string) => void;
  onOrderUpdate: OnOrderUpdate;
  order: ConsolidationOrder;
  orderType: Map<string, string>;
  regionsMap: Map<string, string>;
  statusType: Map<string, string>;
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

  const { expandedId, fieldHeaders, hidden, orderType, statusType } = props;

  useEffect(() => {
    useCase.updateSubmitButtonsState();
  }, [
    consolidationStore.isProcessing,
    consolidationStore.selectedCases,
    consolidationStore.leadCaseId,
    consolidationStore.isDataEnhanced,
    consolidationStore.consolidationType,
  ]);

  useEffect(() => {
    useCase.getValidLeadCase();
  }, [consolidationStore.leadCaseNumber, consolidationStore.leadCaseCourt]);

  const viewModel: ConsolidationViewModel = {
    accordionFieldHeaders: fieldHeaders,
    approveButton: consolidationControls.approveButton,
    caseTableActions: consolidationControls.caseTableActions,
    clearButton: consolidationControls.clearButton,
    confirmationModal: consolidationControls.confirmationModal,
    divisionCode: getUniqueDivisionCodeOrUndefined(consolidationStore.order.childCases),
    expandedAccordionId: expandedId!,
    filteredOfficeRecords: getDivisionComboOptions(
      consolidationStore.filteredOfficesList ?? props.courts,
    ),
    formattedOrderFiledDate: formatDate(consolidationStore.order.orderDate),
    foundValidCaseNumber: consolidationStore.foundValidCaseNumber,
    handleApproveButtonClick: useCase.handleApproveButtonClick,
    handleClearInputs: useCase.handleClearInputs,
    handleConfirmAction: useCase.handleConfirmAction,
    handleIncludeCase: useCase.handleIncludeCase,
    handleLeadCaseInputChange: useCase.handleLeadCaseInputChange,
    handleMarkLeadCase: useCase.handleMarkLeadCase,
    handleOnExpand: useCase.handleOnExpand,
    handleRejectButtonClick: useCase.handleRejectButtonClick,
    handleSelectConsolidationType: useCase.handleSelectConsolidationType,
    handleSelectLeadCaseCourt: useCase.handleSelectLeadCaseCourt,
    handleToggleLeadCaseForm: useCase.handleToggleLeadCaseForm,
    hidden: hidden ?? false,
    isDataEnhanced: consolidationStore.isDataEnhanced,
    isProcessing: consolidationStore.isProcessing,
    isValidatingLeadCaseNumber: consolidationStore.isValidatingLeadCaseNumber,
    jointAdministrationRadio: consolidationControls.jointAdministrationRadio,
    leadCase: consolidationStore.leadCase,

    leadCaseDivisionInput: consolidationControls.leadCaseDivisionInput,
    leadCaseFormToggle: consolidationControls.leadCaseFormToggle,
    leadCaseNumberError: consolidationStore.leadCaseNumberError,
    leadCaseNumberInput: consolidationControls.leadCaseNumberInput,
    order: consolidationStore.order,
    orderType: orderType, // TODO: why is orderType a Map<string, string>?
    rejectButton: consolidationControls.rejectButton,
    selectedCases: consolidationStore.selectedCases,
    showConfirmationModal: consolidationControls.showConfirmationModal,
    showLeadCaseForm: consolidationStore.showLeadCaseForm,
    statusType: statusType, // TODO: why is statusType a Map<string, string>?
    substantiveRadio: consolidationControls.substantiveRadio,
    updateAllSelections: useCase.updateAllSelections,
  };

  return <ConsolidationOrderAccordionView viewModel={viewModel}></ConsolidationOrderAccordionView>;
}
