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
  ShowConfirmationModal,
} from '@/data-verification/consolidation/consolidationControls';
import { ComboOption, ComboOptionList } from '@/lib/components/combobox/ComboBox';
import { AddCaseModalImperative } from '@/data-verification/consolidation/AddCaseModal';

interface ConsolidationViewModel {
  // Non-function properties
  accordionFieldHeaders: string[];
  addCaseModal: React.RefObject<AddCaseModalImperative | null>;
  addCaseNumberError: string | null;
  caseToAddCaseNumber: string | null;
  caseToAddCourt: string | null;
  additionalCaseDivisionRef: Ref<ComboBoxRef>;
  additionalCaseNumberRef: Ref<InputRef>;
  approveButton: React.Ref<ButtonRef>;
  caseTableActions: React.Ref<OrderTableImperative>;
  caseToAdd: ConsolidationOrderCase | null;
  clearButton: React.Ref<ButtonRef>;
  confirmationModal: React.Ref<ConfirmationModalImperative>;
  divisionCode: string | undefined;
  expandedAccordionId: string;
  filteredOfficeRecords: ComboOption[] | null;
  formattedOrderFiledDate: string;
  foundValidCaseNumber: boolean;
  hidden: boolean;
  isDataEnhanced: boolean;
  isLookingForCase: boolean;
  isProcessing: boolean;
  isValidatingLeadCaseNumber: boolean;
  jointAdministrationRadio: React.Ref<RadioRef>;
  leadCase: ConsolidationOrderCase | null;
  leadCaseFormToggle: React.Ref<CheckboxRef>;
  order: ConsolidationOrder;
  orderType: Map<string, string>;
  rejectButton: React.Ref<ButtonRef>;
  selectedCases: ConsolidationOrderCase[];
  showLeadCaseForm: boolean;
  statusType: Map<string, string>;
  substantiveRadio: React.Ref<RadioRef>;

  // Function properties
  handleAddCaseAction: () => void;
  handleAddCaseCourtSelectChange: (option: ComboOptionList) => void;
  handleAddCaseNumberInputChange: (caseNumber?: string) => void;
  handleAddCaseReset: () => void;
  handleApproveButtonClick: () => void;
  handleClearInputs: () => void;
  handleConfirmAction: (action: ConfirmActionResults) => void;
  handleIncludeCase: (bCase: ConsolidationOrderCase) => void;
  handleMarkLeadCase: (bCase: ConsolidationOrderCase) => void;
  handleOnExpand: () => void;
  handleRejectButtonClick: () => void;
  handleSelectConsolidationType: (value: string) => void;
  handleSelectLeadCaseCourt: (option: ComboOptionList) => void;
  showConfirmationModal: ShowConfirmationModal;
  updateAllSelections: (caseList: ConsolidationOrderCase[]) => void;
  verifyCaseCanBeAdded: () => void;
}

interface AddCaseModel extends Pick<
  ConsolidationViewModel,
  | 'caseToAddCaseNumber'
  | 'caseToAddCourt'
  | 'handleAddCaseCourtSelectChange'
  | 'handleAddCaseNumberInputChange'
  | 'handleAddCaseReset'
  | 'filteredOfficeRecords'
  | 'additionalCaseDivisionRef'
  | 'additionalCaseNumberRef'
  | 'addCaseNumberError'
  | 'isLookingForCase'
  | 'caseToAdd'
  | 'handleAddCaseAction'
  | 'verifyCaseCanBeAdded'
> {
  orderId: string;
  defaultDivisionCode: string;
}

export type { ConsolidationViewModel, AddCaseModel };
