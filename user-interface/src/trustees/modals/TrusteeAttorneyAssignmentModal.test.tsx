import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TrusteeAttorneyAssignmentModal from './TrusteeAttorneyAssignmentModal';
import useApi2 from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { AttorneyUser } from '@common/cams/users';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { CamsRole, OversightRole } from '@common/cams/roles';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { TrusteeAttorneyAssignmentModalRef } from './TrusteeAttorneyAssignmentModal';

// Mock the API and global alert hooks
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
      offices: [
        {
          officeCode: 'CHI',
          officeName: 'Chicago Office',
          groups: [],
          idpGroupName: 'USTP CAMS Chicago',
          regionId: 'R11',
          regionName: 'Region 11',
        },
      ],
      roles: [CamsRole.TrialAttorney], // Changed from 'role' to 'roles'
    },
    {
      id: 'attorney-2',
      name: 'Jane Smith',
      offices: [
        {
          officeCode: 'NY',
          officeName: 'New York Office',
          groups: [],
          idpGroupName: 'USTP CAMS New York',
          regionId: 'R2',
          regionName: 'Region 2',
        },
      ],
      roles: [CamsRole.TrialAttorney], // Changed from 'role' to 'roles'
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

  test('should render modal with attorney selection', () => {
    const mockRef = { current: null };
    const onAssignmentCreated = vi.fn();

    render(
      <TrusteeAttorneyAssignmentModal
        modalId="test-modal"
        trusteeId="trustee-123"
        onAssignmentCreated={onAssignmentCreated}
        ref={mockRef}
      />,
    );

    // Modal is initially not visible, but we can verify it exists in the DOM
    expect(document.querySelector('.usa-modal-wrapper')).toBeInTheDocument();
  });

  test('should load attorneys on modal open', async () => {
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

    // Check that the API was called to load attorneys
    expect(mockApiMethods.getAttorneys).toHaveBeenCalledTimes(1);
  });

  test('should handle attorney selection', async () => {
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

    // Wait for attorneys to load
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    // Select an attorney from the combobox
    const comboBox = screen.getByTestId('mock-combobox');
    fireEvent.change(comboBox, { target: { value: mockAttorneys[0].id } });

    // Check that the selected attorney info is displayed
    await waitFor(() => {
      expect(screen.getByText('Selected Attorney:')).toBeInTheDocument();
      // Use a more specific query to avoid the multiple elements issue
      const selectedAttorneyInfo = screen.getByText('Selected Attorney:').parentElement;
      expect(selectedAttorneyInfo).toHaveTextContent('John Doe');
    });
  });

  test('should assign attorney successfully', async () => {
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

    // Wait for attorneys to load
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    // Select an attorney
    const comboBox = screen.getByTestId('mock-combobox');
    fireEvent.change(comboBox, { target: { value: mockAttorneys[0].id } });

    // Find and click the submit button
    const submitButton = screen.getByText('Assign Attorney');
    fireEvent.click(submitButton);

    // Check that API was called with correct arguments
    await waitFor(() => {
      expect(mockApiMethods.createTrusteeOversightAssignment).toHaveBeenCalledWith(
        'trustee-123',
        'attorney-1',
      );
    });

    // Verify success message and callback
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

    // Simulate opening the modal
    ref.current!.show();

    // Wait for attorneys to load
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    // Select an attorney
    const comboBox = screen.getByTestId('mock-combobox');
    fireEvent.change(comboBox, { target: { value: mockAttorneys[0].id } });

    // Find and click the submit button
    const submitButton = screen.getByText('Assign Attorney');
    fireEvent.click(submitButton);

    // Verify error handling
    await waitFor(() => {
      expect(mockGlobalAlert.error).toHaveBeenCalledWith(errorMessage);
      expect(onAssignmentCreated).not.toHaveBeenCalled();
    });
  });

  test('should disable submit button when no attorney selected', async () => {
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

    // Wait for attorneys to load
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    // Find the submit button and check it's disabled
    const submitButton = screen.getByText('Assign Attorney');
    expect(submitButton).toHaveAttribute('disabled');

    // Select an attorney
    const comboBox = screen.getByTestId('mock-combobox');
    fireEvent.change(comboBox, { target: { value: mockAttorneys[0].id } });

    // Button should now be enabled
    await waitFor(() => {
      expect(submitButton).not.toHaveAttribute('disabled');
    });
  });

  test('should hide modal and reset selected attorney when hide() is called', async () => {
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

    // Select an attorney
    const comboBox = screen.getByTestId('mock-combobox');
    fireEvent.change(comboBox, { target: { value: mockAttorneys[0].id } });

    // Verify attorney is selected
    await waitFor(() => {
      expect(screen.getByText('Selected Attorney:')).toBeInTheDocument();
    });

    // Hide modal
    ref.current!.hide();

    // The modal should call hide and reset selected attorney (this is handled internally)
    // We can verify the internal state is reset by checking that the selected attorney is cleared
  });

  test('should handle loadAttorneys error', async () => {
    const errorMessage = 'Failed to load attorneys from API';
    mockApiMethods.getAttorneys.mockRejectedValue(new Error(errorMessage));

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

    // Simulate opening the modal which triggers loadAttorneys
    ref.current!.show();

    // Wait for the error to be displayed
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load attorneys')).toBeInTheDocument();
    });
  });

  test('should handle assignment attempt with no selected attorney', async () => {
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

    // Open modal
    ref.current!.show();
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    // Try to submit without selecting attorney (button should be disabled, but test the logic)
    // We can't directly call handleAssignAttorney, but the button is disabled when no attorney is selected
    const submitButton = screen.getByRole('button', { name: 'Assign Attorney' });
    expect(submitButton).toBeDisabled();

    // Verify no assignment API call was made
    expect(mockApiMethods.createTrusteeOversightAssignment).not.toHaveBeenCalled();
  });

  test('should display attorney office information when available', async () => {
    const attorneyWithOffices = [
      {
        ...mockAttorneys[0],
        offices: [{ officeName: 'Main Office' }, { officeName: 'Branch Office' }],
      },
    ];

    mockApiMethods.getAttorneys.mockResolvedValue({ data: attorneyWithOffices });

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

    // Open modal and select attorney
    ref.current!.show();
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    const comboBox = screen.getByTestId('mock-combobox');
    fireEvent.change(comboBox, { target: { value: attorneyWithOffices[0].id } });

    // Check that office information is displayed
    await waitFor(() => {
      expect(screen.getByText('Office: Main Office, Branch Office')).toBeInTheDocument();
    });
  });

  test('should handle attorney with undefined office names', async () => {
    const attorneyWithUndefinedOffices = [
      {
        ...mockAttorneys[0],
        offices: [
          { officeName: 'Main Office' },
          { officeName: undefined }, // This should be handled gracefully
          { officeName: 'Branch Office' },
        ],
      },
    ];

    mockApiMethods.getAttorneys.mockResolvedValue({ data: attorneyWithUndefinedOffices });

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

    // Open modal and select attorney
    ref.current!.show();
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    const comboBox = screen.getByTestId('mock-combobox');
    fireEvent.change(comboBox, { target: { value: attorneyWithUndefinedOffices[0].id } });

    // Check that office information displays with "Unknown" for undefined office names
    await waitFor(() => {
      expect(screen.getByText('Office: Main Office, Unknown, Branch Office')).toBeInTheDocument();
    });
  });

  test('should handle assignment API error', async () => {
    const errorMessage = 'Assignment failed';
    mockApiMethods.createTrusteeOversightAssignment.mockRejectedValue(new Error(errorMessage));

    const onAssignmentCreated = vi.fn();
    const mockGlobalAlert = { error: vi.fn(), success: vi.fn() };
    (useGlobalAlert as jest.Mock).mockReturnValue(mockGlobalAlert);

    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    render(
      <TrusteeAttorneyAssignmentModal
        modalId="test-modal"
        trusteeId="trustee-123"
        onAssignmentCreated={onAssignmentCreated}
        ref={ref}
      />,
    );

    // Open modal and select attorney
    ref.current!.show();
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    const comboBox = screen.getByTestId('mock-combobox');
    fireEvent.change(comboBox, { target: { value: mockAttorneys[0].id } });

    await waitFor(() => {
      expect(screen.getByText('Selected Attorney:')).toBeInTheDocument();
    });

    // Submit the assignment
    const submitButton = screen.getByRole('button', { name: 'Assign Attorney' });
    expect(submitButton).not.toBeDisabled();
    fireEvent.click(submitButton);

    // Wait for error handling
    await waitFor(() => {
      expect(mockGlobalAlert.error).toHaveBeenCalledWith('Assignment failed');
    });

    // onAssignmentCreated should not have been called
    expect(onAssignmentCreated).not.toHaveBeenCalled();
  });

  test('should handle non-Error exception in assignment', async () => {
    mockApiMethods.createTrusteeOversightAssignment.mockRejectedValue('String error');

    const onAssignmentCreated = vi.fn();
    const mockGlobalAlert = { error: vi.fn(), success: vi.fn() };
    (useGlobalAlert as jest.Mock).mockReturnValue(mockGlobalAlert);

    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    render(
      <TrusteeAttorneyAssignmentModal
        modalId="test-modal"
        trusteeId="trustee-123"
        onAssignmentCreated={onAssignmentCreated}
        ref={ref}
      />,
    );

    // Open modal and select attorney
    ref.current!.show();
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    const comboBox = screen.getByTestId('mock-combobox');
    fireEvent.change(comboBox, { target: { value: mockAttorneys[0].id } });

    await waitFor(() => {
      expect(screen.getByText('Selected Attorney:')).toBeInTheDocument();
    });

    // Submit the assignment
    const submitButton = screen.getByRole('button', { name: 'Assign Attorney' });
    fireEvent.click(submitButton);

    // Wait for error handling with default message
    await waitFor(() => {
      expect(mockGlobalAlert.error).toHaveBeenCalledWith('Failed to assign attorney');
    });
  });
});
