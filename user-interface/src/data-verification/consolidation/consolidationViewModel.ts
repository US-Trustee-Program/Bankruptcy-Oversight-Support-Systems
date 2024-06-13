import { ConsolidationOrder, ConsolidationOrderCase } from '@common/cams/orders';
import { CheckboxRef } from '@/lib/components/uswds/Checkbox';
import { OrderTableImperative } from '@/data-verification/ConsolidationCasesTable';
import { InputRef, RadioRef } from '@/lib/type-declarations/input-fields';
import { ButtonRef } from '@/lib/components/uswds/Button';
import {
  ConfirmActionResults,
  ConfirmationModalImperative,
} from '@/data-verification/ConsolidationOrderModal';
import React, { ChangeEvent } from 'react';
import { CamsSelectOptionList } from '@/lib/components/CamsSelect';

interface ConsolidationViewModel {
  order: ConsolidationOrder;
  expandedAccordionId: string;
  hidden: boolean;
  orderType: Map<string, string>;
  statusType: Map<string, string>;
  jointAdministrationRef: React.Ref<RadioRef>;
  substantiveRef: React.Ref<RadioRef>;
  isDataEnhanced: boolean;
  caseTableRef: React.Ref<OrderTableImperative>;
  toggleLeadCaseFormRef: React.Ref<CheckboxRef>;
  showLeadCaseForm: boolean;
  filteredOfficeRecords: Record<string, string>[];
  leadCaseDivisionRef: React.Ref<InputRef>;
  leadCaseNumberRef: React.Ref<InputRef>;
  leadCaseNumberError: string;
  isValidatingLeadCaseNumber: boolean;
  foundValidCaseNumber: boolean;
  leadCase: ConsolidationOrderCase;
  isProcessing: boolean;
  clearButtonRef: React.Ref<ButtonRef>;
  confirmationModalRef: React.Ref<ConfirmationModalImperative>;
  selectedCases: ConsolidationOrderCase[];
  rejectButtonRef: React.Ref<ButtonRef>;
  approveButtonRef: React.Ref<ButtonRef>;
  divisionCode: string | undefined;

  handleApproveButtonClick: () => void;
  handleClearInputs: () => void;
  handleConfirmAction: (action: ConfirmActionResults) => void;
  handleIncludeCase: (bCase: ConsolidationOrderCase) => void;
  handleLeadCaseInputChange: (caseNumber?: string) => void;
  handleMarkLeadCase: (bCase: ConsolidationOrderCase) => void;
  handleOnExpand: () => void;
  handleSelectConsolidationType: (value: string) => void;
  handleSelectLeadCaseCourt: (option: CamsSelectOptionList) => void;
  handleToggleLeadCaseForm: (ev: ChangeEvent<HTMLInputElement>) => void;
  showConfirmationModal: (
    selectedCases: ConsolidationOrderCase[],
    leadCase: ConsolidationOrderCase,
  ) => void;
  updateAllSelections: (caseList: ConsolidationOrderCase[]) => void;
}

export type { ConsolidationViewModel };
