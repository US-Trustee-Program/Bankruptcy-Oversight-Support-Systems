/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ConsolidationControls,
  Ref,
} from '@/data-verification/consolidation/consolidationControls';
import { ShowOptionParams } from '@/data-verification/ConsolidationOrderModal';
import { CheckboxState } from '@/lib/components/uswds/Checkbox';
import { ConsolidationOrderCase, ConsolidationType, OrderStatus } from '@common/cams/orders';
import { ButtonRef } from '@/lib/components/uswds/Button';

export function useConsolidationControlsMock(): ConsolidationControls {
  const approveButton = {
    current: {
      disableButton: () => {},
    },
  };
  const caseTableRef = {
    current: {
      clearAllCheckboxes: () => {},
      selectAllCheckboxes: () => {},
      clearLeadCase: () => {},
    },
  };
  const clearButton = {
    current: {
      disableButton: () => {},
    },
  };
  const confirmationModalRef = {
    current: {
      show: (options: ShowOptionParams) => {},
      hide: () => {},
    },
  };
  const jointAdministrationRef = {
    current: {
      disable: (value: boolean) => {},
      check: (value: boolean) => {},
      isChecked: () => true,
    },
  };
  const leadCaseDivisionRef = {
    current: {
      setValue: (value: string) => {},
      disable: (value: boolean) => {},
      clearValue: () => {},
      resetValue: () => {},
      getValue: () => '',
    },
  };
  const leadCaseNumberRef = {
    current: {
      setValue: (value: string) => {},
      disable: (value: boolean) => {},
      clearValue: () => {},
      resetValue: () => {},
      getValue: () => '',
    },
  };
  const rejectButton = {
    current: {
      disableButton: () => {},
    },
  };
  const substantiveRef = {
    current: {
      disable: (value: boolean) => {},
      check: (value: boolean) => {},
      isChecked: () => true,
    },
  };
  const toggleLeadCaseFormRef = {
    current: {
      setChecked: (value: boolean | CheckboxState) => {},
      getLabel: () => {
        return '';
      },
    },
  };

  const showConfirmationModal = (
    selectedCases: ConsolidationOrderCase[],
    leadCase: ConsolidationOrderCase,
    status: OrderStatus,
    consolidationType?: ConsolidationType,
  ) => {};
  const clearLeadCase = () => {};
  const disableLeadCaseForm = (disabled: boolean) => {};
  const clearAllCheckBoxes = () => {};
  const disableButton = (button: Ref<ButtonRef>, state: boolean) => {};
  const unsetConsolidationType = () => {};
  const enableLeadCaseForm = (checked: boolean) => {};

  return {
    approveButton,
    caseTableActions: caseTableRef,
    clearButton,
    confirmationModal: confirmationModalRef,
    jointAdministrationRadio: jointAdministrationRef,
    leadCaseDivisionInput: leadCaseDivisionRef,
    leadCaseNumberInput: leadCaseNumberRef,
    rejectButton,
    substantiveRadio: substantiveRef,
    leadCaseFormToggle: toggleLeadCaseFormRef,
    showConfirmationModal,
    clearLeadCase,
    disableLeadCaseForm,
    clearAllCheckBoxes,
    disableButton,
    unsetConsolidationType,
    enableLeadCaseForm,
  };
}
