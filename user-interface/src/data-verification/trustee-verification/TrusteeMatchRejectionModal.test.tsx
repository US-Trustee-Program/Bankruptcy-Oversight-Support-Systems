import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TrusteeMatchRejectionModal, {
  TrusteeMatchRejectionModalImperative,
} from './TrusteeMatchRejectionModal';
const modalId = 'test-order-id';

describe('TrusteeMatchRejectionModal', () => {
  const modalRef = React.createRef<TrusteeMatchRejectionModalImperative>();

  function renderWithProps(onConfirm = vi.fn(), onCancel = vi.fn()) {
    render(
      <TrusteeMatchRejectionModal
        ref={modalRef}
        id={modalId}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    return { onConfirm, onCancel };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('shows heading after show() is called', async () => {
    renderWithProps();
    act(() => modalRef.current?.show());

    await waitFor(() => {
      expect(document.querySelector('.usa-modal__heading')).toHaveTextContent(
        'Reject Trustee Confirmation Task',
      );
    });
  });

  test('renders the rejection reason textarea', async () => {
    renderWithProps();
    act(() => modalRef.current?.show());

    await waitFor(() => {
      expect(screen.getByTestId(`rejection-reason-input-${modalId}`)).toBeInTheDocument();
    });
  });

  test('submit button is disabled until a reason is entered', async () => {
    renderWithProps();
    act(() => modalRef.current?.show());

    const submitButton = screen.getByTestId(
      `button-trustee-rejection-modal-${modalId}-submit-button`,
    );
    await waitFor(() => expect(submitButton).toBeDisabled());

    const reasonInput = screen.getByTestId(`rejection-reason-input-${modalId}`);
    fireEvent.change(reasonInput, { target: { value: 'some reason' } });

    await waitFor(() => expect(submitButton).toBeEnabled());
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
