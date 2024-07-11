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
import { ShowConfirmationModal } from '@/data-verification/consolidation/consolidationControls';

interface ConsolidationViewModel {
  approveButtonRef: React.Ref<ButtonRef>;
  caseTableRef: React.Ref<OrderTableImperative>;
  clearButtonRef: React.Ref<ButtonRef>;
  confirmationModalRef: React.Ref<ConfirmationModalImperative>;
  divisionCode: string | undefined;
  expandedAccordionId: string;
  filteredOfficeRecords: Record<string, string>[] | null;
  formattedOrderFiledDate: string;
  foundValidCaseNumber: boolean;
  hidden: boolean;
  isDataEnhanced: boolean;
  isProcessing: boolean;
  isValidatingLeadCaseNumber: boolean;
  jointAdministrationRef: React.Ref<RadioRef>;
  leadCase: ConsolidationOrderCase | null;
  leadCaseDivisionRef: React.Ref<InputRef>;
  leadCaseNumberError: string;
  leadCaseNumberRef: React.Ref<InputRef>;
  order: ConsolidationOrder;
  orderType: Map<string, string>;
  rejectButtonRef: React.Ref<ButtonRef>;
  selectedCases: ConsolidationOrderCase[];
  showLeadCaseForm: boolean;
  statusType: Map<string, string>;
  substantiveRef: React.Ref<RadioRef>;
  toggleLeadCaseFormRef: React.Ref<CheckboxRef>;

  handleApproveButtonClick: () => void;
  handleClearInputs: () => void;
  handleConfirmAction: (action: ConfirmActionResults) => void;
  handleIncludeCase: (bCase: ConsolidationOrderCase) => void;
  handleLeadCaseInputChange: (caseNumber?: string) => void;
  handleMarkLeadCase: (bCase: ConsolidationOrderCase) => void;
  handleOnExpand: () => void;
  handleRejectButtonClick: () => void;
  handleSelectConsolidationType: (value: string) => void;
  handleSelectLeadCaseCourt: (option: CamsSelectOptionList) => void;
  handleToggleLeadCaseForm: (ev: ChangeEvent<HTMLInputElement>) => void;
  showConfirmationModal: ShowConfirmationModal;
  updateAllSelections: (caseList: ConsolidationOrderCase[]) => void;
}

export type { ConsolidationViewModel };
