import { OrderTableImperative } from '@/data-verification/ConsolidationCasesTable';
import { ButtonRef } from '@/lib/components/uswds/Button';
import { ConfirmationModalImperative } from '@/data-verification/ConsolidationOrderModal';
import { InputRef, RadioRef } from '@/lib/type-declarations/input-fields';
import { CheckboxRef } from '@/lib/components/uswds/Checkbox';
import { ConsolidationOrderCase, ConsolidationType, OrderStatus } from '@common/cams/orders';

export type ShowConfirmationModal = (
  selectedCases: ConsolidationOrderCase[],
  leadCase: ConsolidationOrderCase,
  status: OrderStatus,
  consolidationType?: ConsolidationType,
) => void;

export type Ref<T> = {
  current: T | null;
};

interface ConsolidationControls {
  approveButton: Ref<ButtonRef>;
  caseTableRef: Ref<OrderTableImperative>;
  clearButton: Ref<ButtonRef>;
  confirmationModalRef: Ref<ConfirmationModalImperative>;
  jointAdministrationRef: Ref<RadioRef>;
  leadCaseDivisionRef: Ref<InputRef>;
  leadCaseNumberRef: Ref<InputRef>;
  rejectButton: Ref<ButtonRef>;
  substantiveRef: Ref<RadioRef>;
  toggleLeadCaseFormRef: Ref<CheckboxRef>;

  showConfirmationModal: ShowConfirmationModal;
  clearLeadCase: () => void;
  disableLeadCaseForm: (disabled: boolean) => void;
  clearAllCheckBoxes: () => void;
  disableButton: (button: Ref<ButtonRef>, state: boolean) => void;
  unsetConsolidationType: () => void;
  enableLeadCaseForm: (checked: boolean) => void;
}

export type { ConsolidationControls };
