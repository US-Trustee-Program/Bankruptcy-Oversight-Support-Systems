import { ConsolidationOrder, ConsolidationOrderCase } from '@common/cams/orders';
import { CheckboxRef } from '@/lib/components/uswds/Checkbox';
import { OrderTableImperative } from '@/data-verification/consolidation/ConsolidationCasesTable';
import { ComboBoxRef, InputRef, RadioRef } from '@/lib/type-declarations/input-fields';
import { ButtonRef } from '@/lib/components/uswds/Button';
import {
  ConfirmActionResults,
  ConfirmationModalImperative,
} from '@/data-verification/consolidation/ConsolidationOrderModal';
import React from 'react';
import {
  Ref,
  ShowAddCaseModal,
  ShowConfirmationModal,
} from '@/data-verification/consolidation/consolidationControls';
import { ComboOption, ComboOptionList } from '@/lib/components/combobox/ComboBox';
import { AddCaseModalImperative } from '@/data-verification/consolidation/AddCaseModal';
import { CaseSummary } from '@common/cams/cases';

interface ConsolidationViewModel {
  accordionFieldHeaders: string[];
  approveButton: React.Ref<ButtonRef>;
  caseTableActions: React.Ref<OrderTableImperative>;
  clearButton: React.Ref<ButtonRef>;
  confirmationModal: React.Ref<ConfirmationModalImperative>;
  divisionCode: string | undefined;
  expandedAccordionId: string;
  filteredOfficeRecords: ComboOption[] | null;
  formattedOrderFiledDate: string;
  foundValidCaseNumber: boolean;
  hidden: boolean;
  isDataEnhanced: boolean;
  isProcessing: boolean;
  isValidatingLeadCaseNumber: boolean;
  jointAdministrationRadio: React.Ref<RadioRef>;
  leadCase: ConsolidationOrderCase | null;
  leadCaseDivisionRef: React.RefObject<ComboBoxRef>;
  leadCaseNumberError: string;
  leadCaseNumberRef: React.Ref<InputRef>;
  order: ConsolidationOrder;
  orderType: Map<string, string>;
  rejectButton: React.Ref<ButtonRef>;
  selectedCases: ConsolidationOrderCase[];
  showLeadCaseForm: boolean;
  statusType: Map<string, string>;
  substantiveRadio: React.Ref<RadioRef>;
  leadCaseFormToggle: React.Ref<CheckboxRef>;

  handleApproveButtonClick: () => void;
  handleClearInputs: () => void;
  handleConfirmAction: (action: ConfirmActionResults) => void;
  handleIncludeCase: (bCase: ConsolidationOrderCase) => void;
  handleLeadCaseInputChange: (caseNumber?: string) => void;
  handleMarkLeadCase: (bCase: ConsolidationOrderCase) => void;
  handleOnExpand: () => void;
  handleRejectButtonClick: () => void;
  handleSelectConsolidationType: (value: string) => void;
  handleSelectLeadCaseCourt: (option: ComboOptionList) => void;
  handleToggleLeadCaseForm: (checked: boolean) => void;
  showConfirmationModal: ShowConfirmationModal;
  showAddCaseModal: ShowAddCaseModal;
  updateAllSelections: (caseList: ConsolidationOrderCase[]) => void;

  // TODO: Reorg this when we are nearing done.
  addCaseModal: React.Ref<AddCaseModalImperative>;
  handleAddCaseAction: () => void;
  additionalCaseDivisionRef: Ref<ComboBoxRef>;
  additionalCaseNumberRef: Ref<InputRef>;
  addCaseNumberError: string;
  isLookingForCase: boolean;
  caseToAdd: CaseSummary;
}

interface AddCaseModel
  extends Pick<
    ConsolidationViewModel,
    | 'handleSelectLeadCaseCourt'
    | 'handleLeadCaseInputChange'
    | 'filteredOfficeRecords'
    | 'additionalCaseDivisionRef'
    | 'additionalCaseNumberRef'
    | 'addCaseNumberError'
    | 'isLookingForCase'
    | 'caseToAdd'
    | 'handleAddCaseAction'
  > {
  orderId: string;
}

export type { ConsolidationViewModel, AddCaseModel };
