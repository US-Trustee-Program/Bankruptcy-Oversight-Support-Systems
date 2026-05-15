import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { useRef } from 'react';
import {
  AddAssociatedBankConfirmModal,
  AddAssociatedBankConfirmModalRef,
} from './AddAssociatedBankConfirmModal';

function TestWrapper({ onConfirm }: { onConfirm: (bankId: string, bankName: string) => void }) {
  const ref = useRef<AddAssociatedBankConfirmModalRef>(null);

  return (
    <>
      <button onClick={() => ref.current?.show('bank-1', 'Chase Bank')}>Open Modal</button>
      <AddAssociatedBankConfirmModal ref={ref} modalId="test-confirm-modal" onConfirm={onConfirm} />
    </>
  );
}

function TestWrapperWithRef({
  onConfirm,
  modalRef,
}: {
  onConfirm: (bankId: string, bankName: string) => void;
  modalRef: React.RefObject<AddAssociatedBankConfirmModalRef | null>;
}) {
  return (
    <AddAssociatedBankConfirmModal
      ref={modalRef}
      modalId="test-confirm-modal"
      onConfirm={onConfirm}
    />
  );
}

const MODAL_WRAPPER = 'modal-test-confirm-modal';

describe('AddAssociatedBankConfirmModal', () => {
  test('should show bank name in heading when show() is called', async () => {
    render(<TestWrapper onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByText('Open Modal'));

    await waitFor(() => {
      expect(screen.getByText('Are you sure you want to add Chase Bank?')).toBeInTheDocument();
    });
  });

  test('should show warning text about future status changes', async () => {
    render(<TestWrapper onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByText('Open Modal'));

    await waitFor(() => {
      expect(
        screen.getByText('In the future, you will only be able to mark their status as inactive.'),
      ).toBeInTheDocument();
    });
  });

  test('should call onConfirm with bankId and bankName on submit', async () => {
    const onConfirm = vi.fn();
    render(<TestWrapper onConfirm={onConfirm} />);

    await userEvent.click(screen.getByText('Open Modal'));

    await waitFor(() => {
      expect(screen.getByText('Are you sure you want to add Chase Bank?')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Add Bank' }));

    expect(onConfirm).toHaveBeenCalledWith('bank-1', 'Chase Bank');
  });

  test('should close on cancel', async () => {
    render(<TestWrapper onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByText('Open Modal'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-test-confirm-modal')).toHaveClass('is-visible');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.getByTestId('modal-test-confirm-modal')).toHaveClass('is-hidden');
    });
  });

  test('should close when hide() is called on the ref', async () => {
    const ref = React.createRef<AddAssociatedBankConfirmModalRef>();
    render(<TestWrapperWithRef onConfirm={vi.fn()} modalRef={ref} />);

    act(() => ref.current?.show('bank-1', 'Chase Bank'));
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    });

    act(() => ref.current?.hide());
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });
  });
});
