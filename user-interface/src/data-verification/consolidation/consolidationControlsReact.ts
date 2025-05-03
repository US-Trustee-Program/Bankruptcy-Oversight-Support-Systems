import { OrderTableImperative } from '@/data-verification/consolidation/ConsolidationCasesTable';
import { ConsolidationControls } from '@/data-verification/consolidation/consolidationControls';
import { ConfirmationModalImperative } from '@/data-verification/consolidation/ConsolidationOrderModal';
import { ButtonRef } from '@/lib/components/uswds/Button';
import { CheckboxRef } from '@/lib/components/uswds/Checkbox';
import { ComboBoxRef, InputRef, RadioRef } from '@/lib/type-declarations/input-fields';
import { ConsolidationOrderCase, ConsolidationType, OrderStatus } from '@common/cams/orders';
import React, { useRef } from 'react';

export function useConsolidationControlsReact(): ConsolidationControls {
  const approveButton = useRef<ButtonRef>(null);
  const caseTableActions = useRef<OrderTableImperative>(null);
  const clearButton = useRef<ButtonRef>(null);
  const confirmationModal = useRef<ConfirmationModalImperative>(null);
  const jointAdministrationRadio = useRef<RadioRef>(null);
  const leadCaseDivisionInput = useRef<ComboBoxRef>(null);
  const leadCaseNumberInput = useRef<InputRef>(null);
  const rejectButton = useRef<ButtonRef>(null);
  const substantiveRadio = useRef<RadioRef>(null);
  const leadCaseFormToggle = useRef<CheckboxRef>(null);

  const showConfirmationModal = (
    selectedCases: ConsolidationOrderCase[],
    leadCase: ConsolidationOrderCase,
    status: OrderStatus,
    consolidationType?: ConsolidationType,
  ) => {
    confirmationModal.current?.show({
      cases: selectedCases,
      consolidationType,
      leadCase,
      status,
    });
  };

  const disableLeadCaseForm = (disabled: boolean) => {
    leadCaseDivisionInput.current?.disable(disabled);
    leadCaseNumberInput.current?.disable(disabled);
  };
  const unsetConsolidationType = () => {
    jointAdministrationRadio.current?.check(false);
    substantiveRadio.current?.check(false);
  };

  const clearAllCheckBoxes = () => {
    caseTableActions.current?.clearAllCheckboxes();
  };

  const disableButton = (button: React.RefObject<ButtonRef>, state: boolean) => {
    button.current?.disableButton(state);
  };

  return {
    approveButton,
    caseTableActions,
    clearAllCheckBoxes,
    clearButton,
    confirmationModal,
    disableButton,
    disableLeadCaseForm,
    jointAdministrationRadio,
    leadCaseDivisionInput,
    leadCaseFormToggle,
    leadCaseNumberInput,
    rejectButton,
    showConfirmationModal,
    substantiveRadio,
    unsetConsolidationType,
  };
}
