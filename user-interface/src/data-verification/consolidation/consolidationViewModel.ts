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
import { ShowConfirmationModal } from '@/data-verification/consolidation/consolidationControls';
import { ComboOption, ComboOptionList } from '@/lib/components/combobox/ComboBox';

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
  leadCaseDivisionInput: React.RefObject<ComboBoxRef>;
  leadCaseNumberError: string;
  leadCaseNumberInput: React.Ref<InputRef>;
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
  updateAllSelections: (caseList: ConsolidationOrderCase[]) => void;
}

export type { ConsolidationViewModel };
