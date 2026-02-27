import { render, screen, waitFor, act } from '@testing-library/react';
import TrusteeNoteRemovalModal, {
  TrusteeNoteRemovalModalRef,
  TrusteeNoteRemovalModalOpenProps,
} from './TrusteeNoteRemovalModal';
import React from 'react';
import { randomUUID } from 'crypto';
import MockData from '@common/cams/test-utilities/mock-data';
import LocalStorage from '@/lib/utils/local-storage';
import * as Api2Module from '@/lib/models/api2';
import * as UseGlobalAlertModule from '@/lib/hooks/UseGlobalAlert';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

const modalId = 'trustee-remove-note-modal-test';

const mockGlobalAlert = {
  show: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
};

function renderModal() {
  const ref = React.createRef<TrusteeNoteRemovalModalRef>();
  render(<TrusteeNoteRemovalModal ref={ref} modalId={modalId} />);
  return ref;
}

describe('TrusteeNoteRemovalModal', () => {
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
    vi.spyOn(UseGlobalAlertModule, 'useGlobalAlert').mockReturnValue(mockGlobalAlert);
    vi.spyOn(Api2Module.default, 'deleteTrusteeNote').mockResolvedValue();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession());
    mockGlobalAlert.error.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should render without throwing', () => {
    expect(() => renderModal()).not.toThrow();
  });

  test('should show the delete confirmation modal', async () => {
    const utils = renderModal();

    const showProps: TrusteeNoteRemovalModalOpenProps = {
      id: randomUUID(),
      trusteeId: randomUUID(),
      buttonId: 'test-button',
      callback: vi.fn(),
      openModalButtonRef: { current: { focus: vi.fn(), disableButton: vi.fn() } },
    };

    act(() => {
      utils.current?.show(showProps);
    });

    await waitFor(() => {
      expect(screen.queryByText('Delete note?')).toBeInTheDocument();
    });
  });

  test('should call deleteTrusteeNote and invoke callback on confirm', async () => {
    const callback = vi.fn();
    const utils = renderModal();

    const showProps: TrusteeNoteRemovalModalOpenProps = {
      id: randomUUID(),
      trusteeId: randomUUID(),
      buttonId: 'test-button',
      callback,
      openModalButtonRef: { current: { focus: vi.fn(), disableButton: vi.fn() } },
    };

    act(() => {
      utils.current?.show(showProps);
    });

    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(Api2Module.default.deleteTrusteeNote).toHaveBeenCalledWith(
        expect.objectContaining({
          id: showProps.id,
          trusteeId: showProps.trusteeId,
        }),
      );
      expect(callback).toHaveBeenCalled();
      expect(mockGlobalAlert.error).not.toHaveBeenCalled();
    });
  });

  test('should show global alert error when deleteTrusteeNote fails', async () => {
    vi.spyOn(Api2Module.default, 'deleteTrusteeNote').mockRejectedValue(new Error('API error'));
    const callback = vi.fn();
    const utils = renderModal();

    const showProps: TrusteeNoteRemovalModalOpenProps = {
      id: randomUUID(),
      trusteeId: randomUUID(),
      buttonId: 'test-button',
      callback,
      openModalButtonRef: { current: { focus: vi.fn(), disableButton: vi.fn() } },
    };

    act(() => {
      utils.current?.show(showProps);
    });

    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockGlobalAlert.error).toHaveBeenCalledWith(
        'There was a problem removing the trustee note.',
      );
      expect(callback).not.toHaveBeenCalled();
    });
  });

  test('should not call API when id is missing', async () => {
    const callback = vi.fn();
    const utils = renderModal();

    const showProps: TrusteeNoteRemovalModalOpenProps = {
      id: '',
      trusteeId: randomUUID(),
      buttonId: 'test-button',
      callback,
      openModalButtonRef: { current: { focus: vi.fn(), disableButton: vi.fn() } },
    };

    act(() => {
      utils.current?.show(showProps);
    });

    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(Api2Module.default.deleteTrusteeNote).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
