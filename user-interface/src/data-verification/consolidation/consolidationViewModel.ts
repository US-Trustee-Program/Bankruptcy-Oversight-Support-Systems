import { OrderTableImperative } from '@/data-verification/consolidation/ConsolidationCasesTable';
import { ShowConfirmationModal } from '@/data-verification/consolidation/consolidationControls';
import {
  ConfirmActionResults,
  ConfirmationModalImperative,
} from '@/data-verification/consolidation/ConsolidationOrderModal';
import { ComboOption, ComboOptionList } from '@/lib/components/combobox/ComboBox';
import { ButtonRef } from '@/lib/components/uswds/Button';
import { CheckboxRef } from '@/lib/components/uswds/Checkbox';
import { ComboBoxRef, InputRef, RadioRef } from '@/lib/type-declarations/input-fields';
import { ConsolidationOrder, ConsolidationOrderCase } from '@common/cams/orders';
import React from 'react';

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
  hidden: boolean;
  isDataEnhanced: boolean;
  isProcessing: boolean;
  isValidatingLeadCaseNumber: boolean;
  jointAdministrationRadio: React.Ref<RadioRef>;
  leadCase: ConsolidationOrderCase | null;

  leadCaseDivisionInput: React.RefObject<ComboBoxRef>;
  leadCaseFormToggle: React.Ref<CheckboxRef>;
  leadCaseNumberError: string;
  leadCaseNumberInput: React.Ref<InputRef>;
  order: ConsolidationOrder;
  orderType: Map<string, string>;
  rejectButton: React.Ref<ButtonRef>;
  selectedCases: ConsolidationOrderCase[];
  showConfirmationModal: ShowConfirmationModal;
  showLeadCaseForm: boolean;
  statusType: Map<string, string>;
  substantiveRadio: React.Ref<RadioRef>;
  updateAllSelections: (caseList: ConsolidationOrderCase[]) => void;
}

export type { ConsolidationViewModel };
