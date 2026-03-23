import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TrusteeMatchRejectionModal, {
  TrusteeMatchRejectionModalImperative,
} from './TrusteeMatchRejectionModal';
import { getCaseNumber } from '@/lib/utils/caseNumber';

const modalId = 'test-order-id';
const caseId = '081-22-11111';

describe('TrusteeMatchRejectionModal', () => {
  const modalRef = React.createRef<TrusteeMatchRejectionModalImperative>();

  function renderWithProps(onConfirm = vi.fn(), onCancel = vi.fn()) {
    render(
      <TrusteeMatchRejectionModal
        ref={modalRef}
        id={modalId}
        caseId={caseId}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    return { onConfirm, onCancel };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('shows heading and case number after show() is called', async () => {
    renderWithProps();
    act(() => modalRef.current?.show());

    await waitFor(() => {
      expect(document.querySelector('.usa-modal__heading')).toHaveTextContent(
        'Reject trustee match?',
      );
      const content = document.querySelector('.usa-modal__main');
      expect(content?.textContent).toContain(getCaseNumber(caseId));
    });
  });

  test('renders the rejection reason textarea', async () => {
    renderWithProps();
    act(() => modalRef.current?.show());

    await waitFor(() => {
      expect(screen.getByTestId(`rejection-reason-input-${modalId}`)).toBeInTheDocument();
    });
  });

  test('calls onConfirm with undefined when Reject is clicked with no reason', async () => {
    const { onConfirm } = renderWithProps();
    act(() => modalRef.current?.show());

    const submitButton = screen.getByTestId(
      `button-trustee-rejection-modal-${modalId}-submit-button`,
    );
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(undefined);
    });
  });

  test('calls onConfirm with reason text when Reject is clicked after entering a reason', async () => {
    const { onConfirm } = renderWithProps();
    act(() => modalRef.current?.show());

    const reasonInput = screen.getByTestId(`rejection-reason-input-${modalId}`);
    fireEvent.change(reasonInput, { target: { value: 'Not the right person' } });

    const submitButton = screen.getByTestId(
      `button-trustee-rejection-modal-${modalId}-submit-button`,
    );
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('Not the right person');
    });
  });

  test('calls onCancel and clears reason when Go back is clicked', async () => {
    const { onCancel } = renderWithProps();
    act(() => modalRef.current?.show());

    const reasonInput = screen.getByTestId(`rejection-reason-input-${modalId}`);
    fireEvent.change(reasonInput, { target: { value: 'some reason' } });

    const cancelButton = screen.getByTestId(
      `button-trustee-rejection-modal-${modalId}-cancel-button`,
    );
    await waitFor(() => expect(cancelButton).toBeEnabled());
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalled();
      expect(reasonInput).toHaveValue('');
    });
  });

  test('clears the reason textarea when show() is called', async () => {
    renderWithProps();
    act(() => modalRef.current?.show());

    const reasonInput = screen.getByTestId(`rejection-reason-input-${modalId}`);
    fireEvent.change(reasonInput, { target: { value: 'previous reason' } });

    act(() => modalRef.current?.show());

    await waitFor(() => {
      expect(reasonInput).toHaveValue('');
    });
  });
});
