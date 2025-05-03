/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ConsolidationControls,
  Ref,
} from '@/data-verification/consolidation/consolidationControls';
import { ShowOptionParams } from '@/data-verification/consolidation/ConsolidationOrderModal';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ButtonRef } from '@/lib/components/uswds/Button';
import { CheckboxState } from '@/lib/components/uswds/Checkbox';
import { ConsolidationOrderCase, ConsolidationType, OrderStatus } from '@common/cams/orders';

export function useConsolidationControlsMock(): ConsolidationControls {
  const approveButton = {
    current: {
      disableButton: () => {},
    },
  };
  const caseTableRef = {
    current: {
      clearAllCheckboxes: () => {},
      clearLeadCase: () => {},
      selectAllCheckboxes: () => {},
    },
  };
  const clearButton = {
    current: {
      disableButton: () => {},
    },
  };
  const confirmationModalRef = {
    current: {
      hide: () => {},
      show: (options: ShowOptionParams) => {},
    },
  };
  const jointAdministrationRef = {
    current: {
      check: (value: boolean) => {},
      disable: (value: boolean) => {},
      isChecked: () => true,
    },
  };
  const leadCaseDivisionRef = {
    current: {
      clearSelections: () => {},
      disable: (value: boolean) => {},
      focusInput: () => {},
      getSelections: () => [
        {
          hidden: false,
          label: '',
          selected: false,
          value: '',
        },
      ],
      setSelections: (options: ComboOption[]) => {},
    },
  };
  const leadCaseNumberRef = {
    current: {
      clearValue: () => {},
      disable: (value: boolean) => {},
      focus: () => {},
      getValue: () => '',
      resetValue: () => {},
      setValue: (value: string) => {},
    },
  };
  const rejectButton = {
    current: {
      disableButton: () => {},
    },
  };
  const substantiveRef = {
    current: {
      check: (value: boolean) => {},
      disable: (value: boolean) => {},
      isChecked: () => true,
    },
  };
  const toggleLeadCaseFormRef = {
    current: {
      getLabel: () => {
        return '';
      },
      setChecked: (value: boolean | CheckboxState) => {},
    },
  };

  const showConfirmationModal = (
    selectedCases: ConsolidationOrderCase[],
    leadCase: ConsolidationOrderCase,
    status: OrderStatus,
    consolidationType?: ConsolidationType,
  ) => {};
  const disableLeadCaseForm = (disabled: boolean) => {};
  const clearAllCheckBoxes = () => {};
  const disableButton = (button: Ref<ButtonRef>, state: boolean) => {};
  const unsetConsolidationType = () => {};

  return {
    approveButton,
    caseTableActions: caseTableRef,
    clearAllCheckBoxes,
    clearButton,
    confirmationModal: confirmationModalRef,
    disableButton,
    disableLeadCaseForm,
    jointAdministrationRadio: jointAdministrationRef,
    leadCaseDivisionInput: leadCaseDivisionRef,
    leadCaseFormToggle: toggleLeadCaseFormRef,
    leadCaseNumberInput: leadCaseNumberRef,
    rejectButton,
    showConfirmationModal,
    substantiveRadio: substantiveRef,
    unsetConsolidationType,
  };
}
