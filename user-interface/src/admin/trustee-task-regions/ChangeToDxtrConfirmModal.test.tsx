import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useRef } from 'react';
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
      expect(document.getElementById('test-dxtr-modal-heading')).toHaveTextContent(
        'Change Region 2 to DXTR?',
      );
      expect(document.getElementById('test-dxtr-modal-description')).toHaveTextContent(
        "This action can't be undone. The change takes effect on the next sync.",
      );
    });
  });

  test('should show "Change to DXTR" and "Cancel" buttons', async () => {
    render(<TestWrapper onConfirm={vi.fn()} />);

    await userEvent.click(screen.getByText('Open Modal'));

    await waitFor(() => {
      expect(screen.getByTestId('button-test-dxtr-modal-submit-button')).toHaveTextContent(
        'Change to DXTR',
      );
      expect(screen.getByTestId('button-test-dxtr-modal-cancel-button')).toHaveTextContent(
        'Cancel',
      );
    });
  });

  test('should call onConfirm with the regionId when confirmed', async () => {
    const onConfirm = vi.fn();
    render(<TestWrapper onConfirm={onConfirm} />);

    await userEvent.click(screen.getByText('Open Modal'));
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    });

    await userEvent.click(screen.getByTestId('button-test-dxtr-modal-submit-button'));

    expect(onConfirm).toHaveBeenCalledWith('02');
  });

  test('should not call onConfirm when dismissed by Cancel or Escape', async () => {
    const onConfirm = vi.fn();
    render(<TestWrapper onConfirm={onConfirm} />);

    await userEvent.click(screen.getByText('Open Modal'));
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    });
    await userEvent.click(screen.getByTestId('button-test-dxtr-modal-cancel-button'));
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Open Modal'));
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    });
    await userEvent.keyboard('{Escape}');
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
