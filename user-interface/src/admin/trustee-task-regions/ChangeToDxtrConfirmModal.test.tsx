import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React, { useRef } from 'react';
import { ChangeToDxtrConfirmModal, ChangeToDxtrConfirmModalRef } from './ChangeToDxtrConfirmModal';

function TestWrapper({ onConfirm }: { onConfirm: (regionId: string) => void }) {
  const ref = useRef<ChangeToDxtrConfirmModalRef>(null);

  return (
    <>
      <button onClick={() => ref.current?.show('02', '2')}>Open Modal</button>
      <ChangeToDxtrConfirmModal ref={ref} modalId="test-dxtr-modal" onConfirm={onConfirm} />
    </>
  );
}

const MODAL_WRAPPER = 'modal-test-dxtr-modal';

describe('ChangeToDxtrConfirmModal', () => {
  test('should show the heading and body text for the given region', async () => {
    render(<TestWrapper onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByText('Open Modal'));

    await waitFor(() => {
      expect(screen.getByText('Change Region 2 to DXTR?')).toBeInTheDocument();
      expect(screen.getByText("This action can't be undone.")).toBeInTheDocument();
    });
  });

  test('should show "Change to DXTR" and "Cancel" buttons', async () => {
    render(<TestWrapper onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByText('Open Modal'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Change to DXTR' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  test('should call onConfirm with the regionId and close when confirmed', async () => {
    const onConfirm = vi.fn();
    render(<TestWrapper onConfirm={onConfirm} />);

    await userEvent.click(screen.getByText('Open Modal'));
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Change to DXTR' }));

    expect(onConfirm).toHaveBeenCalledWith('02');
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });
  });

  test('should close on cancel without calling onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<TestWrapper onConfirm={onConfirm} />);

    await userEvent.click(screen.getByText('Open Modal'));
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });
  });

  test('should close on Escape without calling onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<TestWrapper onConfirm={onConfirm} />);

    await userEvent.click(screen.getByText('Open Modal'));
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    });

    await userEvent.keyboard('{Escape}');

    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });
  });

  test('should close when hide() is called on the ref', async () => {
    const ref = React.createRef<ChangeToDxtrConfirmModalRef>();
    render(<ChangeToDxtrConfirmModal ref={ref} modalId="test-dxtr-modal" onConfirm={vi.fn()} />);

    act(() => ref.current?.show('02', '2'));
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    });

    act(() => ref.current?.hide());
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });
  });
});
