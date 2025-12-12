import MockData from '@common/cams/test-utilities/mock-data';
import { ConsolidationStoreMock } from './consolidationStoreMock';
import { ConsolidationsUseCase, consolidationUseCase } from './consolidationsUseCase';
import { orderStatusType, orderType } from '@/lib/utils/labels';
import { useConsolidationControlsMock } from '@/data-verification/consolidation/consolidationControlsMock';
import { ConsolidationControls } from './consolidationControls';
import { ConsolidationStore } from '@/data-verification/consolidation/consolidationStore';
import { ConsolidationOrderCase } from '@common/cams/orders';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import Api2 from '@/lib/models/api2';
import { ResponseBody } from '@common/api/response';
import { Consolidation } from '@common/cams/events';
import { CaseAssignment } from '@common/cams/assignments';
import { CaseSummary } from '@common/cams/cases';
import { ConfirmActionResults } from './ConsolidationOrderModal';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import TestingUtilities from '@/lib/testing/testing-utilities';

describe('Consolidation UseCase tests', () => {
  let store: ConsolidationStore;
  let controls: ConsolidationControls;
  let useCase: ConsolidationsUseCase;
  const onExpand = vi.fn();

  const mockAddCase = MockData.getConsolidatedOrderCase();
  const mockOrder = MockData.getConsolidationOrder();
  const onOrderUpdateSpy = vi.fn();
  const { nonReactWaitFor } = TestingUtilities;

  const setupAddCase = () => {
    store.setCaseToAdd(mockAddCase);
    store.setCaseToAddCaseNumber(getCaseNumber(mockAddCase.caseId));
    store.setCaseToAddCourt(mockAddCase.courtDivisionCode);
    store.setAddCaseNumberError('error message');
  };

  const includeCases = (mockCases: ConsolidationOrderCase[]) => {
    store.setSelectedCases(mockCases);
    store.setLeadCase(mockCases[1]);
    store.setConsolidationType('administrative');
  };

  const expectClearLeadCase = () => {
    expect(store.leadCase).toBeNull();
    expect(store.leadCaseId).toEqual('');
    expect(store.leadCaseNumber).toEqual('');
    expect(store.leadCaseNumberError).toEqual('');
    expect(store.foundValidCaseNumber).toBe(false);
  };

  const accordionFieldHeaders = ['Court District', 'Order Filed', 'Event Type', 'Event Status'];

  const initUseCase = () => {
    const props = {
      order: mockOrder,
      statusType: orderStatusType,
      orderType: orderType,
      courts: MockData.getCourts(),
      regionsMap: new Map(),
      fieldHeaders: accordionFieldHeaders,
      onOrderUpdate: onOrderUpdateSpy,
      onExpand,
    };

    store = new ConsolidationStoreMock(props, []);
    controls = useConsolidationControlsMock();

    useCase = consolidationUseCase(store, controls, props.onOrderUpdate, props.onExpand);
  };

  beforeEach(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    vi.resetModules();
    await import('@/lib/Api2Factory');
    initUseCase();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  test('should properly handle handleClearInputs', () => {
    const clearAllCheckBoxesSpy = vi.spyOn(controls, 'clearAllCheckBoxes');
    const unsetConsolidationTypeSpy = vi.spyOn(controls, 'unsetConsolidationType');

    setupAddCase();

    store.setFoundValidCaseNumber(true);
    store.setShowLeadCaseForm(true);
    store.setSelectedCases(MockData.buildArray(MockData.getConsolidatedOrderCase, 3));
    useCase.handleClearInputs();
    expectClearLeadCase();
    expect(clearAllCheckBoxesSpy).toHaveBeenCalled();
    expect(unsetConsolidationTypeSpy).toHaveBeenCalled();
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

  test('should show alert when rejectConsolidation api call throws an error', async () => {
    const putSpy = vi
      .spyOn(Api2, 'putConsolidationOrderRejection')
      .mockRejectedValue('some put error');
    const action: ConfirmActionResults = {
      status: 'rejected',
      rejectionReason: 'some rejection reason',
    };
    store.order = MockData.getConsolidationOrder();
    store.selectedCases = MockData.buildArray(MockData.getConsolidatedOrderCase, 3);
    store.setIsProcessing(true);

    useCase.handleConfirmAction(action);

    await TestingUtilities.nonReactWaitFor(() => {
      return !store.isProcessing;
    });

    expect(putSpy).toHaveBeenCalled();
    expect(onOrderUpdateSpy).toHaveBeenCalledWith({
      message: 'An unknown error has occurred and has been logged.  Please try again later.',
      type: UswdsAlertStyle.Error,
      timeOut: 8,
    });
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
    const setLeadCaseSpy = vi.spyOn(store, 'setLeadCase');
    const setLeadCaseIdSpy = vi.spyOn(store, 'setLeadCaseId');

    setupAddCase();

    const newLeadCase = MockData.getConsolidatedOrderCase();
    useCase.handleMarkLeadCase(newLeadCase);

    expect(store.leadCase).toBe(newLeadCase);
    expect(store.leadCaseId).toEqual(newLeadCase.caseId);
    expect(store.leadCaseNumber).toEqual('');
    expect(store.leadCaseCourt).toEqual('');
    expect(setLeadCaseSpy).toHaveBeenCalledWith(newLeadCase);
    expect(setLeadCaseIdSpy).toHaveBeenCalledWith(newLeadCase.caseId);

    // select the same case as lead case
    useCase.handleMarkLeadCase(newLeadCase);

    expect(setLeadCaseSpy).toHaveBeenCalledWith(null);
    expect(setLeadCaseIdSpy).toHaveBeenCalledWith('');
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

  test('should set isDataEnhanced to false if call for associations fails on handleOnExpand', async () => {
    const assignmentsSpy = vi.spyOn(Api2, 'getCaseAssignments');
    const associationsSpy = vi.spyOn(Api2, 'getCaseAssociations').mockRejectedValue(new Error());

    await useCase.handleOnExpand();
    expect(onExpand.mock.calls[0][0]).toEqual(`order-list-${mockOrder.id}`);
    expect(assignmentsSpy.mock.calls[0][0]).toEqual(mockOrder.childCases[0].caseId);
    expect(assignmentsSpy.mock.calls[1][0]).toEqual(mockOrder.childCases[1].caseId);
    expect(associationsSpy.mock.calls[0][0]).toEqual(mockOrder.childCases[0].caseId);
    expect(associationsSpy.mock.calls[1][0]).toEqual(mockOrder.childCases[1].caseId);
    expect(store.isDataEnhanced).toBeFalsy();
  }, 10000);

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

  test('should return a valid case if case is not already consolidated and is not the child of another consolidation', async () => {
    const setIsValidatingSpy = vi.spyOn(store, 'setIsLookingForCase');
    const setAddCaseNumberErrorSpy = vi.spyOn(store, 'setAddCaseNumberError');
    const setCaseToAddSpy = vi.spyOn(store, 'setCaseToAdd');

    const caseSummary = MockData.getCaseSummary();
    const summaryResponse: ResponseBody<CaseSummary> =
      MockData.getNonPaginatedResponseBody<CaseSummary>(caseSummary);
    const getCaseSummarySpy = vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue(summaryResponse);

    const associationsResponse: ResponseBody<Consolidation[]> = MockData.getPaginatedResponseBody<
      Consolidation[]
    >([]);
    const getCaseAssociationsSpy = vi
      .spyOn(Api2, 'getCaseAssociations')
      .mockResolvedValue(associationsResponse);

    const getCaseAssignmentsSpy = vi.spyOn(Api2, 'getCaseAssignments');

    setupAddCase();
    useCase.verifyCaseCanBeAdded();
    useCase.handleAddCaseAction();
    expect(setIsValidatingSpy).toHaveBeenCalledWith(true);
    expect(setCaseToAddSpy).toHaveBeenCalledWith(mockAddCase);
    expect(setAddCaseNumberErrorSpy).toHaveBeenCalledWith('');
    expect(getCaseSummarySpy).toHaveBeenCalledWith(mockAddCase.caseId);
    expect(getCaseAssociationsSpy).toHaveBeenCalledWith(mockAddCase.caseId);
    expect(getCaseAssignmentsSpy).toHaveBeenCalledWith(mockAddCase.caseId);
  });

  test('should display an alert if case is already included in the consolidation', async () => {
    const setIsValidatingSpy = vi.spyOn(store, 'setIsLookingForCase');
    const setAddCaseNumberErrorSpy = vi.spyOn(store, 'setAddCaseNumberError');
    const setCaseToAddSpy = vi.spyOn(store, 'setCaseToAdd');

    const caseSummary = MockData.getCaseSummary();
    const summaryResponse: ResponseBody<CaseSummary> =
      MockData.getNonPaginatedResponseBody<CaseSummary>(caseSummary);
    const getCaseSummarySpy = vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue(summaryResponse);

    const associationsResponse: ResponseBody<Consolidation[]> = MockData.getPaginatedResponseBody<
      Consolidation[]
    >([]);
    const getCaseAssociationsSpy = vi
      .spyOn(Api2, 'getCaseAssociations')
      .mockResolvedValue(associationsResponse);

    const getCaseAssignmentsSpy = vi.spyOn(Api2, 'getCaseAssignments');

    store.order = MockData.getConsolidationOrder();
    store.order.childCases.push(mockAddCase);
    setupAddCase();
    useCase.verifyCaseCanBeAdded();

    expect(setIsValidatingSpy).toHaveBeenCalledWith(false);
    expect(setCaseToAddSpy).toHaveBeenCalledWith(mockAddCase);
    expect(setAddCaseNumberErrorSpy).toHaveBeenCalledWith(
      'This case is already included in the consolidation.',
    );
    expect(getCaseSummarySpy).not.toHaveBeenCalled();
    expect(getCaseAssociationsSpy).not.toHaveBeenCalled();
    expect(getCaseAssignmentsSpy).not.toHaveBeenCalled();
  });

  test('should add case to store.order.childCases when handleAddCaseAction is called an store.caseToAdd is set', async () => {
    store.setCaseToAdd(mockAddCase);
    expect(store.order.childCases).not.toContain(mockAddCase);

    useCase.handleAddCaseAction();
    expect(store.order.childCases).toContain(mockAddCase);
  });

  test('should set selected cases', () => {
    expect(store.selectedCases).toEqual([]);
    const selections = MockData.buildArray(MockData.getConsolidatedOrderCase, 3);
    useCase.updateAllSelections(selections);
    expect(store.selectedCases).toEqual(selections);
    expect(store.selectedCases.length).toEqual(3);
    selections.push(MockData.getConsolidatedOrderCase());
    useCase.updateAllSelections(selections);
    expect(store.selectedCases).toEqual(selections);
    expect(store.selectedCases.length).toEqual(4);
  });

  test('should disable approve button and enable reject button if any selected cases are already consolidated', () => {
    const disableButtonSpy = vi.spyOn(controls, 'disableButton');
    store.setIsDataEnhanced(true);
    setupAddCase();
    store.setConsolidationType('administrative');
    const cases = [
      MockData.getConsolidatedOrderCase({
        override: { associations: MockData.buildArray(MockData.getConsolidation, 3) },
      }),
      MockData.getConsolidatedOrderCase(),
      MockData.getConsolidatedOrderCase(),
    ];
    store.setSelectedCases(cases);
    useCase.updateSubmitButtonsState();
    expect(disableButtonSpy).toHaveBeenCalledWith(controls.rejectButton, false);
    expect(disableButtonSpy).toHaveBeenCalledWith(controls.approveButton, true);
    expect(disableButtonSpy).not.toHaveBeenCalledWith(controls.approveButton, false);
  });

  test('areAnySelectedCasesConsolidated should return false if none of the selected case is consolidated', async () => {
    const disableButtonSpy = vi.spyOn(controls, 'disableButton');
    const selections = MockData.buildArray(MockData.getConsolidatedOrderCase, 3);
    store.setIsDataEnhanced(true);
    store.setLeadCaseId('12-34567');
    store.setConsolidationType('administrative');
    useCase.updateAllSelections(selections);
    useCase.updateSubmitButtonsState();
    expect(disableButtonSpy).toHaveBeenCalledWith(controls.approveButton, false);
  });

  test('should set case number to add if handleAddCaseNumberInputChange is supplied a case number', async () => {
    const disableButtonSpy = vi.spyOn(controls, 'disableButton');
    store.setCaseToAddCaseNumber('');
    expect(store.caseToAddCaseNumber).toEqual('');
    const bCase = MockData.getConsolidatedOrderCase();
    const newCaseNumber = '11-11111';
    store.setCaseToAdd(bCase);
    expect(store.caseToAdd).toEqual(bCase);
    useCase.handleAddCaseNumberInputChange(newCaseNumber);

    expect(store.caseToAdd).toEqual(bCase);
    expect(store.caseToAddCaseNumber).toEqual(newCaseNumber);
    expect(disableButtonSpy).not.toHaveBeenCalled();
  });

  test('should clear case number and case to add, and disable button if handleAddCaseNumberInputChange not supplied a case number', async () => {
    const oldCaseNumber = '11-11111';
    store.setCaseToAddCaseNumber(oldCaseNumber);
    expect(store.caseToAddCaseNumber).toEqual(oldCaseNumber);
    const bCase = MockData.getConsolidatedOrderCase();
    store.setCaseToAdd(bCase);
    expect(store.caseToAdd).toEqual(bCase);
    useCase.handleAddCaseNumberInputChange();

    expect(store.caseToAdd).toBeNull();
    expect(store.caseToAddCaseNumber).toEqual('');
  });

  test('handleAddCaseCourtSelectChange should update store.setCaseToAddCourt when a value is supplied', async () => {
    const disableButtonSpy = vi.spyOn(controls, 'disableButton');
    const originalCourt = 'old court';
    const newCourt = 'new court';
    store.setCaseToAddCourt(originalCourt);
    expect(store.caseToAddCourt).toEqual(originalCourt);
    const bCase = MockData.getConsolidatedOrderCase();
    store.setCaseToAdd(bCase);
    expect(store.caseToAdd).toEqual(bCase);

    useCase.handleAddCaseCourtSelectChange([{ label: 'foo', value: newCourt }]);
    expect(store.caseToAddCourt).toEqual(newCourt);
    expect(store.caseToAdd).toEqual(bCase);
    expect(disableButtonSpy).not.toHaveBeenCalled();
  });

  test('handleAddCaseCourtSelectChange should clear store.caseToAddCourt, store.caseToAdd, and disable approveButton when a value is not supplied', async () => {
    const originalCourt = 'old court';
    store.setCaseToAddCourt(originalCourt);
    expect(store.caseToAddCourt).toEqual(originalCourt);
    const bCase = MockData.getConsolidatedOrderCase();
    store.setCaseToAdd(bCase);
    expect(store.caseToAdd).toEqual(bCase);

    useCase.handleAddCaseCourtSelectChange([]);
    expect(store.caseToAddCourt).toEqual('');
    expect(store.caseToAdd).toBeNull();
  });

  test('should throw if lead case is a child in any other consolidation', () => {
    const caseId = '120-23-12345';
    const documentType = 'CONSOLIDATION_TO';
    const data = [
      MockData.getConsolidation({ override: { caseId, documentType } }),
      MockData.getConsolidation(),
    ];
    const response: ResponseBody<Consolidation[]> =
      MockData.getNonPaginatedResponseBody<Consolidation[]>(data);

    store.setConsolidationType(data[0].consolidationType);
    expect(() => useCase.handleCaseAssociationResponse(response, caseId)).toThrow(Error);
  });

  test('should return consolidations if lead case is already a lead for the same type of consolidation', () => {
    const caseId = '120-23-12345';
    const documentType = 'CONSOLIDATION_FROM';
    const data = MockData.buildArray(
      () =>
        MockData.getConsolidation({
          override: {
            caseId,
            documentType,
          },
        }),
      3,
    );
    const response: ResponseBody<Consolidation[]> =
      MockData.getNonPaginatedResponseBody<Consolidation[]>(data);

    store.setConsolidationType(data[0].consolidationType);
    const associations = useCase.handleCaseAssociationResponse(response, caseId);
    expect(associations).toEqual(data);
  });

  test.skip('should throw if lead case is already a lead for the other type of consolidation', () => {
    const caseId = '120-23-12345';
    const documentType = 'CONSOLIDATION_FROM';
    const consolidationType = 'substantive';
    const data = MockData.buildArray(
      () =>
        MockData.getConsolidation({
          override: {
            caseId,
            consolidationType,
            documentType,
          },
        }),
      3,
    );
    const response: ResponseBody<Consolidation[]> =
      MockData.getNonPaginatedResponseBody<Consolidation[]>(data);

    store.setConsolidationType('administrative');
    expect(() => useCase.handleCaseAssociationResponse(response, caseId)).toThrow(Error);
  });

  const params = [
    { message: '404 Not Found', expected: `We couldn't find a case with that number.` },
    { message: '', expected: 'Cannot verify case number.' },
  ];

  test.each(params)(
    'should display alert when case summary can not be retrieved',
    async (params) => {
      const associationResponse: ResponseBody<Consolidation[]> =
        MockData.getNonPaginatedResponseBody<Consolidation[]>([]);
      const assignmentResponse: ResponseBody<CaseAssignment[]> =
        MockData.getNonPaginatedResponseBody<CaseAssignment[]>([]);

      vi.spyOn(Api2, 'getCaseSummary').mockRejectedValue({ message: params.message });
      vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue(associationResponse);
      vi.spyOn(Api2, 'getCaseAssignments').mockResolvedValue(assignmentResponse);

      store.caseToAddCourt = '101';
      store.caseToAddCaseNumber = '23-12345';

      useCase.verifyCaseCanBeAdded();

      await nonReactWaitFor(() => {
        return store.addCaseNumberError?.length != 0 && !store.foundValidCaseNumber;
      });

      expect(store.addCaseNumberError).toEqual(params.expected);
      expect(store.isLookingForCase).toBe(false);
      expect(store.foundValidCaseNumber).toBe(false);
    },
  );

  test('should display alert when case associations cannot be retrieved', async () => {
    const caseSummaryResponse: ResponseBody<CaseSummary> =
      MockData.getNonPaginatedResponseBody<CaseSummary>(MockData.getCaseSummary());
    const assignmentsResponse: ResponseBody<CaseAssignment[]> =
      MockData.getNonPaginatedResponseBody<CaseAssignment[]>([]);

    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue(caseSummaryResponse);
    vi.spyOn(Api2, 'getCaseAssignments').mockResolvedValue(assignmentsResponse);
    vi.spyOn(Api2, 'getCaseAssociations').mockRejectedValue({ message: 'some server error' });

    store.caseToAddCourt = '101';
    store.caseToAddCaseNumber = '23-12345';

    useCase.verifyCaseCanBeAdded();

    await nonReactWaitFor(() => {
      return store.addCaseNumberError?.length != 0 && !store.foundValidCaseNumber;
    });

    expect(store.addCaseNumberError).toEqual('some server error');
    expect(store.isLookingForCase).toBe(false);
    expect(store.foundValidCaseNumber).toBe(false);
  });

  test('should display alert when case assignments cannot be retrieved', async () => {
    const associationResponse: ResponseBody<Consolidation[]> = MockData.getNonPaginatedResponseBody<
      Consolidation[]
    >([]);
    const caseSummaryResponse: ResponseBody<CaseSummary> =
      MockData.getNonPaginatedResponseBody<CaseSummary>(MockData.getCaseSummary());

    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue(caseSummaryResponse);
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue(associationResponse);
    vi.spyOn(Api2, 'getCaseAssignments').mockRejectedValue({ message: 'some server error' });

    store.caseToAddCourt = '101';
    store.caseToAddCaseNumber = '23-12345';

    useCase.verifyCaseCanBeAdded();

    await nonReactWaitFor(() => {
      return store.addCaseNumberError?.length != 0 && !store.foundValidCaseNumber;
    });

    expect(store.addCaseNumberError).toEqual('Cannot verify case assignments. some server error');
    expect(store.isLookingForCase).toBe(false);
    expect(store.foundValidCaseNumber).toBe(false);
  });

  test('should disable the verify button if a lead case and at least one child case are not selected', async () => {
    const disableButtonSpy = vi.spyOn(controls.approveButton.current!, 'disableButton');
    const leadCase = MockData.getConsolidatedOrderCase();
    store.setLeadCase(leadCase);
    store.setLeadCaseId(leadCase.caseId);
    store.setConsolidationType('administrative');
    store.setSelectedCases([leadCase]);
    useCase.updateSubmitButtonsState();
    expect(disableButtonSpy).toHaveBeenCalled();
  });

  test('should disable the verify button if a selected child case is a lead case for another consolidation', async () => {
    const disableButtonSpy = vi.spyOn(controls.approveButton.current!, 'disableButton');
    const leadCase = MockData.getConsolidatedOrderCase();
    store.setLeadCase(leadCase);
    store.setConsolidationType('administrative');
    const selectedCases = MockData.buildArray(MockData.getConsolidatedOrderCase, 4);
    selectedCases[0].associations?.push(MockData.getConsolidationFrom());
    store.setSelectedCases(selectedCases);
    useCase.updateSubmitButtonsState();
    expect(disableButtonSpy).toHaveBeenCalled();
  });

  test('should disable the verify button if a selected child case is already a part of another consolidation', async () => {
    const disableButtonSpy = vi.spyOn(controls.approveButton.current!, 'disableButton');
    const leadCase = MockData.getConsolidatedOrderCase();
    store.setLeadCase(leadCase);
    store.setLeadCaseId(leadCase.caseId);
    store.setConsolidationType('administrative');
    store.setIsDataEnhanced(true);
    const selectedCases = MockData.buildArray(MockData.getConsolidatedOrderCase, 4);
    selectedCases[0].associations?.push(MockData.getConsolidationTo());
    store.setSelectedCases(selectedCases);
    useCase.updateSubmitButtonsState();
    expect(disableButtonSpy).toHaveBeenCalled();
  });

  const approvalAlerts = [{ success: true }, { success: false }];
  test.each(approvalAlerts)('should process approved consolidation', async ({ success }) => {
    const action: ConfirmActionResults = {
      status: 'approved',
    };
    const leadCase = MockData.getConsolidatedOrderCase();
    store.setLeadCase(leadCase);
    store.setConsolidationType('administrative');
    store.setSelectedCases(MockData.buildArray(MockData.getConsolidatedOrderCase, 4));
    const consolidationOrders = [
      MockData.getConsolidationOrder({ override: { leadCase, status: 'approved' } }),
    ];
    const order = MockData.getConsolidationOrder();
    store.setOrder(order);
    let putSpy;
    if (success) {
      putSpy = vi
        .spyOn(Api2, 'putConsolidationOrderApproval')
        .mockResolvedValue({ data: consolidationOrders });
    } else {
      putSpy = vi
        .spyOn(Api2, 'putConsolidationOrderApproval')
        .mockRejectedValue('some server error');
    }
    const expectedSuccessfulAlert = {
      message: `Consolidation to lead case ${getCaseNumber(leadCase.caseId)} in ${
        leadCase.courtName
      } (${leadCase.courtDivisionName}) was successful.`,
      type: UswdsAlertStyle.Success,
      timeOut: 8,
    };
    const expectedFailureAlert = {
      message: 'An unknown error has occurred and has been logged.  Please try again later.',
      type: UswdsAlertStyle.Error,
      timeOut: 8,
    };

    const expectedAlert = success ? expectedSuccessfulAlert : expectedFailureAlert;
    useCase.handleConfirmAction(action);

    expect(putSpy).toHaveBeenCalled();

    await nonReactWaitFor(() => {
      return onOrderUpdateSpy.mock.calls.length > 0;
    });
    if (success) {
      expect(onOrderUpdateSpy).toHaveBeenCalledWith(expectedAlert, consolidationOrders, order);
    } else {
      expect(onOrderUpdateSpy).toHaveBeenCalledWith(expectedAlert);
    }
  });

  const rejectedAlerts = [{ success: true }, { success: false }];
  test.each(rejectedAlerts)('should process rejected consolidation', async ({ success }) => {
    const action: ConfirmActionResults = {
      status: 'rejected',
    };
    store.setSelectedCases(MockData.buildArray(MockData.getConsolidatedOrderCase, 4));
    const consolidationOrders = [
      MockData.getConsolidationOrder({ override: { status: 'rejected' } }),
    ];
    const order = MockData.getConsolidationOrder();
    store.setOrder(order);
    let putSpy;
    if (success) {
      putSpy = vi
        .spyOn(Api2, 'putConsolidationOrderRejection')
        .mockResolvedValue({ data: consolidationOrders });
    } else {
      putSpy = vi
        .spyOn(Api2, 'putConsolidationOrderRejection')
        .mockRejectedValue('some server error');
    }
    const expectedSuccessfulAlert = {
      message: `Rejection of consolidation order was successful.`,
      type: UswdsAlertStyle.Success,
      timeOut: 8,
    };
    const expectedFailureAlert = {
      message: 'An unknown error has occurred and has been logged.  Please try again later.',
      type: UswdsAlertStyle.Error,
      timeOut: 8,
    };

    const expectedAlert = success ? expectedSuccessfulAlert : expectedFailureAlert;
    useCase.handleConfirmAction(action);

    expect(putSpy).toHaveBeenCalled();

    await nonReactWaitFor(() => {
      return onOrderUpdateSpy.mock.calls.length > 0;
    });
    if (success) {
      expect(onOrderUpdateSpy).toHaveBeenCalledWith(expectedAlert, consolidationOrders, order);
    } else {
      expect(onOrderUpdateSpy).toHaveBeenCalledWith(expectedAlert);
    }
  });
});
