import { MockData } from '@common/cams/test-utilities/mock-data';
import { ConsolidationStoreMock } from './consolidationStoreMock';
import { ConsolidationsUseCase, consolidationUseCase } from './consolidationsUseCase';
import { orderStatusType, orderType } from '@/lib/utils/labels';
import { useConsolidationControlsMock } from '@/data-verification/consolidation/consolidationControlsMock';
import { ConsolidationControls } from './consolidationControls';
import { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';
import { ConsolidationOrderCase } from '@common/cams/orders';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { ChangeEvent } from 'react';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';

describe('Consolidation UseCase tests', () => {
  let store: ConsolidationStore;
  let controls: ConsolidationControls;
  let useCase: ConsolidationsUseCase;
  const onExpand = vi.fn();

  const mockLeadCase = MockData.getConsolidatedOrderCase();
  const mockOrder = MockData.getConsolidationOrder();

  function setupLeadCase() {
    store.setLeadCase(mockLeadCase);
    store.setLeadCaseNumber(getCaseNumber(mockLeadCase.caseId));
    store.setLeadCaseId(mockLeadCase.caseId);
    store.setLeadCaseCourt(mockLeadCase.courtDivisionCode);
    store.setLeadCaseNumberError('error message');
  }

  function includeCases(mockCases: ConsolidationOrderCase[]) {
    store.setSelectedCases(mockCases);
    store.setLeadCase(mockCases[1]);
    store.setConsolidationType('administrative');
  }

  function expectClearLeadCase() {
    expect(store.leadCase).toBeNull();
    expect(store.leadCaseId).toEqual('');
    expect(store.leadCaseNumber).toEqual('');
    expect(store.leadCaseCourt).toEqual('');
  }

  function initUseCase() {
    const props = {
      order: mockOrder,
      statusType: orderStatusType,
      orderType: orderType,
      officesList: MockData.getOffices(),
      regionsMap: new Map(),
      onOrderUpdate: vi.fn(),
      onExpand,
    };

    store = new ConsolidationStoreMock(props, []);
    controls = useConsolidationControlsMock();

    useCase = consolidationUseCase(store, controls, props.onOrderUpdate, props.onExpand);
  }

  beforeEach(() => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    initUseCase();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should properly handle handleClearInputs', () => {
    const clearAllCheckBoxesSpy = vitest.spyOn(controls, 'clearAllCheckBoxes');
    const unsetConsolidationTypeSpy = vitest.spyOn(controls, 'unsetConsolidationType');
    const enableLeadCaseFormSpy = vitest.spyOn(controls, 'enableLeadCaseForm');

    setupLeadCase();

    store.setFoundValidCaseNumber(true);
    store.setShowLeadCaseForm(true);
    store.setSelectedCases(MockData.buildArray(MockData.getConsolidatedOrderCase, 3));
    const clearLeadCaseSpy = vitest.spyOn(controls, 'clearLeadCase');
    useCase.handleClearInputs();
    expectClearLeadCase();
    expect(clearLeadCaseSpy).toHaveBeenCalled();
    expect(clearAllCheckBoxesSpy).toHaveBeenCalled();
    expect(unsetConsolidationTypeSpy).toHaveBeenCalled();
    expect(enableLeadCaseFormSpy).toHaveBeenCalledWith(false);
    // TODO: Cannot figure out how to make sure `updateSubmitButtonsStateSpy` was called.
  });

  test('should call approveConsolidation when approve button is clicked', () => {
    const controlSpy = vitest.spyOn(controls, 'showConfirmationModal');
    const mockCases = MockData.buildArray(MockData.getConsolidatedOrderCase, 3);
    includeCases(mockCases);
    useCase.handleApproveButtonClick();
    expect(controlSpy).toHaveBeenCalledWith(mockCases, mockCases[1], 'approved', 'administrative');
  });

  test('should call rejectConsolidation when reject button is clicked', () => {
    const controlSpy = vitest.spyOn(controls, 'showConfirmationModal');
    const mockCases = MockData.buildArray(MockData.getConsolidatedOrderCase, 3);
    includeCases(mockCases);
    useCase.handleRejectButtonClick();
    expect(controlSpy).toHaveBeenCalledWith(mockCases, mockCases[1], 'rejected');
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

  test('should properly set Lead Case when marking lead case', () => {
    //Should clear lead case input and set lead case when case is marked as lead
    const enableLeadCaseFormSpy = vitest.spyOn(controls, 'enableLeadCaseForm');
    const setLeadCaseSpy = vitest.spyOn(store, 'setLeadCase');
    const setLeadCaseIdSpy = vitest.spyOn(store, 'setLeadCaseId');
    const setFoundValidCaseNumberSpy = vitest.spyOn(store, 'setFoundValidCaseNumber');

    setupLeadCase();

    const newLeadCase = MockData.getConsolidatedOrderCase();
    useCase.handleMarkLeadCase(newLeadCase);

    expect(store.leadCase).toBe(newLeadCase);
    expect(store.leadCaseId).toEqual(newLeadCase.caseId);
    expect(store.leadCaseNumber).toEqual('');
    expect(store.leadCaseCourt).toEqual('');
    expect(setLeadCaseSpy).toHaveBeenCalledWith(newLeadCase);
    expect(setLeadCaseIdSpy).toHaveBeenCalledWith(newLeadCase.caseId);
    expect(setFoundValidCaseNumberSpy).toHaveBeenCalledWith(false);
    expect(enableLeadCaseFormSpy).toHaveBeenCalledWith(false);

    // select the same case as lead case
    useCase.handleMarkLeadCase(newLeadCase);

    expect(setLeadCaseSpy).toHaveBeenCalledWith(null);
    expect(setLeadCaseIdSpy).toHaveBeenCalledWith('');
  });

  test('should handle clearing the lead case number input', () => {
    setupLeadCase();
    store.setFoundValidCaseNumber(true);
    store.setShowLeadCaseForm(true);
    const controlSpy = vitest.spyOn(controls, 'disableButton');

    useCase.handleLeadCaseInputChange();

    expect(store.leadCaseNumber).toEqual('');
    expect(store.foundValidCaseNumber).toEqual(false);
    expect(store.leadCase).toBeNull();
    expect(store.leadCaseNumberError).toEqual('');
    expect(controlSpy).toHaveBeenCalledWith(controls.approveButton, true);
  });

  test('should get caseAssignments and caseAssociations when accordion is expanded', async () => {
    const setIsDataEnhancedSpy = vi.spyOn(store, 'setIsDataEnhanced');
    const returns = { success: true, body: ['Test'] };
    const getSpy = vi.spyOn(Chapter15MockApi, 'get').mockResolvedValue(returns);

    await useCase.handleOnExpand();
    expect(onExpand.mock.calls[0][0]).toEqual(`order-list-${mockOrder.id}`);
    expect(getSpy.mock.calls[0][0]).toEqual(`/case-assignments/${mockOrder.childCases[0].caseId}`);
    expect(getSpy.mock.calls[1][0]).toEqual(`/cases/${mockOrder.childCases[0].caseId}/associated`);
    expect(getSpy.mock.calls[2][0]).toEqual(`/case-assignments/${mockOrder.childCases[1].caseId}`);
    expect(getSpy.mock.calls[3][0]).toEqual(`/cases/${mockOrder.childCases[1].caseId}/associated`);
    expect(setIsDataEnhancedSpy).toHaveBeenCalledWith(true);
  });

  // TODO: Attempting to cover lines 377-381, should we handle this error more gracefully like logging to the function?

  // test('should throw an error when accordion expanded and api calls fail', () => {
  //   const getCaseAssignmentsSpy = vi
  //     .spyOn(Api, 'get')
  //     .mockResolvedValueOnce({ success: true, body: ['Assignment Test'] });
  //   const getCaseAssociationsSpy = vi
  //     .spyOn(Api, 'get')
  //     .mockResolvedValueOnce({ success: true, body: ['Association Test'] });

  //   useCase.handleOnExpand();
  //   expect(onExpand.mock.calls[0][0]).toEqual(`order-list-${mockOrder.id}`);
  //   expect(getCaseAssignmentsSpy).toHaveBeenCalled();
  //   expect(getCaseAssociationsSpy).toHaveBeenCalled();
  // });

  test('should call setConsolidationType when handleSelectConsolidationType is called', () => {
    const setConsolidationTypeSpy = vitest.spyOn(store, 'setConsolidationType');
    useCase.handleSelectConsolidationType('Test');
    expect(setConsolidationTypeSpy).toHaveBeenCalledWith('Test');
  });

  test('should call setLeadCaseCourt when a court is selected from the dropdown', () => {
    const setLeadCaseCourtSpy = vitest.spyOn(store, 'setLeadCaseCourt');
    const newLeadCaseCourt = { label: 'test', value: 'test value' };
    useCase.handleSelectLeadCaseCourt(newLeadCaseCourt);
    expect(setLeadCaseCourtSpy).toHaveBeenCalled();
  });

  test('should clear lead case and set show lead case form when lead case form toggle is selected', () => {
    const showLeadCaseFormSpy = vitest.spyOn(store, 'setShowLeadCaseForm');
    const testValue = 'checked';
    const testEvent = {
      target: {
        value: testValue,
      },
    };
    const event = testEvent as ChangeEvent<HTMLInputElement>;
    setupLeadCase();
    const clearLeadCaseSpy = vitest.spyOn(controls, 'clearLeadCase');
    useCase.handleToggleLeadCaseForm(event);
    expect(showLeadCaseFormSpy).toHaveBeenCalled();
    expectClearLeadCase();
    expect(clearLeadCaseSpy).toHaveBeenCalled();
  });

  test('should return a valid lead case if case is not already consolidated and is not the child of another consolidation', async () => {
    const disableLeadCaseSpy = vi.spyOn(controls, 'disableLeadCaseForm');
    const setIsValidatingSpy = vi.spyOn(store, 'setIsValidatingLeadCaseNumber');
    const setLeadCaseNumberErrorSpy = vi.spyOn(store, 'setLeadCaseNumberError');
    const setLeadCaseIdSpy = vi.spyOn(store, 'setLeadCaseId');
    const getSpy = vi.spyOn(Chapter15MockApi, 'get');

    setupLeadCase();
    useCase.getValidLeadCase();
    expect(disableLeadCaseSpy).toHaveBeenCalledWith(true);
    expect(setIsValidatingSpy).toHaveBeenCalledWith(true);
    expect(setLeadCaseNumberErrorSpy).toHaveBeenCalledWith('');
    expect(setLeadCaseIdSpy).toHaveBeenCalledWith('');
    expect(getSpy.mock.calls[0][0]).toEqual(`/cases/${mockLeadCase.caseId}/summary`);
    console.log('Mock calls:    ', getSpy.mock.calls);
    expect(getSpy.mock.calls[1][0]).toEqual(`/cases/${mockLeadCase.caseId}/associated`);
    // expect(getSpy.mock.calls[2][0]).toEqual(`/case-assignments/${mockOrder.childCases[1].caseId}`);
    // expect(getSpy.mock.calls[3][0]).toEqual(`/cases/${mockOrder.childCases[1].caseId}/associated`);
  });

  test('dummy test', async () => {
    expect(() =>
      Promise.resolve('some value').then((response) => {
        return response;
      }),
    ).toEqual('some value');
  });
});
