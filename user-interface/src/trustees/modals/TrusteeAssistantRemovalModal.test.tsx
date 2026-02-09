import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TrusteeAssistantRemovalModal, {
  TrusteeAssistantRemovalModalRef,
  TrusteeAssistantRemovalModalOpenProps,
} from './TrusteeAssistantRemovalModal';
import * as Api2Module from '@/lib/models/api2';
import * as UseGlobalAlertModule from '@/lib/hooks/UseGlobalAlert';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

describe('TrusteeAssistantRemovalModal', () => {
  let userEvent: CamsUserEvent;

  const defaultProps = {
    modalId: 'test-removal-modal',
  } as const;

  const mockGlobalAlert = {
    show: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  };

  const mockCallback = vi.fn();

  const mockShowProps: TrusteeAssistantRemovalModalOpenProps = {
    trusteeId: 'trustee-123',
    assistantId: 'assistant-456',
    buttonId: 'delete-button',
    callback: mockCallback,
    openModalButtonRef: { current: null },
  };

  function renderWithRef() {
    const modalRef = React.createRef<TrusteeAssistantRemovalModalRef>();
    render(<TrusteeAssistantRemovalModal modalId={defaultProps.modalId} ref={modalRef} />);
    return modalRef;
  }

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
    vi.restoreAllMocks();
    vi.spyOn(UseGlobalAlertModule, 'useGlobalAlert').mockReturnValue(mockGlobalAlert);
    vi.spyOn(Api2Module.default, 'deleteTrusteeAssistant').mockResolvedValue({
      data: undefined as unknown as object,
    });
    mockCallback.mockClear();
    mockGlobalAlert.error.mockClear();
  });

  test('should render modal with correct structure', () => {
    renderWithRef();

    expect(screen.getByTestId(`modal-${defaultProps.modalId}`)).toBeInTheDocument();
  });

  test('should display correct button labels', () => {
    renderWithRef();

    expect(screen.getByTestId(`button-${defaultProps.modalId}-submit-button`)).toHaveTextContent(
      'Yes, Delete',
    );
    expect(screen.getByTestId(`button-${defaultProps.modalId}-cancel-button`)).toHaveTextContent(
      'Cancel',
    );
  });

  test('should have secondary style on submit button', () => {
    renderWithRef();

    const submitButton = screen.getByTestId(`button-${defaultProps.modalId}-submit-button`);
    expect(submitButton).toHaveClass('usa-button--secondary');
  });

  test('should call show method and open modal', async () => {
    const utils = renderWithRef();

    act(() => {
      utils.current!.show(mockShowProps);
    });

    await waitFor(() => {
      const modal = screen.getByTestId(`modal-${defaultProps.modalId}`);
      expect(modal).toBeInTheDocument();
    });
  });

  test('should successfully delete assistant when submit button is clicked', async () => {
    const utils = renderWithRef();

    act(() => {
      utils.current!.show(mockShowProps);
    });

    const submitButton = screen.getByTestId(`button-${defaultProps.modalId}-submit-button`);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(Api2Module.default.deleteTrusteeAssistant).toHaveBeenCalledWith(
        'trustee-123',
        'assistant-456',
      );
      expect(mockCallback).toHaveBeenCalled();
      expect(mockGlobalAlert.error).not.toHaveBeenCalled();
    });
  });

  test('should handle deletion error and display error message', async () => {
    const errorMessage = 'Failed to delete assistant';
    vi.spyOn(Api2Module.default, 'deleteTrusteeAssistant').mockRejectedValueOnce(
      new Error(errorMessage),
    );

    const utils = renderWithRef();

    act(() => {
      utils.current!.show(mockShowProps);
    });

    const submitButton = screen.getByTestId(`button-${defaultProps.modalId}-submit-button`);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(Api2Module.default.deleteTrusteeAssistant).toHaveBeenCalledWith(
        'trustee-123',
        'assistant-456',
      );
      expect(mockGlobalAlert.error).toHaveBeenCalledWith(
        'There was a problem removing the trustee assistant.',
      );
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  test('should not call API when assistantId is missing', async () => {
    const utils = renderWithRef();

    const propsWithoutAssistantId = {
      ...mockShowProps,
      assistantId: '',
    };

    act(() => {
      utils.current!.show(propsWithoutAssistantId);
    });

    const submitButton = screen.getByTestId(`button-${defaultProps.modalId}-submit-button`);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(Api2Module.default.deleteTrusteeAssistant).not.toHaveBeenCalled();
      expect(mockCallback).not.toHaveBeenCalled();
      expect(mockGlobalAlert.error).not.toHaveBeenCalled();
    });
  });

  test('should not call API when form values are not set', async () => {
    renderWithRef();

    // Don't call show() to set form values

    const submitButton = screen.getByTestId(`button-${defaultProps.modalId}-submit-button`);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(Api2Module.default.deleteTrusteeAssistant).not.toHaveBeenCalled();
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  test('should have cancel button that closes modal', () => {
    renderWithRef();

    const cancelButton = screen.getByTestId(`button-${defaultProps.modalId}-cancel-button`);
    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton).toHaveTextContent('Cancel');
  });

  test('should expose hide method through ref', () => {
    const utils = renderWithRef();

    expect(utils.current?.hide).toBeDefined();
    expect(typeof utils.current?.hide).toBe('function');

    // Calling hide should not throw
    expect(() => utils.current?.hide({})).not.toThrow();
  });

  test('should close modal after successful deletion', async () => {
    const utils = renderWithRef();

    act(() => {
      utils.current!.show(mockShowProps);
    });

    const submitButton = screen.getByTestId(`button-${defaultProps.modalId}-submit-button`);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  test('should call callback only on successful deletion', async () => {
    const utils = renderWithRef();

    act(() => {
      utils.current!.show(mockShowProps);
    });

    const submitButton = screen.getByTestId(`button-${defaultProps.modalId}-submit-button`);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(Api2Module.default.deleteTrusteeAssistant).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  test('should handle show with different props', async () => {
    const utils = renderWithRef();

    const firstProps = {
      trusteeId: 'trustee-1',
      assistantId: 'assistant-1',
      buttonId: 'delete-1',
      callback: vi.fn(),
      openModalButtonRef: { current: null },
    };

    const secondProps = {
      trusteeId: 'trustee-2',
      assistantId: 'assistant-2',
      buttonId: 'delete-2',
      callback: vi.fn(),
      openModalButtonRef: { current: null },
    };

    // First show
    act(() => {
      utils.current!.show(firstProps);
    });

    const submitButton = screen.getByTestId(`button-${defaultProps.modalId}-submit-button`);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(Api2Module.default.deleteTrusteeAssistant).toHaveBeenCalledWith(
        'trustee-1',
        'assistant-1',
      );
      expect(firstProps.callback).toHaveBeenCalled();
    });

    // Second show with different props
    act(() => {
      utils.current!.show(secondProps);
    });

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(Api2Module.default.deleteTrusteeAssistant).toHaveBeenCalledWith(
        'trustee-2',
        'assistant-2',
      );
      expect(secondProps.callback).toHaveBeenCalled();
    });
  });
});
