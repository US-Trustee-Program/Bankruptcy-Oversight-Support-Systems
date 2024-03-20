import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  ConsolidationOrderModal,
  ConfirmationModalImperative,
  ConsolidationOrderModalProps,
} from '@/data-verification/ConsolidationOrderModal';
import { BrowserRouter } from 'react-router-dom';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { selectItemInMockSelect } from '@/lib/components/SearchableSelect.mock';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';

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
    const caseIds = ['11-11111', '22-22222'];

    // Render and activate the modal.
    const ref = renderModalWithProps({ id });
    await waitFor(() => {
      ref.current?.show({ status: 'rejected', caseIds });
    });

    // Check heading
    const heading = document.querySelector('.usa-modal__heading');
    expect(heading).toHaveTextContent('Reject Case Consolidation?');

    // Check case Ids
    const caseIdDiv = screen.queryByTestId(`confirm-modal-${id}-caseIds`);
    expect(caseIdDiv).toBeInTheDocument();
    caseIds.forEach((caseId) => {
      expect(caseIdDiv).toHaveTextContent(caseId);
    });
  });

  test('should show approved modal and allow user to submit modal after completing form', async () => {
    const id = 'test';
    const caseIds = ['11-11111', '22-22222'];
    const courts = MockData.getOffices().slice(0, 3);
    const attorneys = MockData.getTrialAttorneys();

    // Render and activate the modal.
    const ref = renderModalWithProps({ id, courts });
    await waitFor(() => {
      ref.current?.show({ status: 'approved', caseIds, attorneys });
    });

    const modal = screen.getByTestId('modal-test');
    expect(modal).toHaveClass('is-visible');

    const approveButton = screen.getByTestId('toggle-modal-button-submit');
    expect(approveButton).toBeDisabled();

    // Check the first heading.
    const firstHeading = document.querySelector('.usa-modal__heading');
    expect(firstHeading).toHaveTextContent('Additional Consolidation Information');

    // Select consolidation type
    const radioAdministrative = screen.queryByTestId(`radio-administrative-${id}`);
    const radioSubstantive = screen.queryByTestId(`radio-substantive-${id}`);
    const radioAdministrativeClickTarget = screen.queryByTestId(
      `radio-administrative-${id}-click-target`,
    );
    const radioSubstantiveClickTarget = screen.queryByTestId(
      `radio-substantive-${id}-click-target`,
    );

    expect(radioAdministrative).toBeInTheDocument();
    expect(radioSubstantive).toBeInTheDocument();

    fireEvent.click(radioAdministrativeClickTarget!);

    await waitFor(() => {
      expect(radioAdministrative).toBeChecked();
      expect(radioSubstantive).not.toBeChecked();
    });

    fireEvent.click(radioSubstantiveClickTarget!);

    // await waitFor(() => {
    //   expect(radioSubstantive).toBeChecked();
    //   expect(radioAdministrative).not.toBeChecked();
    // });

    expect(approveButton).toBeDisabled();

    // Select lead case court.
    selectItemInMockSelect(`lead-case-court`, 1);

    expect(approveButton).toBeDisabled();

    // Enter case number.
    const testCaseNumber = '11-11111';
    const caseNumberInput = findCaseNumberInputInModal(id);
    await waitFor(() => {
      enterCaseNumberInModal(caseNumberInput, testCaseNumber);
    });

    await waitFor(() => {
      expect(caseNumberInput).toHaveValue(testCaseNumber);
    });

    // Select attorney
    selectItemInMockSelect(`lead-attorney`, 1);

    expect(approveButton).toBeEnabled();
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(modal).toHaveClass('is-hidden');
    });

    expect(onConfirmSpy).toHaveBeenCalledWith({
      status: 'approved',
      courtDivision: undefined,
      leadCaseId: `${courts[0].courtDivision}-11-11111`,
      consolidationType: 'substantive',
    });
  });

  test('should call onCancel callback when cancel button is clicked', async () => {
    const id = 'test';
    const caseIds = ['11-11111', '22-22222'];

    const ref = renderModalWithProps({ id });

    await waitFor(() => {
      ref.current?.show({ status: 'rejected', caseIds });
    });

    const button = screen.queryByTestId(`toggle-modal-button-cancel`);
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
    const caseIds = ['11-11111', '22-22222'];
    const courts = MockData.getOffices().slice(0, 3);
    const attorneys = MockData.getTrialAttorneys();

    // Render and activate the modal.
    const ref = renderModalWithProps({ id, courts });
    await waitFor(() => {
      ref.current?.show({ status: 'approved', caseIds, attorneys });
    });

    // Select consolidation type
    const radioAdministrative = screen.queryByTestId(`radio-administrative-${id}`);
    const radioSubstantive = screen.queryByTestId(`radio-substantive-${id}`);

    expect(radioAdministrative).not.toBeInTheDocument();
    expect(radioSubstantive).not.toBeInTheDocument();
  });
});
