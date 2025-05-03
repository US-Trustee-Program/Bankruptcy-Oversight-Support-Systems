import { OrderTableImperative } from '@/data-verification/consolidation/ConsolidationCasesTable';
import { ConfirmationModalImperative } from '@/data-verification/consolidation/ConsolidationOrderModal';
import { ButtonRef } from '@/lib/components/uswds/Button';
import { CheckboxRef } from '@/lib/components/uswds/Checkbox';
import { ComboBoxRef, InputRef, RadioRef } from '@/lib/type-declarations/input-fields';
import { ConsolidationOrderCase, ConsolidationType, OrderStatus } from '@common/cams/orders';

export type Ref<T> = {
  current: null | T;
};

export type ShowConfirmationModal = (
  selectedCases: ConsolidationOrderCase[],
  leadCase: ConsolidationOrderCase,
  status: OrderStatus,
  consolidationType?: ConsolidationType,
) => void;

interface ConsolidationControls {
  approveButton: Ref<ButtonRef>;
  caseTableActions: Ref<OrderTableImperative>;
  clearAllCheckBoxes: () => void;
  clearButton: Ref<ButtonRef>;
  confirmationModal: Ref<ConfirmationModalImperative>;
  disableButton: (button: Ref<ButtonRef>, state: boolean) => void;
  disableLeadCaseForm: (disabled: boolean) => void;
  jointAdministrationRadio: Ref<RadioRef>;
  leadCaseDivisionInput: Ref<ComboBoxRef>;
  leadCaseFormToggle: Ref<CheckboxRef>;

  leadCaseNumberInput: Ref<InputRef>;
  rejectButton: Ref<ButtonRef>;
  showConfirmationModal: ShowConfirmationModal;
  substantiveRadio: Ref<RadioRef>;
  unsetConsolidationType: () => void;
}

export type { ConsolidationControls };
