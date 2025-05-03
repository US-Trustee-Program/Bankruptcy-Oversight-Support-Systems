import { getCaseNumber } from '@/lib/utils/caseNumber';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe } from 'vitest';

import {
  TransferConfirmationModal,
  TransferConfirmationModalProps,
} from './TransferConfirmationModal';
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
      fromCaseId: fromCase.caseId,
      fromCourtName: fromCase.courtName,
      fromDivisionName: fromCase.courtDivisionName,
      id: modalId,
      onCancel,
      onConfirm,
      toCaseId: toCase.caseId,
      toCourtName: toCase.courtName,
      toDivisionName: toCase.courtDivisionName,
    };

    const renderProps = { ...defaultProps, ...props };
    render(<TransferConfirmationModal {...renderProps} ref={modalRef} />);
    return {
      modalRef,
      onCancel,
      onConfirm,
    };
  }

  test('should call onCancel callback when cancelled', async () => {
    const { modalRef, onCancel } = renderWithProps();

    modalRef.current?.show({
      status: 'approved',
    });

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
    const { modalRef, onConfirm } = renderWithProps();

    modalRef.current?.show({
      status: 'approved',
    });

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

    modalRef.current?.show({
      status: 'approved',
    });

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

    modalRef.current?.show({
      status: 'rejected',
    });

    const textBlock = document.querySelector('.usa-modal__main section');
    expect(textBlock).toHaveTextContent(expectedText);
  });

  test('should display static text for rejection modal with destination court and case number', async () => {
    const expectedText = `This will stop the transfer of case ${getCaseNumber(fromCase.caseId)} in ${fromCase.courtName} (${fromCase.courtDivisionName}) to case ${getCaseNumber(toCase.caseId)} in ${toCase.courtName} (${toCase.courtDivisionName}).`;
    const { modalRef, onConfirm } = renderWithProps();

    modalRef.current?.show({
      status: 'rejected',
    });

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
