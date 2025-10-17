import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TrusteeAttorneyAssignmentModal from './TrusteeAttorneyAssignmentModal';
import useApi2 from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { AttorneyUser } from '@common/cams/users';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { CamsRole, OversightRole } from '@common/cams/roles';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { TrusteeAttorneyAssignmentModalRef } from './TrusteeAttorneyAssignmentModal';

vi.mock('@/lib/hooks/UseApi2');
vi.mock('@/lib/hooks/UseGlobalAlert');

vi.mock('@/lib/components/combobox/ComboBox', () => {
  return {
    default: ({
      onUpdateSelection,
      options = [],
    }: {
      onUpdateSelection?: (options: ComboOption[]) => void;
      options?: Array<{ value: string; label: string }>;
    }) => (
      <select
        data-testid="mock-combobox"
        onChange={(e) => {
          if (onUpdateSelection) {
            if (e.target.value) {
              const selectedOption = options.find((opt) => opt.value === e.target.value);
              if (selectedOption) {
                onUpdateSelection([{ value: selectedOption.value, label: selectedOption.label }]);
              }
            } else {
              onUpdateSelection([]);
            }
          }
        }}
      >
        <option value="">Select an attorney</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});

describe('TrusteeAttorneyAssignmentModal', () => {
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
    role: OversightRole.OversightAttorney,
    createdBy: { id: 'user-1', name: 'Admin User' },
    createdOn: '2023-01-01T00:00:00Z',
    updatedBy: { id: 'user-1', name: 'Admin User' },
    updatedOn: '2023-01-01T00:00:00Z',
  };

  const mockApiMethods = {
    getAttorneys: vi.fn().mockResolvedValue({ data: mockAttorneys }),
    createTrusteeOversightAssignment: vi.fn().mockResolvedValue({ data: mockAssignment }),
  };

  const mockGlobalAlert = {
    success: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useApi2 as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockApiMethods);
    (useGlobalAlert as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockGlobalAlert);
  });

  test('should render modal with correct structure', () => {
    const onAssignmentCreated = vi.fn();

    render(
      <TrusteeAttorneyAssignmentModal
        modalId="test-modal"
        trusteeId="trustee-123"
        onAssignmentCreated={onAssignmentCreated}
      />,
    );

    // Modal should exist in the DOM (initially hidden)
    expect(screen.getByTestId('modal-test-modal')).toBeInTheDocument();
  });

  test('should load staff when modal opens', async () => {
    const onAssignmentCreated = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    render(
      <TrusteeAttorneyAssignmentModal
        modalId="test-modal"
        trusteeId="trustee-123"
        onAssignmentCreated={onAssignmentCreated}
        ref={ref}
      />,
    );

    // Simulate opening the modal
    ref.current!.show();

    // Check that the API was called to load staff
    await waitFor(() => {
      expect(mockApiMethods.getAttorneys).toHaveBeenCalledTimes(1);
    });
  });

  test('should display ComboBox for attorney selection', async () => {
    const onAssignmentCreated = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    render(
      <TrusteeAttorneyAssignmentModal
        modalId="test-modal"
        trusteeId="trustee-123"
        onAssignmentCreated={onAssignmentCreated}
        ref={ref}
      />,
    );

    // Open modal and wait for loading
    ref.current!.show();
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    // Should display the ComboBox
    expect(screen.getByTestId('mock-combobox')).toBeInTheDocument();
  });

  test('should enable submit button when attorney is selected', async () => {
    const onAssignmentCreated = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    render(
      <TrusteeAttorneyAssignmentModal
        modalId="test-modal"
        trusteeId="trustee-123"
        onAssignmentCreated={onAssignmentCreated}
        ref={ref}
      />,
    );

    // Open modal and wait for loading and the combobox to appear
    ref.current!.show();
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());
    await screen.findByTestId('mock-combobox');

    // Initially, submit button should be disabled
    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    expect(submitButton).toBeDisabled();

    // Select an attorney (use userEvent.selectOptions to ensure proper event flow)
    const comboBox = screen.getByTestId('mock-combobox') as HTMLSelectElement;
    await userEvent.selectOptions(comboBox, mockAttorneys[0].id);

    // Submit button should now be enabled
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  test('should successfully assign attorney', async () => {
    const onAssignmentCreated = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    render(
      <TrusteeAttorneyAssignmentModal
        modalId="test-modal"
        trusteeId="trustee-123"
        onAssignmentCreated={onAssignmentCreated}
        ref={ref}
      />,
    );

    // Open modal and wait for loading
    ref.current!.show();
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    // Select an attorney
    const comboBox = screen.getByTestId('mock-combobox');
    fireEvent.change(comboBox, { target: { value: mockAttorneys[0].id } });

    // Click submit button
    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    fireEvent.click(submitButton);

    // Verify API call and success handling
    await waitFor(() => {
      expect(mockApiMethods.createTrusteeOversightAssignment).toHaveBeenCalledWith(
        'trustee-123',
        'attorney-1',
      );
    });

    expect(mockGlobalAlert.success).toHaveBeenCalledWith('Attorney assigned successfully');
    expect(onAssignmentCreated).toHaveBeenCalledWith(mockAssignment);
  });

  test('should handle assignment error', async () => {
    const errorMessage = 'Failed to assign attorney';
    mockApiMethods.createTrusteeOversightAssignment.mockRejectedValueOnce(new Error(errorMessage));

    const onAssignmentCreated = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    render(
      <TrusteeAttorneyAssignmentModal
        modalId="test-modal"
        trusteeId="trustee-123"
        onAssignmentCreated={onAssignmentCreated}
        ref={ref}
      />,
    );

    // Open modal and make selection
    ref.current!.show();
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    const comboBox = screen.getByTestId('mock-combobox');
    fireEvent.change(comboBox, { target: { value: mockAttorneys[0].id } });

    // Click submit - it should fail
    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    fireEvent.click(submitButton);

    // Verify error handling
    await waitFor(() => {
      expect(mockGlobalAlert.error).toHaveBeenCalledWith(errorMessage);
      expect(onAssignmentCreated).not.toHaveBeenCalled();
    });
  });

  test('should handle loading error', async () => {
    mockApiMethods.getAttorneys.mockRejectedValueOnce(new Error('API Error'));

    const onAssignmentCreated = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    render(
      <TrusteeAttorneyAssignmentModal
        modalId="test-modal"
        trusteeId="trustee-123"
        onAssignmentCreated={onAssignmentCreated}
        ref={ref}
      />,
    );

    // Open modal - should trigger error
    ref.current!.show();

    // Should display error message
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByTestId('alert')).toHaveTextContent('Failed to load attorneys');
    });
  });

  test('should hide modal and reset selected attorney when hide is called', async () => {
    const onAssignmentCreated = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    render(
      <TrusteeAttorneyAssignmentModal
        modalId="test-modal"
        trusteeId="trustee-123"
        onAssignmentCreated={onAssignmentCreated}
        ref={ref}
      />,
    );

    // Open modal and select an attorney
    ref.current!.show();
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    const comboBox = screen.getByTestId('mock-combobox');
    fireEvent.change(comboBox, { target: { value: mockAttorneys[0].id } });

    // Hide the modal
    ref.current!.hide();

    // Verify selectedAttorney is reset - we can check this indirectly by
    // checking that the submit button becomes disabled
    await waitFor(() => {
      const submitButton = screen.getByTestId('button-test-modal-submit-button');
      expect(submitButton).toBeDisabled();
    });
  });

  test('should not call API when trying to assign with no attorney selected', async () => {
    const onAssignmentCreated = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    render(
      <TrusteeAttorneyAssignmentModal
        modalId="test-modal"
        trusteeId="trustee-123"
        onAssignmentCreated={onAssignmentCreated}
        ref={ref}
      />,
    );

    // Open modal and wait for loading
    ref.current!.show();
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    // Select an attorney first
    const comboBox = screen.getByTestId('mock-combobox');
    fireEvent.change(comboBox, { target: { value: mockAttorneys[0].id } });

    // Now clear the selection to make selectedAttorney null
    fireEvent.change(comboBox, { target: { value: '' } });

    // Reset mock to track only assignment calls
    mockApiMethods.createTrusteeOversightAssignment.mockClear();

    // Force clicking the disabled button to test the early return
    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    submitButton.removeAttribute('disabled');
    fireEvent.click(submitButton);

    // Verify that the API was not called due to early return
    expect(mockApiMethods.createTrusteeOversightAssignment).not.toHaveBeenCalled();
    expect(onAssignmentCreated).not.toHaveBeenCalled();
  });

  test('should show loading spinner while fetching staff', async () => {
    // Make the API call take longer to see loading state
    let resolvePromise!: (value: { data: AttorneyUser[] }) => void;
    const loadingPromise = new Promise<{ data: AttorneyUser[] }>((resolve) => {
      resolvePromise = resolve;
    });
    mockApiMethods.getAttorneys.mockReturnValueOnce(loadingPromise);

    const onAssignmentCreated = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    render(
      <TrusteeAttorneyAssignmentModal
        modalId="test-modal"
        trusteeId="trustee-123"
        onAssignmentCreated={onAssignmentCreated}
        ref={ref}
      />,
    );

    // Open modal to trigger loading
    ref.current!.show();

    // Should show loading spinner
    await waitFor(() => {
      expect(screen.getByText('Loading attorneys...')).toBeInTheDocument();
    });

    // Resolve the promise to complete loading
    resolvePromise({ data: mockAttorneys });

    // Wait for loading to complete and ComboBox to appear
    await waitFor(() => {
      expect(screen.getByTestId('mock-combobox')).toBeInTheDocument();
    });
  });

  test('should clear selected attorney when ComboBox selection is cleared', async () => {
    const onAssignmentCreated = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    render(
      <TrusteeAttorneyAssignmentModal
        modalId="test-modal"
        trusteeId="trustee-123"
        onAssignmentCreated={onAssignmentCreated}
        ref={ref}
      />,
    );

    // Open modal and wait for loading
    ref.current!.show();
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    const comboBox = screen.getByTestId('mock-combobox');

    // First, select an attorney
    fireEvent.change(comboBox, { target: { value: mockAttorneys[0].id } });

    // Verify submit button is enabled
    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    // Now clear the selection (empty value)
    fireEvent.change(comboBox, { target: { value: '' } });

    // Verify submit button is disabled again
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });
});
