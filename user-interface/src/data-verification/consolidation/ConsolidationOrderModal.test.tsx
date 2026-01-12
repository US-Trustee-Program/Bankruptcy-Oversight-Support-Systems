import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import ConsolidationOrderModal, {
  ConfirmationModalImperative,
  ConsolidationOrderModalProps,
  formatListForDisplay,
} from '@/data-verification/consolidation/ConsolidationOrderModal';
import { BrowserRouter } from 'react-router-dom';
import MockData from '@common/cams/test-utilities/mock-data';
import { CaseAssignment } from '@common/cams/assignments';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { CaseSummary } from '@common/cams/cases';
import { Consolidation } from '@common/cams/events';
import Api2 from '@/lib/models/api2';
import { ResponseBody } from '@common/api/response';

describe('ConsolidationOrderModalComponent', () => {
  const onCancelSpy = vitest.fn();
  const onConfirmSpy = vitest.fn();

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
    const view = renderModalWithProps({ id, onConfirm: onConfirmSpy, onCancel: onCancelSpy });
    await waitFor(() => {
      view.current?.show({ status: 'rejected', cases });
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
      view.current?.show({ status: 'rejected', cases });
    });
    const cancelButton = screen.getByTestId(`button-${id}-cancel-button`);
    expect(cancelButton).toBeVisible();
    expect(cancelButton).not.toBeDisabled();
    fireEvent.click(cancelButton!);
    expect(onCancelSpy).toHaveBeenCalled();
  });

  test('should allow user to approve a consolidation', async () => {
    const id = 'test';
    const memberCases = MockData.buildArray(MockData.getCaseSummary, 2);
    const courts = MockData.getCourts().slice(0, 3);

    const leadCase = MockData.getCaseSummary();
    const consolidationType = 'substantive';
    const leadCaseResponse: ResponseBody<CaseSummary> = {
      data: leadCase,
    };
    const assignmentResponse: ResponseBody<CaseAssignment[]> = {
      data: MockData.buildArray(MockData.getAttorneyAssignment, 2),
    };
    const associatedCasesResponse: ResponseBody<Consolidation[]> = {
      data: [],
    };

    // Setup API calls to fetch the lead case summary and lead case assignments.
    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue(leadCaseResponse);
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue(associatedCasesResponse);
    vi.spyOn(Api2, 'getCaseAssignments').mockResolvedValue(assignmentResponse);

    // Render and activate the modal.
    const view = renderModalWithProps({ id, courts });
    await waitFor(() => {
      view.current?.show({ status: 'approved', cases: memberCases, leadCase, consolidationType });
    });

    const modal = screen.getByTestId('modal-test');
    expect(modal).toHaveClass('is-visible');

    let verifyButton = screen.getByTestId(`button-${id}-submit-button`);
    expect(verifyButton).toBeEnabled();

    // Check the first heading.
    const firstHeading = document.querySelector('.usa-modal__heading');
    expect(firstHeading).toHaveTextContent('Verify Case Consolidation');

    await waitFor(() => {
      expect(verifyButton).toBeEnabled();
      expect(verifyButton).toHaveTextContent('Verify');
    });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      const heading = document.querySelector('.usa-modal__heading');
      expect(heading).toHaveTextContent('Verify Case Consolidation');
    });

    verifyButton = screen.getByTestId(`button-${id}-submit-button`);
    expect(verifyButton).toBeEnabled();
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(modal).toHaveClass('is-hidden');
    });

    expect(onConfirmSpy).toHaveBeenCalledWith({
      status: 'approved',
      rejectionReason: undefined,
    });

    await waitFor(() => {
      view.current?.show({ status: 'approved', cases: memberCases });
    });
    const cancelButton = screen.getByTestId(`button-${id}-cancel-button`);
    expect(cancelButton).toBeVisible();
    expect(cancelButton).not.toBeDisabled();
    fireEvent.click(cancelButton!);
    expect(onCancelSpy).toHaveBeenCalled();
  });

  test('should call onCancel callback when cancel button is clicked', async () => {
    const id = 'test';
    const cases = MockData.buildArray(MockData.getCaseSummary, 2);

    const view = renderModalWithProps({ id });

    await waitFor(() => {
      view.current?.show({ status: 'rejected', cases });
    });

    const button = screen.queryByTestId(`button-${id}-cancel-button`);
    fireEvent.click(button as Element);

    await waitFor(() => {
      expect(onCancelSpy).toHaveBeenCalled();
    });
  });

  test('should render Oxford comma for attorney list.', async () => {
    const nameList: string[] = [];

    const noNames = formatListForDisplay(nameList);
    expect(noNames).toEqual('(unassigned)');

    nameList.push('Abe');
    const oneName = formatListForDisplay(nameList);
    expect(oneName).toEqual('Abe');

    nameList.push('Ben');
    const twoNames = formatListForDisplay(nameList);
    expect(twoNames).toEqual('Abe and Ben');

    nameList.push('Charles');
    const threeNames = formatListForDisplay(nameList);
    expect(threeNames).toEqual('Abe, Ben, and Charles');
  });
});
