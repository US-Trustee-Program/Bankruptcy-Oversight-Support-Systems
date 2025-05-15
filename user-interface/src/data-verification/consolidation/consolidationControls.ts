import { OrderTableImperative } from '@/data-verification/consolidation/ConsolidationCasesTable';
import { ButtonRef } from '@/lib/components/uswds/Button';
import { ConfirmationModalImperative } from '@/data-verification/consolidation/ConsolidationOrderModal';
import { ComboBoxRef, InputRef, RadioRef } from '@/lib/type-declarations/input-fields';
import { CheckboxRef } from '@/lib/components/uswds/Checkbox';
import { ConsolidationOrderCase, ConsolidationType, OrderStatus } from '@common/cams/orders';
import { AddCaseModalImperative } from '@/data-verification/consolidation/AddCaseModal';

export type ShowConfirmationModal = (
  selectedCases: ConsolidationOrderCase[],
  leadCase: ConsolidationOrderCase,
  status: OrderStatus,
  consolidationType?: ConsolidationType,
) => void;

export type ShowAddCaseModal = (defaultOffice: string) => void;

export type Ref<T> = {
  current: T | null;
};

interface ConsolidationControls {
  approveButton: Ref<ButtonRef>;
  caseTableActions: Ref<OrderTableImperative>;
  clearButton: Ref<ButtonRef>;
  confirmationModal: Ref<ConfirmationModalImperative>;
  addCaseModal: Ref<AddCaseModalImperative>;
  jointAdministrationRadio: Ref<RadioRef>;
  leadCaseDivisionRef: Ref<ComboBoxRef>;
  leadCaseNumberRef: Ref<InputRef>;
  rejectButton: Ref<ButtonRef>;
  substantiveRadio: Ref<RadioRef>;
  leadCaseFormToggle: Ref<CheckboxRef>;
  additionalCaseDivisionRef: Ref<ComboBoxRef>;
  additionalCaseNumberRef: Ref<InputRef>;

  showConfirmationModal: ShowConfirmationModal;
  showAddCaseModal: ShowAddCaseModal;
  disableLeadCaseForm: (disabled: boolean) => void;
  clearAllCheckBoxes: () => void;
  disableButton: (button: Ref<ButtonRef>, state: boolean) => void;
  unsetConsolidationType: () => void;
}

export type { ConsolidationControls };
