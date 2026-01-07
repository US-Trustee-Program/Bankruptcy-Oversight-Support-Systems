import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TrusteeAttorneyAssignmentModal from './TrusteeAttorneyAssignmentModal';
import Api2 from '@/lib/models/api2';
import * as UseGlobalAlertModule from '@/lib/hooks/UseGlobalAlert';
import { AttorneyUser } from '@common/cams/users';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { CamsRole } from '@common/cams/roles';
import { TrusteeAttorneyAssignmentModalRef } from './TrusteeAttorneyAssignmentModal';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

describe('TrusteeAttorneyAssignmentModal', () => {
  let userEvent: CamsUserEvent;

  const defaultProps = {
    modalId: 'test-modal',
    trusteeId: 'trustee-123',
  } as const;

  function renderWithProps(
    props?: Partial<{
      onAssignment: (flag: boolean) => void;
      attorneys: AttorneyUser[];
      currentAssignment?: TrusteeOversightAssignment;
      ref?: React.RefObject<TrusteeAttorneyAssignmentModalRef | null> | undefined;
    }>,
  ) {
    const onAssignment = props?.onAssignment ?? vi.fn();
    const attorneys = props?.attorneys ?? mockAttorneys;
    const currentAssignment = props?.currentAssignment;
    const ref = props?.ref ?? undefined;

    render(
      <TrusteeAttorneyAssignmentModal
        modalId={defaultProps.modalId}
        trusteeId={defaultProps.trusteeId}
        attorneys={attorneys}
        currentAssignment={currentAssignment}
        onAssignment={onAssignment}
        ref={ref}
      />,
    );

    return { onAssignment, ref } as {
      onAssignment: typeof onAssignment;
      ref: React.RefObject<TrusteeAttorneyAssignmentModalRef | null> | undefined;
    };
  }

  const mockAttorneys: AttorneyUser[] = [
    {
      id: 'attorney-1',
      name: 'John Doe',
      offices: [],
      roles: [CamsRole.TrialAttorney],
    },
    {
      id: 'attorney-2',
      name: 'Jane Smith',
      offices: [],
      roles: [CamsRole.TrialAttorney],
    },
  ];

  const mockAssignment: TrusteeOversightAssignment = {
    id: 'assignment-1',
    trusteeId: 'trustee-123',
    user: {
      id: 'attorney-1',
      name: 'John Doe',
    },
    role: CamsRole.OversightAttorney,
    createdBy: { id: 'user-1', name: 'Admin User' },
    createdOn: '2023-01-01T00:00:00Z',
    updatedBy: { id: 'user-1', name: 'Admin User' },
    updatedOn: '2023-01-01T00:00:00Z',
  };

  const mockGlobalAlert = {
    show: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  };

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
    vi.restoreAllMocks();
    vi.spyOn(Api2, 'createTrusteeOversightAssignment').mockResolvedValue({
      data: mockAssignment,
    });
    vi.spyOn(UseGlobalAlertModule, 'useGlobalAlert').mockReturnValue(mockGlobalAlert);
  });

  test('should render modal with correct structure', () => {
    const onAssignment = vi.fn();

    renderWithProps({ onAssignment });

    expect(screen.getByTestId('modal-test-modal')).toBeInTheDocument();
  });

  test('should display ComboBox for attorney selection', async () => {
    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());

    await waitFor(() => {
      expect(document.querySelector('#attorney-search')).toBeInTheDocument();
    });
  });

  test('should enable submit button when attorney is selected', async () => {
    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());

    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    expect(submitButton).toBeDisabled();

    await TestingUtilities.toggleComboBoxItemSelection('attorney-search', 0);

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  test('should successfully assign attorney', async () => {
    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());

    await TestingUtilities.toggleComboBoxItemSelection('attorney-search', 0);

    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(Api2.createTrusteeOversightAssignment).toHaveBeenCalledWith(
        'trustee-123',
        'attorney-1',
        CamsRole.OversightAttorney,
      );
    });

    expect(mockGlobalAlert.success).toHaveBeenCalledWith('Attorney assigned successfully');
    expect(onAssignment).toHaveBeenCalledWith(true);
  });

  test('should handle assignment error', async () => {
    const errorMessage = 'Failed to assign attorney';
    vi.spyOn(Api2, 'createTrusteeOversightAssignment').mockRejectedValueOnce(
      new Error(errorMessage),
    );

    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());

    await TestingUtilities.toggleComboBoxItemSelection('attorney-search', 0);

    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockGlobalAlert.error).toHaveBeenCalledWith(errorMessage);
      expect(onAssignment).not.toHaveBeenCalled();
    });
  });

  test('should not call API when trying to assign with no attorney selected', async () => {
    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());

    await TestingUtilities.toggleComboBoxItemSelection('attorney-search', 0);

    await TestingUtilities.clearComboBoxSelection('attorney-search');

    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    submitButton.removeAttribute('disabled');
    await userEvent.click(submitButton);

    expect(Api2.createTrusteeOversightAssignment).not.toHaveBeenCalled();
    expect(onAssignment).not.toHaveBeenCalled();
  });

  test('should clear selected attorney when ComboBox selection is cleared', async () => {
    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());

    await TestingUtilities.toggleComboBoxItemSelection('attorney-search', 0);

    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    await TestingUtilities.clearComboBoxSelection('attorney-search');

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  test('should close modal without API call when same attorney is selected as current assignment', async () => {
    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, currentAssignment: mockAssignment, ref });

    act(() => ref.current!.show());

    // Wait for the modal to be visible and the pre-selected attorney to be set
    await waitFor(() => {
      const submitButton = screen.getByTestId('button-test-modal-submit-button');
      expect(submitButton).not.toBeDisabled();
    });

    vi.clearAllMocks();

    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(Api2.createTrusteeOversightAssignment).not.toHaveBeenCalled();
      expect(onAssignment).not.toHaveBeenCalled();
    });
  });

  test('should pre-select attorney when currentAssignment is provided', async () => {
    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, currentAssignment: mockAssignment, ref });

    act(() => ref.current!.show());

    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });
});
