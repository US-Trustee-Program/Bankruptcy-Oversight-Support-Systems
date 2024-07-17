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
import { ResponseBodySuccess } from '@common/api/response';
import { Consolidation } from '@common/cams/events';
import { CaseAssignment } from '@common/cams/assignments';
import { CaseSummary } from '@common/cams/cases';
import { ConfirmActionResults } from './ConsolidationOrderModal';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

function waitFor(condition: () => boolean, timeout = 5000, interval = 50): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkCondition = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime >= timeout) {
        reject(new Error('waitFor timed out'));
      } else {
        setTimeout(checkCondition, interval);
      }
    };

    checkCondition();
  });
}

describe('Consolidation UseCase tests', () => {
  let store: ConsolidationStore;
  let controls: ConsolidationControls;
  let useCase: ConsolidationsUseCase;
  const onExpand = vi.fn();

  const mockLeadCase = MockData.getConsolidatedOrderCase();
  const mockOrder = MockData.getConsolidationOrder();
  const onOrderUpdateSpy = vi.fn();

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
      onOrderUpdate: onOrderUpdateSpy,
      onExpand,
    };

    store = new ConsolidationStoreMock(props, []);
    controls = useConsolidationControlsMock();

    useCase = consolidationUseCase(store, controls, props.onOrderUpdate, props.onExpand);
  }

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    vi.resetModules();
    await import('@/lib/hooks/UseApi2');
    initUseCase();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  test('should properly handle handleClearInputs', () => {
    const clearAllCheckBoxesSpy = vi.spyOn(controls, 'clearAllCheckBoxes');
    const unsetConsolidationTypeSpy = vi.spyOn(controls, 'unsetConsolidationType');
    const showLeadCaseFormSpy = vi.spyOn(store, 'setShowLeadCaseForm');

    setupLeadCase();

    store.setFoundValidCaseNumber(true);
    store.setShowLeadCaseForm(true);
    store.setSelectedCases(MockData.buildArray(MockData.getConsolidatedOrderCase, 3));
    useCase.handleClearInputs();
    expectClearLeadCase();
    expect(clearAllCheckBoxesSpy).toHaveBeenCalled();
    expect(unsetConsolidationTypeSpy).toHaveBeenCalled();
    expect(showLeadCaseFormSpy).toHaveBeenCalledWith(false);
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
    const putSpy = vi.spyOn(Chapter15MockApi, 'put').mockRejectedValue('some put error');
    const action: ConfirmActionResults = {
      status: 'rejected',
      rejectionReason: 'some rejection reason',
    };
    store.order = MockData.getConsolidationOrder();
    store.selectedCases = MockData.buildArray(MockData.getConsolidatedOrderCase, 3);
    store.setIsProcessing(true);

    useCase.handleConfirmAction(action);

    await waitFor(() => {
      return store.isProcessing === false;
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
    const summaryResponse: ResponseBodySuccess<CaseSummary> =
      MockData.getNonPaginatedResponseBodySuccess<CaseSummary>(caseSummary);
    const getCaseSummarySpy = vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue(summaryResponse);

    const associationsResponse: ResponseBodySuccess<Consolidation[]> =
      MockData.getPaginatedResponseBodySuccess<Consolidation[]>([]);
    const getCaseAssociationsSpy = vi
      .spyOn(Api2, 'getCaseAssociations')
      .mockResolvedValue(associationsResponse);

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
    setupLeadCase();
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

  test('should throw if lead case is a child in any other consolidation', () => {
    const caseId = '120-23-12345';
    const documentType = 'CONSOLIDATION_TO';
    const data = [
      MockData.getConsolidation({ override: { caseId, documentType } }),
      MockData.getConsolidation(),
    ];
    const response: ResponseBodySuccess<Consolidation[]> =
      MockData.getNonPaginatedResponseBodySuccess<Consolidation[]>(data);

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
    const response: ResponseBodySuccess<Consolidation[]> =
      MockData.getNonPaginatedResponseBodySuccess<Consolidation[]>(data);

    store.setConsolidationType(data[0].consolidationType);
    const associations = useCase.handleCaseAssociationResponse(response, caseId);
    expect(associations).toEqual(data);
  });

  test('should throw if lead case is already a lead for the other type of consolidation', () => {
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
    const response: ResponseBodySuccess<Consolidation[]> =
      MockData.getNonPaginatedResponseBodySuccess<Consolidation[]>(data);

    store.setConsolidationType('administrative');
    expect(() => useCase.handleCaseAssociationResponse(response, caseId)).toThrow(Error);
  });

  const params = [
    { message: '404 Not Found', expected: `We couldn't find a case with that number.` },
    { message: '', expected: 'Cannot verify lead case number.' },
  ];

  test.each(params)(
    'should display alert when case summary can not be retrieved',
    async (params) => {
      const associationResponse: ResponseBodySuccess<Consolidation[]> =
        MockData.getNonPaginatedResponseBodySuccess<Consolidation[]>([]);
      const assignmentResponse: ResponseBodySuccess<CaseAssignment[]> =
        MockData.getNonPaginatedResponseBodySuccess<CaseAssignment[]>([]);

      vi.spyOn(Api2, 'getCaseSummary').mockRejectedValue({ message: params.message });
      vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue(associationResponse);
      vi.spyOn(Api2, 'getCaseAssignments').mockResolvedValue(assignmentResponse);

      store.leadCaseCourt = '101';
      store.leadCaseNumber = '23-12345';

      useCase.getValidLeadCase();

      await waitFor(() => {
        return store.leadCaseNumberError.length != 0 && store.foundValidCaseNumber === false;
      });

      expect(store.leadCaseNumberError).toEqual(params.expected);
      expect(store.isValidatingLeadCaseNumber).toBe(false);
      expect(store.foundValidCaseNumber).toBe(false);
    },
  );

  test('should display alert when case associations cannot be retrieved', async () => {
    const caseSummaryResponse: ResponseBodySuccess<CaseSummary> =
      MockData.getNonPaginatedResponseBodySuccess<CaseSummary>(MockData.getCaseSummary());
    const assignmentsResponse: ResponseBodySuccess<CaseAssignment[]> =
      MockData.getNonPaginatedResponseBodySuccess<CaseAssignment[]>([]);

    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue(caseSummaryResponse);
    vi.spyOn(Api2, 'getCaseAssignments').mockResolvedValue(assignmentsResponse);
    vi.spyOn(Api2, 'getCaseAssociations').mockRejectedValue({ message: 'some server error' });

    store.leadCaseCourt = '101';
    store.leadCaseNumber = '23-12345';

    useCase.getValidLeadCase();

    await waitFor(() => {
      return store.leadCaseNumberError.length != 0 && store.foundValidCaseNumber === false;
    });

    expect(store.leadCaseNumberError).toEqual(
      'Cannot verify lead case is not part of another consolidation. some server error',
    );
    expect(store.isValidatingLeadCaseNumber).toBe(false);
    expect(store.foundValidCaseNumber).toBe(false);
  });

  test('should display alert when case assignments cannot be retrieved', async () => {
    const associationResponse: ResponseBodySuccess<Consolidation[]> =
      MockData.getNonPaginatedResponseBodySuccess<Consolidation[]>([]);
    const caseSummaryResponse: ResponseBodySuccess<CaseSummary> =
      MockData.getNonPaginatedResponseBodySuccess<CaseSummary>(MockData.getCaseSummary());

    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue(caseSummaryResponse);
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue(associationResponse);
    vi.spyOn(Api2, 'getCaseAssignments').mockRejectedValue({ message: 'some server error' });

    store.leadCaseCourt = '101';
    store.leadCaseNumber = '23-12345';

    useCase.getValidLeadCase();

    await waitFor(() => {
      return store.leadCaseNumberError.length != 0 && store.foundValidCaseNumber === false;
    });

    expect(store.leadCaseNumberError).toEqual(
      'Cannot verify lead case assignments. some server error',
    );
    expect(store.isValidatingLeadCaseNumber).toBe(false);
    expect(store.foundValidCaseNumber).toBe(false);
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
        .spyOn(Chapter15MockApi, 'put')
        .mockResolvedValue({ message: '', count: 1, body: consolidationOrders });
    } else {
      putSpy = vi.spyOn(Chapter15MockApi, 'put').mockRejectedValue('some server error');
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

    await waitFor(() => {
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
        .spyOn(Chapter15MockApi, 'put')
        .mockResolvedValue({ message: '', count: 1, body: consolidationOrders });
    } else {
      putSpy = vi.spyOn(Chapter15MockApi, 'put').mockRejectedValue('some server error');
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

    await waitFor(() => {
      return onOrderUpdateSpy.mock.calls.length > 0;
    });
    if (success) {
      expect(onOrderUpdateSpy).toHaveBeenCalledWith(expectedAlert, consolidationOrders, order);
    } else {
      expect(onOrderUpdateSpy).toHaveBeenCalledWith(expectedAlert);
    }
  });
});
