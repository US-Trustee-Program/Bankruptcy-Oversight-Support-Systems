import { ConsolidationOrder, ConsolidationOrderCase } from '@common/cams/orders';
import { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';
import { ConsolidationControls } from '@/data-verification/consolidation/consolidationControls';

export interface ConsolidationsUseCase {
  clearLeadCase(): void;
  clearSelectedCases(): void;
  disableLeadCaseForm(disabled: boolean): void;
  updateSubmitButtonsState(): void;
  selectedCasesAreConsolidationCases(): void;
  setOrderWithDataEnhancement(order: ConsolidationOrder): void;
  updateAllSelections(caseList: ConsolidationOrderCase[]): void;
}

const consolidationUseCase = (
  store: ConsolidationStore,
  controls: ConsolidationControls,
): ConsolidationsUseCase => {
  function clearLeadCase(): void {
    store.setLeadCase(null);
    store.setLeadCaseId('');
    controls.caseTableRef.current?.clearLeadCase();
    controls.leadCaseNumberRef.current?.clearValue();
  }

  function clearSelectedCases(): void {
    store.setSelectedCases([]);
    controls.caseTableRef.current?.clearAllCheckboxes();
  }

  function disableLeadCaseForm(disabled: boolean) {
    controls.leadCaseDivisionRef.current?.disable(disabled);
    controls.leadCaseNumberRef.current?.disable(disabled);
  }

  function updateSubmitButtonsState() {
    if (store.selectedCases.length) {
      controls.rejectButtonRef.current?.disableButton(false);

      controls.approveButtonRef.current?.disableButton(
        !store.isDataEnhanced ||
          store.leadCaseId === '' ||
          store.consolidationType === null ||
          selectedCasesAreConsolidationCases(),
      );
    } else {
      controls.rejectButtonRef.current?.disableButton(true);
      controls.approveButtonRef.current?.disableButton(true);
    }
  }

  function selectedCasesAreConsolidationCases() {
    return store.order.childCases.reduce((itDoes, bCase) => {
      if (!store.selectedCases.includes(bCase)) {
        return itDoes;
      }
      return itDoes || !!bCase.associations?.length;
    }, false);
  }

  function setOrderWithDataEnhancement(order: ConsolidationOrder) {
    store.setOrder({ ...order });
  }

  function updateAllSelections(caseList: ConsolidationOrderCase[]) {
    store.setSelectedCases(caseList);
  }

  return {
    clearLeadCase,
    clearSelectedCases,
    disableLeadCaseForm,
    updateSubmitButtonsState,
    selectedCasesAreConsolidationCases,
    setOrderWithDataEnhancement,
    updateAllSelections,
  };
};

export { consolidationUseCase };
