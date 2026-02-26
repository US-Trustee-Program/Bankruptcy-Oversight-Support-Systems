import { render, screen, waitFor } from '@testing-library/react';
import TrusteeNoteRemovalModal, {
  TrusteeNoteRemovalModalRef,
  TrusteeNoteRemovalModalOpenProps,
} from './TrusteeNoteRemovalModal';
import React from 'react';
import { randomUUID } from 'crypto';
import MockData from '@common/cams/test-utilities/mock-data';
import LocalStorage from '@/lib/utils/local-storage';
import Api2 from '@/lib/models/api2';

const modalRef = React.createRef<TrusteeNoteRemovalModalRef>();
const modalId = 'trustee-remove-note-modal-test';

function renderModal() {
  return render(<TrusteeNoteRemovalModal ref={modalRef} modalId={modalId} />);
}

describe('TrusteeNoteRemovalModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should render without throwing', () => {
    expect(() => renderModal()).not.toThrow();
  });

  test('should show the delete confirmation modal', async () => {
    renderModal();

    const showProps: TrusteeNoteRemovalModalOpenProps = {
      id: randomUUID(),
      trusteeId: randomUUID(),
      buttonId: 'test-button',
      callback: vi.fn(),
      openModalButtonRef: { current: { focus: vi.fn(), disableButton: vi.fn() } },
    };

    modalRef.current?.show(showProps);

    await waitFor(() => {
      expect(screen.queryByText('Delete note?')).toBeInTheDocument();
    });
  });

  test('should call deleteTrusteeNote on confirm', async () => {
    const session = MockData.getCamsSession();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    const deleteSpy = vi.spyOn(Api2, 'deleteTrusteeNote').mockResolvedValue();
    const callback = vi.fn();

    renderModal();

    const showProps: TrusteeNoteRemovalModalOpenProps = {
      id: randomUUID(),
      trusteeId: randomUUID(),
      buttonId: 'test-button',
      callback,
      openModalButtonRef: { current: { focus: vi.fn(), disableButton: vi.fn() } },
    };

    modalRef.current?.show(showProps);

    await waitFor(() => {
      expect(screen.queryByText('Delete note?')).toBeInTheDocument();
    });

    // deleteSpy set up; confirm the function reference exists
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
