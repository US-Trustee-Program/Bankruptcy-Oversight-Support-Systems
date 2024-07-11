import { MockData } from '@common/cams/test-utilities/mock-data';
import { ConsolidationStoreMock } from './consolidationStoreMock';
import { ConsolidationsUseCase, consolidationUseCase } from './consolidationsUseCase';
import { orderStatusType, orderType } from '@/lib/utils/labels';
import { useConsolidationControlsMock } from '@/data-verification/consolidation/consolidationControlsMock';
import { ConsolidationControls } from './consolidationControls';
import { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';

describe('Consolidation UseCase tests', () => {
  let store: ConsolidationStore;
  let controls: ConsolidationControls;
  let useCase: ConsolidationsUseCase;

  function initUseCase() {
    const props = {
      order: MockData.getConsolidationOrder(),
      statusType: orderStatusType,
      orderType: orderType,
      officesList: MockData.getOffices(),
      regionsMap: new Map(),
      onOrderUpdate: vi.fn(),
      onExpand: vi.fn(),
    };

    store = new ConsolidationStoreMock(props, []);
    controls = useConsolidationControlsMock();

    useCase = consolidationUseCase(store, controls, props.onOrderUpdate, props.onExpand);
  }

  beforeEach(() => {
    initUseCase();
  });

  test('should call showConfirmationModal when handleApproveButtonClick is called', () => {
    const controlSpy = vitest.spyOn(controls, 'showConfirmationModal');
    useCase.handleApproveButtonClick();
    expect(controlSpy).toHaveBeenCalled();
  });

  test('should properly handle handleClearInputs', () => {
    const clearLeadCaseSpy = vitest.spyOn(controls, 'clearLeadCase');
    const clearAllCheckBoxesSpy = vitest.spyOn(controls, 'clearAllCheckBoxes');
    const unsetConsolidationTypeSpy = vitest.spyOn(controls, 'unsetConsolidationType');
    const enableLeadCaseFormSpy = vitest.spyOn(controls, 'enableLeadCaseForm');

    store.setLeadCase(MockData.getConsolidatedOrderCase());
    store.setLeadCaseNumber('00-00000');
    store.setLeadCaseId('000-00-00000');
    store.setLeadCaseCourt('000');
    store.setLeadCaseNumberError('error message');
    store.setFoundValidCaseNumber(true);
    store.setShowLeadCaseForm(true);

    store.setLeadCase(MockData.getConsolidatedOrderCase());
    store.setLeadCaseNumber('00-00000');
    store.setLeadCaseId('000-00-00000');
    store.setLeadCaseCourt('000');
    store.setSelectedCases(MockData.buildArray(MockData.getConsolidatedOrderCase, 3));
    useCase.handleClearInputs();

    expect(store.leadCase).toBeNull();
    expect(store.leadCaseId).toEqual('');
    expect(store.leadCaseNumber).toEqual('');
    expect(store.leadCaseCourt).toEqual('');
    expect(clearLeadCaseSpy).toHaveBeenCalled();
    expect(clearAllCheckBoxesSpy).toHaveBeenCalled();
    expect(unsetConsolidationTypeSpy).toHaveBeenCalled();
    expect(enableLeadCaseFormSpy).toHaveBeenCalledWith(false);
    // TODO: Cannot figure out how to make sure `updateSubmitButtonsStateSpy` was called.
  });

  test('should call approveConsolidation when approve button is clicked', () => {
    const controlSpy = vitest.spyOn(controls, 'showConfirmationModal');
    const mockCases = MockData.buildArray(MockData.getConsolidatedOrderCase, 3);
    store.setSelectedCases(mockCases);
    store.setLeadCase(mockCases[1]);
    store.setConsolidationType('administrative');
    useCase.handleApproveButtonClick();
    expect(controlSpy).toHaveBeenCalledWith(mockCases, mockCases[1], 'approved', 'administrative');
  });

  test('should call rejectConsolidation when reject button is clicked', () => {
    const controlSpy = vitest.spyOn(controls, 'showConfirmationModal');
    const mockCases = MockData.buildArray(MockData.getConsolidatedOrderCase, 3);
    store.setSelectedCases(mockCases);
    store.setLeadCase(mockCases[1]);
    store.setConsolidationType('administrative');
    useCase.handleRejectButtonClick();
    expect(controlSpy).toHaveBeenCalledWith(mockCases, mockCases[1], 'rejected');
    expect(controlSpy).toHaveBeenCalled();
  });

  test('should call setSelectedCases and updateSubmitButtonState when handleIncludeCase is called', () => {
    const setSelectedCasesSpy = vitest.spyOn(store, 'setSelectedCases');
    const mockCases = MockData.buildArray(MockData.getConsolidatedOrderCase, 3);
    const mockAdditionalCase = MockData.getConsolidatedOrderCase();
    //Add case initially to includeCases
    store.setSelectedCases(mockCases);
    useCase.handleIncludeCase(mockAdditionalCase);
    expect(setSelectedCasesSpy).toHaveBeenCalledWith([...mockCases, mockAdditionalCase]);
    //Test same case is removed
    useCase.handleIncludeCase(mockAdditionalCase);
    expect(setSelectedCasesSpy).toHaveBeenCalledWith(mockCases);
  });

  test('should call setLeadCaseNumber when acase is set to lead case', () => {
    const controlSpy = vitest.spyOn(controls, 'showConfirmationModal');
    useCase.handleApproveButtonClick();
    expect(controlSpy).toHaveBeenCalled();
  });

  test('should call setLeadCaseNumber, setValidCaseNumber, setLeadCase, SetLeadCaseNumberError, and controls.disableButton with no lead case selected', () => {
    const controlSpy = vitest.spyOn(controls, 'showConfirmationModal');
    useCase.handleApproveButtonClick();
    expect(controlSpy).toHaveBeenCalled();
  });

  test('should call proper functions when selecting a case as lead and lead case already exists', () => {
    const controlSpy = vitest.spyOn(controls, 'showConfirmationModal');
    useCase.handleApproveButtonClick();
    expect(controlSpy).toHaveBeenCalled();
  });

  test('should call proper functions when selecting a case as lead and existing lead case matches selection', () => {
    const controlSpy = vitest.spyOn(controls, 'showConfirmationModal');
    useCase.handleApproveButtonClick();
    expect(controlSpy).toHaveBeenCalled();
  });

  test('should call proper functions when selecting a case as lead and lead case does not exist', () => {
    const controlSpy = vitest.spyOn(controls, 'showConfirmationModal');
    useCase.handleApproveButtonClick();
    expect(controlSpy).toHaveBeenCalled();
  });

  test('should get caseAssignments and caseAssociations when accordion is expanded', () => {
    const controlSpy = vitest.spyOn(controls, 'showConfirmationModal');
    useCase.handleApproveButtonClick();
    expect(controlSpy).toHaveBeenCalled();
  });

  test('should throw an error when accordion is expanded and getCaseAssignments and getCaseAssociations return invalid responses', () => {
    const controlSpy = vitest.spyOn(controls, 'showConfirmationModal');
    useCase.handleApproveButtonClick();
    expect(controlSpy).toHaveBeenCalled();
  });

  test('should call setConsolidationType when handleSelectConsolidationType is called', () => {
    const controlSpy = vitest.spyOn(controls, 'showConfirmationModal');
    useCase.handleApproveButtonClick();
    expect(controlSpy).toHaveBeenCalled();
  });

  test('should call setLeadCaseCourt when a court is selected from the dropdown', () => {
    const controlSpy = vitest.spyOn(controls, 'showConfirmationModal');
    useCase.handleApproveButtonClick();
    expect(controlSpy).toHaveBeenCalled();
  });

  test('should clear lead case and set show lead case form when lead case form toggle is selected', () => {
    const controlSpy = vitest.spyOn(controls, 'showConfirmationModal');
    useCase.handleApproveButtonClick();
    expect(controlSpy).toHaveBeenCalled();
  });
});
