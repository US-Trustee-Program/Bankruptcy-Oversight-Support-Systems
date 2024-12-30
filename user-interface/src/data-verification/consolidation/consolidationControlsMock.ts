/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ConsolidationControls,
  Ref,
} from '@/data-verification/consolidation/consolidationControls';
import { ShowOptionParams } from '@/data-verification/consolidation/ConsolidationOrderModal';
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
      // biome-ignore lint: no-unused-vars
      show: (options: ShowOptionParams) => {},
      hide: () => {},
    },
  };
  const jointAdministrationRef = {
    current: {
      // biome-ignore lint: no-unused-vars
      disable: (value: boolean) => {},
      // biome-ignore lint: no-unused-vars
      check: (value: boolean) => {},
      isChecked: () => true,
    },
  };
  const leadCaseDivisionRef = {
    current: {
      getValue: () => [
        {
          value: '',
          label: '',
          selected: false,
          hidden: false,
        },
      ],
      clearValue: () => {},
      // biome-ignore lint: no-unused-vars
      disable: (value: boolean) => {},
    },
  };
  const leadCaseNumberRef = {
    current: {
      // biome-ignore lint: no-unused-vars
      setValue: (value: string) => {},
      // biome-ignore lint: no-unused-vars
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
      // biome-ignore lint: no-unused-vars
      disable: (value: boolean) => {},
      // biome-ignore lint: no-unused-vars
      check: (value: boolean) => {},
      isChecked: () => true,
    },
  };
  const toggleLeadCaseFormRef = {
    current: {
      // biome-ignore lint: no-unused-vars
      setChecked: (value: boolean | CheckboxState) => {},
      getLabel: () => {
        return '';
      },
    },
  };

  const showConfirmationModal = (
    // biome-ignore lint: no-unused-vars
    selectedCases: ConsolidationOrderCase[],
    // biome-ignore lint: no-unused-vars
    leadCase: ConsolidationOrderCase,
    // biome-ignore lint: no-unused-vars
    status: OrderStatus,
    // biome-ignore lint: no-unused-vars
    consolidationType?: ConsolidationType,
  ) => {};
  // biome-ignore lint: no-unused-vars, what are we doing here?
  const disableLeadCaseForm = (disabled: boolean) => {};
  const clearAllCheckBoxes = () => {};
  // biome-ignore lint: no-unused-vars
  const disableButton = (button: Ref<ButtonRef>, state: boolean) => {};
  const unsetConsolidationType = () => {};

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
    disableLeadCaseForm,
    clearAllCheckBoxes,
    disableButton,
    unsetConsolidationType,
  };
}
