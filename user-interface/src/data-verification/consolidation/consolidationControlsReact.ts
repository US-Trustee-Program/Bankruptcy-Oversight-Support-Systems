import React, { useRef } from 'react';
import { ConsolidationControls } from '@/data-verification/consolidation/consolidationControls';
import { OrderTableImperative } from '@/data-verification/consolidation/ConsolidationCasesTable';
import { ButtonRef } from '@/lib/components/uswds/Button';
import { ConfirmationModalImperative } from '@/data-verification/consolidation/ConsolidationOrderModal';
import { InputRef, RadioRef } from '@/lib/type-declarations/input-fields';
import { CheckboxRef } from '@/lib/components/uswds/Checkbox';
import { ConsolidationOrderCase, ConsolidationType, OrderStatus } from '@common/cams/orders';

export function useConsolidationControlsReact(): ConsolidationControls {
  const approveButton = useRef<ButtonRef>(null);
  const caseTableActions = useRef<OrderTableImperative>(null);
  const clearButton = useRef<ButtonRef>(null);
  const confirmationModal = useRef<ConfirmationModalImperative>(null);
  const jointAdministrationRadio = useRef<RadioRef>(null);
  const leadCaseDivisionInput = useRef<InputRef>(null);
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
      status,
      cases: selectedCases,
      leadCase,
      consolidationType,
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
    clearButton,
    confirmationModal,
    jointAdministrationRadio,
    leadCaseDivisionInput,
    leadCaseNumberInput,
    rejectButton,
    substantiveRadio,
    leadCaseFormToggle,
    showConfirmationModal,
    disableLeadCaseForm,
    clearAllCheckBoxes,
    disableButton,
    unsetConsolidationType,
  };
}
