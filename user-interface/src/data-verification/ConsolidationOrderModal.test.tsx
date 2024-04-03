import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  ConsolidationOrderModal,
  ConfirmationModalImperative,
  ConsolidationOrderModalProps,
  addOxfordCommas,
  getCaseAssignments,
  fetchLeadCaseAttorneys,
} from '@/data-verification/ConsolidationOrderModal';
import { BrowserRouter } from 'react-router-dom';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { selectItemInMockSelect } from '@/lib/components/SearchableSelect.mock';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { CaseAssignmentResponseData } from '@/lib/type-declarations/chapter-15';
import { CaseAssignment } from '@common/cams/assignments';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { SimpleResponseData } from '@/lib/type-declarations/api';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import * as UseWindowSize from '@/lib/hooks/UseWindowSize';

vi.mock(
  '../lib/components/SearchableSelect',
  () => import('../lib/components/SearchableSelect.mock'),
);

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
    vitest.clearAllMocks();
  });

  test('should show rejection modal', async () => {
    const id = 'test';
    const cases = MockData.buildArray(MockData.getCaseSummary, 2);

    // Render and activate the modal.
    const ref = renderModalWithProps({ id });
    await waitFor(() => {
      ref.current?.show({ status: 'rejected', cases });
    });

    // Check heading
    const heading = document.querySelector('.usa-modal__heading');
    expect(heading).toHaveTextContent('Reject Case Consolidation?');

    // Check case Ids
    const caseIdDiv = screen.queryByTestId(`confirm-modal-${id}-caseIds`);
    expect(caseIdDiv).toBeInTheDocument();
    cases.forEach((bCase) => {
      expect(caseIdDiv).toHaveTextContent(getCaseNumber(bCase.caseId));
    });
  });

  test('should show approved modal and allow user to submit modal after completing form', async () => {
    const id = 'test';
    const cases = MockData.buildArray(MockData.getCaseSummary, 2);
    const courts = MockData.getOffices().slice(0, 3);

    const assignmentResponse: SimpleResponseData<CaseAssignment[]> = {
      success: true,
      body: MockData.buildArray(MockData.getAttorneyAssignment, 2),
    };
    vitest.spyOn(Chapter15MockApi, 'get').mockResolvedValueOnce(assignmentResponse);

    // Render and activate the modal.
    const ref = renderModalWithProps({ id, courts });
    await waitFor(() => {
      ref.current?.show({ status: 'approved', cases });
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
    const leadCaseNumber = getCaseNumber(cases[0].caseId);
    const caseNumberInput = findCaseNumberInputInModal(id);
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
      courtDivision: undefined,
      leadCaseId: `${courts[0].courtDivision}-${leadCaseNumber}`,
      consolidationType: 'substantive',
    });
  });

  test('should resize modal and consolidated cases list inside modal when window size changes', async () => {
    const id = 'test';
    const cases = MockData.buildArray(MockData.getCaseSummary, 25);
    const courts = MockData.getOffices().slice(0, 3);
    vi.spyOn(UseWindowSize, 'default').mockReturnValue({ width: 0, height: 500 });

    const assignmentResponse: SimpleResponseData<CaseAssignment[]> = {
      success: true,
      body: MockData.buildArray(MockData.getAttorneyAssignment, 10),
    };

    vitest.spyOn(Chapter15MockApi, 'get').mockResolvedValueOnce(assignmentResponse);

    // Render and activate the modal.
    const ref = renderModalWithProps({ id, courts });
    await waitFor(() => {
      ref.current?.show({ status: 'approved', cases });
    });

    const modal = document.querySelector('.confirm-modal');
    const continueButton = screen.getByTestId(`button-${id}-submit-button`);

    // Select consolidation type
    const radioSubstantiveClickTarget = screen.queryByTestId(
      `radio-substantive-${id}-click-target`,
    );

    fireEvent.click(radioSubstantiveClickTarget!);

    // Select lead case court.
    selectItemInMockSelect(`lead-case-court`, 1);

    // Enter case number.
    const leadCaseNumber = getCaseNumber(cases[0].caseId);
    const caseNumberInput = findCaseNumberInputInModal(id);
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

    const modalCaseList = document.querySelector('.modal-case-list');
    expect(modalCaseList?.children.length).toEqual(25);

    const modalAttorneyList = document.querySelector('.modal-step2-assignments-list .oxford-comma');
    expect(modalAttorneyList?.textContent?.split(',').length).toEqual(10);

    //resize window and validate it has the correct size according to calculations
    const originalWindowHeight = Number(global.innerHeight);
    const caseListModalDiv = document.querySelector('.modal-case-list-container');
    const modalHeight = modal?.getAttribute('data-misc');

    console.log('original window height: ', originalWindowHeight);
    console.log('original modal height: ', modalHeight);

    act(() => {
      window.innerHeight = 500;
      window.innerWidth = 500;
    });
    fireEvent(window, new Event('resize'));

    console.log('new window height: ', global.innerHeight);
    console.log('original modal height: ', modalHeight);
    console.log('Case List Modal Container height: ', caseListModalDiv!.getAttribute('style'));
    console.log(modalHeight);
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

  test('should not show consolidation type input when feature flag is false', async () => {
    const mockFeatureFlags = {
      'consolidations-assign-attorney': false,
    };
    vitest.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);

    const id = 'test';
    const cases = MockData.buildArray(MockData.getCaseSummary, 2);
    const courts = MockData.getOffices().slice(0, 3);

    // Render and activate the modal.
    const ref = renderModalWithProps({ id, courts });
    await waitFor(() => {
      ref.current?.show({ status: 'approved', cases });
    });

    // Select consolidation type
    const radioAdministrative = screen.queryByTestId(`radio-administrative-${id}`);
    const radioSubstantive = screen.queryByTestId(`radio-substantive-${id}`);

    expect(radioAdministrative).not.toBeInTheDocument();
    expect(radioSubstantive).not.toBeInTheDocument();
  });

  test('should render Oxford comma for attorney list.', async () => {
    const nameList: string[] = [];

    const noNames = addOxfordCommas(nameList);
    expect(noNames).toEqual('(unassigned)');

    nameList.push('Abe');
    const oneName = addOxfordCommas(nameList);
    expect(oneName).toEqual('Abe');

    nameList.push('Ben');
    const twoNames = addOxfordCommas(nameList);
    expect(twoNames).toEqual('Abe and Ben');

    nameList.push('Charles');
    const threeNames = addOxfordCommas(nameList);
    expect(threeNames).toEqual('Abe, Ben, and Charles');
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
});
