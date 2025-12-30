import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createRef } from 'react';
import SessionTimeoutWarningModal, {
  SessionTimeoutWarningModalRef,
} from './SessionTimeoutWarningModal';

// Mock the Modal component
vi.mock('@/lib/components/uswds/modal/Modal', () => ({
  default: vi.fn(({ content, actionButtonGroup }) => {
    return (
      <div data-testid="mock-modal">
        <div data-testid="modal-content">{content}</div>
        <button
          data-testid="submit-button"
          onClick={(e) => {
            actionButtonGroup.submitButton?.onClick(e);
          }}
        >
          {actionButtonGroup.submitButton?.label}
        </button>
        <button
          data-testid="cancel-button"
          onClick={(e) => {
            actionButtonGroup.cancelButton?.onClick(e);
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

  test('should show timer when show() is called', async () => {
    const ref = createRef<SessionTimeoutWarningModalRef>();

    render(
      <SessionTimeoutWarningModal
        ref={ref}
        warningSeconds={warningSeconds}
        onStayLoggedIn={mockOnStayLoggedIn}
        onLogoutNow={mockOnLogoutNow}
      />,
    );

    // Call show() - should render timer
    ref.current?.show();

    await waitFor(() => {
      const timer = screen.queryByTestId('countdown-timer');
      expect(timer).toBeInTheDocument();
    });
  });

  test('should reset timer when show() is called multiple times', async () => {
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
      const timer = screen.getByTestId('countdown-timer');
      expect(timer).toBeInTheDocument();
      // Timer should show initial value
      expect(timer.textContent).toBe('60');
    });

    // Call show() again - timer should reset to initial value
    ref.current?.show();

    await waitFor(() => {
      const timer = screen.getByTestId('countdown-timer');
      // Timer should be reset to initial value
      expect(timer.textContent).toBe('60');
    });
  });

  test('should reset timer when modal is reopened', async () => {
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
      const timer = screen.getByTestId('countdown-timer');
      expect(timer).toBeInTheDocument();
      // Timer should show initial value
      expect(timer.textContent).toBe('60');
    });

    // Close the modal using hide()
    ref.current?.hide();

    // Reopen the modal - timer should be reset
    ref.current?.show();

    await waitFor(() => {
      const timer = screen.getByTestId('countdown-timer');
      expect(timer).toBeInTheDocument();
      // Timer should be reset to initial value
      expect(timer.textContent).toBe('60');
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
