import React, { useRef } from 'react';
import { ConsolidationControls } from '@/data-verification/consolidation/consolidationControls';
import { OrderTableImperative } from '@/data-verification/ConsolidationCasesTable';
import { ButtonRef } from '@/lib/components/uswds/Button';
import { ConfirmationModalImperative } from '@/data-verification/ConsolidationOrderModal';
import { InputRef, RadioRef } from '@/lib/type-declarations/input-fields';
import { CheckboxRef } from '@/lib/components/uswds/Checkbox';
import { ConsolidationOrderCase, ConsolidationType, OrderStatus } from '@common/cams/orders';

export function useConsolidationControlsReact(): ConsolidationControls {
  const approveButton = useRef<ButtonRef>(null);
  const caseTableRef = useRef<OrderTableImperative>(null);
  const clearButton = useRef<ButtonRef>(null);
  const confirmationModalRef = useRef<ConfirmationModalImperative>(null);
  const jointAdministrationRef = useRef<RadioRef>(null);
  const leadCaseDivisionRef = useRef<InputRef>(null);
  const leadCaseNumberRef = useRef<InputRef>(null);
  const rejectButton = useRef<ButtonRef>(null);
  const substantiveRef = useRef<RadioRef>(null);
  const toggleLeadCaseFormRef = useRef<CheckboxRef>(null);

  const showConfirmationModal = (
    selectedCases: ConsolidationOrderCase[],
    leadCase: ConsolidationOrderCase,
    status: OrderStatus,
    consolidationType?: ConsolidationType,
  ) => {
    confirmationModalRef.current?.show({
      status,
      cases: selectedCases,
      leadCase,
      consolidationType,
    });
  };

  const clearLeadCase = () => {
    caseTableRef.current?.clearLeadCase();
    leadCaseNumberRef.current?.clearValue();
  };

  const disableLeadCaseForm = (disabled: boolean) => {
    leadCaseDivisionRef.current?.disable(disabled);
    leadCaseNumberRef.current?.disable(disabled);
  };
  const unsetConsolidationType = () => {
    jointAdministrationRef.current?.check(false);
    substantiveRef.current?.check(false);
  };

  const clearAllCheckBoxes = () => {
    caseTableRef.current?.clearAllCheckboxes();
  };

  const enableLeadCaseForm = (checked: boolean) => {
    toggleLeadCaseFormRef.current?.setChecked(checked);
  };

  const disableButton = (button: React.RefObject<ButtonRef>, state: boolean) => {
    button.current?.disableButton(state);
  };

  return {
    approveButton,
    caseTableRef,
    clearButton,
    confirmationModalRef,
    jointAdministrationRef,
    leadCaseDivisionRef,
    leadCaseNumberRef,
    rejectButton,
    substantiveRef,
    toggleLeadCaseFormRef,
    showConfirmationModal,
    clearLeadCase,
    disableLeadCaseForm,
    clearAllCheckBoxes,
    disableButton,
    unsetConsolidationType,
    enableLeadCaseForm,
  };
}
