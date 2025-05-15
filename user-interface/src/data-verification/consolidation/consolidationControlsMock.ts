/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ConsolidationControls,
  Ref,
} from '@/data-verification/consolidation/consolidationControls';
import { ShowOptionParams } from '@/data-verification/consolidation/ConsolidationOrderModal';
import { CheckboxState } from '@/lib/components/uswds/Checkbox';
import { ConsolidationOrderCase, ConsolidationType, OrderStatus } from '@common/cams/orders';
import { ButtonRef } from '@/lib/components/uswds/Button';
import { ComboOption } from '@/lib/components/combobox/ComboBox';

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
  const addCaseModalRef = {
    current: {
      show: () => {},
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
      setSelections: (options: ComboOption[]) => {},
      getSelections: () => [
        {
          value: '',
          label: '',
          selected: false,
          hidden: false,
        },
      ],
      clearSelections: () => {},
      disable: (value: boolean) => {},
      focusInput: () => {},
      focus: () => {},
    },
  };
  const leadCaseNumberRef = {
    current: {
      setValue: (value: string) => {},
      disable: (value: boolean) => {},
      clearValue: () => {},
      resetValue: () => {},
      getValue: () => '',
      focus: () => {},
    },
  };
  const additionalCaseDivisionRef = {
    current: {
      setSelections: (options: ComboOption[]) => {},
      getSelections: () => [
        {
          value: '',
          label: '',
          selected: false,
          hidden: false,
        },
      ],
      clearSelections: () => {},
      disable: (value: boolean) => {},
      focusInput: () => {},
      focus: () => {},
    },
  };
  const additionalCaseNumberRef = {
    current: {
      setValue: (value: string) => {},
      disable: (value: boolean) => {},
      clearValue: () => {},
      resetValue: () => {},
      getValue: () => '',
      focus: () => {},
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
  const showAddCaseModal = (defaultOffice: string) => {};

  const disableLeadCaseForm = (disabled: boolean) => {};
  const clearAllCheckBoxes = () => {};
  const disableButton = (button: Ref<ButtonRef>, state: boolean) => {};
  const unsetConsolidationType = () => {};

  return {
    approveButton,
    caseTableActions: caseTableRef,
    clearButton,
    confirmationModal: confirmationModalRef,
    jointAdministrationRadio: jointAdministrationRef,
    leadCaseDivisionRef,
    leadCaseNumberRef,
    rejectButton,
    substantiveRadio: substantiveRef,
    leadCaseFormToggle: toggleLeadCaseFormRef,
    showConfirmationModal,
    disableLeadCaseForm,
    clearAllCheckBoxes,
    disableButton,
    unsetConsolidationType,

    // TODO: CAMS-548 properties
    additionalCaseDivisionRef,
    additionalCaseNumberRef,
    addCaseModal: addCaseModalRef,
    showAddCaseModal,
  };
}
