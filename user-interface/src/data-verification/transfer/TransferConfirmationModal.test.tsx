import { describe } from 'vitest';
import TransferConfirmationModal, {
  TransferConfirmationModalProps,
} from './TransferConfirmationModal';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MockData from '@common/cams/test-utilities/mock-data';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import React from 'react';
import { TransferConfirmationModalImperative } from './TransferConfirmationModal';

const modalId = 'test';
const fromCase = MockData.getCaseSummary();
const toCase = MockData.getCaseSummary();

describe('TransferConfirmationModal component', () => {
  const modalRef = React.createRef<TransferConfirmationModalImperative>();
  function renderWithProps(props: Partial<TransferConfirmationModalProps> = {}) {
    const onCancel = vitest.fn();
    const onConfirm = vitest.fn();
    const defaultProps: TransferConfirmationModalProps = {
      id: modalId,
      fromCaseId: fromCase.caseId,
      fromDivisionName: fromCase.courtDivisionName,
      fromCourtName: fromCase.courtName,
      toCaseId: toCase.caseId,
      toCourtName: toCase.courtName,
      toDivisionName: toCase.courtDivisionName,
      onCancel,
      onConfirm,
    };

    const renderProps = { ...defaultProps, ...props };
    render(<TransferConfirmationModal {...renderProps} ref={modalRef} />);
    return {
      onCancel,
      onConfirm,
      modalRef,
    };
  }

  test('should call onCancel callback when cancelled', async () => {
    const { onCancel, modalRef } = renderWithProps();

    act(() =>
      modalRef.current?.show({
        status: 'approved',
      }),
    );

    const cancelButton = screen.getByTestId(`button-confirm-modal-${modalId}-cancel-button`);

    await waitFor(() => {
      expect(cancelButton).toBeVisible();
      expect(cancelButton).toBeEnabled();
    });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalled();
    });
  });

  test('should call onConfirm callback when approved', async () => {
    const { onConfirm, modalRef } = renderWithProps();

    act(() =>
      modalRef.current?.show({
        status: 'approved',
      }),
    );

    const confirmButton = screen.getByTestId(`button-confirm-modal-${modalId}-submit-button`);

    await waitFor(() => {
      expect(confirmButton).toBeVisible();
      expect(confirmButton).toBeEnabled();
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('approved', undefined);
    });
  });

  test('should display static text for confirmation modal', async () => {
    const expectedText = `This will verify the transfer of case ${getCaseNumber(fromCase.caseId)} in ${fromCase.courtName} (${fromCase.courtDivisionName}) to case ${getCaseNumber(toCase.caseId)} in ${toCase.courtName} (${toCase.courtDivisionName}).`;
    const { modalRef } = renderWithProps();

    act(() =>
      modalRef.current?.show({
        status: 'approved',
      }),
    );

    await waitFor(() => {
      const titleBlock = document.querySelector('.usa-modal__heading');
      expect(titleBlock).toHaveTextContent('Verify case transfer?');
    });

    const textBlock = document.querySelector('.usa-modal__main section');
    expect(textBlock).toHaveTextContent(expectedText);
  });

  test('should display static text for rejection modal without destination court and case number', async () => {
    const expectedText = `This will stop the transfer of case ${getCaseNumber(fromCase.caseId)} in ${fromCase.courtName} (${fromCase.courtDivisionName}).`;
    const { modalRef } = renderWithProps({
      toCaseId: undefined,
      toCourtName: undefined,
      toDivisionName: undefined,
    });

    act(() =>
      modalRef.current?.show({
        status: 'rejected',
      }),
    );

    const textBlock = document.querySelector('.usa-modal__main section');
    await waitFor(() => {
      expect(textBlock).toHaveTextContent(expectedText);
    });
  });

  test('should display static text for rejection modal with destination court and case number', async () => {
    const expectedText = `This will stop the transfer of case ${getCaseNumber(fromCase.caseId)} in ${fromCase.courtName} (${fromCase.courtDivisionName}) to case ${getCaseNumber(toCase.caseId)} in ${toCase.courtName} (${toCase.courtDivisionName}).`;
    const { modalRef, onConfirm } = renderWithProps();

    act(() =>
      modalRef.current?.show({
        status: 'rejected',
      }),
    );

    await waitFor(() => {
      const titleBlock = document.querySelector('.usa-modal__heading');
      expect(titleBlock).toHaveTextContent('Reject case transfer?');
    });

    const textBlock = document.querySelector('.usa-modal__main section');
    expect(textBlock).toHaveTextContent(expectedText);

    let rejectReasonTextArea = screen.getByTestId(`rejection-reason-input-${modalId}`);
    const rejectReasonText = 'rejected because it has already been completed';
    fireEvent.change(rejectReasonTextArea, { target: { value: rejectReasonText } });
    await waitFor(() => {
      rejectReasonTextArea = screen.getByTestId(`rejection-reason-input-${modalId}`);
      expect(rejectReasonTextArea).toHaveValue(rejectReasonText);
    });

    const confirmButton = screen.getByTestId(`button-confirm-modal-${modalId}-submit-button`);
    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith('rejected', rejectReasonText);
  });
});
