import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useRef } from 'react';
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

describe('AddAssociatedBankConfirmModal', () => {
  test('should show bank name in content when show() is called', async () => {
    render(<TestWrapper onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByText('Open Modal'));

    await waitFor(() => {
      expect(screen.getByText('Chase Bank')).toBeInTheDocument();
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
      expect(screen.getByText('Chase Bank')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Add Bank' }));

    expect(onConfirm).toHaveBeenCalledWith('bank-1', 'Chase Bank');
  });

  test('should close on cancel', async () => {
    render(<TestWrapper onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByText('Open Modal'));

    await waitFor(() => {
      expect(screen.getByText('Chase Bank')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Are you sure you want to add')).not.toBeInTheDocument();
    });
  });
});
