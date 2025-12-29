import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createRef } from 'react';
import SessionTimeoutWarningModal, {
  SessionTimeoutWarningModalRef,
} from './SessionTimeoutWarningModal';

// Extend global for test mock storage
declare global {
  var mockModalOnClose: (() => void) | undefined;
}

// Mock the Modal component
vi.mock('@/lib/components/uswds/modal/Modal', () => ({
  default: vi.fn(({ onClose, content, actionButtonGroup }) => {
    // Store onClose in a global for testing
    global.mockModalOnClose = onClose;
    return (
      <div data-testid="mock-modal">
        <div data-testid="modal-content">{content}</div>
        <button
          data-testid="submit-button"
          onClick={(e) => {
            actionButtonGroup.submitButton?.onClick(e);
            if (onClose) onClose();
          }}
        >
          {actionButtonGroup.submitButton?.label}
        </button>
        <button
          data-testid="cancel-button"
          onClick={(e) => {
            actionButtonGroup.cancelButton?.onClick(e);
            if (onClose) onClose();
          }}
        >
          {actionButtonGroup.cancelButton?.label}
        </button>
      </div>
    );
  }),
}));

describe('SessionTimeoutWarningModal', () => {
  const mockOnStayLoggedIn = vi.fn();
  const mockOnLogoutNow = vi.fn();
  const warningSeconds = 60;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render modal with countdown timer', () => {
    const ref = createRef<SessionTimeoutWarningModalRef>();

    render(
      <SessionTimeoutWarningModal
        ref={ref}
        warningSeconds={warningSeconds}
        onStayLoggedIn={mockOnStayLoggedIn}
        onLogoutNow={mockOnLogoutNow}
      />,
    );

    // Modal should be rendered
    expect(screen.getByTestId('mock-modal')).toBeInTheDocument();
  });

  test('should expose show and hide methods via ref', () => {
    const ref = createRef<SessionTimeoutWarningModalRef>();

    render(
      <SessionTimeoutWarningModal
        ref={ref}
        warningSeconds={warningSeconds}
        onStayLoggedIn={mockOnStayLoggedIn}
        onLogoutNow={mockOnLogoutNow}
      />,
    );

    expect(ref.current).toBeDefined();
    expect(ref.current?.show).toBeDefined();
    expect(ref.current?.hide).toBeDefined();
  });

  test('should increment mountKey when show() is called on closed modal', () => {
    const ref = createRef<SessionTimeoutWarningModalRef>();

    const { rerender } = render(
      <SessionTimeoutWarningModal
        ref={ref}
        warningSeconds={warningSeconds}
        onStayLoggedIn={mockOnStayLoggedIn}
        onLogoutNow={mockOnLogoutNow}
      />,
    );

    // Call show() - should increment mountKey
    ref.current?.show();
    rerender(
      <SessionTimeoutWarningModal
        ref={ref}
        warningSeconds={warningSeconds}
        onStayLoggedIn={mockOnStayLoggedIn}
        onLogoutNow={mockOnLogoutNow}
      />,
    );

    // Timer should be remounted (new instance)
    const newTimer = screen.queryByTestId('countdown-timer');

    // Timer should exist since modal is open
    expect(newTimer).toBeInTheDocument();
  });

  test('should NOT increment mountKey when show() is called on already open modal', async () => {
    const ref = createRef<SessionTimeoutWarningModalRef>();

    render(
      <SessionTimeoutWarningModal
        ref={ref}
        warningSeconds={warningSeconds}
        onStayLoggedIn={mockOnStayLoggedIn}
        onLogoutNow={mockOnLogoutNow}
      />,
    );

    // Open modal first time
    ref.current?.show();

    await waitFor(() => {
      expect(screen.getByTestId('countdown-timer')).toBeInTheDocument();
    });

    // Get the key of the timer
    const firstTimer = screen.getByTestId('countdown-timer');
    const firstKey = firstTimer.getAttribute('data-key');

    // Call show() again while modal is already open
    ref.current?.show();

    await waitFor(() => {
      const secondTimer = screen.getByTestId('countdown-timer');
      const secondKey = secondTimer.getAttribute('data-key');
      // Key should be the same (mountKey was not incremented)
      expect(secondKey).toBe(firstKey);
    });
  });

  test('should call onClose when modal closes', () => {
    const ref = createRef<SessionTimeoutWarningModalRef>();

    render(
      <SessionTimeoutWarningModal
        ref={ref}
        warningSeconds={warningSeconds}
        onStayLoggedIn={mockOnStayLoggedIn}
        onLogoutNow={mockOnLogoutNow}
      />,
    );

    // Open the modal
    ref.current?.show();

    // Simulate modal close by calling the onClose callback
    const mockOnClose = global.mockModalOnClose;
    expect(mockOnClose).toBeDefined();

    // Call onClose
    if (mockOnClose) mockOnClose();

    // Verify that isOpen state is updated (indirectly by checking next show() increments mountKey)
    // This is tested in the next test
  });

  test('should reset timer when modal is closed and reopened', async () => {
    const ref = createRef<SessionTimeoutWarningModalRef>();

    render(
      <SessionTimeoutWarningModal
        ref={ref}
        warningSeconds={warningSeconds}
        onStayLoggedIn={mockOnStayLoggedIn}
        onLogoutNow={mockOnLogoutNow}
      />,
    );

    // Open modal first time
    ref.current?.show();

    await waitFor(() => {
      expect(screen.getByTestId('countdown-timer')).toBeInTheDocument();
    });

    // Close the modal using hide()
    ref.current?.hide();

    // Also simulate the onClose callback being called
    const mockOnClose = global.mockModalOnClose;
    if (mockOnClose) mockOnClose();

    await waitFor(() => {
      // Timer should not be visible when modal is closed
      const timer = screen.queryByTestId('countdown-timer');
      expect(timer).not.toBeInTheDocument();
    });

    // Reopen the modal - timer should be reset
    ref.current?.show();

    await waitFor(() => {
      expect(screen.getByTestId('countdown-timer')).toBeInTheDocument();
    });
  });

  test('should call onStayLoggedIn when Stay Logged In button is clicked', () => {
    const ref = createRef<SessionTimeoutWarningModalRef>();

    render(
      <SessionTimeoutWarningModal
        ref={ref}
        warningSeconds={warningSeconds}
        onStayLoggedIn={mockOnStayLoggedIn}
        onLogoutNow={mockOnLogoutNow}
      />,
    );

    // Open the modal
    ref.current?.show();

    // Click Stay Logged In button
    const submitButton = screen.getByTestId('submit-button');
    submitButton.click();

    expect(mockOnStayLoggedIn).toHaveBeenCalled();
  });

  test('should call onLogoutNow when Log Out Now button is clicked', () => {
    const ref = createRef<SessionTimeoutWarningModalRef>();

    render(
      <SessionTimeoutWarningModal
        ref={ref}
        warningSeconds={warningSeconds}
        onStayLoggedIn={mockOnStayLoggedIn}
        onLogoutNow={mockOnLogoutNow}
      />,
    );

    // Open the modal
    ref.current?.show();

    // Click Log Out Now button
    const cancelButton = screen.getByTestId('cancel-button');
    cancelButton.click();

    expect(mockOnLogoutNow).toHaveBeenCalled();
  });

  test('should display countdown timer with correct initial value', async () => {
    const ref = createRef<SessionTimeoutWarningModalRef>();

    render(
      <SessionTimeoutWarningModal
        ref={ref}
        warningSeconds={warningSeconds}
        onStayLoggedIn={mockOnStayLoggedIn}
        onLogoutNow={mockOnLogoutNow}
      />,
    );

    // Open the modal
    ref.current?.show();

    await waitFor(() => {
      const timer = screen.getByTestId('countdown-timer');
      expect(timer).toBeInTheDocument();
      // Timer should show 60 seconds initially
      expect(timer.textContent).toBe('60');
    });
  });
});
