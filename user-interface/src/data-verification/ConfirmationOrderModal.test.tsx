import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  ConfirmationModal,
  ConfirmationModalImperative,
  ConfirmationModalProps,
} from '@/data-verification/ConsolidationOrderModal';
import { BrowserRouter } from 'react-router-dom';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { selectItemInMockSelect } from '@/lib/components/SearchableSelect.mock';

vi.mock(
  '../lib/components/SearchableSelect',
  () => import('../lib/components/SearchableSelect.mock'),
);

describe('ConfirmationModalComponent', () => {
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
    // expect(caseIdInput).toHaveValue(value);
    //
    // return caseIdInput; // expect(caseIdInput).toHaveValue(value);
    //
    // return caseIdInput;
  }

  function renderModalWithProps(props: Partial<ConfirmationModalProps> = {}) {
    const modalRef = React.createRef<ConfirmationModalImperative>();
    const defaultProps: ConfirmationModalProps = {
      id: 'mock-modal-id',
      onCancel: onCancelSpy,
      onConfirm: onConfirmSpy,
      courts: [],
    };

    const renderProps = { ...defaultProps, ...props };

    render(
      <BrowserRouter>
        <ConfirmationModal {...renderProps} ref={modalRef} />
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

  test('should show approved modal', async () => {
    const id = 'test';
    const caseIds = ['11-11111', '22-22222'];
    const courts = MockData.getOffices().slice(0, 3);
    const attorneys = MockData.getTrialAttorneys();

    // Render and activate the modal.
    const ref = renderModalWithProps({ id, courts });
    await waitFor(() => {
      ref.current?.show({ status: 'approved', caseIds, attorneys });
    });

    // Check the first heading.
    const firstHeading = document.querySelector('.usa-modal__heading');
    expect(firstHeading).toHaveTextContent('Additional Consolidation Information');

    // Select consolidation type
    const radioAdministrative = screen.queryByTestId(`radio-administrative-${id}`);
    const radioSubstative = screen.queryByTestId(`radio-substantive-${id}`);

    expect(radioAdministrative).toBeInTheDocument();
    expect(radioSubstative).toBeInTheDocument();

    fireEvent.click(radioAdministrative!);
    expect(radioAdministrative).toBeChecked();
    expect(radioSubstative).not.toBeChecked();

    fireEvent.click(radioSubstative!);
    expect(radioSubstative).toBeChecked();
    expect(radioAdministrative).not.toBeChecked();

    // Select lead case court.
    selectItemInMockSelect(`lead-case-court`, 1);

    // Enter case number.
    const testCaseNumber = '11-11111';
    const caseNumberInput = findCaseNumberInputInModal(id);
    await waitFor(() => {
      enterCaseNumberInModal(caseNumberInput, testCaseNumber);
    });
    console.log('Input:', (caseNumberInput as HTMLInputElement).value);
    console.log(
      'Input value was empty string?',
      (caseNumberInput as HTMLInputElement).value === '',
    );
    await waitFor(() => {
      expect(caseNumberInput).toHaveValue(testCaseNumber);
    });

    // Select attorney
    selectItemInMockSelect(`lead-attorney`, 1);

    // Click Verify
  });

  test('should call onConfirm callback when confirmation button is clicked', async () => {
    const id = 'test';
    const caseIds = ['11-11111', '22-22222'];

    const ref = renderModalWithProps({ id });

    await waitFor(() => {
      ref.current?.show({ status: 'rejected', caseIds });
    });

    const button = screen.queryByTestId(`toggle-modal-button-submit`);
    fireEvent.click(button as Element);

    await waitFor(() => {
      expect(onConfirmSpy).toHaveBeenCalled();
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
});
