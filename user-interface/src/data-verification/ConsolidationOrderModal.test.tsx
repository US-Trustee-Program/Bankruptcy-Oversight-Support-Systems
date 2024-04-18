import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  ConsolidationOrderModal,
  ConfirmationModalImperative,
  ConsolidationOrderModalProps,
  formatListforDisplay,
  getCaseAssignments,
  fetchLeadCaseAttorneys,
  getUniqueDivisionCodeOrUndefined,
  getCaseAssociations,
} from '@/data-verification/ConsolidationOrderModal';
import { BrowserRouter } from 'react-router-dom';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { selectItemInMockSelect } from '@/lib/components/CamsSelect.mock';
import { CaseAssignmentResponseData } from '@/lib/type-declarations/chapter-15';
import { CaseAssignment } from '@common/cams/assignments';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { SimpleResponseData } from '@/lib/type-declarations/api';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { CaseSummary } from '@common/cams/cases';
import { Consolidation } from '@common/cams/events';

vi.mock('../lib/components/CamsSelect', () => import('../lib/components/CamsSelect.mock'));

describe('ConsolidationOrderModalComponent', () => {
  const onCancelSpy = vitest.fn();
  const onConfirmSpy = vitest.fn();

  function findCaseNumberInputInModal(id: string) {
    const caseIdInput = document.querySelector(`input#lead-case-input-${id}`);
    expect(caseIdInput).toBeInTheDocument();
    return caseIdInput;
  }

  function enterCaseNumberInModal(caseIdInput: Element | null | undefined, value: string) {
    if (!caseIdInput) throw Error();

    fireEvent.change(caseIdInput!, { target: { value } });
  }

  function renderModalWithProps(props: Partial<ConsolidationOrderModalProps> = {}) {
    const modalRef = React.createRef<ConfirmationModalImperative>();
    const defaultProps: ConsolidationOrderModalProps = {
      id: 'mock-modal-id',
      onCancel: onCancelSpy,
      onConfirm: onConfirmSpy,
      courts: [],
    };

    const renderProps = { ...defaultProps, ...props };

    render(
      <BrowserRouter>
        <ConsolidationOrderModal {...renderProps} ref={modalRef} />
      </BrowserRouter>,
    );
    return modalRef;
  }

  beforeEach(() => {
    vitest.resetAllMocks();
  });

  test('should allow user to reject a consolidation', async () => {
    const id = 'test';
    const cases = MockData.buildArray(MockData.getCaseSummary, 2);

    const onConfirmSpy = vitest.fn();
    const onCancelSpy = vitest.fn();

    // Render and activate the modal.
    const ref = renderModalWithProps({ id, onConfirm: onConfirmSpy, onCancel: onCancelSpy });
    await waitFor(() => {
      ref.current?.show({ status: 'rejected', cases });
    });

    // Check heading
    const heading = document.querySelector('.usa-modal__heading');
    expect(heading).toHaveTextContent('Reject Case Consolidation?');

    // Check case Ids
    const caseIdDiv = screen.getByTestId(`modal-case-list-container`);
    cases.forEach((bCase) => {
      expect(caseIdDiv).toHaveTextContent(getCaseNumber(bCase.caseId));
    });

    const rejectionReasonText = screen.getByTestId(`rejection-reason-input-${id}`);
    expect(rejectionReasonText).toBeVisible();
    expect(rejectionReasonText).not.toBeDisabled();
    const rejectionTextValue = 'This is a test';
    fireEvent.change(rejectionReasonText, { target: { value: rejectionTextValue } });

    const rejectButton = screen.getByTestId(`button-${id}-submit-button`);
    expect(rejectButton).toBeVisible();
    expect(rejectButton).not.toBeDisabled();
    fireEvent.click(rejectButton!);
    expect(onConfirmSpy).toHaveBeenCalledWith({
      status: 'rejected',
      rejectionReason: rejectionTextValue,
    });

    await waitFor(() => {
      ref.current?.show({ status: 'rejected', cases });
    });
    const cancelButton = screen.getByTestId(`button-${id}-cancel-button`);
    expect(cancelButton).toBeVisible();
    expect(cancelButton).not.toBeDisabled();
    fireEvent.click(cancelButton!);
    expect(onCancelSpy).toHaveBeenCalled();
  });

  test('should allow user to approve a consolidation', async () => {
    const id = 'test';
    const childCases = MockData.buildArray(MockData.getCaseSummary, 2);
    const courts = MockData.getOffices().slice(0, 3);

    const leadCase = MockData.getCaseSummary();
    const leadCaseResponse: SimpleResponseData<CaseSummary> = {
      success: true,
      body: leadCase,
    };
    const assignmentResponse: SimpleResponseData<CaseAssignment[]> = {
      success: true,
      body: MockData.buildArray(MockData.getAttorneyAssignment, 2),
    };
    const associatedCasesResponse: SimpleResponseData<Consolidation[]> = {
      success: true,
      body: [],
    };

    // Setup API calls to fetch the lead case summary and lead case assignments.
    vitest
      .spyOn(Chapter15MockApi, 'get')
      .mockResolvedValueOnce(leadCaseResponse)
      .mockResolvedValueOnce(associatedCasesResponse)
      .mockResolvedValueOnce(assignmentResponse);

    // Render and activate the modal.
    const ref = renderModalWithProps({ id, courts });
    await waitFor(() => {
      ref.current?.show({ status: 'approved', cases: childCases });
    });

    const modal = screen.getByTestId('modal-test');
    expect(modal).toHaveClass('is-visible');

    const continueButton = screen.getByTestId(`button-${id}-submit-button`);
    expect(continueButton).toBeDisabled();

    // Check the first heading.
    const firstHeading = document.querySelector('.usa-modal__heading');
    expect(firstHeading).toHaveTextContent('Additional Consolidation Information');

    // Select consolidation type
    const radioAdministrative = screen.queryByTestId(`radio-administrative-${id}`);
    const radioSubstantive = screen.queryByTestId(`radio-substantive-${id}`);

    const radioSubstantiveClickTarget = screen.queryByTestId(
      `radio-substantive-${id}-click-target`,
    );

    expect(radioAdministrative).toBeInTheDocument();
    expect(radioSubstantive).toBeInTheDocument();

    fireEvent.click(radioSubstantiveClickTarget!);

    expect(continueButton).toBeDisabled();

    // Select lead case court.
    selectItemInMockSelect(`lead-case-court`, 1);

    expect(continueButton).toBeDisabled();

    // Enter case number.
    const leadCaseNumber = getCaseNumber(childCases[0].caseId);
    const caseNumberInput = findCaseNumberInputInModal(id);
    await waitFor(() => {
      enterCaseNumberInModal(caseNumberInput, '12-');
    });
    await waitFor(() => {
      enterCaseNumberInModal(caseNumberInput, leadCaseNumber);
    });

    await waitFor(() => {
      expect(caseNumberInput).toHaveValue(leadCaseNumber);
    });

    await waitFor(() => {
      expect(continueButton).toBeEnabled();
    });
    fireEvent.click(continueButton);

    await waitFor(() => {
      const secondHeading = document.querySelector('.usa-modal__heading');
      expect(secondHeading).toHaveTextContent('Consolidate Cases');
    });

    const verifyButton = screen.getByTestId(`button-${id}-submit-button`);
    expect(verifyButton).toBeEnabled();
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(modal).toHaveClass('is-hidden');
    });

    expect(onConfirmSpy).toHaveBeenCalledWith({
      status: 'approved',
      rejectionReason: undefined,
      leadCaseSummary: leadCase,
      consolidationType: 'substantive',
    });

    await waitFor(() => {
      ref.current?.show({ status: 'approved', cases: childCases });
    });
    const cancelButton = screen.getByTestId(`button-${id}-cancel-button`);
    expect(cancelButton).toBeVisible();
    expect(cancelButton).not.toBeDisabled();
    fireEvent.click(cancelButton!);
    expect(onCancelSpy).toHaveBeenCalled();
  });

  test('should show an error if the lead case does not exist', async () => {
    const id = 'test';
    const childCases = MockData.buildArray(MockData.getCaseSummary, 2);
    const courts = MockData.getOffices().slice(0, 3);

    // Render and activate the modal.
    const ref = renderModalWithProps({ id, courts });
    await waitFor(() => {
      ref.current?.show({ status: 'approved', cases: childCases });
    });

    const continueButton = screen.getByTestId(`button-${id}-submit-button`);
    expect(continueButton).toBeDisabled();

    const radioSubstantiveClickTarget = screen.queryByTestId(
      `radio-substantive-${id}-click-target`,
    );
    fireEvent.click(radioSubstantiveClickTarget!);

    // Select lead case court.
    selectItemInMockSelect(`lead-case-court`, 1);

    let errorMessage;
    const leadCaseNumber = '11-11111';
    const caseNumberInput = findCaseNumberInputInModal(id);

    vitest.spyOn(Chapter15MockApi, 'get').mockRejectedValueOnce(new Error('404 Error'));

    // Test the 404 case.
    await waitFor(() => {
      enterCaseNumberInModal(caseNumberInput, leadCaseNumber);
    });
    await waitFor(() => {
      errorMessage = screen.queryByTestId('alert-message');
    });
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveTextContent('Lead case not found.');
    expect(continueButton).toBeDisabled();
  });

  test('should show an error if the lead case cannot be verified', async () => {
    const id = 'test';
    const childCases = MockData.buildArray(MockData.getCaseSummary, 2);
    const courts = MockData.getOffices().slice(0, 3);

    // Render and activate the modal.
    const ref = renderModalWithProps({ id, courts });
    await waitFor(() => {
      ref.current?.show({ status: 'approved', cases: childCases });
    });

    const continueButton = screen.getByTestId(`button-${id}-submit-button`);
    expect(continueButton).toBeDisabled();

    const radioSubstantiveClickTarget = screen.queryByTestId(
      `radio-substantive-${id}-click-target`,
    );
    fireEvent.click(radioSubstantiveClickTarget!);

    // Select lead case court.
    selectItemInMockSelect(`lead-case-court`, 1);

    let errorMessage;
    const leadCaseNumber = '11-11111';
    const caseNumberInput = findCaseNumberInputInModal(id);

    vitest.spyOn(Chapter15MockApi, 'get').mockRejectedValueOnce(new Error('500 Error'));

    // Test error other than 404.
    await waitFor(() => {
      enterCaseNumberInModal(caseNumberInput, leadCaseNumber);
    });
    await waitFor(() => {
      errorMessage = screen.queryByTestId('alert-message');
    });
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveTextContent('Cannot verify lead case number.');
    expect(continueButton).toBeDisabled();
  });

  test('should call onCancel callback when cancel button is clicked', async () => {
    const id = 'test';
    const cases = MockData.buildArray(MockData.getCaseSummary, 2);

    const ref = renderModalWithProps({ id });

    await waitFor(() => {
      ref.current?.show({ status: 'rejected', cases });
    });

    const button = screen.queryByTestId(`button-${id}-cancel-button`);
    fireEvent.click(button as Element);

    await waitFor(() => {
      expect(onCancelSpy).toHaveBeenCalled();
    });
  });

  test('should render Oxford comma for attorney list.', async () => {
    const nameList: string[] = [];

    const noNames = formatListforDisplay(nameList);
    expect(noNames).toEqual('(unassigned)');

    nameList.push('Abe');
    const oneName = formatListforDisplay(nameList);
    expect(oneName).toEqual('Abe');

    nameList.push('Ben');
    const twoNames = formatListforDisplay(nameList);
    expect(twoNames).toEqual('Abe and Ben');

    nameList.push('Charles');
    const threeNames = formatListforDisplay(nameList);
    expect(threeNames).toEqual('Abe, Ben, and Charles');
  });

  test('should return a unique division code or undefined', () => {
    const cases: CaseSummary[] = [];
    const expectedDivisionCode = '081';

    const noDivisionCodes = getUniqueDivisionCodeOrUndefined(cases);
    expect(noDivisionCodes).toBeUndefined();

    cases.push(MockData.getCaseSummary({ override: { courtDivisionCode: expectedDivisionCode } }));
    const oneDivisionCode = getUniqueDivisionCodeOrUndefined(cases);
    expect(oneDivisionCode).toEqual(expectedDivisionCode);

    cases.push(MockData.getCaseSummary({ override: { courtDivisionCode: expectedDivisionCode } }));
    const sameDivisionCode = getUniqueDivisionCodeOrUndefined(cases);
    expect(sameDivisionCode).toEqual(expectedDivisionCode);

    cases.push(MockData.getCaseSummary({ override: { courtDivisionCode: '999' } }));
    const differentDivisionCodes = getUniqueDivisionCodeOrUndefined(cases);
    expect(differentDivisionCodes).toBeUndefined();
  });

  test('should return case assignments from the api', async () => {
    const mockResponse: CaseAssignmentResponseData = {
      success: true,
      body: MockData.buildArray(MockData.getAttorneyAssignment, 3),
    };
    vitest.spyOn(Chapter15MockApi, 'get').mockResolvedValue(mockResponse);
    const response = await getCaseAssignments('leadCaseId');
    expect(response).toEqual(mockResponse.body);
  });

  test('should return names from the case assignments', async () => {
    const mockResponse: CaseAssignmentResponseData = {
      success: true,
      body: MockData.buildArray<CaseAssignment>(MockData.getAttorneyAssignment, 3),
    };
    const nameList = mockResponse.body.map((assignment) => assignment.name);
    vitest.spyOn(Chapter15MockApi, 'get').mockResolvedValue(mockResponse);
    const response = await fetchLeadCaseAttorneys('leadCaseId');
    expect(response).toEqual(nameList);
  });

  test('should get case associations', async () => {
    const mockResponse = {
      success: true,
      body: MockData.buildArray<Consolidation>(MockData.getConsolidationReference, 3),
    };
    vitest.spyOn(Chapter15MockApi, 'get').mockResolvedValue(mockResponse);
    const response = await getCaseAssociations('leadCaseId');
    expect(response).toEqual(mockResponse.body);
  });

  test('should show an alert if the lead case is a child case of another consolidation', async () => {
    const id = 'test';
    const childCases = MockData.buildArray(MockData.getCaseSummary, 2);
    const courts = MockData.getOffices().slice(0, 3);

    const leadCase = MockData.getCaseSummary();
    const leadCaseResponse: SimpleResponseData<CaseSummary> = {
      success: true,
      body: leadCase,
    };
    const assignmentResponse: SimpleResponseData<CaseAssignment[]> = {
      success: true,
      body: [],
    };
    const associatedCasesResponse: SimpleResponseData<Consolidation[]> = {
      success: true,
      body: [
        MockData.getConsolidationReference({
          override: { documentType: 'CONSOLIDATION_TO', caseId: leadCase.caseId },
        }),
      ],
    };

    // Setup API calls to fetch the lead case summary and lead case assignments.
    vitest
      .spyOn(Chapter15MockApi, 'get')
      .mockResolvedValueOnce(leadCaseResponse)
      .mockResolvedValueOnce(associatedCasesResponse)
      .mockResolvedValueOnce(assignmentResponse);

    // Render and activate the modal.
    const ref = renderModalWithProps({ id, courts });
    await waitFor(() => {
      ref.current?.show({ status: 'approved', cases: childCases });
    });

    const continueButton = screen.getByTestId(`button-${id}-submit-button`);

    // Select the consolidation type.
    const radioButton = screen.getByTestId(`radio-substantive-${id}-click-target`);
    fireEvent.click(radioButton);

    // Select lead case court.
    selectItemInMockSelect(`lead-case-court`, 1);

    // Enter case number.
    const leadCaseNumber = getCaseNumber(leadCase.caseId);
    const caseNumberInput = findCaseNumberInputInModal(id);
    await waitFor(() => {
      enterCaseNumberInModal(caseNumberInput, leadCaseNumber);
    });

    await waitFor(() => {
      expect(caseNumberInput).toHaveValue(leadCaseNumber);
    });

    const alertElement = screen.queryByTestId('alert-message');
    expect(alertElement).toHaveTextContent('Case is a child case of another consolidation.');
    expect(continueButton).not.toBeEnabled();
  });

  test('should show an alert if an API error occurs in the child case check', async () => {
    const id = 'test';
    const childCases = MockData.buildArray(MockData.getCaseSummary, 2);
    const courts = MockData.getOffices().slice(0, 3);

    const leadCase = MockData.getCaseSummary();
    const leadCaseResponse: SimpleResponseData<CaseSummary> = {
      success: true,
      body: leadCase,
    };
    const assignmentResponse: SimpleResponseData<CaseAssignment[]> = {
      success: true,
      body: [],
    };

    // Setup API calls to fetch the lead case summary and lead case assignments.
    vitest
      .spyOn(Chapter15MockApi, 'get')
      .mockResolvedValueOnce(leadCaseResponse)
      .mockRejectedValueOnce(new Error('Test error.'))
      .mockResolvedValueOnce(assignmentResponse);

    // Render and activate the modal.
    const ref = renderModalWithProps({ id, courts });
    await waitFor(() => {
      ref.current?.show({ status: 'approved', cases: childCases });
    });

    const continueButton = screen.getByTestId(`button-${id}-submit-button`);

    // Select the consolidation type.
    const radioButton = screen.getByTestId(`radio-substantive-${id}-click-target`);
    fireEvent.click(radioButton);

    // Select lead case court.
    selectItemInMockSelect(`lead-case-court`, 1);

    // Enter case number.
    const leadCaseNumber = getCaseNumber(leadCase.caseId);
    const caseNumberInput = findCaseNumberInputInModal(id);
    await waitFor(() => {
      enterCaseNumberInModal(caseNumberInput, leadCaseNumber);
    });

    await waitFor(() => {
      expect(caseNumberInput).toHaveValue(leadCaseNumber);
    });

    const alertElement = screen.queryByTestId('alert-message');
    expect(alertElement).toHaveTextContent(
      'Cannot verify lead case is not part of another consolidation. Test error.',
    );
    expect(continueButton).not.toBeEnabled();
  });
});
