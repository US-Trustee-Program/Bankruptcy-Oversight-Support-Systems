import { MockData } from '@common/cams/test-utilities/mock-data';
import { ConsolidationStoreMock } from './consolidationStoreMock';
import { ConsolidationsUseCase, consolidationUseCase } from './consolidationsUseCase';
import { orderStatusType, orderType } from '@/lib/utils/labels';
import { useConsolidationControlsMock } from '@/data-verification/consolidation/consolidationControlsMock';
import { ConsolidationControls } from './consolidationControls';
import { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';
import { ConsolidationOrderCase } from '@common/cams/orders';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import Api2 from '@/lib/hooks/UseApi2';

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
    expect(store.leadCaseNumberError).toEqual('');
    expect(store.foundValidCaseNumber).toBe(false);
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
    const clearAllCheckBoxesSpy = vi.spyOn(controls, 'clearAllCheckBoxes');
    const unsetConsolidationTypeSpy = vi.spyOn(controls, 'unsetConsolidationType');
    const showLeadCaseFormSpy = vi.spyOn(store, 'setShowLeadCaseForm');
    // const disableButtonSpy = vi.spyOn(controls, 'disableButton');

    setupLeadCase();

    store.setFoundValidCaseNumber(true);
    store.setShowLeadCaseForm(true);
    store.setSelectedCases(MockData.buildArray(MockData.getConsolidatedOrderCase, 3));
    useCase.handleClearInputs();
    expectClearLeadCase();
    expect(clearAllCheckBoxesSpy).toHaveBeenCalled();
    expect(unsetConsolidationTypeSpy).toHaveBeenCalled();
    expect(showLeadCaseFormSpy).toHaveBeenCalledWith(false);
    // TODO: Cannot figure out how to make sure `updateSubmitButtonsStateSpy` was called.
    //   The following doesn't work. For some reason the function is called with state in the default configuration.
    // expect(disableButtonSpy).toHaveBeenCalledWith(controls.rejectButton, false);
    // expect(disableButtonSpy).toHaveBeenCalledWith(controls.approveButton, false);
  });

  test('should call approveConsolidation when approve button is clicked', () => {
    const controlSpy = vi.spyOn(controls, 'showConfirmationModal');
    const mockCases = MockData.buildArray(MockData.getConsolidatedOrderCase, 3);
    includeCases(mockCases);
    useCase.handleApproveButtonClick();
    expect(controlSpy).toHaveBeenCalledWith(mockCases, mockCases[1], 'approved', 'administrative');
  });

  test('should call rejectConsolidation when reject button is clicked', () => {
    const controlSpy = vi.spyOn(controls, 'showConfirmationModal');
    const mockCases = MockData.buildArray(MockData.getConsolidatedOrderCase, 3);
    includeCases(mockCases);
    useCase.handleRejectButtonClick();
    expect(controlSpy).toHaveBeenCalledWith(mockCases, mockCases[1], 'rejected');
  });

  test('should call setSelectedCases and updateSubmitButtonState when handleIncludeCase is called', () => {
    const setSelectedCasesSpy = vi.spyOn(store, 'setSelectedCases');
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
    const setLeadCaseSpy = vi.spyOn(store, 'setLeadCase');
    const setLeadCaseIdSpy = vi.spyOn(store, 'setLeadCaseId');

    setupLeadCase();

    const newLeadCase = MockData.getConsolidatedOrderCase();
    useCase.handleMarkLeadCase(newLeadCase);

    expect(store.leadCase).toBe(newLeadCase);
    expect(store.leadCaseId).toEqual(newLeadCase.caseId);
    expect(store.leadCaseNumber).toEqual('');
    expect(store.leadCaseCourt).toEqual('');
    expect(store.showLeadCaseForm).toBe(false);
    expect(setLeadCaseSpy).toHaveBeenCalledWith(newLeadCase);
    expect(setLeadCaseIdSpy).toHaveBeenCalledWith(newLeadCase.caseId);

    // select the same case as lead case
    useCase.handleMarkLeadCase(newLeadCase);

    expect(setLeadCaseSpy).toHaveBeenCalledWith(null);
    expect(setLeadCaseIdSpy).toHaveBeenCalledWith('');
  });

  test('should handle clearing the lead case number input', () => {
    setupLeadCase();
    store.setFoundValidCaseNumber(true);
    store.setShowLeadCaseForm(true);
    const controlSpy = vi.spyOn(controls, 'disableButton');

    useCase.handleLeadCaseInputChange();

    expect(store.leadCaseNumber).toEqual('');
    expect(store.foundValidCaseNumber).toEqual(false);
    expect(store.leadCase).toBeNull();
    expect(store.leadCaseNumberError).toEqual('');
    expect(controlSpy).toHaveBeenCalledWith(controls.approveButton, true);
  });

  test('should handle setting the lead case number input', () => {
    setupLeadCase();
    store.setFoundValidCaseNumber(true);
    store.setShowLeadCaseForm(true);
    const disableButtonSpy = vi.spyOn(controls, 'disableButton');

    const caseNumber = '24-12345';
    useCase.handleLeadCaseInputChange(caseNumber);

    expect(store.leadCaseNumber).toEqual(caseNumber);
    expect(disableButtonSpy).not.toHaveBeenCalled();
  });

  test('should get caseAssignments and caseAssociations when accordion is expanded', async () => {
    const setIsDataEnhancedSpy = vi.spyOn(store, 'setIsDataEnhanced');
    const assignmentsSpy = vi.spyOn(Api2, 'getCaseAssignments');
    const associationsSpy = vi.spyOn(Api2, 'getCaseAssociations');

    await useCase.handleOnExpand();
    expect(onExpand.mock.calls[0][0]).toEqual(`order-list-${mockOrder.id}`);
    expect(assignmentsSpy.mock.calls[0][0]).toEqual(mockOrder.childCases[0].caseId);
    expect(assignmentsSpy.mock.calls[1][0]).toEqual(mockOrder.childCases[1].caseId);
    expect(associationsSpy.mock.calls[0][0]).toEqual(mockOrder.childCases[0].caseId);
    expect(associationsSpy.mock.calls[1][0]).toEqual(mockOrder.childCases[1].caseId);
    expect(setIsDataEnhancedSpy).toHaveBeenCalledWith(true);
  }, 10000);

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
    const setConsolidationTypeSpy = vi.spyOn(store, 'setConsolidationType');
    useCase.handleSelectConsolidationType('Test');
    expect(setConsolidationTypeSpy).toHaveBeenCalledWith('Test');
  });

  test('should call setLeadCaseCourt when a court is selected from the dropdown', () => {
    const setLeadCaseCourtSpy = vi.spyOn(store, 'setLeadCaseCourt');
    const newLeadCaseCourt = { label: 'test', value: 'test value' };
    useCase.handleSelectLeadCaseCourt(newLeadCaseCourt);
    expect(setLeadCaseCourtSpy).toHaveBeenCalled();
  });

  test('should clear lead case and set show lead case form when lead case form toggle is selected', () => {
    setupLeadCase();
    useCase.handleToggleLeadCaseForm(true);
    expect(store.showLeadCaseForm).toBe(true);
    expectClearLeadCase();
  });

  test('should return a valid lead case if case is not already consolidated and is not the child of another consolidation', async () => {
    const disableLeadCaseSpy = vi.spyOn(controls, 'disableLeadCaseForm');
    const setIsValidatingSpy = vi.spyOn(store, 'setIsValidatingLeadCaseNumber');
    const setLeadCaseNumberErrorSpy = vi.spyOn(store, 'setLeadCaseNumberError');
    const setLeadCaseIdSpy = vi.spyOn(store, 'setLeadCaseId');

    const caseSummary = MockData.getCaseSummary();
    const getCaseSummarySpy = vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({
      meta: {
        isPaginated: false,
        self: '',
      },
      isSuccess: true,
      data: caseSummary,
    });

    const getCaseAssociationsSpy = vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue({
      meta: {
        isPaginated: true,
        count: 1,
        limit: 500,
        currentPage: 1,
        self: '',
      },
      isSuccess: true,
      data: [],
    });

    const getCaseAssignmentsSpy = vi.spyOn(Api2, 'getCaseAssignments');

    setupLeadCase();
    useCase.getValidLeadCase();
    expect(disableLeadCaseSpy).toHaveBeenCalledWith(true);
    expect(setIsValidatingSpy).toHaveBeenCalledWith(true);
    expect(setLeadCaseNumberErrorSpy).toHaveBeenCalledWith('');
    expect(setLeadCaseIdSpy).toHaveBeenCalledWith('');
    expect(getCaseSummarySpy).toHaveBeenCalledWith(mockLeadCase.caseId);
    expect(getCaseAssociationsSpy).toHaveBeenCalledWith(mockLeadCase.caseId);
    expect(getCaseAssignmentsSpy).toHaveBeenCalledWith(mockLeadCase.caseId);
  });

  test(`should call put with '/consolidations/approve' if handleConfirmAction is called with 'approved'`, () => {
    const putSpy = vi.spyOn(Chapter15MockApi, 'put');
    setupLeadCase();
    store.setConsolidationType('administrative');
    useCase.handleConfirmAction({ status: 'approved' });
    const pathParam = putSpy.mock.calls[0][0];
    const dataParam = putSpy.mock.calls[0][1];
    expect(pathParam).toEqual('/consolidations/approve');
    expect(dataParam).toEqual(
      expect.objectContaining({
        approvedCases: expect.any(Array<string>),
        leadCase: expect.anything(),
      }),
    );
  });

  test(`should call put with '/consolidations/reject' if handleConfirmAction is called with 'approved'`, () => {
    const putSpy = vi.spyOn(Chapter15MockApi, 'put');
    setupLeadCase();
    store.setConsolidationType('administrative');
    const rejectionReason = 'already consolidated';
    useCase.handleConfirmAction({ status: 'rejected', rejectionReason });
    const pathParam = putSpy.mock.calls[0][0];
    const dataParam = putSpy.mock.calls[0][1];
    expect(pathParam).toEqual('/consolidations/reject');
    expect(dataParam).toEqual(
      expect.objectContaining({
        rejectedCases: expect.any(Array<string>),
        reason: rejectionReason,
      }),
    );
  });
});
