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
    default: ({ onUpdateSelection }: { onUpdateSelection?: (options: ComboOption[]) => void }) => (
      <select
        data-testid="mock-combobox"
        onChange={(e) => {
          if (onUpdateSelection && e.target.value) {
            const attorney = JSON.parse(e.target.value);
            onUpdateSelection([{ value: attorney.id, label: attorney.name }]);
          } else if (onUpdateSelection) {
            onUpdateSelection([]);
          }
        }}
      >
        <option value="">Select an attorney</option>
        <option value='{"id":"attorney-1","name":"John Doe"}'>John Doe</option>
        <option value='{"id":"attorney-2","name":"Jane Smith"}'>Jane Smith</option>
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
    role: OversightRole.TrialAttorney,
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
    fireEvent.change(comboBox, { target: { value: JSON.stringify(mockAttorneys[0]) } });

    // Check that the selected attorney info is displayed
    await waitFor(() => {
      expect(screen.getByText('Selected Attorney:')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
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
    fireEvent.change(comboBox, { target: { value: JSON.stringify(mockAttorneys[0]) } });

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
    fireEvent.change(comboBox, { target: { value: JSON.stringify(mockAttorneys[0]) } });

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
    fireEvent.change(comboBox, { target: { value: JSON.stringify(mockAttorneys[0]) } });

    // Button should now be enabled
    await waitFor(() => {
      expect(submitButton).not.toHaveAttribute('disabled');
    });
  });
});
